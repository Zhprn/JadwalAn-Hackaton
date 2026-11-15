import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { SchemaType } from '@google/generative-ai';
import prisma from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { getStoreSetting } from '../settings.service';
import { getAgentConfig } from './context';
import { generateJson } from './gemini';
import { writeAiLog } from './log';

/**
 * Copywriter Poster: admin mengunggah flyer/poster → AI (Gemini vision) membaca isi & gaya visualnya,
 * lalu membuat 1 caption "langsung ke promo" siap posting + hashtag + saran waktu posting.
 * Hasil disimpan sebagai AiInsight (type "poster_caption") supaya ada riwayat; gambar disimpan di /uploads/posters.
 */

export const PLATFORMS = ['instagram', 'tiktok', 'facebook', 'whatsapp'] as const;
export const CAPTION_TONES = ['friendly', 'hype', 'elegan', 'lucu'] as const;
export type Platform = (typeof PLATFORMS)[number];
export type CaptionTone = (typeof CAPTION_TONES)[number];

export const UPLOAD_ROOT = path.resolve(process.env.UPLOAD_DIR || 'uploads');
const POSTER_DIR = path.join(UPLOAD_ROOT, 'posters');
const MIME_EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
export const ALLOWED_MIME = Object.keys(MIME_EXT);

const PLATFORM_GUIDE: Record<Platform, string> = {
  instagram: 'Instagram feed: hook kuat di baris pertama, 3–6 kalimat pendek dengan jeda baris, emoji secukupnya, 8–15 hashtag relevan (campuran populer & lokal).',
  tiktok: 'TikTok: sangat singkat (1–2 kalimat), gaya ngobrol anak muda, ajak komentar/duet, 4–6 hashtag termasuk tren gaming.',
  facebook: 'Facebook: sedikit lebih panjang & informatif (detail harga, jam, lokasi), bahasa ramah untuk semua umur, 3–5 hashtag.',
  whatsapp: 'Status/broadcast WhatsApp: 2–4 kalimat padat, langsung ke inti promo + cara booking, tanpa hashtag (kosongkan hashtags).',
};
const TONE_GUIDE: Record<CaptionTone, string> = {
  friendly: 'hangat dan bersahabat',
  hype: 'heboh, energik, bikin FOMO (tetap sopan)',
  elegan: 'rapi, premium, tidak alay',
  lucu: 'lucu dan relate dengan gamer, boleh plesetan ringan',
};

const POSTER_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    analysis: {
      type: SchemaType.OBJECT,
      properties: {
        poster_type: { type: SchemaType.STRING, description: 'promo | event/turnamen | menu/harga | pengumuman | branding | lainnya' },
        headline: { type: SchemaType.STRING, description: 'Inti pesan poster dalam ≤ 8 kata' },
        summary: { type: SchemaType.STRING, description: '1–2 kalimat isi poster' },
        detected_text: { type: SchemaType.STRING, description: 'Teks penting yang terbaca di poster (harga, tanggal, kode promo, kontak)' },
        key_points: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '2–5 info kunci' },
        visual_style: { type: SchemaType.STRING, description: 'Gaya visual & warna dominan, singkat' },
        target_audience: { type: SchemaType.STRING },
        missing_info: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Info penting yang tidak ada di poster (mis. jam, lokasi, cara booking)' },
      },
      required: ['poster_type', 'headline', 'summary', 'detected_text', 'key_points', 'visual_style', 'target_audience', 'missing_info'],
    },
    captions: {
      type: SchemaType.ARRAY,
      description: 'Tepat 1 caption dengan pendekatan "Langsung ke promo"',
      items: {
        type: SchemaType.OBJECT,
        properties: {
          angle: { type: SchemaType.STRING, description: 'Selalu "Langsung ke promo"' },
          caption: { type: SchemaType.STRING, description: 'Caption lengkap siap posting (tanpa hashtag)' },
          hashtags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: 'Tanpa spasi, diawali #' },
          cta: { type: SchemaType.STRING, description: 'Ajakan bertindak singkat' },
        },
        required: ['angle', 'caption', 'hashtags', 'cta'],
      },
    },
    best_time: { type: SchemaType.STRING, description: 'Saran hari & jam posting + alasan singkat' },
    poster_tips: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '1–3 saran perbaikan desain/isi poster' },
  },
  required: ['analysis', 'captions', 'best_time', 'poster_tips'],
};

type PosterAnalysis = {
  poster_type: string;
  headline: string;
  summary: string;
  detected_text: string;
  key_points: string[];
  visual_style: string;
  target_audience: string;
  missing_info: string[];
};
type CaptionVariant = { angle: string; caption: string; hashtags: string[]; cta: string };
type PosterResult = { analysis: PosterAnalysis; captions: CaptionVariant[]; best_time: string; poster_tips: string[] };

export type PosterCaptionRecord = PosterResult & {
  id: string;
  platform: Platform;
  tone: CaptionTone;
  notes: string | null;
  imageUrl: string;
  model: string;
  createdAt: Date;
};

const toRecord = (row: { id: string; data: unknown; createdAt: Date }): PosterCaptionRecord => {
  const d = (row.data ?? {}) as Omit<PosterCaptionRecord, 'id' | 'createdAt'>;
  return { ...d, id: row.id, createdAt: row.createdAt };
};

/** Simpan file gambar poster → path publik relatif (/uploads/posters/xxx.jpg). */
export const savePosterImage = async (buffer: Buffer, mimeType: string) => {
  const ext = MIME_EXT[mimeType];
  if (!ext) throw badRequest('Format gambar harus JPG, PNG, atau WebP');
  await fs.mkdir(POSTER_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(POSTER_DIR, name), buffer);
  return `/uploads/posters/${name}`;
};

const buildContext = async () => {
  const [setting, promos] = await Promise.all([
    getStoreSetting(),
    prisma.promo.findMany({
      where: { isActive: true, isPublic: true, validUntil: { gte: new Date() } },
      select: { code: true, title: true, description: true },
      take: 5,
    }),
  ]);
  const promoText = promos.length ? promos.map((p) => `${p.code} (${p.title ?? 'promo'}${p.description ? `: ${p.description}` : ''})`).join('; ') : 'tidak ada';
  return `INFO RENTAL (boleh dipakai untuk melengkapi caption):
- Nama: ${setting.name}
- Alamat: ${setting.address ?? '-'}
- Jam buka: ${setting.openTime}–${setting.closeTime} WIB
- Kontak/booking: ${setting.phone ?? 'WhatsApp rental'} atau website Jadwal.an
- Promo aktif: ${promoText}`;
};

/** Analisis poster + buat caption. */
export const generatePosterCaption = async (input: {
  image: Buffer;
  mimeType: string;
  imageUrl: string;
  platform: Platform;
  tone: CaptionTone;
  notes?: string | null;
}): Promise<PosterCaptionRecord> => {
  const t0 = Date.now();
  const config = await getAgentConfig('copywriter');
  if (!config.isActive) throw badRequest('Fitur copywriter AI sedang dinonaktifkan di Pengaturan AI');

  const system = `${config.systemPrompt}
Kamu juga analis konten visual. Baca poster/flyer yang diunggah dengan teliti (teks, angka, tanggal, kode promo, gaya visual).
ATURAN:
- Jangan mengarang harga, tanggal, atau kode promo yang tidak ada di poster/INFO RENTAL.
- Bahasa Indonesia, sesuaikan dengan platform & gaya yang diminta.
- Buat TEPAT 1 caption dengan pendekatan "Langsung ke promo": langsung sebut promo/penawaran utama, detail penting (harga, tanggal, kode), lalu CTA jelas.
- Hashtag diawali # tanpa spasi; untuk WhatsApp kosongkan hashtag.`;

  const prompt = `${await buildContext()}

PLATFORM: ${input.platform} — ${PLATFORM_GUIDE[input.platform]}
GAYA BAHASA: ${TONE_GUIDE[input.tone]}
${input.notes ? `CATATAN DARI ADMIN: ${input.notes}\n` : ''}
Analisis poster terlampir, lalu buatkan caption untuk postingannya.`;

  try {
    const { data, model, usage } = await generateJson<PosterResult>({
      model: config.model,
      system,
      prompt,
      schema: POSTER_SCHEMA,
      temperature: Math.max(0.6, Math.min(config.temperature, 1)),
      maxTokens: Math.max(config.maxTokens, 3072),
      images: [{ data: input.image, mimeType: input.mimeType }],
      timeoutMs: 45_000,
    });

    const clean: PosterResult = {
      analysis: data.analysis,
      captions: (data.captions ?? []).slice(0, 1).map((c) => ({
        ...c,
        angle: 'Langsung ke promo',
        hashtags:
          input.platform === 'whatsapp'
            ? []
            : [...new Set((c.hashtags ?? []).map((h) => `#${h.replace(/^#+/, '').replace(/\s+/g, '')}`).filter((h) => h.length > 1))],
      })),
      best_time: data.best_time,
      poster_tips: data.poster_tips ?? [],
    };
    if (!clean.captions.length) throw new Error('AI tidak menghasilkan caption');

    const record = { ...clean, platform: input.platform, tone: input.tone, notes: input.notes ?? null, imageUrl: input.imageUrl, model };
    const row = await prisma.aiInsight.create({
      data: {
        type: 'poster_caption',
        title: clean.analysis.headline?.slice(0, 120) ?? 'Caption poster',
        content: clean.captions[0].caption,
        data: JSON.parse(JSON.stringify(record)),
      },
    });
    await writeAiLog({
      feature: 'copywriter',
      model,
      usage,
      latencyMs: Date.now() - t0,
      status: 'success',
      input: { platform: input.platform, tone: input.tone, notes: input.notes, imageUrl: input.imageUrl },
      output: { headline: clean.analysis.headline, captions: clean.captions.length },
    });
    return toRecord(row);
  } catch (e: any) {
    await writeAiLog({ feature: 'copywriter', model: config.model, latencyMs: Date.now() - t0, status: 'error', errorMessage: e?.message, input: { platform: input.platform, imageUrl: input.imageUrl } });
    throw e;
  }
};

/** Buat ulang caption dari poster yang sudah pernah diunggah (boleh ganti platform/gaya/catatan). */
export const regeneratePosterCaption = async (id: string, opts: { platform?: Platform; tone?: CaptionTone; notes?: string | null }) => {
  const row = await prisma.aiInsight.findFirst({ where: { id, type: 'poster_caption' } });
  if (!row) throw notFound('Riwayat caption tidak ditemukan');
  const prev = toRecord(row);
  const file = path.join(UPLOAD_ROOT, prev.imageUrl.replace(/^\/uploads\//, ''));
  const ext = path.extname(file).slice(1);
  const mimeType = Object.entries(MIME_EXT).find(([, e]) => e === ext)?.[0];
  if (!mimeType) throw badRequest('File poster tidak valid');
  const image = await fs.readFile(file).catch(() => {
    throw notFound('File poster sudah tidak ada, silakan unggah ulang');
  });
  return generatePosterCaption({
    image,
    mimeType,
    imageUrl: prev.imageUrl,
    platform: opts.platform ?? prev.platform,
    tone: opts.tone ?? prev.tone,
    notes: opts.notes !== undefined ? opts.notes : prev.notes,
  });
};

export const listPosterCaptions = async (limit = 20) => {
  const rows = await prisma.aiInsight.findMany({ where: { type: 'poster_caption' }, orderBy: { createdAt: 'desc' }, take: limit });
  return rows.map(toRecord);
};

export const deletePosterCaption = async (id: string) => {
  const row = await prisma.aiInsight.findFirst({ where: { id, type: 'poster_caption' } });
  if (!row) throw notFound('Riwayat caption tidak ditemukan');
  await prisma.aiInsight.delete({ where: { id } });
  // Hapus file hanya jika tidak dipakai riwayat lain (hasil "buat ulang" memakai gambar yang sama).
  const imageUrl = toRecord(row).imageUrl;
  const others = await prisma.aiInsight.count({ where: { type: 'poster_caption', data: { path: ['imageUrl'], equals: imageUrl } } });
  if (!others && imageUrl) await fs.rm(path.join(UPLOAD_ROOT, imageUrl.replace(/^\/uploads\//, ''))).catch(() => undefined);
};

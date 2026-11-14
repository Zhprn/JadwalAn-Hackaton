import { AiAgent } from '@prisma/client';
import prisma from '../../lib/prisma';
import { cached, invalidate } from '../../lib/cache';
import { addDays, DAY_NAMES, jktDate, jktParts, todayJkt } from '../../lib/time';
import { getActiveStations, getStoreSetting } from '../settings.service';
import { DEFAULT_MODEL } from './gemini';

export type AiFeature = 'chat' | 'crm_promo' | 'copywriter' | 'insight';

export const DEFAULT_PERSONA = `Kamu adalah "Jadwal.an AI", asisten ramah sebuah rental PlayStation.
Kamu membantu pelanggan mengecek jadwal kosong, harga, promo, membuat booking, dan menjawab pertanyaan seputar rental.`;

const DEFAULT_AGENTS: Record<AiFeature, Partial<AiAgent>> = {
  chat: {
    name: 'Jadwal.an AI',
    systemPrompt: DEFAULT_PERSONA,
    temperature: 0.6,
    maxTokens: 1024,
    greetingMessage: 'Halo kak! 👋 Aku Jadwal.an AI. Mau cek jadwal kosong, harga, atau langsung booking PS?',
    fallbackMessage: 'Maaf kak, aku lagi kesulitan menjawab. Admin kami akan segera membantu ya 🙏',
    handoffKeywords: ['admin', 'cs', 'manusia', 'refund', 'komplain'],
  },
  crm_promo: {
    name: 'Promo Copywriter',
    systemPrompt:
      'Kamu copywriter WhatsApp untuk rental PlayStation. Tulis pesan promo personal, singkat, hangat, tidak spam, dalam Bahasa Indonesia santai.',
    temperature: 0.9,
    maxTokens: 512,
  },
  copywriter: {
    name: 'Copywriter',
    systemPrompt: 'Kamu copywriter kreatif untuk rental PlayStation. Tulis dalam Bahasa Indonesia santai dan menarik.',
    temperature: 0.9,
    maxTokens: 512,
  },
  insight: {
    name: 'Business Insight',
    systemPrompt:
      'Kamu analis bisnis untuk rental PlayStation. Berikan insight singkat, berbasis angka, dan rekomendasi yang bisa langsung dijalankan pemilik rental.',
    temperature: 0.4,
    maxTokens: 1024,
  },
};

export type AgentConfig = AiAgent;

/** Konfigurasi agent per fitur dari DB (cache 60 detik), dengan nilai default jika belum ada. */
export const getAgentConfig = (feature: AiFeature): Promise<AgentConfig> =>
  cached(`ai:agent:${feature}`, 60_000, async () => {
    const row = await prisma.aiAgent.findUnique({ where: { feature } });
    const def = DEFAULT_AGENTS[feature];
    const now = new Date();
    return {
      id: row?.id ?? '',
      feature,
      name: row?.name ?? def.name ?? 'Jadwal.an AI',
      provider: 'gemini',
      model: row?.model || DEFAULT_MODEL,
      systemPrompt: row?.systemPrompt || def.systemPrompt || DEFAULT_PERSONA,
      temperature: row?.temperature ?? def.temperature ?? 0.7,
      maxTokens: row?.maxTokens ?? def.maxTokens ?? 1024,
      isActive: row?.isActive ?? true,
      autoReply: row?.autoReply ?? true,
      canCreateBooking: row?.canCreateBooking ?? true,
      bookingStatus: row?.bookingStatus ?? 'confirmed',
      greetingMessage: row?.greetingMessage ?? def.greetingMessage ?? null,
      fallbackMessage: row?.fallbackMessage ?? def.fallbackMessage ?? null,
      handoffKeywords: row?.handoffKeywords?.length ? row.handoffKeywords : (def.handoffKeywords ?? []),
      activeFrom: row?.activeFrom ?? null,
      activeTo: row?.activeTo ?? null,
      createdAt: row?.createdAt ?? now,
      updatedAt: row?.updatedAt ?? now,
    };
  });

export const invalidateAi = () => invalidate('ai:');

/** Apakah AI sedang dalam jam aktif (null = 24 jam). */
export const isWithinActiveHours = (cfg: AgentConfig) => {
  if (!cfg.activeFrom || !cfg.activeTo) return true;
  const now = jktParts().minutesOfDay;
  const [fh, fm] = cfg.activeFrom.split(':').map(Number);
  const [th, tm] = cfg.activeTo.split(':').map(Number);
  const from = fh * 60 + fm;
  const to = th * 60 + tm;
  return from <= to ? now >= from && now < to : now >= from || now < to;
};

// ---------------------------------------------------------------------
// Knowledge base: pencarian kata kunci sederhana (cepat, tanpa embedding)
// ---------------------------------------------------------------------

const STOPWORDS = new Set(
  'yang dan di ke dari ini itu ada apa apakah bisa gak ga tidak kak min mas mbak saya aku gue kamu untuk dengan atau juga sih dong ya yah kah nya lah the a'.split(
    ' ',
  ),
);
const tokenize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

const getKnowledge = () =>
  cached('ai:knowledge', 60_000, () =>
    prisma.aiKnowledge.findMany({
      where: { isActive: true },
      orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
      select: { category: true, question: true, content: true, priority: true },
    }),
  );

/** Ambil entri knowledge paling relevan: entri prioritas tinggi selalu ikut + top-k berdasarkan kecocokan kata. */
export const searchKnowledge = async (query: string, k = 6) => {
  const all = await getKnowledge();
  const q = new Set(tokenize(query));
  const scored = all.map((item) => {
    const words = tokenize(`${item.category} ${item.question ?? ''} ${item.content}`);
    let score = 0;
    for (const w of words) if (q.has(w)) score++;
    return { item, score };
  });
  const pinned = scored.filter((s) => s.item.priority >= 10).map((s) => s.item);
  const relevant = scored
    .filter((s) => s.score > 0 && s.item.priority < 10)
    .sort((a, b) => b.score - a.score || b.item.priority - a.item.priority)
    .slice(0, k)
    .map((s) => s.item);
  return [...pinned.slice(0, 5), ...relevant];
};

// ---------------------------------------------------------------------
// Konteks bisnis untuk prompt
// ---------------------------------------------------------------------

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

export const buildStoreContext = async () => {
  const [setting, stations] = await Promise.all([getStoreSetting(), getActiveStations()]);
  const closed = setting.closedDays.length ? setting.closedDays.map((d) => DAY_NAMES[d]).join(', ') : 'tidak ada (buka setiap hari)';

  const stationLines = stations
    .map(
      (s) =>
        `- [${s.id}] ${s.name} (${s.category}) ${rupiah(s.pricePerHour)}/jam, maks ${s.maxPlayers} pemain` +
        (s.games.length ? `, game: ${s.games.slice(0, 8).join(', ')}` : ''),
    )
    .join('\n');

  return `INFO RENTAL
Nama: ${setting.name}${setting.address ? `\nAlamat: ${setting.address}` : ''}${setting.phone ? `\nKontak: ${setting.phone}` : ''}
Jam buka: ${setting.openTime}–${setting.closeTime} WIB. Hari libur: ${closed}.
Durasi booking: ${setting.minBookingHours}–${setting.maxBookingHours} jam. Booking minimal ${setting.bookingLeadMins} menit sebelum mulai.

DAFTAR UNIT (id dalam kurung siku, pakai id ini saat memanggil tool):
${stationLines || '- (belum ada unit aktif)'}`;
};

/** Penanda waktu supaya AI bisa menerjemahkan "besok", "Sabtu ini", "nanti malam". */
export const buildTimeContext = () => {
  const now = jktParts();
  const today = todayJkt();
  const next = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(today, i);
    const label = i === 0 ? 'hari ini' : i === 1 ? 'besok' : i === 2 ? 'lusa' : '';
    return `${DAY_NAMES[jktParts(jktDate(d)).weekday]} ${d}${label ? ` (${label})` : ''}`;
  }).join('; ');
  return `WAKTU SEKARANG: ${DAY_NAMES[now.weekday]}, ${now.dateStr} pukul ${now.timeStr} WIB.
Kalender 7 hari: ${next}.`;
};

export const buildCustomerContext = async (customerId?: string | null) => {
  if (!customerId) return 'PELANGGAN: tamu (belum login).';
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { name: true, tier: true, totalSessions: true, totalHours: true, favoriteConsole: true, favoriteHour: true, lastPlayed: true },
  });
  if (!c) return 'PELANGGAN: tidak dikenal.';
  return `PELANGGAN: ${c.name} (tier ${c.tier}), ${c.totalSessions} sesi / ${c.totalHours} jam main.${
    c.favoriteConsole ? ` Favorit: ${c.favoriteConsole}` : ''
  }${c.favoriteHour ? ` jam ${c.favoriteHour}` : ''}.`;
};

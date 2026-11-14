import { SchemaType } from '@google/generative-ai';
import prisma from '../../lib/prisma';
import { badRequest, notFound } from '../../lib/http';
import { addDays, daysBetween, dbDate, DAY_NAMES, formatJkt, todayJkt } from '../../lib/time';
import { getStoreSetting } from '../settings.service';
import { getAgentConfig } from './context';
import { generateJson } from './gemini';
import { writeAiLog } from './log';
import { computeDailyMetric } from '../metric.service';

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

// =====================================================================
// 1. Copywriter promo personal (AI Promo CRM)
// =====================================================================

export type Tone = 'friendly' | 'urgent' | 'exclusive' | 'casual';
const TONE_GUIDE: Record<Tone, string> = {
  friendly: 'hangat dan bersahabat',
  urgent: 'mendesak (stok/waktu terbatas) tapi tetap sopan',
  exclusive: 'eksklusif, membuat pelanggan merasa spesial',
  casual: 'santai seperti teman tongkrongan gamer',
};

const PROMO_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    content: { type: SchemaType.STRING, description: 'Isi pesan WhatsApp' },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '2–4 tag singkat' },
  },
  required: ['content', 'tags'],
};

export const generatePromoCopy = async (opts: {
  customerId: string;
  promoId?: string | null;
  tone: Tone;
  extraInstruction?: string | null;
  previousContent?: string | null;
}) => {
  const t0 = Date.now();
  const [customer, promo, setting, config] = await Promise.all([
    prisma.customer.findUnique({ where: { id: opts.customerId } }),
    opts.promoId ? prisma.promo.findUnique({ where: { id: opts.promoId } }) : Promise.resolve(null),
    getStoreSetting(),
    getAgentConfig('crm_promo'),
  ]);
  if (!customer) throw notFound('Pelanggan tidak ditemukan');
  if (opts.promoId && !promo) throw notFound('Promo tidak ditemukan');

  const absentDays = customer.lastPlayed ? daysBetween(customer.lastPlayed, new Date()) : null;
  const promoText = promo
    ? `Kode ${promo.code}${promo.title ? ` (${promo.title})` : ''}: diskon ${
        promo.discountType === 'nominal' ? rupiah(promo.discountAmount) : `${promo.discountPercentage}%`
      }${promo.consoleType !== 'ALL' ? ` khusus ${promo.consoleType}` : ''}, minimal ${promo.minHours} jam, berlaku sampai ${formatJkt(promo.validUntil)}${
        promo.validDays.length ? `, hari ${promo.validDays.map((d) => DAY_NAMES[d]).join('/')}` : ''
      }${promo.validFrom && promo.validTo ? `, jam ${promo.validFrom}–${promo.validTo}` : ''}.`
    : 'Tidak ada kode promo khusus, ajak main kembali saja.';

  const prompt = `Data pelanggan:
- Nama: ${customer.name}
- Tier: ${customer.tier}, total ${customer.totalSessions} sesi / ${customer.totalHours} jam
- Konsol favorit: ${customer.favoriteConsole ?? '-'}, jam favorit: ${customer.favoriteHour ?? '-'}
- Terakhir main: ${absentDays == null ? 'belum pernah main' : `${absentDays} hari lalu`}

Rental: ${setting.name}, buka ${setting.openTime}–${setting.closeTime} WIB.
Promo: ${promoText}
Gaya: ${TONE_GUIDE[opts.tone]}.
${opts.previousContent ? `Buat versi BERBEDA dari pesan sebelumnya ini:\n"""${opts.previousContent}"""\n` : ''}${opts.extraInstruction ? `Instruksi tambahan: ${opts.extraInstruction}\n` : ''}
Tulis pesan WhatsApp 2–4 kalimat (maks 400 karakter), sapa dengan nama depan, sebut konsol favorit jika ada, sertakan kode promo jika ada, akhiri dengan ajakan booking. Tanpa hashtag.`;

  try {
    const { data, model, usage } = await generateJson<{ content: string; tags: string[] }>({
      model: config.model,
      system: config.systemPrompt,
      prompt,
      schema: PROMO_SCHEMA,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    const tags = [
      ...(customer.favoriteConsole ? [customer.favoriteConsole] : []),
      ...(absentDays != null && absentDays >= 7 ? [`Absen ${absentDays} hari`] : []),
      ...(data.tags ?? []),
    ];
    await writeAiLog({ feature: 'crm_promo', model, usage, latencyMs: Date.now() - t0, status: 'success', customerId: customer.id, input: { tone: opts.tone, promoId: opts.promoId }, output: data });
    return { content: data.content.trim(), tags: [...new Set(tags)].slice(0, 6) };
  } catch (e: any) {
    await writeAiLog({ feature: 'crm_promo', model: config.model, latencyMs: Date.now() - t0, status: 'error', errorMessage: e?.message, customerId: customer.id });
    throw e;
  }
};

// =====================================================================
// 2. Insight dashboard harian
// =====================================================================

const INSIGHT_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: 'Judul insight maks 8 kata' },
    content: { type: SchemaType.STRING, description: '2–4 kalimat insight utama' },
    highlights: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '2–4 poin angka penting' },
    recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: '2–3 aksi konkret' },
  },
  required: ['title', 'content', 'highlights', 'recommendations'],
};

export const getDashboardInsight = async (opts: { refresh?: boolean } = {}) => {
  const today = todayJkt();
  const date = dbDate(today);

  if (!opts.refresh) {
    const cachedInsight = await prisma.aiInsight.findFirst({
      where: { type: 'dashboard_daily', date, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      orderBy: { createdAt: 'desc' },
    });
    if (cachedInsight) return cachedInsight;
  }

  // Data 7 hari terakhir (dihitung langsung agar akurat walau job metrik belum jalan).
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const metrics = await Promise.all(days.map((d) => computeDailyMetric(d, { persist: d !== today })));
  const upcoming = await prisma.booking.count({ where: { status: { in: ['pending', 'confirmed'] }, startTime: { gte: new Date() } } });

  const t0 = Date.now();
  const config = await getAgentConfig('insight');
  const table = metrics
    .map(
      (m, i) =>
        `${days[i]} (${DAY_NAMES[new Date(`${days[i]}T12:00:00+07:00`).getUTCDay()]}): pendapatan ${rupiah(m.totalRevenue)}, booking ${m.totalBookings} (AI ${m.aiBookings}, batal ${m.cancelledBookings}), okupansi ${(m.occupancyRate * 100).toFixed(0)}%, jam ramai ${m.peakHour ?? '-'}, pelanggan baru ${m.newCustomers}, chat ${m.chatSessions}`,
    )
    .join('\n');

  const { data, model, usage } = await generateJson<{ title: string; content: string; highlights: string[]; recommendations: string[] }>({
    model: config.model,
    system: config.systemPrompt,
    prompt: `Data rental 7 hari terakhir (hari ini = ${today}, data hari ini masih berjalan):\n${table}\n\nBooking mendatang: ${upcoming}.\nBerikan insight & rekomendasi dalam Bahasa Indonesia.`,
    schema: INSIGHT_SCHEMA,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  await writeAiLog({ feature: 'insight', model, usage, latencyMs: Date.now() - t0, status: 'success', output: data });

  return prisma.aiInsight.create({
    data: {
      type: 'dashboard_daily',
      date,
      title: data.title,
      content: data.content,
      data: { highlights: data.highlights, recommendations: data.recommendations, metrics: JSON.parse(JSON.stringify(metrics)) },
      expiresAt: new Date(Date.now() + 3 * 60 * 60 * 1000), // segarkan tiap 3 jam
    },
  });
};

// =====================================================================
// 3. Analisis pelanggan (CRM)
// =====================================================================

const CUSTOMER_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING, description: 'Segmen pelanggan, mis. "Gamer PS5 malam hari"' },
    content: { type: SchemaType.STRING, description: '2–3 kalimat analisis perilaku' },
    tags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    churnRisk: { type: SchemaType.STRING, format: 'enum', enum: ['rendah', 'sedang', 'tinggi'] },
    recommendations: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: ['title', 'content', 'tags', 'churnRisk', 'recommendations'],
};

export const getCustomerAnalysis = async (customerId: string, opts: { refresh?: boolean } = {}) => {
  if (!opts.refresh) {
    const hit = await prisma.aiInsight.findFirst({
      where: { type: 'customer_analysis', refId: customerId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (hit) return hit;
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      bookings: { orderBy: { startTime: 'desc' }, take: 20, include: { station: { select: { category: true, name: true } } } },
      reviews: { orderBy: { createdAt: 'desc' }, take: 5 },
    },
  });
  if (!customer) throw notFound('Pelanggan tidak ditemukan');
  if (!customer.bookings.length) throw badRequest('Pelanggan belum punya riwayat booking untuk dianalisis');

  const t0 = Date.now();
  const config = await getAgentConfig('insight');
  const history = customer.bookings
    .map((b) => `${formatJkt(b.startTime)} ${b.station.category} ${b.durationHours} jam ${rupiah(b.totalPrice)} [${b.status}]${b.promoId ? ' (promo)' : ''}`)
    .join('\n');

  const { data, model, usage } = await generateJson<{ title: string; content: string; tags: string[]; churnRisk: string; recommendations: string[] }>({
    model: config.model,
    system: config.systemPrompt,
    prompt: `Pelanggan: ${customer.name}, tier ${customer.tier}, ${customer.totalSessions} sesi, total belanja ${rupiah(customer.totalSpent)}, terakhir main ${
      customer.lastPlayed ? `${daysBetween(customer.lastPlayed, new Date())} hari lalu` : '-'
    }.
Rating ulasan: ${customer.reviews.map((r) => r.rating).join(', ') || '-'}.
Riwayat booking terbaru:
${history}

Analisis pola main, risiko berhenti (churn), dan rekomendasi promo/aksi CRM.`,
    schema: CUSTOMER_SCHEMA,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  await writeAiLog({ feature: 'insight', model, usage, latencyMs: Date.now() - t0, status: 'success', customerId, output: data });

  return prisma.aiInsight.create({
    data: {
      type: 'customer_analysis',
      refId: customerId,
      title: data.title,
      content: data.content,
      data: { tags: data.tags, churnRisk: data.churnRisk, recommendations: data.recommendations },
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
};

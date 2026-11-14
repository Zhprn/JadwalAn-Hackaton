import { SchemaType } from '@google/generative-ai';
import type { ToolName } from './tools';

/**
 * Arsitektur multi-agent:
 *
 *   pesan pelanggan
 *        │
 *        ├─► Router (aturan kata kunci → kalau ragu, model cepat + JSON)   ┐ berjalan paralel
 *        └─► Pemuat konteks (info rental, unit, profil, knowledge)          ┘
 *        │
 *        ▼
 *   Agent spesialis: booking | info | support (function calling, tool paralel)
 *        │
 *        ▼
 *   Balasan ──► (latar belakang) Summarizer memperbarui judul/ringkasan/intent sesi
 */

export type AgentKind = 'booking' | 'info' | 'support';
export type Intent = 'booking' | 'tanya_harga' | 'tanya_promo' | 'komplain' | 'lainnya';

export type RouteDecision = { agent: AgentKind; intent: Intent; priority: 'normal' | 'high'; via: 'rule' | 'model' };

export type AgentSpec = {
  kind: AgentKind;
  label: string;
  tools: ToolName[];
  /** Apakah knowledge base disisipkan ke prompt. */
  useKnowledge: boolean;
  temperature: number;
  instructions: string;
};

export const COMMON_RULES = `ATURAN UMUM
- Jawab dalam Bahasa Indonesia santai dan sopan, panggil pelanggan "kak". Singkat: maksimal 4–6 kalimat atau daftar pendek.
- Jangan pernah mengarang jam kosong, harga, atau promo. Ambil dari tool atau dari INFO RENTAL.
- Format untuk chat/WhatsApp: tanpa tabel markdown dan tanpa heading. Boleh *tebal* seperlunya dan emoji secukupnya.
- Tanggal selalu disebut dengan nama hari, mis. "Sabtu, 15 Nov jam 16:00".
- Jika pelanggan marah, komplain, minta refund, atau minta bicara dengan admin, panggil handoff_to_admin.
- Jangan menyebut kata "tool", "function", atau ID internal unit ke pelanggan.`;

export const AGENTS: Record<AgentKind, AgentSpec> = {
  booking: {
    kind: 'booking',
    label: 'Booking Agent',
    tools: ['check_availability', 'quote_price', 'create_booking', 'get_my_bookings', 'cancel_my_booking', 'get_promos', 'handoff_to_admin'],
    useKnowledge: false,
    temperature: 0.4,
    instructions: `PERANMU: Booking Agent. Tugasmu membantu pelanggan membuat, mengecek, atau membatalkan booking.
ALUR BOOKING:
1. Pastikan ada tanggal, jam mulai, durasi, dan jenis konsol/unit. Tanyakan yang belum ada dalam SATU pertanyaan saja. Jika pelanggan tidak menyebut durasi, anggap durasi minimal. Jika tidak menyebut unit, pilihkan unit kosong yang cocok (utamakan konsol favorit pelanggan).
2. Panggil check_availability (pakai start_time jika jam sudah disebut). Jika penuh, tawarkan 2–3 alternatif jam/unit terdekat.
3. Panggil quote_price, lalu kirim ringkasan: unit, hari & tanggal, jam mulai–selesai, durasi, total (dan diskon jika ada). Minta konfirmasi "ya".
4. Setelah pelanggan setuju (ya/oke/gas/lanjut/boleh), panggil create_booking. Lalu beri kode booking dan info pembayaran.
   Jika pelanggan sejak awal sudah memberi detail lengkap DAN tegas meminta langsung dibookingkan, boleh langsung create_booking setelah quote_price.
PEMBATALAN: tunjukkan booking via get_my_bookings, minta konfirmasi, lalu cancel_my_booking.`,
  },
  info: {
    kind: 'info',
    label: 'Info Agent',
    tools: ['check_availability', 'get_promos', 'get_my_bookings', 'handoff_to_admin'],
    useKnowledge: true,
    temperature: 0.6,
    instructions: `PERANMU: Info Agent. Jawab pertanyaan tentang harga, unit, game, promo, jam buka, lokasi, aturan, dan sapaan umum.
- Untuk harga dan unit, pakai DAFTAR UNIT. Untuk promo, panggil get_promos. Untuk "ada yang kosong?", panggil check_availability.
- Untuk pertanyaan lain, pakai BASIS PENGETAHUAN. Jika tidak ada jawabannya, katakan jujur lalu tawarkan bantuan admin.
- Jika pelanggan terlihat ingin main, akhiri dengan ajakan singkat untuk booking.`,
  },
  support: {
    kind: 'support',
    label: 'Support Agent',
    tools: ['get_my_bookings', 'cancel_my_booking', 'handoff_to_admin'],
    useKnowledge: true,
    temperature: 0.5,
    instructions: `PERANMU: Support Agent. Tangani keluhan, masalah booking/pembayaran, dan permintaan refund dengan empati.
- Minta maaf dengan tulus, pahami masalahnya, dan cek booking terkait via get_my_bookings jika relevan.
- Untuk refund, kerusakan unit, masalah pembayaran, atau saat pelanggan kesal: panggil handoff_to_admin dengan alasan yang jelas, lalu beri tahu pelanggan bahwa admin akan segera membalas.
- Jangan menjanjikan kompensasi atau refund sendiri.`,
  },
};

// ---------------------------------------------------------------------
// Router berbasis aturan (tanpa panggilan AI → instan)
// ---------------------------------------------------------------------

const RULES: { re: RegExp; agent: AgentKind; intent: Intent; priority?: 'high' }[] = [
  {
    re: /\b(komplain|kecewa|rusak|refund|uang\s*kembali|marah|parah|lemot|stik\s*(rusak|error)|nipu|penipuan|gak\s*nyala|ga\s*nyala|mati\s*listrik)\b/i,
    agent: 'support',
    intent: 'komplain',
    priority: 'high',
  },
  {
    re: /\b(booking|book|bokin|booking-?in|pesan|mesen|reservasi|sewa|slot|kosong|available|jadwal|batal(in)?|cancel|reschedule|main\s+(jam|besok|nanti|malam|sore|siang|pagi|hari))\b/i,
    agent: 'booking',
    intent: 'booking',
  },
  { re: /\b(promo|diskon|voucher|potongan|cashback)\b/i, agent: 'info', intent: 'tanya_promo' },
  { re: /\b(harga|tarif|biaya|berapa(an)?|per\s*jam|price|murah)\b/i, agent: 'info', intent: 'tanya_harga' },
];

const GREETING = /^(h+a+l+o+|hai|hi|hello|p|pagi|siang|sore|malam|assalamualaikum|permisi|min|kak|halo\s+min|test|tes)\W*$/i;

/** Kembalikan keputusan jika aturan cukup yakin; null jika perlu router berbasis model. */
export const routeByRules = (message: string, previousIntent?: string | null): RouteDecision | null => {
  const text = message.trim();
  if (GREETING.test(text)) return { agent: 'info', intent: 'lainnya', priority: 'normal', via: 'rule' };

  const hits = RULES.filter((r) => r.re.test(text));
  const kinds = new Set(hits.map((h) => h.agent));

  if (hits.some((h) => h.agent === 'support')) {
    return { agent: 'support', intent: 'komplain', priority: 'high', via: 'rule' };
  }
  if (kinds.size === 1) {
    const h = hits[0];
    return { agent: h.agent, intent: h.intent, priority: h.priority ?? 'normal', via: 'rule' };
  }
  // "booking pakai promo X" → booking menang
  if (kinds.has('booking')) return { agent: 'booking', intent: 'booking', priority: 'normal', via: 'rule' };

  // Jawaban pendek lanjutan ("ya", "oke", "jam 4", "2 jam") → tetap di alur sebelumnya.
  const isFollowUp = /^(ya|iya|y|ok(e|ay)?|sip|gas|lanjut|boleh|jadi|setuju|nggak|ngga|gak|tidak|batal|jam\s*\d+|\d+\s*jam|ps\s*[45]|besok|lusa|nanti)\b/i.test(text);
  if (isFollowUp && previousIntent === 'booking') return { agent: 'booking', intent: 'booking', priority: 'normal', via: 'rule' };
  if (isFollowUp && previousIntent === 'komplain') return { agent: 'support', intent: 'komplain', priority: 'high', via: 'rule' };
  if (isFollowUp && previousIntent) return { agent: 'info', intent: previousIntent as Intent, priority: 'normal', via: 'rule' };

  return null;
};

// ---------------------------------------------------------------------
// Router berbasis model (hanya jika aturan ragu)
// ---------------------------------------------------------------------

export const ROUTER_SYSTEM = `Kamu adalah router percakapan untuk chatbot rental PlayStation.
Tentukan agent yang paling tepat menangani pesan TERAKHIR pelanggan:
- "booking": ingin booking/sewa, cek slot/jadwal kosong, ubah/batal booking, atau melanjutkan proses booking.
- "info": tanya harga, unit, game, promo, lokasi, jam buka, aturan, sapaan, obrolan umum.
- "support": komplain, masalah pembayaran, refund, unit rusak, pelanggan kesal, atau minta bicara dengan admin.
intent: booking | tanya_harga | tanya_promo | komplain | lainnya. priority "high" hanya untuk komplain/emosi.`;

export const ROUTER_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    agent: { type: SchemaType.STRING, format: 'enum', enum: ['booking', 'info', 'support'] },
    intent: { type: SchemaType.STRING, format: 'enum', enum: ['booking', 'tanya_harga', 'tanya_promo', 'komplain', 'lainnya'] },
    priority: { type: SchemaType.STRING, format: 'enum', enum: ['normal', 'high'] },
  },
  required: ['agent', 'intent', 'priority'],
};

// ---------------------------------------------------------------------
// Summarizer sesi
// ---------------------------------------------------------------------

export const SUMMARY_SYSTEM = `Kamu merangkum percakapan customer service rental PlayStation untuk admin.
Buat: title (maks 6 kata, mis. "Booking PS5 Sabtu 16:00"), summary (1–3 kalimat berisi kebutuhan pelanggan dan status terakhir), intent (booking | tanya_harga | tanya_promo | komplain | lainnya).`;

export const SUMMARY_SCHEMA = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    intent: { type: SchemaType.STRING, format: 'enum', enum: ['booking', 'tanya_harga', 'tanya_promo', 'komplain', 'lainnya'] },
  },
  required: ['title', 'summary', 'intent'],
};

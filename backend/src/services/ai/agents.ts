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
- Jangan menyebut kata "tool", "function", atau ID internal unit ke pelanggan.

MEMAHAMI CHAT TYPO / SINGKAT
- Pelanggan sering mengetik singkat, typo, atau bahasa gaul (mis. "bsk bkg ps5 jm 7 2j" = besok booking PS5 jam 19:00 selama 2 jam, "brp" = berapa, "y/gas/ok" = setuju, "gk jd" = tidak jadi, "qr" = QRIS). Pahami maksudnya, JANGAN minta pelanggan mengulang atau mengoreksi ejaan.
- Pesan pendek hampir selalu LANJUTAN topik sebelumnya. Baca riwayat & RINGKASAN PERCAKAPAN, lalu lanjutkan dari langkah terakhir (mis. "jam 8 aja" saat sedang booking = ganti jam mulai).
- Jam tanpa keterangan: "jam 7"–"jam 11" pada konteks main malam = 19:00–23:00; kalau masih ambigu & jam buka mencakup keduanya, pilih yang paling masuk akal lalu sebutkan dalam ringkasan supaya pelanggan bisa koreksi.
- Kalau ada "KEMUNGKINAN MAKSUD PELANGGAN", gunakan sebagai bantuan membaca pesan aslinya.

PEMBAYARAN (WAJIB)
- JANGAN PERNAH menyatakan pembayaran lunas/berhasil/terkonfirmasi hanya karena pelanggan bilang "sudah bayar", "udah tf", "oke sudah", dsb.
- Setiap pelanggan mengaku sudah bayar atau menanyakan status bayar → panggil check_payment_status, lalu jawab SESUAI hasilnya.
- Status di RIWAYAT CHAT atau ringkasan bisa sudah usang; yang berlaku hanya hasil check_payment_status terbaru.`;

export const AGENTS: Record<AgentKind, AgentSpec> = {
  booking: {
    kind: 'booking',
    label: 'Booking Agent',
    tools: ['check_availability', 'quote_price', 'create_booking', 'send_payment_qris', 'check_payment_status', 'get_my_bookings', 'cancel_my_booking', 'get_promos', 'handoff_to_admin'],
    useKnowledge: false,
    temperature: 0.4,
    instructions: `PERANMU: Booking Agent. Tugasmu membantu pelanggan membuat, mengecek, atau membatalkan booking.
ALUR BOOKING (form pemesanan lewat chat):
1. Kumpulkan: tanggal, jam mulai, durasi, jenis konsol/unit. Tanyakan yang belum ada dalam SATU pertanyaan singkat. Jika durasi tidak disebut, pakai durasi minimal. Jika unit tidak disebut, pilihkan unit kosong yang cocok (utamakan konsol favorit pelanggan).
2. Panggil check_availability (pakai start_time jika jam sudah disebut). Jika penuh, tawarkan 2–3 alternatif jam/unit terdekat.
3. Panggil quote_price, lalu kirim RINGKASAN PESANAN:
   🎮 unit · 📅 hari & tanggal · ⏰ jam mulai–selesai (durasi) · 💰 total (dan diskon jika ada)
   lalu tanyakan sekaligus: "Bayarnya mau pakai *QRIS* atau *cash di kasir*?"
4. Setelah pelanggan setuju DAN memilih metode bayar → panggil create_booking dengan payment_method ("qris" atau "cash").
   - Jika pelanggan hanya menjawab "ya/oke" tanpa memilih metode, tanyakan metode bayarnya dulu (singkat).
   - Jika pelanggan langsung menjawab "qris"/"cash" setelah ringkasan, itu dianggap setuju.
   - Jika detail lengkap + metode bayar sudah disebut sejak awal dan pelanggan tegas minta dibookingkan, boleh langsung create_booking setelah quote_price.
5. Setelah booking dibuat:
   - QRIS: gambar QR dikirim OTOMATIS oleh sistem tepat setelah balasanmu. Katakan "QR pembayarannya aku kirim di bawah ya kak", sebut total & batas waktu bayar, dan bahwa booking terkonfirmasi otomatis setelah dibayar. JANGAN menulis link/URL QR.
   - Cash: beri kode booking dan minta tunjukkan kode ke kasir saat datang.
6. Pelanggan minta QR lagi / QR kedaluwarsa / ingin ganti ke QRIS → panggil send_payment_qris dengan kode booking (ambil dari get_my_bookings bila perlu).
7. Pelanggan bilang sudah bayar → panggil check_payment_status. Lunas → konfirmasi + ingatkan kode booking. Belum → katakan jujur pembayaran belum masuk ke sistem (jangan menuduh), minta cek aplikasi pembayaran & tunggu sebentar.
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
    tools: ['get_my_bookings', 'cancel_my_booking', 'send_payment_qris', 'check_payment_status', 'handoff_to_admin'],
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
    re: /\b(booking|book|bokin|boking|bking|bkg|buking|booking-?in|pesan|pesen|mesen|reservasi|sewa|nyewa|slot|kosong|available|jadwal|batal(in)?|cancel|reschedule|qris|bayar|transfer|tf|lunas|main\s+(jam|besok|nanti|malam|sore|siang|pagi|hari|lusa|sekarang))\b/i,
    agent: 'booking',
    intent: 'booking',
  },
  { re: /\b(promo|diskon|voucher|potongan|cashback)\b/i, agent: 'info', intent: 'tanya_promo' },
  { re: /\b(harga|hrg|tarif|biaya|berapa(an)?|brp|brapa|per\s*jam|price|murah)\b/i, agent: 'info', intent: 'tanya_harga' },
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
  const isFollowUp =
    /^(ya|iya|y|ok(e|ay)?|sip|siap|gas|lanjut|boleh|jadi|setuju|nggak|ngga|gak|tidak|batal|qris|cash|tunai|jam\s*\d+|\d+\s*jam|ps\s*[45]|besok|lusa|nanti|sekarang|hari\s*ini|malam|sore|siang|pagi)\b/i.test(text) ||
    // Pesan sangat pendek (≤ 4 kata) di tengah percakapan → hampir pasti lanjutan topik sebelumnya.
    text.split(/\s+/).length <= 4;
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

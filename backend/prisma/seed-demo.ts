/**
 * Seed DATA DEMO supaya dashboard terlihat ramai saat presentasi.
 *
 *   npm run seed:demo           → hapus data demo lama lalu buat ulang
 *   npm run seed:demo -- --clear → hanya hapus data demo
 *
 * Semua data demo ditandai: pelanggan bertag "demo" (nomor 62899000xxxx).
 * Data asli (pelanggan/booking non-demo) TIDAK disentuh.
 * Jalankan `npm run seed` lebih dulu (butuh unit/station & pengaturan rental).
 */
import 'dotenv/config';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import prisma from '../src/lib/prisma';
import { addDays, jktDate, jktParts, todayJkt } from '../src/lib/time';
import { recalcCustomerStats } from '../src/services/booking.service';
import { computeRangeMetrics, persistMetrics } from '../src/services/metric.service';


const PAST_DAYS = 45;
const FUTURE_DAYS = 7;
const DEMO_TAG = 'demo';
const PHONE_PREFIX = '62899000';

// ---------------------------------------------------------------------
// Util acak (deterministik → hasil sama tiap dijalankan)
// ---------------------------------------------------------------------
let seed = 20261115;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
const chance = (p: number) => rand() < p;
const weighted = <T>(items: [T, number][]) => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of items) if ((r -= w) <= 0) return v;
  return items[items.length - 1][0];
};
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = (start: Date) => {
  const p = jktParts(start);
  let r = '';
  for (let i = 0; i < 4; i++) r += CODE_CHARS[Math.floor(rand() * CODE_CHARS.length)];
  return `JA${String(p.year).slice(2)}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}${r}`;
};

const FIRST = ['Rizky', 'Dimas', 'Fajar', 'Bayu', 'Andi', 'Reza', 'Yoga', 'Arief', 'Galih', 'Hendra', 'Ilham', 'Joko', 'Kevin', 'Lutfi', 'Naufal', 'Oki', 'Putra', 'Raka', 'Satria', 'Taufik', 'Wahyu', 'Yudha', 'Zaki', 'Bima', 'Danu', 'Eko', 'Farhan', 'Gilang', 'Hafiz', 'Irfan', 'Aldi', 'Rangga', 'Sinta', 'Nadia', 'Dinda', 'Ayu', 'Tiara', 'Salsa', 'Bagas', 'Fikri'];
const LAST = ['Pratama', 'Saputra', 'Wijaya', 'Nugraha', 'Hidayat', 'Ramadhan', 'Kurniawan', 'Firmansyah', 'Setiawan', 'Maulana', 'Siregar', 'Lubis', 'Harahap', 'Putri', 'Anggraini', 'Syahputra'];

const REVIEWS: [number, string][] = [
  [5, 'Mantap, booking lewat WA cepet banget dibales AI-nya 🔥'],
  [5, 'Tempat nyaman, stik aman semua. Bakal balik lagi!'],
  [5, 'Gampang banget booking, langsung dapet QR bayar.'],
  [4, 'Seru main FC bareng temen, AC dingin. Cuma parkir agak sempit.'],
  [5, 'PS5 lancar, TV gede. Recommended buat mabar.'],
  [4, 'Harga oke, pelayanan ramah. Snack bisa lebih banyak pilihan.'],
  [5, 'Suka fitur pengingat sebelum main, jadi nggak telat.'],
  [3, 'Lumayan, tapi pas malam minggu rame banget.'],
  [5, 'Adminnya fast respon, AI-nya ngerti walau aku chat singkat 😂'],
  [4, 'Booking jam sepi dapet promo, mantap.'],
];

const CHAT_SCRIPTS: { title: string; intent: string; summary: string; msgs: [('customer' | 'ai'), string][] }[] = [
  {
    title: 'Booking PS5 malam',
    intent: 'booking',
    summary: 'Pelanggan booking PS5 2 jam malam hari, bayar QRIS. Booking terkonfirmasi.',
    msgs: [
      ['customer', 'bsk bkg ps5 jm 7 2j'],
      ['ai', 'Siap kak! PS5 - TV 1 besok jam 19:00–21:00 masih kosong. Total Rp30.000. Bayarnya mau QRIS atau cash di kasir?'],
      ['customer', 'qr'],
      ['ai', 'Booking berhasil! QR pembayarannya aku kirim di bawah ya kak, berlaku 30 menit 🙌'],
    ],
  },
  {
    title: 'Tanya harga PS4',
    intent: 'tanya_harga',
    summary: 'Pelanggan menanyakan harga sewa PS4 per jam.',
    msgs: [
      ['customer', 'brp hrga ps4 sejam?'],
      ['ai', 'Harga PS4 Rp10.000/jam kak. Mau sekalian aku cekin slot kosong hari ini? 😊'],
    ],
  },
  {
    title: 'Cek promo weekend',
    intent: 'tanya_promo',
    summary: 'Pelanggan menanyakan promo akhir pekan, diberi info WEEKEND20.',
    msgs: [
      ['customer', 'ada promo ga min'],
      ['ai', 'Ada kak! Pakai kode *WEEKEND20* diskon 20% untuk main Sabtu–Minggu. Mau langsung booking?'],
      ['customer', 'gas sabtu jm 4'],
      ['ai', 'Oke kak, PS5 - TV 2 Sabtu 16:00–17:00 setelah diskon jadi Rp12.000. Bayar QRIS atau cash?'],
    ],
  },
  {
    title: 'Booking ramean PS5',
    intent: 'booking',
    summary: 'Pelanggan booking PS5 untuk 4 orang selama 3 jam, bayar di kasir.',
    msgs: [
      ['customer', 'mau maen ber4 ps5 3 jam nanti sore bisa?'],
      ['ai', 'Bisa kak! PS5 - TV 1 kosong jam 16:00–19:00, muat 4 pemain. Total Rp45.000. Bayar QRIS atau cash di kasir?'],
      ['customer', 'cash aja'],
      ['ai', 'Siap, booking tersimpan! Tunjukkan kode booking ke kasir saat datang ya kak 🎮'],
    ],
  },
  {
    title: 'Komplain stik error',
    intent: 'komplain',
    summary: 'Pelanggan komplain stik bermasalah, diteruskan ke admin.',
    msgs: [
      ['customer', 'min stik nya error terus nih ga bisa main'],
      ['ai', 'Waduh maaf banget kak 🙏 Aku teruskan ke admin ya supaya langsung dicek dan diganti.'],
    ],
  },
  {
    title: 'Batalkan booking',
    intent: 'booking',
    summary: 'Pelanggan membatalkan booking karena ada acara mendadak.',
    msgs: [
      ['customer', 'gk jd main bsk, btlin ya'],
      ['ai', 'Oke kak, booking besok jam 15:00 sudah aku batalkan. Semoga lain kali bisa main ya 🙌'],
    ],
  },
];

async function clearDemo() {
  const customers = await prisma.customer.findMany({ where: { tags: { has: DEMO_TAG } }, select: { id: true } });
  const ids = customers.map((c) => c.id);
  if (!ids.length) return 0;
  await prisma.review.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.aiLog.deleteMany({ where: { customerId: { in: ids } } });
  await prisma.booking.deleteMany({ where: { customerId: { in: ids } } }); // payment ikut terhapus (cascade)
  await prisma.chatSession.deleteMany({ where: { customerId: { in: ids } } }); // pesan & event ikut terhapus
  await prisma.customer.deleteMany({ where: { id: { in: ids } } }); // promoMessage ikut terhapus
  return ids.length;
}

async function main() {
  const removed = await clearDemo();
  console.log(`🧹 Data demo lama dihapus: ${removed} pelanggan`);
  if (process.argv.includes('--clear')) {
    await persistMetrics(await computeRangeMetrics(addDays(todayJkt(), -PAST_DAYS), todayJkt()));
    return;
  }

  const setting = await prisma.storeSetting.findFirst();
  const stations = await prisma.station.findMany({ where: { status: { not: 'inactive' } }, orderBy: { sortOrder: 'asc' } });
  if (!setting || !stations.length) throw new Error('Pengaturan rental / unit belum ada. Jalankan `npm run seed` dulu.');
  const promos = await prisma.promo.findMany();
  const weekendPromo = promos.find((p) => p.code === 'WEEKEND20');
  const siangPromo = promos.find((p) => p.code === 'SIANGHEMAT');

  const openH = Number(setting.openTime.split(':')[0]);
  let closeH = Number(setting.closeTime.split(':')[0]);
  if (closeH <= openH) closeH = 24;

  // ---------------- Pelanggan ----------------
  const password = await bcrypt.hash('demo1234', 10);
  const today = todayJkt();
  const customers = Array.from({ length: 42 }, (_, i) => {
    const joinedDaysAgo = Math.floor(rand() * (PAST_DAYS + 30));
    // Pelanggan "rajin" lebih sering main → jadi VIP/loyal setelah stats dihitung.
    const activity = weighted<'heavy' | 'regular' | 'light'>([['heavy', 6], ['regular', 16], ['light', 20]]);
    return {
      id: crypto.randomUUID(),
      name: `${FIRST[i % FIRST.length]} ${pick(LAST)}`,
      whatsapp: `${PHONE_PREFIX}${String(1000 + i)}`,
      password,
      tags: [DEMO_TAG, ...(chance(0.5) ? ['whatsapp'] : [])],
      createdAt: jktDate(addDays(today, -joinedDaysAgo), '12:00'),
      activity,
    };
  });
  await prisma.customer.createMany({ data: customers.map(({ activity: _a, ...c }) => c) });
  console.log(`👥 ${customers.length} pelanggan demo dibuat`);

  const pool = customers.flatMap((c) => Array(c.activity === 'heavy' ? 8 : c.activity === 'regular' ? 3 : 1).fill(c));

  // ---------------- Booking ----------------
  const bookings: Prisma.BookingCreateManyInput[] = [];
  const payments: Prisma.PaymentCreateManyInput[] = [];
  const now = new Date();

  for (let d = -PAST_DAYS; d <= FUTURE_DAYS; d++) {
    const dateStr = addDays(today, d);
    const dow = jktDate(dateStr, '12:00').getUTCDay();
    if (setting.closedDays.includes(dow)) continue;
    const weekend = dow === 0 || dow === 6;
    // Tren naik: makin dekat hari ini makin ramai (cerita "pertumbuhan" setelah pakai AI).
    const growth = 0.55 + 0.45 * ((d + PAST_DAYS) / (PAST_DAYS + FUTURE_DAYS));
    const futureFactor = d > 0 ? 0.55 - d * 0.05 : 1;

    for (const st of stations) {
      let h = openH;
      while (h < closeH) {
        const evening = h >= 16;
        const base = (weekend ? 0.55 : 0.3) + (evening ? 0.25 : 0) - (h < 13 ? 0.1 : 0);
        if (!chance(base * growth * futureFactor)) {
          h += 1;
          continue;
        }
        const dur = Math.min(weighted([[1, 3], [2, 5], [3, 3], [4, 1]]), closeH - h);
        const start = jktDate(dateStr, `${String(h).padStart(2, '0')}:00`);
        const end = new Date(start.getTime() + dur * 3_600_000);
        const cust = pick(pool);
        const source = weighted<'ai' | 'web' | 'manual'>([['ai', 3 + (d + PAST_DAYS) / 15], ['web', 3], ['manual', 2]]);
        const channel = source === 'ai' ? (chance(0.7) ? 'whatsapp' : 'web') : source === 'web' ? 'web' : null;

        let promoId: string | null = null;
        const subtotal = st.pricePerHour * dur;
        let discount = 0;
        if (weekend && weekendPromo && chance(0.25)) {
          promoId = weekendPromo.id;
          discount = Math.round(subtotal * 0.2);
        } else if (!evening && siangPromo && chance(0.2)) {
          promoId = siangPromo.id;
          discount = Math.round(subtotal * 0.15);
        }
        const totalPrice = subtotal - discount;

        let status: string;
        if (end <= now) status = weighted([['completed', 88], ['cancelled', 8], ['no_show', 4]]);
        else if (start <= now) status = 'checked_in';
        else status = weighted([['confirmed', 80], ['pending', 8], ['cancelled', 12]]);

        const id = crypto.randomUUID();
        const createdAt = new Date(start.getTime() - (1 + rand() * 72) * 3_600_000);
        bookings.push({
          id,
          bookingCode: code(start),
          startTime: start,
          endTime: end,
          durationHours: dur,
          subtotal,
          discount,
          totalPrice,
          status,
          source,
          channel,
          promoId,
          customerId: cust.id,
          stationId: st.id,
          checkedInAt: ['completed', 'checked_in'].includes(status) ? start : null,
          cancelledAt: status === 'cancelled' ? new Date(start.getTime() - 3_600_000 * 5) : null,
          cancelReason: status === 'cancelled' ? pick(['Ada acara mendadak', 'Ganti jadwal', 'Teman berhalangan']) : null,
          notes: chance(0.15) ? pick(['Main ber-4, minta stik tambahan', 'Mau main FC 25', 'Ulang tahun teman 🎉']) : null,
          createdAt,
        });

        // Pembayaran: QRIS untuk sebagian besar booking online, cash di kasir untuk sisanya.
        if (status !== 'cancelled') {
          const qris = source !== 'manual' && chance(0.75);
          const paid = status === 'completed' || status === 'checked_in' || (status === 'confirmed' && qris);
          if (status === 'pending' || paid) {
            payments.push({
              id: crypto.randomUUID(),
              bookingId: id,
              provider: qris ? 'midtrans' : 'manual',
              method: qris ? 'qris' : 'cash',
              amount: totalPrice,
              status: paid ? 'paid' : 'pending',
              transactionId: qris ? `${id.slice(0, 8)}-DEMO` : null,
              paidAt: paid ? (qris ? new Date(createdAt.getTime() + 10 * 60_000) : start) : null,
              expiredAt: status === 'pending' ? new Date(Date.now() + 25 * 60_000) : null,
              createdAt,
            });
          }
        }
        h += dur;
      }
    }
  }

  for (let i = 0; i < bookings.length; i += 500) await prisma.booking.createMany({ data: bookings.slice(i, i + 500) });
  for (let i = 0; i < payments.length; i += 500) await prisma.payment.createMany({ data: payments.slice(i, i + 500) });
  console.log(`📅 ${bookings.length} booking & ${payments.length} pembayaran dibuat`);

  // ---------------- Ulasan ----------------
  const completed = bookings.filter((b) => b.status === 'completed');
  const reviews = completed
    .filter(() => chance(0.22))
    .map((b) => {
      const [rating, comment] = pick(REVIEWS);
      return { id: crypto.randomUUID(), bookingId: b.id!, customerId: b.customerId, rating, comment, createdAt: new Date((b.endTime as Date).getTime() + 2 * 3_600_000) };
    });
  await prisma.review.createMany({ data: reviews });
  console.log(`⭐ ${reviews.length} ulasan dibuat`);

  // ---------------- Chat AI + log ----------------
  const sessions: Prisma.ChatSessionCreateManyInput[] = [];
  const messages: Prisma.ChatMessageCreateManyInput[] = [];
  const logs: Prisma.AiLogCreateManyInput[] = [];
  const models = ['gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-lite-latest'];

  for (let i = 0; i < 70; i++) {
    const script = i < CHAT_SCRIPTS.length * 2 ? CHAT_SCRIPTS[i % CHAT_SCRIPTS.length] : pick(CHAT_SCRIPTS);
    const cust = pick(pool);
    const daysAgo = i < 6 ? 0 : Math.floor(rand() * PAST_DAYS);
    const t0 = new Date(jktDate(addDays(today, -daysAgo), `${String(10 + Math.floor(rand() * 10)).padStart(2, '0')}:00`).getTime() + rand() * 3_600_000);
    if (t0 > now) t0.setTime(now.getTime() - (i + 1) * 7 * 60_000);
    const handoff = script.intent === 'komplain';
    const recent = daysAgo === 0;
    const sid = crypto.randomUUID();
    const last = script.msgs[script.msgs.length - 1];
    const lastAt = new Date(t0.getTime() + script.msgs.length * 20_000);

    sessions.push({
      id: sid,
      customerId: cust.id,
      channel: chance(0.65) ? 'whatsapp' : 'web',
      title: script.title,
      summary: script.summary,
      intent: script.intent,
      priority: handoff ? 'high' : 'normal',
      status: handoff ? (recent ? 'human' : 'closed') : recent ? 'ai_pilot' : 'closed',
      lastMessage: last[1].slice(0, 120),
      lastMessageAt: lastAt,
      lastSender: last[0],
      unreadByAdmin: handoff && recent ? 1 : 0,
      closedAt: recent ? null : new Date(lastAt.getTime() + 3_600_000),
      rating: !recent && chance(0.4) ? pick([4, 5, 5, 5]) : null,
      createdAt: t0,
    });
    script.msgs.forEach(([sender, text], k) => {
      const at = new Date(t0.getTime() + k * 20_000);
      messages.push({ id: crypto.randomUUID(), sessionId: sid, sender, message: text, createdAt: at, readAt: at });
      if (sender === 'ai') {
        logs.push({
          id: crypto.randomUUID(),
          feature: 'chat',
          model: pick(models),
          sessionId: sid,
          customerId: cust.id,
          input: { message: script.msgs[k - 1]?.[1] ?? '' },
          output: { reply: text, agent: script.intent === 'komplain' ? 'support' : script.intent === 'booking' ? 'booking' : 'info' },
          promptTokens: 1200 + Math.floor(rand() * 900),
          completionTokens: 40 + Math.floor(rand() * 120),
          latencyMs: 1800 + Math.floor(rand() * 5200),
          status: handoff ? 'handoff' : chance(0.03) ? 'error' : 'success',
          createdAt: at,
        });
      }
    });
    if (handoff) messages.push({ id: crypto.randomUUID(), sessionId: sid, sender: 'system', message: 'Percakapan diteruskan ke admin.', createdAt: lastAt });
  }
  await prisma.chatSession.createMany({ data: sessions });
  for (let i = 0; i < messages.length; i += 500) await prisma.chatMessage.createMany({ data: messages.slice(i, i + 500) });
  await prisma.aiLog.createMany({ data: logs });
  console.log(`💬 ${sessions.length} sesi chat, ${messages.length} pesan, ${logs.length} log AI dibuat`);

  // ---------------- Pesan promo terkirim ----------------
  const promoMsgs = customers
    .filter(() => chance(0.3))
    .map((c) => ({
      id: crypto.randomUUID(),
      customerId: c.id,
      content: `Halo kak ${c.name.split(' ')[0]}! Kangen mabar? 🎮 Main Senin–Jumat jam 10–15 pakai kode *SIANGHEMAT* diskon 15%. Booking langsung balas chat ini ya!`,
      tone: pick(['friendly', 'casual', 'urgent']),
      tags: ['Absen 14 hari', 'Diskon 15%'],
      status: 'sent',
      sentAt: jktDate(addDays(today, -Math.floor(rand() * 20)), '11:00'),
      promoId: siangPromo?.id ?? null,
    }));
  await prisma.promoMessage.createMany({ data: promoMsgs });
  console.log(`📣 ${promoMsgs.length} pesan promo dibuat`);

  // ---------------- Statistik pelanggan & metrik harian ----------------
  for (const c of customers) await recalcCustomerStats(c.id);
  const tiers = await prisma.customer.groupBy({ by: ['tier'], where: { tags: { has: DEMO_TAG } }, _count: true });
  console.log(`🏅 Tier pelanggan: ${tiers.map((t) => `${t.tier}=${t._count}`).join(', ')}`);

  await persistMetrics(await computeRangeMetrics(addDays(today, -PAST_DAYS), today));
  console.log('📊 Metrik harian dihitung ulang');
  console.log('\n✅ Selesai! Login pelanggan demo: 62899001000 … 62899001041 / password demo1234');
}

main()
  .catch((e) => {
    console.error('❌ Seed demo gagal:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

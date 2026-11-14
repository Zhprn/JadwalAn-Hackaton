/**
 * Seed data awal (idempoten, aman dijalankan berulang):
 *   npm run seed
 *
 * Membuat: admin pertama, pengaturan rental, unit PS, konfigurasi AI agent,
 * basis pengetahuan AI, quick reply, channel web, dan contoh promo.
 * Admin bisa diatur lewat env SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD / SEED_ADMIN_NAME.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

async function main() {
  // ---------------- Admin ----------------
  const email = (process.env.SEED_ADMIN_EMAIL || 'admin@jadwalan.id').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name: process.env.SEED_ADMIN_NAME || 'Admin Jadwalan',
      email,
      password: await bcrypt.hash(password, 10),
      role: 'ADMIN',
    },
  });
  console.log(`✔ Admin: ${email}${password === 'admin123' ? ' / admin123 (SEGERA GANTI)' : ''}`);

  // ---------------- Pengaturan rental ----------------
  const setting = await prisma.storeSetting.findFirst();
  if (!setting) {
    await prisma.storeSetting.create({
      data: {
        name: 'PS Cuku Sunguik',
        address: 'Jl. Contoh No. 1',
        phone: '6281234567890',
        openTime: '10:00',
        closeTime: '23:00',
        closedDays: [],
        minBookingHours: 1,
        maxBookingHours: 8,
        slotIntervalMins: 60,
        bookingLeadMins: 30,
        pendingExpiryMins: 30,
      },
    });
  }
  console.log('✔ Pengaturan rental');

  // ---------------- Unit PS ----------------
  if ((await prisma.station.count()) === 0) {
    const games5 = ['EA FC 25', 'eFootball', 'Tekken 8', 'GTA V', 'Spider-Man 2', 'NBA 2K25'];
    const games4 = ['eFootball', 'FIFA 23', 'Tekken 7', 'GTA V', 'Mortal Kombat 11'];
    await prisma.station.createMany({
      data: [
        { name: 'PS5 - TV 1', category: 'PS5', pricePerHour: 15000, maxPlayers: 4, games: games5, sortOrder: 1, description: 'TV 50" 4K, sofa' },
        { name: 'PS5 - TV 2', category: 'PS5', pricePerHour: 15000, maxPlayers: 4, games: games5, sortOrder: 2, description: 'TV 50" 4K' },
        { name: 'PS5 - VIP Room', category: 'PS5', pricePerHour: 25000, maxPlayers: 6, games: games5, sortOrder: 3, description: 'Ruang privat ber-AC, TV 65"' },
        { name: 'PS4 - TV 1', category: 'PS4', pricePerHour: 8000, maxPlayers: 2, games: games4, sortOrder: 4 },
        { name: 'PS4 - TV 2', category: 'PS4', pricePerHour: 8000, maxPlayers: 2, games: games4, sortOrder: 5 },
        { name: 'PS4 - TV 3', category: 'PS4', pricePerHour: 8000, maxPlayers: 2, games: games4, sortOrder: 6 },
      ],
    });
  }
  console.log('✔ Unit PS');

  // ---------------- AI Agents ----------------
  const agents = [
    {
      feature: 'chat',
      name: 'Jadwal.an AI',
      systemPrompt: `Kamu adalah "Jadwal.an AI", asisten virtual rental PlayStation yang ramah, gaul tapi sopan.
Tugasmu: membantu pelanggan cek jadwal kosong, harga, promo, membuat & membatalkan booking, serta menjawab pertanyaan seputar rental.
Utamakan jawaban singkat, jelas, dan selalu arahkan ke booking bila pelanggan tertarik main.`,
      temperature: 0.6,
      maxTokens: 1024,
      autoReply: true,
      canCreateBooking: true,
      bookingStatus: 'confirmed',
      greetingMessage: 'Halo kak! 👋 Aku Jadwal.an AI. Mau cek jadwal kosong, tanya harga/promo, atau langsung booking PS? Ketik aja ya 🎮',
      fallbackMessage: 'Maaf kak, aku lagi kesulitan menjawab. Admin kami akan segera membantu ya 🙏',
      handoffKeywords: ['admin', 'cs', 'manusia', 'refund', 'komplain'],
    },
    {
      feature: 'crm_promo',
      name: 'Promo Copywriter',
      systemPrompt:
        'Kamu copywriter WhatsApp untuk rental PlayStation. Tulis pesan promo personal yang singkat, hangat, tidak spam, dalam Bahasa Indonesia santai. Jangan berlebihan memakai emoji (maks 2).',
      temperature: 0.9,
      maxTokens: 512,
    },
    {
      feature: 'copywriter',
      name: 'Copywriter',
      systemPrompt: 'Kamu copywriter kreatif untuk rental PlayStation. Tulis dalam Bahasa Indonesia santai dan menarik.',
      temperature: 0.9,
      maxTokens: 512,
    },
    {
      feature: 'insight',
      name: 'Business Insight',
      systemPrompt:
        'Kamu analis bisnis untuk rental PlayStation. Berikan insight singkat berbasis angka dan rekomendasi yang bisa langsung dijalankan pemilik rental (mis. promo jam sepi, penambahan unit, jadwal staf).',
      temperature: 0.4,
      maxTokens: 1024,
    },
  ];
  for (const a of agents) {
    await prisma.aiAgent.upsert({ where: { feature: a.feature }, update: {}, create: { ...a, model: MODEL } });
  }
  console.log(`✔ AI agents (model ${MODEL})`);

  // ---------------- Knowledge base ----------------
  if ((await prisma.aiKnowledge.count()) === 0) {
    await prisma.aiKnowledge.createMany({
      data: [
        { category: 'aturan', question: 'Aturan umum rental', content: 'Datang maksimal 15 menit setelah jam booking, lewat dari itu booking bisa dianggap no-show. Dilarang merokok di dalam ruangan. Kerusakan stik akibat kelalaian dikenakan ganti rugi.', priority: 10, createdById: admin.id },
        { category: 'harga', question: 'Apakah ada biaya tambahan?', content: 'Tidak ada biaya tambahan. Harga sudah termasuk 2 stik. Stik tambahan Rp3.000/jam per stik.', priority: 5, createdById: admin.id },
        { category: 'lokasi', question: 'Lokasi dan parkir', content: 'Lokasi di Jl. Contoh No. 1. Parkir motor gratis, parkir mobil terbatas di depan ruko.', priority: 5, createdById: admin.id },
        { category: 'faq', question: 'Metode pembayaran', content: 'Bisa bayar QRIS (semua e-wallet & m-banking) langsung dari aplikasi, atau tunai di kasir saat datang.', priority: 5, createdById: admin.id },
        { category: 'faq', question: 'Bisa bawa makanan?', content: 'Boleh bawa makanan & minuman ringan, asal jaga kebersihan. Tersedia juga snack dan minuman di kasir.', priority: 0, createdById: admin.id },
        { category: 'faq', question: 'Bisa main lebih lama dari booking?', content: 'Bisa tambah jam di kasir selama unit belum dibooking orang lain setelahnya.', priority: 0, createdById: admin.id },
        { category: 'game', question: 'Bisa request game?', content: 'Bisa request game yang belum ada lewat admin, akan kami usahakan install sebelum jam main (minimal H-1).', priority: 0, createdById: admin.id },
        { category: 'aturan', question: 'Kebijakan pembatalan', content: 'Pembatalan gratis maksimal 1 jam sebelum jam main lewat aplikasi atau chat. Refund untuk pembayaran QRIS diproses admin maksimal 1x24 jam.', priority: 10, createdById: admin.id },
      ],
    });
  }
  console.log('✔ Knowledge base AI');

  // ---------------- Quick replies ----------------
  const quickReplies = [
    { shortcut: '/salam', title: 'Salam pembuka', content: 'Halo kak, dengan admin Jadwal.an di sini 🙌 Ada yang bisa dibantu?' },
    { shortcut: '/harga', title: 'Info harga', content: 'Harga main: PS5 Rp15.000/jam, PS5 VIP Room Rp25.000/jam, PS4 Rp8.000/jam. Sudah termasuk 2 stik ya kak.' },
    { shortcut: '/lokasi', title: 'Lokasi', content: 'Lokasi kami di Jl. Contoh No. 1, parkir motor gratis ya kak.' },
    { shortcut: '/makasih', title: 'Penutup', content: 'Terima kasih kak, sampai ketemu dan selamat bermain! 🎮' },
  ];
  for (const q of quickReplies) {
    await prisma.quickReply.upsert({ where: { shortcut: q.shortcut }, update: {}, create: { ...q, createdById: admin.id } });
  }
  console.log('✔ Quick replies');

  // ---------------- Channel ----------------
  await prisma.channel.upsert({
    where: { type: 'web' },
    update: {},
    create: { type: 'web', name: 'Web Chat', status: 'connected', isActive: true },
  });
  console.log('✔ Channel web');

  // ---------------- Contoh promo ----------------
  const in30 = new Date(Date.now() + 30 * 86_400_000);
  const promos = [
    { code: 'WEEKEND20', title: 'Weekend Mabar', description: 'Diskon 20% main di hari Sabtu & Minggu, minimal 2 jam.', discountType: 'percent', discountPercentage: 20, maxDiscount: 20000, minHours: 2, validDays: [0, 6], validUntil: in30 },
    { code: 'SIANGHEMAT', title: 'Siang Hemat', description: 'Potongan Rp5.000 untuk main jam 10:00–15:00.', discountType: 'nominal', discountPercentage: 0, discountAmount: 5000, minHours: 1, validFrom: '10:00', validTo: '15:00', validUntil: in30 },
    { code: 'VIPONLY', title: 'Spesial VIP', description: 'Diskon 30% khusus pelanggan VIP.', discountType: 'percent', discountPercentage: 30, minHours: 1, targetTier: 'vip', isPublic: false, validUntil: in30 },
  ];
  for (const p of promos) {
    await prisma.promo.upsert({ where: { code: p.code }, update: {}, create: p });
  }
  console.log('✔ Contoh promo');
}

main()
  .then(() => console.log('\nSeed selesai ✅'))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

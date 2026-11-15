import { SchemaType, type FunctionCall, type FunctionDeclaration } from '@google/generative-ai';
import prisma from '../../lib/prisma';
import { addMinutes, DATE_REGEX, formatJkt, jktDate, jktParts, TIME_REGEX } from '../../lib/time';
import { getStoreSetting } from '../settings.service';
import {
  ACTIVE_STATUSES,
  assertSlotRules,
  createBooking,
  getAvailability,
  quotePrice,
  updateBookingStatus,
} from '../booking.service';
import { createQrisPayment, getPaymentStatus } from '../payment.service';
import type { AgentConfig } from './context';

export type ToolName =
  | 'check_availability'
  | 'quote_price'
  | 'create_booking'
  | 'send_payment_qris'
  | 'check_payment_status'
  | 'get_my_bookings'
  | 'cancel_my_booking'
  | 'get_promos'
  | 'handoff_to_admin';

export type ToolContext = {
  customerId?: string | null;
  sessionId?: string | null;
  channel?: string;
  config: AgentConfig;
  /** Mode uji (playground admin): tidak membuat / membatalkan booking sungguhan. */
  dryRun?: boolean;
  /** Hasil samping yang dikumpulkan selama satu giliran. */
  state: { bookingIds: string[]; handoffReason?: string; /** Booking yang QRIS-nya perlu dikirim sebagai gambar. */ qrisBookingIds: string[] };
};

// ---------------------------------------------------------------------
// Deklarasi tool untuk Gemini
// ---------------------------------------------------------------------

const str = (description: string) => ({ type: SchemaType.STRING, description }) as const;
const int = (description: string) => ({ type: SchemaType.INTEGER, description }) as const;

export const TOOL_DECLARATIONS: Record<ToolName, FunctionDeclaration> = {
  check_availability: {
    name: 'check_availability',
    description:
      'Cek slot jam kosong pada tanggal tertentu. Selalu panggil ini sebelum menyebut jam yang tersedia. Hasil berisi rentang jam kosong per unit.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        date: str('Tanggal format YYYY-MM-DD (WIB).'),
        category: str('Opsional. Filter jenis konsol: PS5 atau PS4.'),
        start_time: str('Opsional. Jam mulai yang diinginkan format HH:mm, untuk cek unit mana yang kosong di jam itu.'),
      },
      required: ['date'],
    },
  },
  quote_price: {
    name: 'quote_price',
    description: 'Hitung total harga booking (termasuk diskon promo) dan pastikan slot masih kosong. Panggil sebelum meminta konfirmasi.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        station_id: str('ID unit dari daftar unit.'),
        date: str('Tanggal YYYY-MM-DD.'),
        start_time: str('Jam mulai HH:mm.'),
        duration_hours: int('Durasi dalam jam (bilangan bulat).'),
        promo_code: str('Opsional. Kode promo.'),
      },
      required: ['station_id', 'date', 'start_time', 'duration_hours'],
    },
  },
  create_booking: {
    name: 'create_booking',
    description:
      'Buat booking sungguhan. HANYA panggil setelah pelanggan secara jelas mengonfirmasi detail (unit, tanggal, jam, durasi, total harga).',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        station_id: str('ID unit.'),
        date: str('Tanggal YYYY-MM-DD.'),
        start_time: str('Jam mulai HH:mm.'),
        duration_hours: int('Durasi dalam jam.'),
        promo_code: str('Opsional. Kode promo.'),
        notes: str('Opsional. Catatan pelanggan (mis. jumlah pemain, game yang diminta).'),
        payment_method: {
          type: SchemaType.STRING,
          format: 'enum',
          enum: ['qris', 'cash'],
          description: 'Metode bayar pilihan pelanggan: "qris" (QR dikirim otomatis) atau "cash" (bayar di kasir).',
        },
      },
      required: ['station_id', 'date', 'start_time', 'duration_hours', 'payment_method'],
    },
  },
  check_payment_status: {
    name: 'check_payment_status',
    description:
      'Cek status pembayaran QRIS LANGSUNG ke Midtrans. WAJIB dipanggil setiap kali pelanggan bilang sudah bayar/transfer atau menanyakan status bayar. Tanpa kode booking = booking terbaru pelanggan yang belum lunas.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { booking_code: str('Opsional. Kode booking, mis. JA261116ABCD.') },
    },
  },
  send_payment_qris: {
    name: 'send_payment_qris',
    description:
      'Kirim (ulang) gambar QR QRIS untuk booking milik pelanggan yang belum dibayar. Pakai saat pelanggan minta QR lagi, QR kedaluwarsa, atau ingin ganti bayar via QRIS.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { booking_code: str('Kode booking, mis. JA-20261115-0001.') },
      required: ['booking_code'],
    },
  },
  get_my_bookings: {
    name: 'get_my_bookings',
    // Tanpa `parameters`: Gemini menolak OBJECT dengan properties kosong.
    description: 'Lihat booking milik pelanggan ini (yang akan datang dan beberapa riwayat terakhir).',
  },
  cancel_my_booking: {
    name: 'cancel_my_booking',
    description: 'Batalkan booking milik pelanggan berdasarkan kode booking. Hanya setelah pelanggan mengonfirmasi ingin membatalkan.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: {
        booking_code: str('Kode booking, mis. JA2611145K3D.'),
        reason: str('Alasan pembatalan.'),
      },
      required: ['booking_code'],
    },
  },
  get_promos: {
    name: 'get_promos',
    description: 'Daftar promo yang sedang berlaku dan bisa dipakai pelanggan ini.',
  },
  handoff_to_admin: {
    name: 'handoff_to_admin',
    description:
      'Alihkan percakapan ke admin manusia. Pakai jika pelanggan komplain, minta refund, minta bicara dengan admin, atau pertanyaan di luar kemampuanmu.',
    parameters: {
      type: SchemaType.OBJECT,
      properties: { reason: str('Alasan singkat kenapa perlu admin.') },
      required: ['reason'],
    },
  },
};

// ---------------------------------------------------------------------
// Implementasi tool
// ---------------------------------------------------------------------

const rupiah = (n: number) => `Rp${n.toLocaleString('id-ID')}`;

const parseWhen = (date: unknown, time: unknown) => {
  const d = String(date ?? '');
  const t = String(time ?? '').padStart(5, '0');
  if (!DATE_REGEX.test(d)) throw new Error('Format tanggal harus YYYY-MM-DD');
  if (!TIME_REGEX.test(t)) throw new Error('Format jam harus HH:mm');
  return jktDate(d, t);
};

/** Gabungkan slot kosong yang berurutan menjadi rentang, mis. "10:00–14:00". */
const freeRanges = (slots: { start: string; end: string; available: boolean }[]) => {
  const ranges: string[] = [];
  let from: string | null = null;
  let to = '';
  for (const s of slots) {
    if (s.available) {
      if (!from) from = s.start;
      to = s.end;
    } else if (from) {
      ranges.push(`${from}–${to}`);
      from = null;
    }
  }
  if (from) ranges.push(`${from}–${to}`);
  return ranges;
};

const executors: Record<ToolName, (args: any, ctx: ToolContext) => Promise<unknown>> = {
  async check_availability(args) {
    const date = String(args.date ?? '');
    if (!DATE_REGEX.test(date)) return { ok: false, error: 'Format tanggal harus YYYY-MM-DD' };
    const av = await getAvailability({ date, category: args.category || undefined, enforceLead: true });
    if (av.closed) return { ok: true, date, closed: true, message: 'Rental tutup pada tanggal tersebut' };

    if (args.start_time) {
      const t = String(args.start_time).padStart(5, '0');
      const free = av.stations
        .map((s) => ({ s, slot: s.slots.find((x) => x.start === t) }))
        .filter((x) => x.slot?.available)
        .map((x) => ({ station_id: x.s.station.id, name: x.s.station.name, category: x.s.station.category, price_per_hour: x.s.station.pricePerHour, max_hours_from_here: x.slot!.maxHours }));
      return { ok: true, date, start_time: t, available_stations: free, note: free.length ? undefined : 'Tidak ada unit kosong di jam itu' };
    }

    return {
      ok: true,
      date,
      open: `${av.openTime}–${av.closeTime}`,
      stations: av.stations.map((s) => ({
        station_id: s.station.id,
        name: s.station.name,
        category: s.station.category,
        price_per_hour: s.station.pricePerHour,
        free: freeRanges(s.slots),
      })),
    };
  },

  async quote_price(args, ctx) {
    const start = parseWhen(args.date, args.start_time);
    const duration = Number(args.duration_hours);
    const setting = await getStoreSetting();
    let end: Date;
    try {
      end = assertSlotRules({ setting, start, durationHours: duration, enforceLead: true });
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
    const clash = await prisma.booking.findFirst({
      where: { stationId: String(args.station_id), status: { in: ACTIVE_STATUSES }, startTime: { lt: end }, endTime: { gt: start } },
      select: { startTime: true, endTime: true },
    });
    if (clash) {
      return { ok: false, error: `Slot bentrok dengan booking ${jktParts(clash.startTime).timeStr}–${jktParts(clash.endTime).timeStr}` };
    }

    const customer = ctx.customerId
      ? await prisma.customer.findUnique({ where: { id: ctx.customerId }, select: { id: true, tier: true } })
      : null;
    const q = await quotePrice({ stationId: String(args.station_id), start, durationHours: duration, promoCode: args.promo_code, customer });
    return {
      ok: true,
      station: q.station.name,
      when: `${formatJkt(start)} – ${jktParts(end).timeStr} WIB`,
      duration_hours: duration,
      subtotal: rupiah(q.subtotal),
      discount: rupiah(q.discount),
      total: rupiah(q.totalPrice),
      promo_applied: q.promo?.code ?? null,
      promo_error: q.promoError,
    };
  },

  async create_booking(args, ctx) {
    if (!ctx.config.canCreateBooking) {
      return { ok: false, error: 'AI tidak diizinkan membuat booking. Arahkan pelanggan booking lewat aplikasi atau admin.' };
    }
    if (!ctx.customerId) return { ok: false, error: 'Pelanggan harus login dulu untuk booking.' };
    const method = String(args.payment_method ?? '').toLowerCase() === 'cash' ? 'cash' : 'qris';
    const midtransReady = !!process.env.MIDTRANS_SERVER_KEY;
    const wantsQris = method === 'qris' && midtransReady;
    const start = parseWhen(args.date, args.start_time);
    if (ctx.dryRun) {
      return { ok: true, dry_run: true, message: 'Mode uji: booking tidak benar-benar dibuat.', booking_code: 'JA-TEST', payment_method: method };
    }

    // Cegah booking ganda: pelanggan yang sama sudah punya booking aktif yang bentrok di jam ini
    // (mis. pelanggan mengulang "ya/lanjut" setelah booking sudah dibuat).
    const durationMs = Number(args.duration_hours) * 3_600_000;
    const existing = await prisma.booking.findFirst({
      where: {
        customerId: ctx.customerId,
        status: { in: ['pending', 'confirmed', 'checked_in'] },
        startTime: { lt: new Date(start.getTime() + durationMs) },
        endTime: { gt: start },
      },
      include: { station: { select: { name: true } }, payment: { select: { status: true } } },
    });
    if (existing) {
      return {
        ok: false,
        already_booked: true,
        booking_code: existing.bookingCode,
        station: existing.station.name,
        when: `${formatJkt(existing.startTime)} – ${jktParts(existing.endTime).timeStr} WIB`,
        payment: existing.payment?.status === 'paid' ? 'lunas' : existing.status === 'pending' ? 'menunggu pembayaran' : 'bayar di kasir',
        error:
          'Pelanggan SUDAH punya booking di jam ini — jangan buat booking baru. Ingatkan kode booking tsb; jika belum dibayar dan pelanggan mau QRIS, panggil send_payment_qris.',
      };
    }

    // QRIS → pending sampai dibayar. Cash → ikut pengaturan agent (default langsung terkonfirmasi).
    const { booking, promoWarning } = await createBooking({
      stationId: String(args.station_id),
      customerId: ctx.customerId,
      start,
      durationHours: Number(args.duration_hours),
      promoCode: args.promo_code || null,
      notes: args.notes || null,
      source: 'ai',
      channel: ctx.channel ?? 'web',
      status: wantsQris || ctx.config.bookingStatus === 'pending' ? 'pending' : 'confirmed',
      chatSessionId: ctx.sessionId ?? null,
      enforceLead: true,
      strictPromo: false,
    });
    ctx.state.bookingIds.push(booking.id);

    let payment_note: string;
    let qris: Record<string, unknown> | null = null;
    if (wantsQris && booking.totalPrice > 0) {
      try {
        const p = await createQrisPayment(booking.id);
        ctx.state.qrisBookingIds.push(booking.id);
        qris = { sent_as_image: true, amount: rupiah(p.amount), expires_at: p.expiredAt ? `${jktParts(p.expiredAt).timeStr} WIB` : null };
        payment_note = 'Gambar QR QRIS dikirim otomatis setelah balasanmu. Booking terkonfirmasi otomatis setelah dibayar; jika lewat batas waktu, booking batal.';
      } catch (e: any) {
        await updateBookingStatus(booking.id, 'confirmed', { actor: 'system' }).catch(() => undefined);
        payment_note = `QRIS gagal dibuat (${e?.message ?? 'error'}). Booking dikonfirmasi, pembayaran di kasir saat datang.`;
      }
    } else if (wantsQris) {
      await updateBookingStatus(booking.id, 'confirmed', { actor: 'system' }).catch(() => undefined);
      payment_note = 'Total Rp0, tidak perlu pembayaran. Booking terkonfirmasi.';
    } else if (method === 'qris') {
      payment_note = 'QRIS belum tersedia di rental ini. Booking dibuat dengan pembayaran di kasir.';
    } else {
      payment_note = 'Bayar cash di kasir saat datang. Tunjukkan kode booking ke kasir.';
    }

    return {
      ok: true,
      booking_code: booking.bookingCode,
      status: booking.status,
      station: booking.station.name,
      when: `${formatJkt(booking.startTime)} – ${jktParts(booking.endTime).timeStr} WIB`,
      total: rupiah(booking.totalPrice),
      discount: rupiah(booking.discount),
      promo_warning: promoWarning,
      payment_method: wantsQris ? 'qris' : 'cash',
      qris,
      payment_note,
    };
  },

  async check_payment_status(args, ctx) {
    if (!ctx.customerId) return { ok: false, error: 'Pelanggan belum login.' };
    const code = String(args.booking_code ?? '').trim().toUpperCase();
    const booking = await prisma.booking.findFirst({
      where: code
        ? { customerId: ctx.customerId, bookingCode: code }
        : { customerId: ctx.customerId, status: { in: ['pending', 'confirmed'] }, payment: { isNot: null } },
      include: { payment: true, station: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    if (!booking) return { ok: false, error: code ? `Booking ${code} tidak ditemukan.` : 'Tidak ada booking dengan tagihan pembayaran.' };
    if (!booking.payment) {
      return { ok: true, booking_code: booking.bookingCode, paid: false, status: 'tidak ada tagihan QRIS', note: 'Booking ini dibayar di kasir saat datang.' };
    }
    // Status diambil ulang dari Midtrans (bukan dari pengakuan pelanggan). Jika memang lunas, booking otomatis terkonfirmasi.
    const p = await getPaymentStatus(booking.id);
    const paid = p.status === 'paid';
    return {
      ok: true,
      booking_code: booking.bookingCode,
      station: booking.station.name,
      amount: rupiah(p.amount),
      paid,
      status: p.status,
      expires_at: !paid && p.expiredAt ? `${jktParts(p.expiredAt).timeStr} WIB` : null,
      instruction: paid
        ? 'Pembayaran SUDAH diterima sistem. Sampaikan booking terkonfirmasi.'
        : p.status === 'expired' || p.status === 'failed'
          ? 'QR sudah kedaluwarsa/gagal. Tawarkan kirim QR baru (send_payment_qris). Jangan katakan lunas.'
          : 'Pembayaran BELUM diterima sistem. JANGAN katakan sudah lunas/terkonfirmasi. Minta pelanggan pastikan transaksi berhasil di aplikasi e-wallet/m-banking lalu tunggu ±1 menit; jika yakin sudah terpotong saldo, tawarkan meneruskan bukti bayar ke admin (handoff_to_admin).',
    };
  },

  async send_payment_qris(args, ctx) {
    if (!ctx.customerId) return { ok: false, error: 'Pelanggan belum login.' };
    if (!process.env.MIDTRANS_SERVER_KEY) return { ok: false, error: 'QRIS belum tersedia di rental ini. Pembayaran di kasir.' };
    const code = String(args.booking_code ?? '').trim().toUpperCase();
    const booking = await prisma.booking.findFirst({
      where: { customerId: ctx.customerId, bookingCode: code },
      include: { payment: true },
    });
    if (!booking) return { ok: false, error: `Booking ${code} tidak ditemukan untuk pelanggan ini.` };
    if (booking.payment?.status === 'paid') return { ok: false, error: 'Booking ini sudah lunas.' };
    if (!['pending', 'confirmed'].includes(booking.status)) return { ok: false, error: `Booking berstatus ${booking.status}, tidak bisa dibayar.` };
    if (ctx.dryRun) return { ok: true, dry_run: true, message: 'Mode uji: QR tidak benar-benar dikirim.' };
    try {
      const p = await createQrisPayment(booking.id);
      ctx.state.qrisBookingIds.push(booking.id);
      return {
        ok: true,
        booking_code: booking.bookingCode,
        amount: rupiah(p.amount),
        expires_at: p.expiredAt ? `${jktParts(p.expiredAt).timeStr} WIB` : null,
        note: 'Gambar QR dikirim otomatis setelah balasanmu.',
      };
    } catch (e: any) {
      return { ok: false, error: e?.message ?? 'Gagal membuat QRIS' };
    }
  },

  async get_my_bookings(_args, ctx) {
    if (!ctx.customerId) return { ok: false, error: 'Pelanggan belum login.' };
    const [upcoming, recent] = await Promise.all([
      prisma.booking.findMany({
        where: { customerId: ctx.customerId, status: { in: ACTIVE_STATUSES }, endTime: { gte: new Date() } },
        include: { station: { select: { name: true } }, payment: { select: { status: true } } },
        orderBy: { startTime: 'asc' },
        take: 5,
      }),
      prisma.booking.findMany({
        where: { customerId: ctx.customerId, status: { in: ['completed', 'cancelled', 'no_show'] } },
        include: { station: { select: { name: true } } },
        orderBy: { startTime: 'desc' },
        take: 3,
      }),
    ]);
    const fmt = (b: (typeof upcoming)[number] | (typeof recent)[number]) => ({
      code: b.bookingCode,
      station: b.station.name,
      when: `${formatJkt(b.startTime)} – ${jktParts(b.endTime).timeStr}`,
      status: b.status,
      total: rupiah(b.totalPrice),
    });
    return {
      ok: true,
      upcoming: upcoming.map((b) => ({ ...fmt(b), payment: b.payment?.status ?? 'belum dibayar' })),
      recent: recent.map(fmt),
    };
  },

  async cancel_my_booking(args, ctx) {
    if (!ctx.customerId) return { ok: false, error: 'Pelanggan belum login.' };
    const code = String(args.booking_code ?? '').trim().toUpperCase();
    const booking = await prisma.booking.findFirst({ where: { bookingCode: code, customerId: ctx.customerId } });
    if (!booking) return { ok: false, error: `Booking ${code} tidak ditemukan untuk akun ini` };
    if (!['pending', 'confirmed'].includes(booking.status)) return { ok: false, error: `Booking berstatus ${booking.status}, tidak bisa dibatalkan` };
    if (booking.startTime < addMinutes(new Date(), 60)) {
      return { ok: false, error: 'Pembatalan maksimal 1 jam sebelum jam main. Hubungi admin.' };
    }
    if (ctx.dryRun) return { ok: true, dry_run: true, message: 'Mode uji: booking tidak benar-benar dibatalkan.' };
    await updateBookingStatus(booking.id, 'cancelled', { reason: args.reason || 'Dibatalkan via chat AI', actor: 'ai' });
    return { ok: true, booking_code: code, status: 'cancelled' };
  },

  async get_promos(_args, ctx) {
    const now = new Date();
    const customer = ctx.customerId
      ? await prisma.customer.findUnique({ where: { id: ctx.customerId }, select: { tier: true } })
      : null;
    const promos = await prisma.promo.findMany({
      where: {
        isActive: true,
        isPublic: true,
        startDate: { lte: now },
        validUntil: { gte: now },
        OR: [{ targetTier: null }, ...(customer ? [{ targetTier: customer.tier }] : [])],
      },
      orderBy: { validUntil: 'asc' },
      take: 10,
    });
    return {
      ok: true,
      promos: promos
        .filter((p) => p.usageLimit == null || p.usedCount < p.usageLimit)
        .map((p) => ({
          code: p.code,
          title: p.title,
          description: p.description,
          discount: p.discountType === 'nominal' ? rupiah(p.discountAmount) : `${p.discountPercentage}%${p.maxDiscount ? ` (maks ${rupiah(p.maxDiscount)})` : ''}`,
          console: p.consoleType,
          min_hours: p.minHours,
          valid_until: formatJkt(p.validUntil),
          days: p.validDays.length ? p.validDays : 'setiap hari',
          hours: p.validFrom && p.validTo ? `${p.validFrom}–${p.validTo}` : 'sepanjang jam buka',
        })),
    };
  },

  async handoff_to_admin(args, ctx) {
    ctx.state.handoffReason = String(args.reason ?? 'Pelanggan butuh bantuan admin');
    return { ok: true, message: 'Percakapan akan diteruskan ke admin. Sampaikan ke pelanggan bahwa admin akan segera membalas.' };
  },
};

export const executeTool = (call: FunctionCall, ctx: ToolContext) => {
  const fn = executors[call.name as ToolName];
  if (!fn) return Promise.resolve({ ok: false, error: `Tool ${call.name} tidak dikenal` });
  return fn(call.args ?? {}, ctx);
};

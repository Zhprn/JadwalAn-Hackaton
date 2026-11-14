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
import type { AgentConfig } from './context';

export type ToolName =
  | 'check_availability'
  | 'quote_price'
  | 'create_booking'
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
  state: { bookingIds: string[]; handoffReason?: string };
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
      },
      required: ['station_id', 'date', 'start_time', 'duration_hours'],
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
    const start = parseWhen(args.date, args.start_time);
    if (ctx.dryRun) {
      return { ok: true, dry_run: true, message: 'Mode uji: booking tidak benar-benar dibuat.', booking_code: 'JA-TEST' };
    }

    const { booking, promoWarning } = await createBooking({
      stationId: String(args.station_id),
      customerId: ctx.customerId,
      start,
      durationHours: Number(args.duration_hours),
      promoCode: args.promo_code || null,
      notes: args.notes || null,
      source: 'ai',
      channel: ctx.channel ?? 'web',
      status: ctx.config.bookingStatus === 'pending' ? 'pending' : 'confirmed',
      chatSessionId: ctx.sessionId ?? null,
      enforceLead: true,
      strictPromo: false,
    });
    ctx.state.bookingIds.push(booking.id);

    return {
      ok: true,
      booking_code: booking.bookingCode,
      status: booking.status,
      station: booking.station.name,
      when: `${formatJkt(booking.startTime)} – ${jktParts(booking.endTime).timeStr} WIB`,
      total: rupiah(booking.totalPrice),
      discount: rupiah(booking.discount),
      promo_warning: promoWarning,
      payment_note:
        booking.status === 'pending'
          ? 'Booking menunggu pembayaran QRIS di aplikasi. Jika tidak dibayar akan batal otomatis.'
          : 'Booking terkonfirmasi. Pembayaran bisa di kasir saat datang atau QRIS di aplikasi.',
    };
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

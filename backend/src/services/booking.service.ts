import { Prisma, Promo, Station } from '@prisma/client';
import prisma from '../lib/prisma';
import { badRequest, conflict, notFound } from '../lib/http';
import { logActivity, notifyAdmins } from '../lib/activity';
import { addDays, addMinutes, formatJkt, jktDate, jktParts, minutesToTime, timeToMinutes } from '../lib/time';
import { getStoreSetting, StoreSettingData } from './settings.service';
import { notifyBookingWa } from './notify.service';

// ---------------------------------------------------------------------
// Konstanta
// ---------------------------------------------------------------------

/** Status yang "memakan" slot (dianggap bentrok). */
export const ACTIVE_STATUSES = ['pending', 'confirmed', 'checked_in'];
export const BOOKING_STATUSES = ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

/** Transisi status yang diperbolehkan. */
const TRANSITIONS: Record<string, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

/** Ambang tier pelanggan. */
const TIER_RULES = { vip: { sessions: 20, spent: 1_000_000 }, loyal: { sessions: 5, spent: 250_000 } };

export const bookingInclude = {
  station: { select: { id: true, name: true, category: true, pricePerHour: true } },
  customer: { select: { id: true, name: true, whatsapp: true, tier: true } },
  promo: { select: { id: true, code: true, title: true } },
  payment: { select: { id: true, method: true, status: true, amount: true, qrUrl: true, paidAt: true, expiredAt: true } },
  review: { select: { id: true, rating: true, comment: true } },
} satisfies Prisma.BookingInclude;

// ---------------------------------------------------------------------
// Jam operasional
// ---------------------------------------------------------------------

export type OperatingWindow = { dateStr: string; closed: boolean; open: Date; close: Date };

/** Jendela buka-tutup untuk satu tanggal (WIB). Mendukung tutup lewat tengah malam (mis. 10:00–02:00). */
export const getOperatingWindow = (setting: StoreSettingData, dateStr: string): OperatingWindow => {
  const open = jktDate(dateStr, setting.openTime);
  let close = jktDate(dateStr, setting.closeTime);
  if (close <= open) close = addMinutes(close, 24 * 60);
  const weekday = jktParts(open).weekday;
  return { dateStr, closed: setting.closedDays.includes(weekday), open, close };
};

/** Cari jendela operasional yang memuat waktu mulai (bisa milik hari sebelumnya jika lewat tengah malam). */
const findWindowFor = (setting: StoreSettingData, start: Date) => {
  const dateStr = jktParts(start).dateStr;
  const today = getOperatingWindow(setting, dateStr);
  if (start >= today.open) return today;
  const yesterday = getOperatingWindow(setting, addDays(dateStr, -1));
  return start < yesterday.close ? yesterday : today;
};

// ---------------------------------------------------------------------
// Ketersediaan slot
// ---------------------------------------------------------------------

export type AvailabilityOptions = {
  date: string;
  stationId?: string;
  category?: string;
  /** true untuk pelanggan/AI: slot sebelum (sekarang + bookingLeadMins) dianggap tidak tersedia. */
  enforceLead?: boolean;
};

export const getAvailability = async ({ date, stationId, category, enforceLead = true }: AvailabilityOptions) => {
  const setting = await getStoreSetting();
  const win = getOperatingWindow(setting, date);

  const stations = await prisma.station.findMany({
    where: {
      status: 'active',
      ...(stationId ? { id: stationId } : {}),
      ...(category ? { category: { equals: category, mode: 'insensitive' } } : {}),
    },
    orderBy: { sortOrder: 'asc' },
  });

  const base = {
    date,
    openTime: setting.openTime,
    closeTime: setting.closeTime,
    slotIntervalMins: setting.slotIntervalMins,
    minBookingHours: setting.minBookingHours,
    maxBookingHours: setting.maxBookingHours,
  };

  if (win.closed) return { ...base, closed: true, stations: [] };

  const bookings = await prisma.booking.findMany({
    where: {
      stationId: { in: stations.map((s) => s.id) },
      status: { in: ACTIVE_STATUSES },
      startTime: { lt: win.close },
      endTime: { gt: win.open },
    },
    select: { stationId: true, startTime: true, endTime: true },
    orderBy: { startTime: 'asc' },
  });

  const earliest = enforceLead ? addMinutes(new Date(), setting.bookingLeadMins) : new Date(0);
  const step = Math.max(15, setting.slotIntervalMins);

  const result = stations.map((station) => {
    const own = bookings.filter((b) => b.stationId === station.id);
    const slots: { start: string; end: string; available: boolean; maxHours: number }[] = [];

    for (let t = win.open; addMinutes(t, step) <= win.close; t = addMinutes(t, step)) {
      const slotEnd = addMinutes(t, step);
      const busy = own.some((b) => b.startTime < slotEnd && b.endTime > t);
      const available = !busy && t >= earliest;

      // Berapa jam bisa main berturut-turut dari slot ini (sampai booking berikutnya / jam tutup).
      let maxHours = 0;
      if (available) {
        const next = own.find((b) => b.startTime >= t);
        const limit = next && next.startTime < win.close ? next.startTime : win.close;
        maxHours = Math.min(setting.maxBookingHours, Math.floor((limit.getTime() - t.getTime()) / 3_600_000));
        if (maxHours < setting.minBookingHours) maxHours = 0;
      }

      slots.push({ start: jktParts(t).timeStr, end: jktParts(slotEnd).timeStr, available: available && maxHours > 0, maxHours });
    }

    return {
      station: {
        id: station.id,
        name: station.name,
        category: station.category,
        pricePerHour: station.pricePerHour,
        maxPlayers: station.maxPlayers,
      },
      availableCount: slots.filter((s) => s.available).length,
      slots,
    };
  });

  return { ...base, closed: false, stations: result };
};

// ---------------------------------------------------------------------
// Validasi slot
// ---------------------------------------------------------------------

type SlotCheck = {
  setting: StoreSettingData;
  start: Date;
  durationHours: number;
  enforceLead: boolean;
};

export const assertSlotRules = ({ setting, start, durationHours, enforceLead }: SlotCheck) => {
  if (Number.isNaN(start.getTime())) throw badRequest('Waktu mulai tidak valid');
  if (!Number.isInteger(durationHours) || durationHours < setting.minBookingHours || durationHours > setting.maxBookingHours) {
    throw badRequest(`Durasi harus antara ${setting.minBookingHours}–${setting.maxBookingHours} jam`);
  }

  const end = addMinutes(start, durationHours * 60);
  const win = findWindowFor(setting, start);
  if (win.closed) throw badRequest('Rental tutup pada hari tersebut');
  if (start < win.open || end > win.close) {
    throw badRequest(`Di luar jam operasional (${setting.openTime}–${setting.closeTime} WIB)`);
  }

  if (enforceLead) {
    const earliest = addMinutes(new Date(), setting.bookingLeadMins);
    if (start < earliest) throw badRequest(`Booking minimal ${setting.bookingLeadMins} menit sebelum jam mulai`);
  }
  return end;
};

const findOverlap = (
  tx: Prisma.TransactionClient,
  stationId: string,
  start: Date,
  end: Date,
  excludeId?: string,
) =>
  tx.booking.findFirst({
    where: {
      stationId,
      status: { in: ACTIVE_STATUSES },
      startTime: { lt: end },
      endTime: { gt: start },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true, startTime: true, endTime: true },
  });

/** Kunci per-station di dalam transaksi, mencegah dua booking bersamaan di slot yang sama. */
const lockStation = (tx: Prisma.TransactionClient, stationId: string) =>
  tx.$queryRaw`SELECT 1 AS ok FROM (SELECT pg_advisory_xact_lock(hashtext(${stationId}))) AS l`;

// ---------------------------------------------------------------------
// Promo & harga
// ---------------------------------------------------------------------

type PromoContext = {
  station: Pick<Station, 'category'>;
  start: Date;
  durationHours: number;
  subtotal: number;
  customer?: { id: string; tier: string } | null;
  /** Abaikan booking ini saat menghitung pemakaian per pelanggan (untuk reschedule). */
  excludeBookingId?: string;
};

/** Kembalikan pesan error jika promo tidak bisa dipakai, atau null jika valid. */
export const checkPromo = async (promo: Promo, ctx: PromoContext): Promise<string | null> => {
  const now = new Date();
  if (!promo.isActive) return 'Promo tidak aktif';
  if (promo.startDate > now) return 'Promo belum berlaku';
  if (promo.validUntil < now) return 'Promo sudah berakhir';
  if (promo.consoleType !== 'ALL' && promo.consoleType.toUpperCase() !== ctx.station.category.toUpperCase()) {
    return `Promo hanya untuk ${promo.consoleType}`;
  }

  const p = jktParts(ctx.start);
  if (promo.validDays.length && !promo.validDays.includes(p.weekday)) return 'Promo tidak berlaku di hari tersebut';
  if (promo.validFrom && promo.validTo) {
    const m = p.minutesOfDay;
    const from = timeToMinutes(promo.validFrom);
    const to = timeToMinutes(promo.validTo);
    const inRange = from <= to ? m >= from && m < to : m >= from || m < to;
    if (!inRange) return `Promo hanya berlaku jam ${promo.validFrom}–${promo.validTo}`;
  }

  if (ctx.durationHours < promo.minHours) return `Promo minimal ${promo.minHours} jam`;
  if (ctx.subtotal < promo.minTransaction) return `Promo minimal transaksi Rp${promo.minTransaction.toLocaleString('id-ID')}`;
  if (promo.usageLimit != null && promo.usedCount >= promo.usageLimit) return 'Kuota promo sudah habis';

  if (promo.targetTier) {
    if (!ctx.customer) return `Promo khusus pelanggan ${promo.targetTier}`;
    if (promo.targetTier !== ctx.customer.tier) return `Promo khusus pelanggan ${promo.targetTier}`;
  }

  if (promo.perCustomerLimit != null && ctx.customer) {
    const used = await prisma.booking.count({
      where: {
        customerId: ctx.customer.id,
        promoId: promo.id,
        status: { notIn: ['cancelled'] },
        ...(ctx.excludeBookingId ? { id: { not: ctx.excludeBookingId } } : {}),
      },
    });
    if (used >= promo.perCustomerLimit) return 'Batas pemakaian promo untuk akun ini sudah tercapai';
  }
  return null;
};

export const calcDiscount = (promo: Promo, subtotal: number) => {
  let discount =
    promo.discountType === 'nominal'
      ? promo.discountAmount
      : Math.floor((subtotal * promo.discountPercentage) / 100);
  if (promo.maxDiscount != null) discount = Math.min(discount, promo.maxDiscount);
  return Math.max(0, Math.min(discount, subtotal));
};

export type QuoteInput = {
  stationId: string;
  start: Date;
  durationHours: number;
  promoCode?: string | null;
  customer?: { id: string; tier: string } | null;
  excludeBookingId?: string;
};

/** Hitung harga + validasi promo. Tidak menyimpan apa pun. */
export const quotePrice = async (input: QuoteInput) => {
  const station = await prisma.station.findUnique({ where: { id: input.stationId } });
  if (!station) throw notFound('Unit tidak ditemukan');

  const subtotal = station.pricePerHour * input.durationHours;
  let promo: Promo | null = null;
  let promoError: string | null = null;
  let discount = 0;

  if (input.promoCode) {
    promo = await prisma.promo.findUnique({ where: { code: input.promoCode.trim().toUpperCase() } });
    if (!promo) promoError = 'Kode promo tidak ditemukan';
    else {
      promoError = await checkPromo(promo, {
        station,
        start: input.start,
        durationHours: input.durationHours,
        subtotal,
        customer: input.customer,
        excludeBookingId: input.excludeBookingId,
      });
      if (!promoError) discount = calcDiscount(promo, subtotal);
    }
  }

  return {
    station,
    subtotal,
    discount,
    totalPrice: subtotal - discount,
    promo: promo && !promoError ? promo : null,
    promoError,
  };
};

// ---------------------------------------------------------------------
// Membuat booking
// ---------------------------------------------------------------------

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const generateBookingCode = (start: Date) => {
  const p = jktParts(start);
  const ymd = `${String(p.year).slice(2)}${String(p.month).padStart(2, '0')}${String(p.day).padStart(2, '0')}`;
  let rand = '';
  for (let i = 0; i < 4; i++) rand += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return `JA${ymd}${rand}`;
};

export type CreateBookingInput = {
  stationId: string;
  customerId: string;
  start: Date;
  durationHours: number;
  promoCode?: string | null;
  notes?: string | null;
  source: 'manual' | 'web' | 'ai';
  channel?: string | null;
  status?: 'pending' | 'confirmed';
  createdById?: string | null;
  chatSessionId?: string | null;
  /** false untuk admin (walk-in boleh langsung mulai). */
  enforceLead?: boolean;
  /** Jika true, promo tidak valid akan menggagalkan booking. Jika false, promo diabaikan. */
  strictPromo?: boolean;
};

export const createBooking = async (input: CreateBookingInput) => {
  const setting = await getStoreSetting();
  const enforceLead = input.enforceLead ?? true;
  const end = assertSlotRules({ setting, start: input.start, durationHours: input.durationHours, enforceLead });

  const customer = await prisma.customer.findUnique({ where: { id: input.customerId }, select: { id: true, tier: true, name: true } });
  if (!customer) throw notFound('Pelanggan tidak ditemukan');

  const quote = await quotePrice({
    stationId: input.stationId,
    start: input.start,
    durationHours: input.durationHours,
    promoCode: input.promoCode,
    customer,
  });
  if (quote.station.status !== 'active') throw badRequest(`Unit ${quote.station.name} sedang tidak tersedia`);
  if (input.promoCode && quote.promoError && (input.strictPromo ?? true)) throw badRequest(quote.promoError);

  const status = input.status ?? 'confirmed';

  const booking = await prisma.$transaction(
    async (tx) => {
      await lockStation(tx, input.stationId);
      const clash = await findOverlap(tx, input.stationId, input.start, end);
      if (clash) {
        throw conflict(
          `Slot sudah terisi (${jktParts(clash.startTime).timeStr}–${jktParts(clash.endTime).timeStr}). Silakan pilih jam lain.`,
        );
      }

      let created;
      for (let attempt = 0; ; attempt++) {
        try {
          created = await tx.booking.create({
            data: {
              bookingCode: generateBookingCode(input.start),
              startTime: input.start,
              endTime: end,
              durationHours: input.durationHours,
              subtotal: quote.subtotal,
              discount: quote.discount,
              totalPrice: quote.totalPrice,
              status,
              source: input.source,
              channel: input.channel ?? null,
              notes: input.notes ?? null,
              stationId: input.stationId,
              customerId: input.customerId,
              promoId: quote.promo?.id ?? null,
              createdById: input.createdById ?? null,
              chatSessionId: input.chatSessionId ?? null,
            },
            include: bookingInclude,
          });
          break;
        } catch (e) {
          // Kode booking bentrok (sangat jarang) → coba lagi.
          if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 3) continue;
          throw e;
        }
      }

      if (quote.promo) await tx.promo.update({ where: { id: quote.promo.id }, data: { usedCount: { increment: 1 } } });
      return created;
    },
    { timeout: 15_000, maxWait: 10_000 },
  );

  const sourceLabel = input.source === 'ai' ? 'AI' : input.source === 'web' ? 'web' : 'admin';
  await Promise.all([
    notifyAdmins(
      'new_booking',
      `Booking baru (${sourceLabel}) — ${booking.bookingCode}`,
      `${customer.name} • ${booking.station.name} • ${formatJkt(booking.startTime)} • ${input.durationHours} jam`,
      `/dashboard/bookings/${booking.id}`,
    ),
    logActivity('booking.create', 'Booking', booking.id, { source: input.source, status }, input.createdById),
  ]);

  if (status === 'confirmed') void notifyBookingWa(booking.id, 'confirmed');

  return { booking, promoWarning: input.promoCode && quote.promoError ? quote.promoError : null };
};

// ---------------------------------------------------------------------
// Ubah jadwal (admin)
// ---------------------------------------------------------------------

export const rescheduleBooking = async (
  id: string,
  data: { stationId?: string; start?: Date; durationHours?: number },
  adminId?: string,
) => {
  const current = await prisma.booking.findUnique({ where: { id }, include: { customer: true } });
  if (!current) throw notFound('Booking tidak ditemukan');
  if (!['pending', 'confirmed'].includes(current.status)) throw badRequest('Hanya booking pending/confirmed yang bisa diubah jadwalnya');

  const setting = await getStoreSetting();
  const stationId = data.stationId ?? current.stationId;
  const start = data.start ?? current.startTime;
  const durationHours = data.durationHours ?? current.durationHours;
  const end = assertSlotRules({ setting, start, durationHours, enforceLead: false });

  const station = await prisma.station.findUnique({ where: { id: stationId } });
  if (!station) throw notFound('Unit tidak ditemukan');

  const subtotal = station.pricePerHour * durationHours;
  let discount = 0;
  if (current.promoId) {
    const promo = await prisma.promo.findUnique({ where: { id: current.promoId } });
    if (promo) discount = calcDiscount(promo, subtotal);
  }

  const updated = await prisma.$transaction(async (tx) => {
    await lockStation(tx, stationId);
    const clash = await findOverlap(tx, stationId, start, end, id);
    if (clash) throw conflict('Slot baru sudah terisi booking lain');
    return tx.booking.update({
      where: { id },
      data: { stationId, startTime: start, endTime: end, durationHours, subtotal, discount, totalPrice: subtotal - discount },
      include: bookingInclude,
    });
  });

  await logActivity(
    'booking.reschedule',
    'Booking',
    id,
    { from: { stationId: current.stationId, start: current.startTime, durationHours: current.durationHours }, to: data },
    adminId,
  );
  return updated;
};

// ---------------------------------------------------------------------
// Status booking
// ---------------------------------------------------------------------

export const updateBookingStatus = async (
  id: string,
  next: BookingStatus,
  opts: { reason?: string | null; actorId?: string | null; actor?: 'admin' | 'customer' | 'system' | 'ai' } = {},
) => {
  const current = await prisma.booking.findUnique({ where: { id }, include: { payment: true } });
  if (!current) throw notFound('Booking tidak ditemukan');
  if (current.status === next) return prisma.booking.findUniqueOrThrow({ where: { id }, include: bookingInclude });

  const allowed = TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(next)) throw badRequest(`Status tidak bisa diubah dari "${current.status}" ke "${next}"`);

  const now = new Date();
  const data: Prisma.BookingUpdateInput = { status: next };
  if (next === 'checked_in') data.checkedInAt = now;
  if (next === 'cancelled') {
    data.cancelledAt = now;
    data.cancelReason = opts.reason ?? null;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const b = await tx.booking.update({ where: { id }, data, include: bookingInclude });

    if (next === 'cancelled') {
      if (current.promoId) {
        await tx.promo.updateMany({ where: { id: current.promoId, usedCount: { gt: 0 } }, data: { usedCount: { decrement: 1 } } });
      }
      if (current.payment && current.payment.status === 'pending') {
        await tx.payment.update({ where: { id: current.payment.id }, data: { status: 'failed' } });
      }
    }
    return b;
  });

  if (next === 'completed') await recalcCustomerStats(current.customerId);
  // Kabari pelanggan lewat WhatsApp (jika terhubung).
  if (next === 'confirmed' || next === 'cancelled') void notifyBookingWa(id, next);

  if (next === 'cancelled' && opts.actor !== 'admin') {
    await notifyAdmins(
      'booking_cancelled',
      `Booking ${current.bookingCode} dibatalkan`,
      opts.reason ?? (opts.actor === 'system' ? 'Dibatalkan otomatis oleh sistem' : 'Dibatalkan oleh pelanggan'),
      `/dashboard/bookings/${id}`,
    );
  }
  await logActivity(`booking.${next}`, 'Booking', id, { from: current.status, to: next, reason: opts.reason, by: opts.actor }, opts.actorId);

  return updated;
};

// ---------------------------------------------------------------------
// Statistik CRM pelanggan
// ---------------------------------------------------------------------

const mode = <T>(items: T[]): T | null => {
  const counts = new Map<T, number>();
  let best: T | null = null;
  let bestCount = 0;
  for (const it of items) {
    const c = (counts.get(it) ?? 0) + 1;
    counts.set(it, c);
    if (c > bestCount) {
      best = it;
      bestCount = c;
    }
  }
  return best;
};

/** Hitung ulang statistik pelanggan dari seluruh booking completed (idempoten). */
export const recalcCustomerStats = async (customerId: string) => {
  const done = await prisma.booking.findMany({
    where: { customerId, status: 'completed' },
    select: { durationHours: true, totalPrice: true, startTime: true, endTime: true, station: { select: { category: true } } },
    orderBy: { startTime: 'desc' },
  });

  const totalSessions = done.length;
  const totalHours = done.reduce((s, b) => s + b.durationHours, 0);
  const totalSpent = done.reduce((s, b) => s + b.totalPrice, 0);
  const tier =
    totalSessions >= TIER_RULES.vip.sessions || totalSpent >= TIER_RULES.vip.spent
      ? 'vip'
      : totalSessions >= TIER_RULES.loyal.sessions || totalSpent >= TIER_RULES.loyal.spent
        ? 'loyal'
        : 'regular';

  return prisma.customer.update({
    where: { id: customerId },
    data: {
      totalSessions,
      totalHours,
      totalSpent,
      tier,
      lastPlayed: done[0]?.endTime ?? null,
      favoriteConsole: mode(done.map((b) => b.station.category.toUpperCase())),
      favoriteHour: mode(done.map((b) => minutesToTime(Math.floor(jktParts(b.startTime).minutesOfDay / 60) * 60))),
    },
  });
};

// ---------------------------------------------------------------------
// Job otomatis
// ---------------------------------------------------------------------

/** Batalkan booking pending yang melewati batas waktu pembayaran. */
export const expirePendingBookings = async () => {
  const setting = await getStoreSetting();
  const cutoff = addMinutes(new Date(), -setting.pendingExpiryMins);
  const stale = await prisma.booking.findMany({
    where: {
      status: 'pending',
      createdAt: { lt: cutoff },
      OR: [
        { payment: null },
        { payment: { status: { in: ['expired', 'failed'] } } },
        // QR masih pending tapi sudah lewat masa berlaku
        { payment: { status: 'pending', OR: [{ expiredAt: null }, { expiredAt: { lt: new Date() } }] } },
      ],
    },
    select: { id: true, payment: { select: { id: true, status: true } } },
    take: 100,
  });

  for (const b of stale) {
    try {
      if (b.payment?.status === 'pending') {
        await prisma.payment.update({ where: { id: b.payment.id }, data: { status: 'expired' } });
      }
      await updateBookingStatus(b.id, 'cancelled', { reason: 'Melewati batas waktu pembayaran', actor: 'system' });
    } catch (e) {
      console.error(`Gagal expire booking ${b.id}:`, e);
    }
  }
  return stale.length;
};

/** Tandai no_show untuk booking confirmed yang sudah lewat jam selesai tanpa check-in. */
export const markNoShows = async () => {
  const stale = await prisma.booking.findMany({
    where: { status: 'confirmed', endTime: { lt: new Date() } },
    select: { id: true },
    take: 100,
  });
  for (const b of stale) {
    try {
      await updateBookingStatus(b.id, 'no_show', { actor: 'system' });
    } catch (e) {
      console.error(`Gagal menandai no-show ${b.id}:`, e);
    }
  }
  return stale.length;
};

/** Selesaikan otomatis booking checked_in yang sudah lewat jam selesai. */
export const autoCompleteBookings = async () => {
  const stale = await prisma.booking.findMany({
    where: { status: 'checked_in', endTime: { lt: addMinutes(new Date(), -15) } },
    select: { id: true },
    take: 100,
  });
  for (const b of stale) {
    try {
      await updateBookingStatus(b.id, 'completed', { actor: 'system' });
    } catch (e) {
      console.error(`Gagal auto-complete ${b.id}:`, e);
    }
  }
  return stale.length;
};

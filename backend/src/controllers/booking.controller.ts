import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, forbidden, notFound, pageMeta, paginate, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { addMinutes, DATE_REGEX, dayRange, formatJkt, jktDate, jktParts, TIME_REGEX, todayJkt } from '../lib/time';
import {
  ACTIVE_STATUSES,
  BOOKING_STATUSES,
  bookingInclude,
  createBooking,
  getAvailability,
  getOperatingWindow,
  quotePrice,
  rescheduleBooking,
  updateBookingStatus,
} from '../services/booking.service';
import bcrypt from 'bcrypt';
import { createQrisPayment, recordManualPayment } from '../services/payment.service';
import { getStoreSetting } from '../services/settings.service';
import { normalizeWhatsapp } from './customer.controller';
import { AuthRequest } from '../middlewares/authMiddleware';

const dateStr = z.string().regex(DATE_REGEX, 'Format tanggal YYYY-MM-DD');
const timeStr = z.string().regex(TIME_REGEX, 'Format jam HH:mm');

const slotInput = z.object({
  stationId: z.string().uuid('stationId tidak valid'),
  date: dateStr,
  startTime: timeStr,
  durationHours: z.coerce.number().int().min(1),
  promoCode: z.string().trim().min(1).optional().nullable(),
});

// =====================================================================
// Publik
// =====================================================================

/** GET /bookings/availability?date=YYYY-MM-DD&stationId=&category= */
export const getAvailabilityHandler = async (req: Request, res: Response): Promise<any> => {
  const q = z
    .object({ date: dateStr.optional(), stationId: z.string().uuid().optional(), category: z.string().optional() })
    .parse(req.query);
  const data = await getAvailability({ date: q.date ?? todayJkt(), stationId: q.stationId, category: q.category, enforceLead: true });
  res.json({ success: true, data });
};

/** POST /bookings/quote — hitung harga & validasi promo (login opsional untuk promo khusus tier). */
export const quoteBooking = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = slotInput.parse(req.body);
  const customer =
    req.user?.role === 'CUSTOMER'
      ? await prisma.customer.findUnique({ where: { id: req.user.id }, select: { id: true, tier: true } })
      : null;
  const start = jktDate(input.date, input.startTime);
  const q = await quotePrice({ stationId: input.stationId, start, durationHours: input.durationHours, promoCode: input.promoCode, customer });
  res.json({
    success: true,
    data: {
      station: { id: q.station.id, name: q.station.name, category: q.station.category, pricePerHour: q.station.pricePerHour },
      startTime: start,
      endTime: addMinutes(start, input.durationHours * 60),
      durationHours: input.durationHours,
      subtotal: q.subtotal,
      discount: q.discount,
      totalPrice: q.totalPrice,
      promo: q.promo ? { id: q.promo.id, code: q.promo.code, title: q.promo.title } : null,
      promoValid: input.promoCode ? !q.promoError : null,
      promoError: q.promoError,
    },
  });
};

// =====================================================================
// Pelanggan
// =====================================================================

/** POST /bookings — pelanggan membuat booking dari web. */
export const createMyBooking = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = slotInput
    .extend({ notes: z.string().max(500).optional(), paymentMethod: z.enum(['qris', 'cash']).default('qris') })
    .parse(req.body);

  // QRIS → pending sampai dibayar. Bayar di kasir → langsung confirmed.
  const midtransReady = !!process.env.MIDTRANS_SERVER_KEY;
  const wantsQris = input.paymentMethod === 'qris' && midtransReady;

  const { booking } = await createBooking({
    stationId: input.stationId,
    customerId: req.user!.id,
    start: jktDate(input.date, input.startTime),
    durationHours: input.durationHours,
    promoCode: input.promoCode,
    notes: input.notes,
    source: 'web',
    channel: 'web',
    status: wantsQris ? 'pending' : 'confirmed',
    enforceLead: true,
    strictPromo: true,
  });

  let payment = null;
  let paymentError: string | null = null;
  if (wantsQris && booking.totalPrice > 0) {
    try {
      payment = await createQrisPayment(booking.id);
    } catch (e: any) {
      paymentError = e?.message ?? 'Gagal membuat QRIS';
    }
  } else if (wantsQris && booking.totalPrice === 0) {
    await updateBookingStatus(booking.id, 'confirmed', { actor: 'system' });
  }

  const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  res.status(201).json({
    success: true,
    data: {
      booking: fresh,
      payment,
      paymentError,
      note:
        input.paymentMethod === 'qris' && !midtransReady
          ? 'QRIS belum tersedia, booking dikonfirmasi dengan pembayaran di kasir.'
          : undefined,
    },
  });
};

/** GET /bookings/me?status=upcoming|history|<status> */
export const listMyBookings = async (req: AuthRequest, res: Response): Promise<any> => {
  const { status } = z.object({ status: z.string().optional() }).parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where: Prisma.BookingWhereInput = { customerId: req.user!.id };
  if (status === 'upcoming') {
    where.status = { in: ACTIVE_STATUSES };
    where.endTime = { gte: new Date() };
  } else if (status === 'history') {
    where.status = { in: ['completed', 'cancelled', 'no_show'] };
  } else if (status) {
    where.status = status;
  }

  const [rows, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { startTime: status === 'upcoming' ? 'asc' : 'desc' },
      skip,
      take,
    }),
    prisma.booking.count({ where }),
  ]);
  res.json({ success: true, data: rows, meta: pageMeta(page, limit, total) });
};

const loadOwnBooking = async (req: AuthRequest) => {
  const booking = await prisma.booking.findUnique({ where: { id: param(req, 'id') }, include: bookingInclude });
  if (!booking) throw notFound('Booking tidak ditemukan');
  if (req.user?.role === 'CUSTOMER' && booking.customerId !== req.user.id) throw forbidden('Ini bukan booking milikmu');
  return booking;
};

/** GET /bookings/me/:id */
export const getMyBooking = async (req: AuthRequest, res: Response): Promise<any> => {
  res.json({ success: true, data: await loadOwnBooking(req) });
};

/** POST /bookings/me/:id/cancel */
export const cancelMyBooking = async (req: AuthRequest, res: Response): Promise<any> => {
  const { reason } = z.object({ reason: z.string().max(300).optional() }).parse(req.body ?? {});
  const booking = await loadOwnBooking(req);
  if (!['pending', 'confirmed'].includes(booking.status)) throw badRequest('Booking ini tidak bisa dibatalkan');
  if (booking.status === 'confirmed' && booking.startTime < addMinutes(new Date(), 60)) {
    throw badRequest('Pembatalan maksimal 1 jam sebelum jam main. Silakan hubungi admin.');
  }
  const updated = await updateBookingStatus(booking.id, 'cancelled', {
    reason: reason ?? 'Dibatalkan oleh pelanggan',
    actor: 'customer',
    actorId: null,
  });
  res.json({
    success: true,
    data: updated,
    message: booking.payment?.status === 'paid' ? 'Booking dibatalkan. Untuk refund, admin akan menghubungimu.' : 'Booking dibatalkan',
  });
};

// =====================================================================
// Admin
// =====================================================================

const adminListQuery = z.object({
  date: dateStr.optional(),
  from: dateStr.optional(),
  to: dateStr.optional(),
  status: z.string().optional(), // bisa dipisah koma: pending,confirmed
  stationId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  source: z.enum(['manual', 'web', 'ai']).optional(),
  search: z.string().optional(),
  sort: z.enum(['startTime', '-startTime', 'createdAt', '-createdAt']).default('-startTime'),
});

const buildAdminWhere = (q: z.infer<typeof adminListQuery>): Prisma.BookingWhereInput => {
  const where: Prisma.BookingWhereInput = {};
  if (q.date) {
    const { start, end } = dayRange(q.date);
    where.startTime = { gte: start, lt: end };
  } else if (q.from || q.to) {
    where.startTime = {
      ...(q.from ? { gte: dayRange(q.from).start } : {}),
      ...(q.to ? { lt: dayRange(q.to).end } : {}),
    };
  }
  if (q.status) where.status = { in: q.status.split(',').map((s) => s.trim()) };
  if (q.stationId) where.stationId = q.stationId;
  if (q.customerId) where.customerId = q.customerId;
  if (q.source) where.source = q.source;
  if (q.search) {
    where.OR = [
      { bookingCode: { contains: q.search.toUpperCase() } },
      { customer: { name: { contains: q.search, mode: 'insensitive' } } },
      { customer: { whatsapp: { contains: q.search.replace(/\D/g, '') || q.search } } },
    ];
  }
  return where;
};

/** GET /bookings (admin) */
export const listBookings = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = adminListQuery.parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where = buildAdminWhere(q);
  const field = q.sort.replace('-', '') as 'startTime' | 'createdAt';
  const [rows, total] = await Promise.all([
    prisma.booking.findMany({ where, include: bookingInclude, orderBy: { [field]: q.sort.startsWith('-') ? 'desc' : 'asc' }, skip, take }),
    prisma.booking.count({ where }),
  ]);
  res.json({ success: true, data: rows, meta: pageMeta(page, limit, total) });
};

/** GET /bookings/schedule?date= — tampilan timeline per unit (admin). */
export const getSchedule = async (req: AuthRequest, res: Response): Promise<any> => {
  const { date } = z.object({ date: dateStr.optional() }).parse(req.query);
  const day = date ?? todayJkt();
  const setting = await getStoreSetting();
  const win = getOperatingWindow(setting, day);

  const [stations, bookings] = await Promise.all([
    prisma.station.findMany({ where: { status: { not: 'inactive' } }, orderBy: { sortOrder: 'asc' } }),
    prisma.booking.findMany({
      where: { startTime: { lt: win.close }, endTime: { gt: win.open }, status: { notIn: ['cancelled'] } },
      include: {
        customer: { select: { id: true, name: true, whatsapp: true, tier: true } },
        payment: { select: { status: true, method: true } },
        promo: { select: { code: true } },
      },
      orderBy: { startTime: 'asc' },
    }),
  ]);

  res.json({
    success: true,
    data: {
      date: day,
      closed: win.closed,
      openTime: setting.openTime,
      closeTime: setting.closeTime,
      stations: stations.map((s) => ({
        ...s,
        bookings: bookings
          .filter((b) => b.stationId === s.id)
          .map((b) => ({ ...b, start: jktParts(b.startTime).timeStr, end: jktParts(b.endTime).timeStr })),
      })),
    },
  });
};

/** GET /bookings/:id (admin) */
export const getBooking = async (req: AuthRequest, res: Response): Promise<any> => {
  const booking = await prisma.booking.findUnique({
    where: { id: param(req, 'id') },
    include: {
      ...bookingInclude,
      createdBy: { select: { id: true, name: true } },
      chatSession: { select: { id: true, title: true, status: true } },
    },
  });
  if (!booking) throw notFound('Booking tidak ditemukan');
  const logs = await prisma.activityLog.findMany({
    where: { entity: 'Booking', entityId: booking.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ success: true, data: { ...booking, history: logs } });
};

/** POST /bookings/admin — booking manual (walk-in / telepon). Bisa sekaligus membuat pelanggan baru. */
export const createAdminBooking = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = slotInput
    .extend({
      customerId: z.string().uuid().optional(),
      newCustomer: z.object({ name: z.string().min(2), whatsapp: z.string().min(9) }).optional(),
      notes: z.string().max(500).optional(),
      status: z.enum(['pending', 'confirmed']).default('confirmed'),
      markPaid: z.enum(['cash', 'transfer']).optional(),
      enforceLead: z.boolean().default(false),
    })
    .refine((v) => v.customerId || v.newCustomer, 'Isi customerId atau newCustomer')
    .parse(req.body);

  let customerId = input.customerId;
  if (!customerId && input.newCustomer) {
    const whatsapp = normalizeWhatsapp(input.newCustomer.whatsapp);
    const existing = await prisma.customer.findUnique({ where: { whatsapp } });
    if (existing) customerId = existing.id;
    else {
      const created = await prisma.customer.create({
        data: { name: input.newCustomer.name, whatsapp, password: await bcrypt.hash(Math.random().toString(36), 10) },
      });
      customerId = created.id;
    }
  }

  const { booking, promoWarning } = await createBooking({
    stationId: input.stationId,
    customerId: customerId!,
    start: jktDate(input.date, input.startTime),
    durationHours: input.durationHours,
    promoCode: input.promoCode,
    notes: input.notes,
    source: 'manual',
    channel: null,
    status: input.status,
    createdById: req.user!.id,
    enforceLead: input.enforceLead,
    strictPromo: true,
  });

  if (input.markPaid) {
    await recordManualPayment(booking.id, input.markPaid, req.user!.id);
  }

  const fresh = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id }, include: bookingInclude });
  res.status(201).json({ success: true, data: fresh, promoWarning });
};

/** PATCH /bookings/:id/status (admin) */
export const changeBookingStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  const { status, reason } = z.object({ status: z.enum(BOOKING_STATUSES), reason: z.string().max(300).optional() }).parse(req.body);
  const updated = await updateBookingStatus(param(req, 'id'), status, { reason, actor: 'admin', actorId: req.user!.id });
  res.json({ success: true, data: updated });
};

/** PATCH /bookings/:id/reschedule (admin) */
export const rescheduleHandler = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({
      stationId: z.string().uuid().optional(),
      date: dateStr.optional(),
      startTime: timeStr.optional(),
      durationHours: z.coerce.number().int().min(1).optional(),
    })
    .refine((v) => !!v.date === !!v.startTime, 'date dan startTime harus diisi bersamaan')
    .parse(req.body);

  const updated = await rescheduleBooking(
    param(req, 'id'),
    {
      stationId: input.stationId,
      start: input.date && input.startTime ? jktDate(input.date, input.startTime) : undefined,
      durationHours: input.durationHours,
    },
    req.user!.id,
  );
  res.json({ success: true, data: updated });
};

/** PATCH /bookings/:id/notes (admin) */
export const updateBookingNotes = async (req: AuthRequest, res: Response): Promise<any> => {
  const { notes } = z.object({ notes: z.string().max(1000).nullable() }).parse(req.body);
  const updated = await prisma.booking.update({ where: { id: param(req, 'id') }, data: { notes }, include: bookingInclude });
  await logActivity('booking.notes', 'Booking', updated.id, { notes }, req.user?.id);
  res.json({ success: true, data: updated });
};

/** GET /bookings/export?from=&to= — unduh Excel (admin). */
export const exportBookings = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = adminListQuery.parse(req.query);
  const where = buildAdminWhere(q);
  const rows = await prisma.booking.findMany({ where, include: bookingInclude, orderBy: { startTime: 'asc' }, take: 5000 });

  const wb = new ExcelJS.Workbook();
  wb.creator = 'Jadwalan';
  const ws = wb.addWorksheet('Booking');
  ws.columns = [
    { header: 'Kode', key: 'code', width: 16 },
    { header: 'Mulai', key: 'start', width: 26 },
    { header: 'Durasi (jam)', key: 'duration', width: 12 },
    { header: 'Unit', key: 'station', width: 18 },
    { header: 'Konsol', key: 'category', width: 8 },
    { header: 'Pelanggan', key: 'customer', width: 22 },
    { header: 'WhatsApp', key: 'whatsapp', width: 16 },
    { header: 'Status', key: 'status', width: 12 },
    { header: 'Sumber', key: 'source', width: 10 },
    { header: 'Promo', key: 'promo', width: 12 },
    { header: 'Subtotal', key: 'subtotal', width: 12 },
    { header: 'Diskon', key: 'discount', width: 12 },
    { header: 'Total', key: 'total', width: 12 },
    { header: 'Pembayaran', key: 'payment', width: 14 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const b of rows) {
    ws.addRow({
      code: b.bookingCode,
      start: formatJkt(b.startTime),
      duration: b.durationHours,
      station: b.station.name,
      category: b.station.category,
      customer: b.customer.name,
      whatsapp: b.customer.whatsapp,
      status: b.status,
      source: b.source,
      promo: b.promo?.code ?? '',
      subtotal: b.subtotal,
      discount: b.discount,
      total: b.totalPrice,
      payment: b.payment ? `${b.payment.method}/${b.payment.status}` : '-',
    });
  }
  ['subtotal', 'discount', 'total'].forEach((k) => (ws.getColumn(k).numFmt = '#,##0'));

  const filename = `booking-${q.from ?? q.date ?? todayJkt()}${q.to ? `_${q.to}` : ''}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
};

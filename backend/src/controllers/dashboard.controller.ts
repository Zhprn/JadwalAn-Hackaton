import { Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { addDays, DATE_REGEX, dayRange, dbDate, jktParts, todayJkt } from '../lib/time';
import { computeDailyMetric, SOLD_STATUSES } from '../services/metric.service';
import { bookingInclude } from '../services/booking.service';
import { AuthRequest } from '../middlewares/authMiddleware';

const dateStr = z.string().regex(DATE_REGEX);

/** GET /dashboard/summary?date= — kartu ringkasan hari ini. */
export const summary = async (req: AuthRequest, res: Response): Promise<any> => {
  const { date } = z.object({ date: dateStr.optional() }).parse(req.query);
  const day = date ?? todayJkt();
  const yesterday = addDays(day, -1);

  const now = new Date();
  const [today, prev, upcoming, nowPlaying, chats, pendingPayments, unreadNotifs] = await Promise.all([
    computeDailyMetric(day),
    computeDailyMetric(yesterday),
    prisma.booking.findMany({
      where: { status: { in: ['pending', 'confirmed'] }, startTime: { gte: now } },
      include: bookingInclude,
      orderBy: { startTime: 'asc' },
      take: 8,
    }),
    prisma.booking.findMany({
      where: { status: 'checked_in', startTime: { lte: now }, endTime: { gte: now } },
      include: bookingInclude,
      orderBy: { endTime: 'asc' },
    }),
    prisma.chatSession.groupBy({ by: ['status'], where: { status: { not: 'closed' } }, _count: { _all: true } }),
    prisma.booking.count({ where: { status: 'pending' } }),
    prisma.notification.count({ where: { isRead: false, OR: [{ userId: null }, { userId: req.user!.id }] } }),
  ]);

  const pct = (a: number, b: number) => (b ? Math.round(((a - b) / b) * 100) : a ? 100 : 0);

  res.json({
    success: true,
    data: {
      date: day,
      metrics: today,
      comparison: {
        revenue: pct(today.totalRevenue, prev.totalRevenue),
        bookings: pct(today.totalBookings, prev.totalBookings),
        occupancy: Math.round((today.occupancyRate - prev.occupancyRate) * 100),
      },
      upcoming,
      nowPlaying,
      pendingPayments,
      chats: Object.fromEntries(chats.map((c) => [c.status, c._count._all])),
      unreadNotifications: unreadNotifs,
    },
  });
};

/** GET /dashboard/revenue?days=7 — grafik pendapatan & booking per hari. */
export const revenueChart = async (req: AuthRequest, res: Response): Promise<any> => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
  const today = todayJkt();
  const list = Array.from({ length: days }, (_, i) => addDays(today, i - (days - 1)));

  // Hari lampau diambil dari tabel Metric jika ada; sisanya dihitung (lalu disimpan).
  const stored = await prisma.metric.findMany({ where: { date: { gte: dbDate(list[0]), lt: dbDate(today) } } });
  const byDate = new Map(stored.map((m) => [m.date.toISOString().slice(0, 10), m]));

  const rows = await Promise.all(
    list.map(async (d) => {
      const m = d !== today && byDate.get(d) ? byDate.get(d)! : await computeDailyMetric(d, { persist: d !== today });
      return {
        date: d,
        revenue: m.totalRevenue,
        bookings: m.totalBookings,
        aiBookings: m.aiBookings,
        cancelled: m.cancelledBookings,
        occupancyRate: m.occupancyRate,
      };
    }),
  );
  res.json({
    success: true,
    data: { days: rows, totalRevenue: rows.reduce((s, r) => s + r.revenue, 0), totalBookings: rows.reduce((s, r) => s + r.bookings, 0) },
  });
};

/** GET /dashboard/peak-hours?days=30 — heatmap hari × jam. */
export const peakHours = async (req: AuthRequest, res: Response): Promise<any> => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(180).default(30) }).parse(req.query);
  const since = dayRange(addDays(todayJkt(), -(days - 1))).start;
  const bookings = await prisma.booking.findMany({
    where: { startTime: { gte: since }, status: { in: SOLD_STATUSES } },
    select: { startTime: true, durationHours: true },
  });

  const grid = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const b of bookings) {
    const p = jktParts(b.startTime);
    for (let h = 0; h < b.durationHours; h++) {
      const hour = (p.hour + h) % 24;
      const weekday = (p.weekday + Math.floor((p.hour + h) / 24)) % 7;
      grid[weekday][hour]++;
    }
  }
  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, count: grid.reduce((s, row) => s + row[h], 0) }));
  res.json({ success: true, data: { days, grid, byHour, peak: [...byHour].sort((a, b) => b.count - a.count).slice(0, 3) } });
};

/** GET /dashboard/stations?days=30 — utilisasi & pendapatan per unit. */
export const stationUtilization = async (req: AuthRequest, res: Response): Promise<any> => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(180).default(30) }).parse(req.query);
  const since = dayRange(addDays(todayJkt(), -(days - 1))).start;
  const [stations, grouped] = await Promise.all([
    prisma.station.findMany({ orderBy: { sortOrder: 'asc' }, select: { id: true, name: true, category: true, status: true } }),
    prisma.booking.groupBy({
      by: ['stationId'],
      where: { startTime: { gte: since }, status: { in: SOLD_STATUSES } },
      _sum: { durationHours: true, totalPrice: true },
      _count: { _all: true },
    }),
  ]);
  const map = new Map(grouped.map((g) => [g.stationId, g]));
  res.json({
    success: true,
    data: stations.map((s) => ({
      ...s,
      bookings: map.get(s.id)?._count._all ?? 0,
      hours: map.get(s.id)?._sum.durationHours ?? 0,
      revenue: map.get(s.id)?._sum.totalPrice ?? 0,
    })),
  });
};

/** GET /dashboard/top-customers?days=30 */
export const topCustomers = async (req: AuthRequest, res: Response): Promise<any> => {
  const { days, limit } = z
    .object({ days: z.coerce.number().int().min(1).max(365).default(30), limit: z.coerce.number().int().min(1).max(50).default(10) })
    .parse(req.query);
  const since = dayRange(addDays(todayJkt(), -(days - 1))).start;
  const grouped = await prisma.booking.groupBy({
    by: ['customerId'],
    where: { startTime: { gte: since }, status: { in: SOLD_STATUSES } },
    _sum: { totalPrice: true, durationHours: true },
    _count: { _all: true },
    orderBy: { _sum: { totalPrice: 'desc' } },
    take: limit,
  });
  const customers = await prisma.customer.findMany({
    where: { id: { in: grouped.map((g) => g.customerId) } },
    select: { id: true, name: true, whatsapp: true, tier: true },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));
  res.json({
    success: true,
    data: grouped.map((g) => ({
      customer: byId.get(g.customerId),
      bookings: g._count._all,
      hours: g._sum.durationHours ?? 0,
      spent: g._sum.totalPrice ?? 0,
    })),
  });
};

/** GET /dashboard/metrics?from=&to= — data mentah tabel Metric. */
export const metrics = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z.object({ from: dateStr.optional(), to: dateStr.optional() }).parse(req.query);
  const rows = await prisma.metric.findMany({
    where: { date: { ...(q.from ? { gte: dbDate(q.from) } : {}), ...(q.to ? { lte: dbDate(q.to) } : {}) } },
    orderBy: { date: 'asc' },
  });
  res.json({ success: true, data: rows });
};

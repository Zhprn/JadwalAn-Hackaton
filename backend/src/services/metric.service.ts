import prisma from '../lib/prisma';
import { dayRange, dbDate, jktParts, minutesToTime } from '../lib/time';
import { getStoreSetting } from './settings.service';
import { getOperatingWindow } from './booking.service';

/** Status booking yang dihitung sebagai "terjual". */
export const SOLD_STATUSES = ['confirmed', 'checked_in', 'completed'];

/** Hitung metrik satu hari (WIB). persist=true → simpan ke tabel Metric. */
export const computeDailyMetric = async (dateStr: string, opts: { persist?: boolean } = {}) => {
  const { start, end } = dayRange(dateStr);
  const setting = await getStoreSetting();
  const win = getOperatingWindow(setting, dateStr);

  const [bookings, stationCount, newCustomers, chatSessions] = await Promise.all([
    prisma.booking.findMany({
      where: { startTime: { gte: start, lt: end } },
      select: { status: true, source: true, totalPrice: true, durationHours: true, startTime: true },
    }),
    prisma.station.count({ where: { status: 'active' } }),
    prisma.customer.count({ where: { createdAt: { gte: start, lt: end } } }),
    prisma.chatSession.count({ where: { createdAt: { gte: start, lt: end } } }),
  ]);

  const sold = bookings.filter((b) => SOLD_STATUSES.includes(b.status));
  const openHours = win.closed ? 0 : Math.floor((win.close.getTime() - win.open.getTime()) / 3_600_000);
  const slotsTotal = stationCount * openHours;
  const slotsFilled = sold.reduce((s, b) => s + b.durationHours, 0);

  const hourCount = new Map<number, number>();
  for (const b of sold) {
    const h = jktParts(b.startTime).hour;
    hourCount.set(h, (hourCount.get(h) ?? 0) + 1);
  }
  const peak = [...hourCount.entries()].sort((a, b) => b[1] - a[1])[0];

  const metric = {
    date: dbDate(dateStr),
    totalRevenue: sold.reduce((s, b) => s + b.totalPrice, 0),
    occupancyRate: slotsTotal ? Math.min(1, slotsFilled / slotsTotal) : 0,
    slotsFilled,
    slotsTotal,
    totalBookings: bookings.length,
    aiBookings: bookings.filter((b) => b.source === 'ai').length,
    cancelledBookings: bookings.filter((b) => b.status === 'cancelled').length,
    newCustomers,
    chatSessions,
    peakHour: peak ? minutesToTime(peak[0] * 60) : null,
  };

  if (opts.persist) {
    await prisma.metric.upsert({ where: { date: metric.date }, create: metric, update: metric });
  }
  return metric;
};

import prisma from '../lib/prisma';
import { addDays, dayRange, dbDate, jktParts, minutesToTime } from '../lib/time';
import { getStoreSetting } from './settings.service';
import { getOperatingWindow } from './booking.service';

/** Status booking yang dihitung sebagai "terjual". */
export const SOLD_STATUSES = ['confirmed', 'checked_in', 'completed'];

export type DailyMetric = Awaited<ReturnType<typeof computeRangeMetrics>>[number];

/**
 * Hitung metrik untuk rentang tanggal (WIB) dengan HANYA 4 query,
 * berapa pun jumlah harinya — supaya tidak menghabiskan pool koneksi database.
 */
export const computeRangeMetrics = async (fromStr: string, toStr: string) => {
  const days: string[] = [];
  for (let d = fromStr; d <= toStr; d = addDays(d, 1)) days.push(d);
  const start = dayRange(fromStr).start;
  const end = dayRange(toStr).end;
  const setting = await getStoreSetting();

  // Dijalankan berurutan (bukan Promise.all) agar satu request hanya memakai 1 koneksi.
  const bookings = await prisma.booking.findMany({
    where: { startTime: { gte: start, lt: end } },
    select: { status: true, source: true, totalPrice: true, durationHours: true, startTime: true },
  });
  const stationCount = await prisma.station.count({ where: { status: 'active' } });
  const customers = await prisma.customer.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { createdAt: true } });
  const sessions = await prisma.chatSession.findMany({ where: { createdAt: { gte: start, lt: end } }, select: { createdAt: true } });

  const dayOf = (d: Date) => jktParts(d).dateStr;
  const countBy = (rows: { createdAt: Date }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(dayOf(r.createdAt), (m.get(dayOf(r.createdAt)) ?? 0) + 1);
    return m;
  };
  const newCustomersByDay = countBy(customers);
  const sessionsByDay = countBy(sessions);

  return days.map((dateStr) => {
    const own = bookings.filter((b) => dayOf(b.startTime) === dateStr);
    const sold = own.filter((b) => SOLD_STATUSES.includes(b.status));
    const win = getOperatingWindow(setting, dateStr);
    const openHours = win.closed ? 0 : Math.floor((win.close.getTime() - win.open.getTime()) / 3_600_000);
    const slotsTotal = stationCount * openHours;
    const slotsFilled = sold.reduce((s, b) => s + b.durationHours, 0);

    const hourCount = new Map<number, number>();
    for (const b of sold) {
      const h = jktParts(b.startTime).hour;
      hourCount.set(h, (hourCount.get(h) ?? 0) + 1);
    }
    const peak = [...hourCount.entries()].sort((a, b) => b[1] - a[1])[0];

    return {
      date: dbDate(dateStr),
      dateStr,
      totalRevenue: sold.reduce((s, b) => s + b.totalPrice, 0),
      occupancyRate: slotsTotal ? Math.min(1, slotsFilled / slotsTotal) : 0,
      slotsFilled,
      slotsTotal,
      totalBookings: own.length,
      aiBookings: own.filter((b) => b.source === 'ai').length,
      cancelledBookings: own.filter((b) => b.status === 'cancelled').length,
      newCustomers: newCustomersByDay.get(dateStr) ?? 0,
      chatSessions: sessionsByDay.get(dateStr) ?? 0,
      peakHour: peak ? minutesToTime(peak[0] * 60) : null,
    };
  });
};

/** Simpan metrik ke tabel Metric (berurutan, dipakai job terjadwal). */
export const persistMetrics = async (metrics: DailyMetric[]) => {
  for (const { dateStr: _d, ...m } of metrics) {
    await prisma.metric.upsert({ where: { date: m.date }, create: m, update: m });
  }
};

/** Hitung metrik satu hari (WIB). persist=true → simpan ke tabel Metric. */
export const computeDailyMetric = async (dateStr: string, opts: { persist?: boolean } = {}) => {
  const [metric] = await computeRangeMetrics(dateStr, dateStr);
  if (opts.persist) await persistMetrics([metric]);
  const { dateStr: _d, ...rest } = metric;
  return rest;
};

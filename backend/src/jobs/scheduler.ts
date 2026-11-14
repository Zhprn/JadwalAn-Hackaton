import { addDays, todayJkt } from '../lib/time';
import { autoCompleteBookings, expirePendingBookings, markNoShows } from '../services/booking.service';
import { expireStalePayments } from '../services/payment.service';
import { computeRangeMetrics, persistMetrics } from '../services/metric.service';

/**
 * Job latar belakang sederhana berbasis setInterval (cukup untuk satu instance server).
 * - Tiap 1 menit : expire QRIS & booking pending, auto-complete, tandai no-show.
 * - Tiap 30 menit: simpan metrik kemarin & hari ini ke tabel Metric.
 */
let running = false;

const safe = (name: string, fn: () => Promise<unknown>) => async () => {
  try {
    await fn();
  } catch (e: any) {
    console.error(`[job:${name}]`, e?.message ?? e);
  }
};

const bookingTick = safe('booking', async () => {
  if (running) return; // cegah tumpang tindih jika satu putaran lambat
  running = true;
  try {
    const expiredPayments = await expireStalePayments();
    const expired = await expirePendingBookings();
    const completed = await autoCompleteBookings();
    const noShows = await markNoShows();
    if (expiredPayments || expired || completed || noShows) {
      console.log(`[job] payment expired ${expiredPayments}, booking expired ${expired}, completed ${completed}, no-show ${noShows}`);
    }
  } finally {
    running = false;
  }
});

const metricTick = safe('metric', async () => {
  const today = todayJkt();
  await persistMetrics(await computeRangeMetrics(addDays(today, -1), today));
});

export const startScheduler = () => {
  if (process.env.DISABLE_JOBS === 'true') {
    console.log('[job] Scheduler dimatikan (DISABLE_JOBS=true)');
    return;
  }
  setInterval(bookingTick, 60_000).unref();
  setInterval(metricTick, 30 * 60_000).unref();
  setTimeout(bookingTick, 5_000).unref();
  setTimeout(metricTick, 15_000).unref();
  console.log('[job] Scheduler aktif');
};

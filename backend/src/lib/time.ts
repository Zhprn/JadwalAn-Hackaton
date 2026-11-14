// Semua jam operasional mengikuti WIB (Asia/Jakarta, UTC+7, tanpa DST).
export const TZ_OFFSET = '+07:00';
const OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

const pad = (n: number) => String(n).padStart(2, '0');

/** Bagian tanggal/jam dari sebuah Date menurut WIB. */
export const jktParts = (date: Date = new Date()) => {
  const d = new Date(date.getTime() + OFFSET_MS);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hour = d.getUTCHours();
  const minute = d.getUTCMinutes();
  return {
    year,
    month,
    day,
    hour,
    minute,
    weekday: d.getUTCDay(),
    dateStr: `${year}-${pad(month)}-${pad(day)}`,
    timeStr: `${pad(hour)}:${pad(minute)}`,
    minutesOfDay: hour * 60 + minute,
  };
};

/** "2026-11-14" + "16:00" (WIB) → Date. */
export const jktDate = (dateStr: string, timeStr = '00:00') => new Date(`${dateStr}T${timeStr}:00${TZ_OFFSET}`);

export const todayJkt = () => jktParts().dateStr;

export const addDays = (dateStr: string, days: number) => jktParts(new Date(jktDate(dateStr).getTime() + days * DAY_MS)).dateStr;

export const addMinutes = (date: Date, mins: number) => new Date(date.getTime() + mins * 60_000);

/** "16:30" → 990 */
export const timeToMinutes = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const minutesToTime = (mins: number) => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
};

/** Rentang [awal, akhir) satu hari WIB, dalam UTC. */
export const dayRange = (dateStr: string) => {
  const start = jktDate(dateStr);
  return { start, end: new Date(start.getTime() + DAY_MS) };
};

/** Untuk kolom @db.Date (disimpan sebagai tanggal UTC tengah malam). */
export const dbDate = (dateStr: string) => new Date(`${dateStr}T00:00:00Z`);

export const formatJkt = (date: Date) => {
  const p = jktParts(date);
  return `${DAY_NAMES[p.weekday]}, ${p.dateStr} ${p.timeStr} WIB`;
};

export const daysBetween = (a: Date, b: Date) => Math.floor(Math.abs(b.getTime() - a.getTime()) / DAY_MS);

export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

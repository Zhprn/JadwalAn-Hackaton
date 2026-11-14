// Semua waktu ditampilkan dalam WIB (Asia/Jakarta).
const TZ = "Asia/Jakarta";

export const rupiah = (n: number | null | undefined) => `Rp${Math.round(n ?? 0).toLocaleString("id-ID")}`;

/** Rp1,2 jt / Rp640rb untuk angka ringkas di grafik. */
export const rupiahShort = (n: number) => {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (n >= 1_000) return `Rp${Math.round(n / 1000)}rb`;
  return `Rp${n}`;
};

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("id-ID", { timeZone: TZ, ...opts });

export const fmtTime = (d: string | Date) => fmt({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(d)).replace(".", ":");

export const fmtDate = (d: string | Date) => fmt({ weekday: "short", day: "numeric", month: "short" }).format(new Date(d));

export const fmtDateLong = (d: string | Date) =>
  fmt({ weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(d));

export const fmtDateTime = (d: string | Date) => `${fmtDate(d)} · ${fmtTime(d)}`;

export const fmtRange = (start: string, end: string) => `${fmtTime(start)}–${fmtTime(end)}`;

/** "YYYY-MM-DD" hari ini menurut WIB. */
export const todayJkt = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());

export const addDays = (dateStr: string, n: number) => {
  const d = new Date(`${dateStr}T12:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + n);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d);
};

export const dateFromStr = (dateStr: string) => new Date(`${dateStr}T12:00:00+07:00`);

export const relativeTime = (d: string | Date) => {
  const diff = (Date.now() - new Date(d).getTime()) / 1000;
  if (diff < 60) return "baru saja";
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} hari lalu`;
  return fmtDate(d);
};

export const initials = (name?: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("") || "?";

export const formatWa = (wa?: string | null) => {
  if (!wa) return "-";
  const local = wa.startsWith("62") ? `0${wa.slice(2)}` : wa;
  return local.replace(/(\d{4})(\d{4})(\d+)/, "$1-$2-$3");
};

export const greeting = () => {
  const h = Number(fmt({ hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  if (h < 11) return "Selamat pagi";
  if (h < 15) return "Selamat siang";
  if (h < 19) return "Selamat sore";
  return "Selamat malam";
};

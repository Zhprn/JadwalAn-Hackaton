import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ChevronLeft, ChevronRight, Gamepad2, Bot, Wrench } from "lucide-react";
import { bookingApi } from "@/services/api";
import { BookingDetailDialog, CreateBookingDialog, type CreateDefaults } from "@/components/booking-dialogs";
import { Spinner, statusColor } from "@/components/common";
import { addDays, dateFromStr, fmtDateLong, rupiah, todayJkt } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types";

type CalSearch = { date?: string };

export const Route = createFileRoute("/_authenticated/dashboard/calender")({
  validateSearch: (s: Record<string, unknown>): CalSearch => ({ date: typeof s.date === "string" ? s.date : undefined }),
  component: CalendarPage,
});

const BLOCK: Record<BookingStatus, string> = {
  pending: "bg-amber-50 border-amber-300 text-amber-800 border-dashed",
  confirmed: "bg-indigo-600 border-indigo-600 text-white",
  checked_in: "bg-sky-500 border-sky-500 text-white",
  completed: "bg-emerald-50 border-emerald-200 text-emerald-800",
  cancelled: "bg-red-50 border-red-200 text-red-700",
  no_show: "bg-slate-100 border-slate-200 text-slate-500",
};

const toMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
};

function CalendarPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const date = search.date ?? todayJkt();
  const setDate = (d: string) => navigate({ search: { date: d } });
  const [category, setCategory] = useState<"ALL" | "PS5" | "PS4">("ALL");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [createDefaults, setCreateDefaults] = useState<CreateDefaults | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["schedule", date],
    queryFn: () => bookingApi.schedule(date),
    refetchInterval: 30_000,
  });

  const openMin = toMin(data?.openTime ?? "10:00");
  let closeMin = toMin(data?.closeTime ?? "23:00");
  if (closeMin <= openMin) closeMin += 24 * 60;
  const totalMin = closeMin - openMin;
  const hours = Array.from({ length: Math.ceil(totalMin / 60) }, (_, i) => openMin + i * 60);
  const label = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  // Posisi "sekarang" (hanya untuk hari ini).
  const nowParts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  let nowMin = toMin(nowParts);
  if (nowMin < openMin && closeMin > 24 * 60) nowMin += 24 * 60;
  const showNow = date === todayJkt() && nowMin >= openMin && nowMin <= closeMin;

  /** Menit relatif terhadap jam buka (booking lewat tengah malam tetap benar). */
  const rel = (iso: string) => {
    const start = new Date(`${date}T00:00:00+07:00`).getTime();
    return (new Date(iso).getTime() - start) / 60000 - openMin;
  };

  const stations = (data?.stations ?? []).filter((s) => category === "ALL" || s.category.toUpperCase() === category);
  const isToday = date === todayJkt();

  return (
    <div className="flex flex-col gap-6 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Manajemen Kalender</h1>
          <p className="text-sm text-slate-500 mt-1">Atur jam main, cek slot kosong, dan hindari booking bentrok.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateDefaults({ date })}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} /> Tambah reservasi
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        {/* CONTROLS */}
        <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setDate(todayJkt())}
              disabled={isToday}
              className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Hari ini
            </button>
            <div className="flex items-center gap-1">
              <button type="button" aria-label="Hari sebelumnya" onClick={() => setDate(addDays(date, -1))} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button type="button" aria-label="Hari berikutnya" onClick={() => setDate(addDays(date, 1))} className="p-1.5 text-slate-500 hover:text-slate-700 hover:bg-slate-50 rounded-md">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            <h2 className="text-lg font-bold text-slate-800">{fmtDateLong(dateFromStr(date))}</h2>
            <input
              type="date"
              aria-label="Pilih tanggal"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="h-9 rounded-lg border border-gray-200 px-2 text-sm text-slate-600"
            />
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {(["ALL", "PS5", "PS4"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn("px-4 py-1.5 text-sm font-semibold rounded-md", category === c ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                {c === "ALL" ? "Semua unit" : c}
              </button>
            ))}
          </div>
        </div>

        {/* LEGEND */}
        <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap justify-between items-center gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-5">
            {(["pending", "confirmed", "checked_in", "completed", "no_show"] as BookingStatus[]).map((st) => (
              <div key={st} className="flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className={cn("w-3 h-3 rounded border", BLOCK[st])} /> {statusColor(st).label}
              </div>
            ))}
            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
              <span className="w-3 h-3 rounded bg-indigo-600 ring-2 ring-violet-400" /> Booking dari AI
            </div>
          </div>
          <span className="text-xs text-slate-400">
            Jam operasional {data?.openTime ?? "–"} – {data?.closeTime ?? "–"} · WIB
          </span>
        </div>

        {/* TIMELINE */}
        {isLoading ? (
          <Spinner label="Memuat jadwal..." />
        ) : data?.closed ? (
          <div className="py-16 text-center text-sm text-slate-500">Rental tutup pada tanggal ini (hari libur di pengaturan).</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="p-5 min-w-[960px] flex flex-col gap-3">
              {/* Header jam */}
              <div className="flex items-end pb-2 border-b border-gray-100">
                <div className="w-[180px] flex-shrink-0 text-xs font-bold text-slate-400 tracking-wider">UNIT / JAM</div>
                <div className="flex-1 relative h-4">
                  {hours.map((h) => (
                    <span key={h} className="absolute text-xs font-medium text-slate-400 -translate-x-1/2" style={{ left: `${((h - openMin) / totalMin) * 100}%` }}>
                      {label(h)}
                    </span>
                  ))}
                </div>
              </div>

              {!stations.length && <div className="py-10 text-center text-sm text-slate-500">Tidak ada unit untuk filter ini.</div>}

              {stations.map((st) => (
                <div key={st.id} className="flex min-h-[88px]">
                  <div className="w-[180px] flex-shrink-0 pr-4 flex flex-col justify-center border-r border-slate-100">
                    {st.status === "maintenance" ? <Wrench className="w-5 h-5 text-amber-500 mb-2" /> : <Gamepad2 className="w-5 h-5 text-indigo-600 mb-2" />}
                    <h3 className="text-sm font-bold text-slate-800">{st.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {rupiah(st.pricePerHour)} / jam{st.status === "maintenance" ? " · perawatan" : ""}
                    </p>
                  </div>
                  <div className="flex-1 relative ml-2">
                    {/* Sel jam kosong (klik untuk booking) */}
                    <div className="absolute inset-0 flex">
                      {hours.map((h) => (
                        <button
                          key={h}
                          type="button"
                          disabled={st.status !== "active"}
                          onClick={() => setCreateDefaults({ stationId: st.id, date, startTime: label(h) })}
                          title={`Booking ${st.name} jam ${label(h)}`}
                          className="flex-1 border-l border-slate-100 hover:bg-indigo-50/60 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
                          style={st.status === "maintenance" ? { background: "repeating-linear-gradient(135deg,#F8FAFC 0,#F8FAFC 8px,#F1F5F9 8px,#F1F5F9 16px)" } : undefined}
                        />
                      ))}
                    </div>
                    {/* Blok booking */}
                    {st.bookings.map((b) => {
                      const left = Math.max(0, rel(b.startTime));
                      const right = Math.min(totalMin, rel(b.endTime));
                      if (right <= 0 || left >= totalMin) return null;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setDetailId(b.id)}
                          className={cn(
                            "absolute top-2 bottom-2 rounded-xl border-2 px-3 py-1.5 text-left overflow-hidden hover:opacity-90 hover:shadow-md transition",
                            BLOCK[b.status],
                            b.source === "ai" && "ring-2 ring-violet-400 ring-offset-1",
                          )}
                          style={{ left: `calc(${(left / totalMin) * 100}% + 2px)`, width: `calc(${((right - left) / totalMin) * 100}% - 4px)` }}
                        >
                          <span className="font-semibold text-sm flex items-center gap-1.5 truncate">
                            {b.source === "ai" && <Bot className="w-3.5 h-3.5 shrink-0" />}
                            {b.customer.name}
                          </span>
                          <span className="block text-xs opacity-80 truncate">
                            {b.start} – {b.end}
                            {b.promo ? ` · ${b.promo.code}` : ""}
                          </span>
                          <span className="block text-[10px] font-medium opacity-80 truncate">
                            {statusColor(b.status).label}
                            {b.payment?.status === "paid" ? " · lunas" : ""}
                          </span>
                        </button>
                      );
                    })}
                    {showNow && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none" style={{ left: `${((nowMin - openMin) / totalMin) * 100}%` }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50">
          <span className="text-xs text-slate-500 font-medium px-1">Klik area kosong untuk menambah reservasi · klik blok untuk detail &amp; ubah status</span>
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-bold text-emerald-600">Sinkron otomatis tiap 30 detik</span>
          </div>
        </div>
      </div>

      <BookingDetailDialog bookingId={detailId} onClose={() => setDetailId(null)} />
      <CreateBookingDialog open={!!createDefaults} defaults={createDefaults ?? undefined} onClose={() => setCreateDefaults(null)} />
    </div>
  );
}

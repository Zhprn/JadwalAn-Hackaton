import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Gamepad2, Wallet, Clock, Bot, Plus, ArrowRight, RefreshCw, Sparkles, Timer, MessageSquare } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { aiApi, dashboardApi, stationApi } from "@/services/api";
import { Avatar, Card, EmptyState, SkeletonRows, SourceBadge, StatusBadge } from "@/components/common";
import { BookingDetailDialog, CreateBookingDialog } from "@/components/booking-dialogs";
import { dateFromStr, fmtDateLong, fmtRange, greeting, rupiah, rupiahShort } from "@/lib/format";
import { useAuth } from "@/auth";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardPage,
});

const DAY = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function Trend({ value, suffix = "%" }: { value: number; suffix?: string }) {
  if (!value) return <span className="text-xs font-medium text-slate-400">sama dengan kemarin</span>;
  const up = value > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-500" : "text-red-500"}`}>
      {up ? "↑" : "↓"} {Math.abs(value)}
      {suffix} dari kemarin
    </span>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const summary = useQuery({ queryKey: ["dashboard", "summary"], queryFn: dashboardApi.summary, refetchInterval: 30_000 });
  const revenue = useQuery({ queryKey: ["dashboard", "revenue", 7], queryFn: () => dashboardApi.revenue(7) });
  const stations = useQuery({ queryKey: ["stations"], queryFn: () => stationApi.list() });
  const insight = useQuery({ queryKey: ["ai", "insight", "dashboard"], queryFn: () => aiApi.dashboardInsight(), retry: 0, staleTime: 10 * 60_000 });
  const [refreshingInsight, setRefreshingInsight] = useState(false);

  const s = summary.data;
  const m = s?.metrics;
  const occupancy = Math.round((m?.occupancyRate ?? 0) * 100);
  const freeSlots = Math.max(0, (m?.slotsTotal ?? 0) - (m?.slotsFilled ?? 0));
  const activeStations = stations.data?.filter((x) => x.status === "active") ?? [];
  const ps5 = activeStations.filter((x) => x.category.toUpperCase() === "PS5").length;

  const refreshInsight = async () => {
    setRefreshingInsight(true);
    try {
      await aiApi.dashboardInsight(true);
      await insight.refetch();
    } finally {
      setRefreshingInsight(false);
    }
  };

  const chartData = (revenue.data?.days ?? []).map((d) => ({ ...d, label: DAY[dateFromStr(d.date).getDay()] }));

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">
            {greeting()}, {user?.name?.split(" ")[0] ?? "Admin"}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Semua aktivitas rental dalam satu tampilan. Yuk, cek hari ini!</p>
        </div>
        <Link
          to="/dashboard/calender"
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
        >
          <CalendarDays className="w-4 h-4" />
          {fmtDateLong(new Date())}
        </Link>
      </div>

      {/* 2. SUMMARY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Jam Terisi Hari Ini</span>
            <Gamepad2 className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-slate-800 mb-2">
              {m ? `${m.slotsFilled}/${m.slotsTotal}` : "–"} <span className="text-lg text-slate-400">jam</span>
            </h2>
            <span className="text-xs font-medium text-slate-500">
              {m?.totalBookings ?? 0} booking · <span className="text-violet-600 font-semibold">{m?.aiBookings ?? 0} via AI</span> · {m?.cancelledBookings ?? 0} batal
            </span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Pendapatan Hari Ini</span>
            <Wallet className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-3xl font-semibold text-slate-800 mb-2">{m ? rupiah(m.totalRevenue) : "–"}</h2>
            <Trend value={s?.comparison.revenue ?? 0} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start mb-4">
            <span className="text-sm font-medium text-slate-500">Tingkat Okupansi</span>
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-semibold text-slate-800 mb-2">{m ? `${occupancy}%` : "–"}</h2>
              <p className="text-xs font-medium text-emerald-500">{freeSlots} jam unit masih tersedia</p>
            </div>
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56" aria-hidden="true">
              <circle cx="28" cy="28" r="24" stroke="currentColor" strokeWidth="5" fill="transparent" className="text-indigo-50" />
              <circle
                cx="28"
                cy="28"
                r="24"
                stroke="currentColor"
                strokeWidth="5"
                fill="transparent"
                strokeDasharray="150.8"
                strokeDashoffset={150.8 * (1 - occupancy / 100)}
                className="text-indigo-600 transition-all"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      </div>

      {/* 3. AI BANNER */}
      <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex flex-col lg:flex-row items-start gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            {insight.isLoading ? (
              <>
                <div className="h-4 w-64 bg-indigo-100 rounded animate-pulse" />
                <div className="h-3 w-96 max-w-full bg-indigo-100 rounded animate-pulse mt-2" />
              </>
            ) : insight.data ? (
              <>
                <h3 className="text-sm font-semibold text-indigo-900">{insight.data.title ?? "Insight AI hari ini"}</h3>
                <p className="text-xs text-indigo-700/80 mt-0.5 leading-relaxed">{insight.data.content}</p>
                {!!insight.data.data?.recommendations?.length && (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {insight.data.data.recommendations.slice(0, 3).map((r) => (
                      <li key={r} className="text-[11px] font-medium text-indigo-800 bg-white border border-indigo-100 px-2 py-1 rounded-md flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-violet-500" /> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <>
                <h3 className="text-sm font-semibold text-indigo-900">AI bantu isi slot, kamu fokus urus rental.</h3>
                <p className="text-xs text-indigo-700/80 mt-0.5">
                  {m?.aiBookings ?? 0} booking ditangani AI hari ini{m?.peakHour ? ` · jam paling ramai ${m.peakHour}` : ""}. Insight harian belum tersedia
                  {insight.error ? " (cek GEMINI_API_KEY di backend)" : ""}.
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={refreshInsight}
            disabled={refreshingInsight}
            className="text-xs font-semibold text-indigo-700 flex items-center gap-1.5 hover:text-indigo-800 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingInsight ? "animate-spin" : ""}`} /> Perbarui
          </button>
          <Link to="/dashboard/livechat" className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5 whitespace-nowrap hover:text-indigo-800">
            Lihat percakapan <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 4. CHART + NOW PLAYING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Pendapatan 7 hari</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                {rupiah(revenue.data?.totalRevenue)} · {revenue.data?.totalBookings ?? 0} booking
              </p>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94A3B8" }} />
                <YAxis tickFormatter={rupiahShort} tickLine={false} axisLine={false} width={64} tick={{ fontSize: 11, fill: "#94A3B8" }} />
                <Tooltip
                  cursor={{ fill: "#EEF2FF" }}
                  formatter={(v) => [rupiah(Number(v)), "Pendapatan"]}
                  labelFormatter={(_, p) => (p?.[0]?.payload ? fmtDateLong(dateFromStr(p[0].payload.date)) : "")}
                  contentStyle={{ borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 12 }}
                />
                <Bar dataKey="revenue" fill="#4F46E5" radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">Sedang main</h2>
            <span className="px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 text-xs font-semibold">{s?.nowPlaying.length ?? 0} unit</span>
          </div>
          {!s?.nowPlaying.length ? (
            <EmptyState title="Belum ada yang main" description="Pelanggan yang sudah check-in tampil di sini." icon={<Gamepad2 className="w-5 h-5" />} />
          ) : (
            <ul className="space-y-3">
              {s.nowPlaying.map((b) => {
                const total = new Date(b.endTime).getTime() - new Date(b.startTime).getTime();
                const pct = Math.min(100, Math.max(0, ((Date.now() - new Date(b.startTime).getTime()) / total) * 100));
                const left = Math.max(0, Math.round((new Date(b.endTime).getTime() - Date.now()) / 60000));
                return (
                  <li key={b.id}>
                    <button type="button" onClick={() => setDetailId(b.id)} className="w-full text-left">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-semibold text-slate-800">{b.station.name}</span>
                        <span className="text-xs text-slate-500 flex items-center gap-1">
                          <Timer className="w-3 h-3" /> sisa {left >= 60 ? `${Math.floor(left / 60)}j ${left % 60}m` : `${left}m`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {b.customer.name} · {fmtRange(b.startTime, b.endTime)}
                      </p>
                      <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                        <div className="h-full bg-sky-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* 5. TABLE */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-6 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Reservasi Mendatang</h2>
            <p className="text-sm text-slate-500 mt-1">{s?.upcoming.length ?? 0} reservasi berikutnya</p>
          </div>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Tambah reservasi
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-white border-b border-gray-100 text-xs text-slate-400">
                <th className="py-4 px-6 font-semibold tracking-wide">Nama</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Jam Main</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Unit</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Total</th>
                <th className="py-4 px-6 font-semibold tracking-wide">Status Booking</th>
              </tr>
            </thead>
            <tbody className="text-sm text-slate-800">
              {summary.isLoading && <SkeletonRows rows={4} cols={5} />}
              {s?.upcoming.map((b) => (
                <tr key={b.id} onClick={() => setDetailId(b.id)} className="border-b border-gray-50 hover:bg-slate-50/50 transition-colors cursor-pointer">
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.customer.name} />
                      <div>
                        <p className="font-semibold text-slate-800">{b.customer.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                          <SourceBadge source={b.source} /> <span className="font-mono">{b.bookingCode}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-800">{fmtRange(b.startTime, b.endTime)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{b.durationHours} jam</p>
                  </td>
                  <td className="py-4 px-6 text-slate-600 font-medium">{b.station.name}</td>
                  <td className="py-4 px-6 font-semibold text-slate-800">{rupiah(b.totalPrice)}</td>
                  <td className="py-4 px-6">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {s && !s.upcoming.length && <EmptyState title="Belum ada reservasi mendatang" description="Booking baru dari web, AI, atau manual akan muncul di sini." />}
        </div>

        <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-white">
          <span className="text-xs text-slate-500 font-medium px-2">{s?.pendingPayments ?? 0} booking menunggu pembayaran</span>
          <Link to="/dashboard/calender" className="text-sm font-semibold text-indigo-600 flex items-center gap-1.5 hover:text-indigo-700">
            Buka kalender <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* 6. BOTTOM SUMMARY */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2 pb-8">
        <div className="flex items-center gap-3 px-2">
          <Gamepad2 className="w-6 h-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">{activeStations.length} unit siap main</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {ps5} PS5 · {activeStations.length - ps5} PS4
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-2">
          <Bot className="w-6 h-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">{m?.aiBookings ?? 0} booking otomatis</p>
            <p className="text-xs text-slate-500 mt-0.5">{m?.chatSessions ?? 0} sesi chat hari ini</p>
          </div>
        </div>
        <div className="flex items-center gap-3 px-2">
          <MessageSquare className="w-6 h-6 text-slate-400" />
          <div>
            <p className="text-sm font-semibold text-slate-700">{s?.chats?.human ?? 0} chat menunggu admin</p>
            <p className="text-xs text-slate-500 mt-0.5">{s?.chats?.ai_pilot ?? 0} sesi sedang ditangani AI</p>
          </div>
        </div>
      </div>

      <BookingDetailDialog bookingId={detailId} onClose={() => setDetailId(null)} />
      <CreateBookingDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

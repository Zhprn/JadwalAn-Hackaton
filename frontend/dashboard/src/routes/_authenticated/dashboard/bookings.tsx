import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Download, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { bookingApi, stationApi } from "@/services/api";
import { Avatar, Btn, EmptyState, PageHeader, Pagination, SkeletonRows, SourceBadge, StatusBadge, inputCls } from "@/components/common";
import { BookingDetailDialog, CreateBookingDialog } from "@/components/booking-dialogs";
import { errorMessage } from "@/lib/api-client";
import { fmtDate, fmtRange, formatWa, rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { BookingStatus } from "@/types";

type BookingSearch = { id?: string };

export const Route = createFileRoute("/_authenticated/dashboard/bookings")({
  validateSearch: (s: Record<string, unknown>): BookingSearch => ({ id: typeof s.id === "string" ? s.id : undefined }),
  component: BookingsPage,
});

const STATUS_FILTERS: { value: "" | BookingStatus; label: string; dot?: string }[] = [
  { value: "", label: "Semua" },
  { value: "pending", label: "Pending", dot: "bg-amber-500" },
  { value: "confirmed", label: "Confirmed", dot: "bg-indigo-500" },
  { value: "checked_in", label: "Sedang main", dot: "bg-sky-500" },
  { value: "completed", label: "Selesai", dot: "bg-emerald-500" },
  { value: "cancelled", label: "Dibatalkan", dot: "bg-red-500" },
  { value: "no_show", label: "No-show", dot: "bg-slate-400" },
];

function useDebounced<T>(value: T, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function BookingsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<"" | BookingStatus>("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [source, setSource] = useState("");
  const [stationId, setStationId] = useState("");
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const debouncedQ = useDebounced(q);

  useEffect(() => setPage(1), [status, debouncedQ, from, to, source, stationId]);

  const filters = { status, search: debouncedQ, from, to, source, stationId };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["bookings", filters, page],
    queryFn: () => bookingApi.list({ ...filters, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
  const { data: stations } = useQuery({ queryKey: ["stations"], queryFn: () => stationApi.list() });

  const doExport = async () => {
    setExporting(true);
    try {
      await bookingApi.export({ status, search: debouncedQ, from, to, source, stationId });
      toast.success("File Excel diunduh");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <PageHeader
        title="Daftar Booking"
        subtitle="Semua reservasi dari web, chat AI, dan admin."
        actions={
          <>
            <Btn variant="outline" onClick={doExport} loading={exporting}>
              <Download className="w-4 h-4" /> Export Excel
            </Btn>
            <Btn onClick={() => setCreating(true)}>
              <Plus className="w-4 h-4" /> Tambah reservasi
            </Btn>
          </>
        }
      />

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value || "all"}
            type="button"
            onClick={() => setStatus(f.value)}
            className={cn(
              "inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold border transition-colors",
              status === f.value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50",
            )}
          >
            {f.dot && <span className={cn("w-1.5 h-1.5 rounded-full", f.dot)} />}
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-end">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className={`${inputCls} pl-9`} placeholder="Kode booking, nama, atau WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari booking" />
          </div>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
            Dari
            <input type="date" className={`${inputCls} w-40`} value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-slate-500">
            Sampai
            <input type="date" className={`${inputCls} w-40`} value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select className={`${inputCls} w-40`} value={source} onChange={(e) => setSource(e.target.value)} aria-label="Sumber">
            <option value="">Semua sumber</option>
            <option value="web">Web</option>
            <option value="ai">Chat AI</option>
            <option value="manual">Manual</option>
          </select>
          <select className={`${inputCls} w-44`} value={stationId} onChange={(e) => setStationId(e.target.value)} aria-label="Unit">
            <option value="">Semua unit</option>
            {stations?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className={cn("overflow-x-auto transition-opacity", isFetching && !isLoading && "opacity-60")}>
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-slate-400 bg-slate-50/50">
                <th className="py-3 px-5 font-semibold">Kode</th>
                <th className="py-3 px-5 font-semibold">Pelanggan</th>
                <th className="py-3 px-5 font-semibold">Unit</th>
                <th className="py-3 px-5 font-semibold">Jadwal</th>
                <th className="py-3 px-5 font-semibold">Total</th>
                <th className="py-3 px-5 font-semibold">Bayar</th>
                <th className="py-3 px-5 font-semibold">Sumber</th>
                <th className="py-3 px-5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading && <SkeletonRows rows={8} cols={8} />}
              {data?.data.map((b) => (
                <tr key={b.id} onClick={() => navigate({ search: { id: b.id } })} className="border-b border-gray-50 hover:bg-slate-50/60 cursor-pointer">
                  <td className="py-3 px-5 font-mono font-semibold text-slate-800">{b.bookingCode}</td>
                  <td className="py-3 px-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={b.customer.name} className="w-8 h-8" />
                      <div>
                        <p className="font-semibold text-slate-800">{b.customer.name}</p>
                        <p className="text-xs text-slate-500">{formatWa(b.customer.whatsapp)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-5 text-slate-600">{b.station.name}</td>
                  <td className="py-3 px-5">
                    <p className="font-semibold text-slate-800">{fmtDate(b.startTime)}</p>
                    <p className="text-xs text-slate-500">
                      {fmtRange(b.startTime, b.endTime)} · {b.durationHours}j
                    </p>
                  </td>
                  <td className="py-3 px-5">
                    <p className="font-semibold text-slate-800">{rupiah(b.totalPrice)}</p>
                    {b.discount > 0 && <p className="text-xs text-emerald-600">{b.promo?.code} −{rupiah(b.discount)}</p>}
                  </td>
                  <td className="py-3 px-5">
                    {b.payment ? (
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-md",
                          b.payment.status === "paid" ? "bg-emerald-50 text-emerald-700" : b.payment.status === "pending" ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {b.payment.method} · {b.payment.status}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-5">
                    <SourceBadge source={b.source} />
                  </td>
                  <td className="py-3 px-5">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && !data.data.length && <EmptyState title="Tidak ada booking" description="Coba ubah filter atau rentang tanggal." />}
        </div>
        <Pagination meta={data?.meta} onPage={setPage} />
      </div>

      <BookingDetailDialog bookingId={search.id ?? null} onClose={() => navigate({ search: {} })} />
      <CreateBookingDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

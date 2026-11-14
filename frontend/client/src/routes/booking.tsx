import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, MonitorPlay, ArrowRight, Minus, Plus, Check, QrCode, Wallet, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { bookingApi, publicApi } from "@/services/api";
import { useAuth } from "@/auth";
import { Spinner, inputCls } from "@/components/ui-bits";
import { errorMessage } from "@/lib/api-client";
import { addDays, dateFromStr, fmtDateLong, rupiah, todayJkt } from "@/lib/format";
import { cn } from "@/lib/utils";

type BookingSearch = { date?: string; stationId?: string; start?: string; promo?: string };

export const Route = createFileRoute("/booking")({
  validateSearch: (s: Record<string, unknown>): BookingSearch => ({
    date: typeof s.date === "string" ? s.date : undefined,
    stationId: typeof s.stationId === "string" ? s.stationId : undefined,
    start: typeof s.start === "string" ? s.start : undefined,
    promo: typeof s.promo === "string" ? s.promo : undefined,
  }),
  component: BookingPage,
});

const DAY_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

function BookingPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const search = Route.useSearch();
  const today = todayJkt();

  const [weekStart, setWeekStart] = useState(today);
  const [date, setDate] = useState(search.date && search.date >= today ? search.date : today);
  const [category, setCategory] = useState<"" | "PS5" | "PS4">("");
  const [stationId, setStationId] = useState<string | null>(search.stationId ?? null);
  const [start, setStart] = useState<string | null>(search.start ?? null);
  const [duration, setDuration] = useState(2);
  const [promoInput, setPromoInput] = useState(search.promo ?? "");
  const [promoCode, setPromoCode] = useState<string | null>(search.promo ?? null);
  const [paymentMethod, setPaymentMethod] = useState<"qris" | "cash">("qris");
  const [notes, setNotes] = useState("");

  const settings = useQuery({ queryKey: ["settings"], queryFn: publicApi.settings });
  const av = useQuery({ queryKey: ["availability", date, category], queryFn: () => publicApi.availability(date, category || undefined), refetchInterval: 60_000 });

  const minH = av.data?.minBookingHours ?? settings.data?.minBookingHours ?? 1;
  const selectedStation = av.data?.stations.find((s) => s.station.id === stationId);
  const selectedSlot = selectedStation?.slots.find((s) => s.start === start);
  const maxH = selectedSlot?.available ? selectedSlot.maxHours : (av.data?.maxBookingHours ?? 8);

  // Jaga durasi tetap dalam batas slot yang dipilih.
  useEffect(() => {
    if (selectedSlot?.available) setDuration((d) => Math.min(Math.max(d, minH), selectedSlot.maxHours));
  }, [selectedSlot?.start, selectedSlot?.maxHours, selectedSlot?.available, minH]);

  // Slot yang dipilih jadi tidak tersedia (mis. tanggal/konsol berubah) → reset.
  useEffect(() => {
    if (av.data && stationId && start && !selectedSlot?.available) setStart(null);
  }, [av.data, stationId, start, selectedSlot?.available]);

  const ready = !!stationId && !!start && !!selectedSlot?.available;
  const quoteInput = useMemo(() => ({ stationId: stationId ?? "", date, startTime: start ?? "", durationHours: duration, promoCode }), [stationId, date, start, duration, promoCode]);
  const quote = useQuery({ queryKey: ["quote", quoteInput, auth.isAuthenticated], queryFn: () => bookingApi.quote(quoteInput), enabled: ready });

  const endTime = start ? `${String((Number(start.split(":")[0]) + duration) % 24).padStart(2, "0")}:${start.split(":")[1]}` : "";
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const monthLabel = (() => {
    const d = dateFromStr(dates[3]);
    return `${MONTH[d.getMonth()]} ${d.getFullYear()}`;
  })();

  const create = useMutation({
    mutationFn: () => bookingApi.create({ stationId: stationId!, date, startTime: start!, durationHours: duration, promoCode, notes: notes || undefined, paymentMethod }),
    onSuccess: (res) => {
      if (res.note) toast.info(res.note);
      if (res.booking.status === "pending") {
        navigate({ to: "/bayar/$bookingId", params: { bookingId: res.booking.id } });
      } else {
        toast.success(`Booking ${res.booking.bookingCode} terkonfirmasi! Bayar di kasir saat datang.`);
        navigate({ to: "/jadwal" });
      }
    },
    onError: (e) => toast.error(errorMessage(e, "Booking gagal")),
  });

  const submit = () => {
    if (!auth.isAuthenticated) {
      toast.info("Masuk dulu untuk menyelesaikan booking");
      navigate({ to: "/login", search: { redirect: `/booking?date=${date}&stationId=${stationId}&start=${start}${promoCode ? `&promo=${promoCode}` : ""}` } });
      return;
    }
    create.mutate();
  };

  const q = quote.data;
  const promoOk = promoCode && q && !q.promoError;

  return (
    <div className="min-h-screen bg-[#F8FAFC] -m-4 md:-m-8 pb-24 md:pb-12 pt-4 px-4 md:px-8 font-sans">
      <div className="max-w-[1200px] mx-auto">
        <button type="button" onClick={() => navigate({ to: "/" })} className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-6">
          <ChevronLeft className="w-4 h-4" /> Kembali
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Pilih jadwal main</h1>
          <p className="text-slate-500 text-sm">
            {settings.data
              ? `Jam buka ${settings.data.openTime}–${settings.data.closeTime} WIB · booking minimal ${settings.data.bookingLeadMins} menit sebelum mulai · durasi ${settings.data.minBookingHours}–${settings.data.maxBookingHours} jam`
              : "Memuat info rental…"}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* KIRI */}
          <div className="flex-1 space-y-6 min-w-0">
            <div className="bg-white rounded-2xl p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900">{monthLabel}</h2>
                <div className="flex gap-2">
                  <button
                    type="button"
                    aria-label="Minggu sebelumnya"
                    disabled={weekStart <= today}
                    onClick={() => setWeekStart(addDays(weekStart, -7) < today ? today : addDays(weekStart, -7))}
                    className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:text-slate-300"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button type="button" aria-label="Minggu berikutnya" onClick={() => setWeekStart(addDays(weekStart, 7))} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {dates.map((d) => {
                  const dt = dateFromStr(d);
                  const active = d === date;
                  const closed = settings.data?.closedDays.includes(dt.getDay());
                  return (
                    <button
                      key={d}
                      type="button"
                      disabled={closed}
                      onClick={() => setDate(d)}
                      className={cn(
                        "min-w-[4.5rem] rounded-2xl p-3 flex flex-col items-center justify-center transition-all",
                        active ? "bg-indigo-600 text-white shadow-md shadow-indigo-200" : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300",
                        closed && "opacity-40 cursor-not-allowed",
                      )}
                    >
                      <span className={cn("text-xs", active ? "text-indigo-100" : "text-slate-400")}>{DAY_SHORT[dt.getDay()]}</span>
                      <span className="text-xl font-bold my-0.5">{dt.getDate()}</span>
                      <span className={cn("text-[10px] font-semibold mt-1 h-3", active ? "text-white" : "text-slate-400")}>{closed ? "Libur" : d === today ? "Hari ini" : ""}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex bg-white border border-slate-200 p-1 rounded-xl">
                {(
                  [
                    ["", "Semua"],
                    ["PS5", "PS5"],
                    ["PS4", "PS4"],
                  ] as const
                ).map(([v, l]) => (
                  <button key={l} type="button" onClick={() => setCategory(v)} className={cn("px-4 py-1.5 text-sm font-semibold rounded-lg", category === v ? "bg-indigo-600 text-white" : "text-slate-500")}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded border border-slate-200 bg-white" /> Kosong
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-slate-100" /> Terisi
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-indigo-600" /> Pilihanmu
                </span>
              </div>
            </div>

            {av.isLoading ? (
              <Spinner label="Mengecek slot kosong..." />
            ) : av.data?.closed ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">Rental tutup di tanggal ini. Pilih tanggal lain, ya.</div>
            ) : (
              av.data?.stations.map(({ station, slots, availableCount }) => {
                const isSel = station.id === stationId;
                const endIdx = isSel && start ? slots.findIndex((s) => s.start === start) + duration : -1;
                const startIdx = isSel && start ? slots.findIndex((s) => s.start === start) : -1;
                return (
                  <div key={station.id} className={cn("bg-white rounded-2xl p-5 md:p-6 transition-all", isSel ? "border-2 border-indigo-600 shadow-sm" : "border border-slate-200")}>
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-5">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", isSel ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600")}>
                          <MonitorPlay className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">{station.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {station.category} · maks {station.maxPlayers} pemain · {availableCount} slot kosong
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-slate-900">{rupiah(station.pricePerHour)}</span>
                        <span className="text-xs text-slate-500">/jam</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-7 gap-2">
                      {slots.map((s, idx) => {
                        let cls = "border-slate-200 text-slate-700 hover:border-indigo-400 bg-white";
                        if (!s.available) cls = "bg-slate-50 text-slate-300 border-transparent cursor-not-allowed line-through";
                        if (isSel && idx === startIdx) cls = "bg-indigo-600 text-white border-indigo-600 shadow-sm";
                        else if (isSel && idx > startIdx && idx < endIdx && startIdx >= 0) cls = "bg-indigo-100 text-indigo-700 border-indigo-200";
                        return (
                          <button
                            key={s.start}
                            type="button"
                            disabled={!s.available && !(isSel && idx > startIdx && idx < endIdx)}
                            onClick={() => {
                              setStationId(station.id);
                              setStart(s.start);
                            }}
                            className={cn("py-2 text-xs font-semibold rounded-xl border transition-all", cls)}
                          >
                            {s.start}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            {av.data && !av.data.closed && !av.data.stations.length && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-sm text-slate-500">Belum ada unit untuk konsol ini.</div>
            )}
          </div>

          {/* KANAN */}
          <div className="w-full lg:w-[400px] shrink-0">
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden lg:sticky lg:top-24">
              <div className="bg-[#0F172A] p-6 text-white">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Ringkasan Booking</p>
                <h3 className="text-xl font-bold mb-1">{selectedStation?.station.name ?? "Pilih unit & jam"}</h3>
                <p className="text-sm text-slate-300">
                  {fmtDateLong(dateFromStr(date))}
                  {ready ? ` · ${start}–${endTime} WIB` : ""}
                </p>
              </div>

              <div className="p-6 space-y-6">
                <div>
                  <span className="block text-sm font-semibold text-slate-700 mb-3">Durasi</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      aria-label="Kurangi durasi"
                      disabled={!ready || duration <= minH}
                      onClick={() => setDuration((d) => d - 1)}
                      className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="flex-1 h-11 border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-900">{duration} jam</div>
                    <button
                      type="button"
                      aria-label="Tambah durasi"
                      disabled={!ready || duration >= maxH}
                      onClick={() => setDuration((d) => d + 1)}
                      className="w-11 h-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  {ready && <p className="text-xs text-slate-400 mt-2">Maksimal {maxH} jam dari {start} (slot setelahnya sudah terisi / jam tutup).</p>}
                </div>

                <div>
                  <span className="block text-sm font-semibold text-slate-700 mb-2">Kode promo</span>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      placeholder="Opsional"
                      aria-label="Kode promo"
                      className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold font-mono text-slate-900 focus:outline-none focus:border-indigo-500"
                    />
                    {promoCode ? (
                      <button type="button" onClick={() => (setPromoCode(null), setPromoInput(""))} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50">
                        Hapus
                      </button>
                    ) : (
                      <button type="button" disabled={!promoInput.trim()} onClick={() => setPromoCode(promoInput.trim())} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-50 disabled:opacity-50">
                        Pakai
                      </button>
                    )}
                  </div>
                  {promoCode && ready && q?.promoError && (
                    <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5" /> {q.promoError}
                    </p>
                  )}
                  {promoOk && (
                    <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5" /> {q?.promo?.title ?? promoCode} berhasil dipakai
                    </p>
                  )}
                </div>

                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  {!ready ? (
                    <p className="text-sm text-slate-500 text-center">Pilih jam mulai di salah satu unit.</p>
                  ) : quote.isLoading ? (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
                    </div>
                  ) : q ? (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">
                          {rupiah(q.station.pricePerHour)} × {q.durationHours} jam
                        </span>
                        <span className="font-semibold text-slate-900">{rupiah(q.subtotal)}</span>
                      </div>
                      {q.discount > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-500">Diskon {q.promo?.code}</span>
                          <span className="font-semibold text-emerald-600">−{rupiah(q.discount)}</span>
                        </div>
                      )}
                      <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                        <span className="font-bold text-slate-900">Total</span>
                        <span className="text-2xl font-black text-slate-900">{rupiah(q.totalPrice)}</span>
                      </div>
                    </>
                  ) : null}
                </div>

                <fieldset className="space-y-2">
                  <legend className="block text-sm font-semibold text-slate-700 mb-2">Metode bayar</legend>
                  {(
                    [
                      ["qris", "QRIS", "Semua e-wallet & m-banking · langsung terkonfirmasi", QrCode],
                      ["cash", "Bayar di kasir", "Tunai saat datang", Wallet],
                    ] as const
                  ).map(([v, title, desc, Icon]) => (
                    <label
                      key={v}
                      className={cn("flex items-center gap-3 p-3.5 rounded-xl cursor-pointer border transition-colors", paymentMethod === v ? "border-2 border-indigo-600 bg-indigo-50/40" : "border-slate-200")}
                    >
                      <input type="radio" name="pay" className="sr-only" checked={paymentMethod === v} onChange={() => setPaymentMethod(v)} />
                      <Icon className={cn("w-5 h-5", paymentMethod === v ? "text-indigo-600" : "text-slate-400")} />
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-slate-900">{title}</span>
                        <span className="block text-xs text-slate-500">{desc}</span>
                      </span>
                      {paymentMethod === v && <Check className="w-4 h-4 text-indigo-600" />}
                    </label>
                  ))}
                </fieldset>

                <label className="block space-y-1.5">
                  <span className="text-sm font-semibold text-slate-700">Catatan (opsional)</span>
                  <input className={inputCls} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mis. main ber-4, minta stik tambahan" />
                </label>

                <button
                  type="button"
                  onClick={submit}
                  disabled={!ready || !q || create.isPending}
                  className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {!auth.isAuthenticated ? "Masuk & booking" : paymentMethod === "qris" ? `Booking & bayar ${q ? rupiah(q.totalPrice) : ""}` : "Booking sekarang"}
                  <ArrowRight className="w-4 h-4" />
                </button>
                {paymentMethod === "qris" && settings.data && (
                  <p className="text-[11px] text-slate-400 text-center">Booking QRIS menunggu pembayaran {settings.data.pendingExpiryMins} menit, lalu batal otomatis jika belum dibayar.</p>
                )}
                {!auth.isAuthenticated && <p className="text-[11px] text-slate-400 text-center">Pilihanmu tetap tersimpan setelah masuk.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

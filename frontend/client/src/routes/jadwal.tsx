import { useState } from "react";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Calendar, Clock, MapPin, ArrowUpRight, Info, X, Star, QrCode, Loader2, CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { bookingApi, publicApi, reviewApi } from "@/services/api";
import { Empty, Spinner, StatusPill } from "@/components/ui-bits";
import { errorMessage } from "@/lib/api-client";
import { fmtDateLong, fmtRange, rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Booking } from "@/types";

export const Route = createFileRoute("/jadwal")({
  beforeLoad: ({ context, location }) => {
    if (!context.auth.isAuthenticated) throw redirect({ to: "/login", search: { redirect: location.href } });
  },
  component: JadwalPage,
});

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const jktParts = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return { day: d.getUTCDate(), month: MONTH_SHORT[d.getUTCMonth()] };
};

function useBookings(status: "upcoming" | "history") {
  return useInfiniteQuery({
    queryKey: ["my-bookings", status],
    queryFn: ({ pageParam }) => bookingApi.mine({ status, page: pageParam, limit: 10 }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page < last.meta.totalPages ? last.meta.page + 1 : undefined),
  });
}

function JadwalPage() {
  const upcoming = useBookings("upcoming");
  const history = useBookings("history");
  const settings = useQuery({ queryKey: ["settings"], queryFn: publicApi.settings });
  const [detail, setDetail] = useState<Booking | null>(null);
  const [reviewing, setReviewing] = useState<Booking | null>(null);

  const up = upcoming.data?.pages.flatMap((p) => p.data) ?? [];
  const hist = history.data?.pages.flatMap((p) => p.data) ?? [];
  const totalHistory = history.data?.pages[0]?.meta.total ?? 0;

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-10 space-y-8 relative">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Jadwal Saya</h1>
        <p className="text-slate-500 text-sm">Semua rencana mainmu, rapi dalam satu tempat.</p>
      </div>

      <div className="bg-[#F8F9FF] border border-indigo-50 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-2.5 rounded-xl shadow-sm text-indigo-600">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-0.5">{up.length ? `Ada ${up.length} jadwal seru menantimu.` : "Belum ada jadwal mendatang."}</h3>
            <p className="text-xs text-slate-500">{up.length ? "Datang 10 menit lebih awal, ya!" : "Yuk cari slot kosong untuk mabar berikutnya."}</p>
          </div>
        </div>
        <Link to="/booking" className="text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 rounded-lg flex items-center gap-1.5 w-fit">
          <CalendarPlus className="w-4 h-4" /> Booking baru
        </Link>
      </div>

      {/* Akan datang */}
      <section>
        <div className="flex justify-between items-end mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Akan datang</h2>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-md">{up.length}</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Reservasi aktif</span>
        </div>
        {upcoming.isLoading ? (
          <Spinner />
        ) : !up.length ? (
          <Empty title="Belum ada booking aktif" description="Booking dari web maupun chat AI akan muncul di sini." action={<Link to="/booking" className="text-sm font-bold text-indigo-600">Cari slot kosong →</Link>} />
        ) : (
          <div className="space-y-4">
            {up.map((b) => (
              <BookingCard key={b.id} b={b} address={settings.data?.address} storeName={settings.data?.name} onDetail={() => setDetail(b)} />
            ))}
          </div>
        )}
        {upcoming.hasNextPage && (
          <button type="button" onClick={() => upcoming.fetchNextPage()} className="mt-4 w-full text-sm font-semibold text-indigo-600 py-3 rounded-xl border border-slate-200 hover:bg-slate-50">
            Muat lebih banyak
          </button>
        )}
      </section>

      <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] md:text-xs text-slate-500 leading-relaxed">
          Tunjukkan kode booking saat tiba. Pembatalan bisa dilakukan sendiri maksimal 1 jam sebelum sesi; perubahan jadwal dibantu admin lewat Chat AI.
        </p>
      </div>

      {/* Riwayat */}
      <section>
        <div className="flex justify-between items-end mb-4 mt-8">
          <h2 className="text-lg font-bold text-slate-900">Riwayat</h2>
          <span className="text-xs text-slate-400 font-medium">{totalHistory} sesi</span>
        </div>
        {history.isLoading ? (
          <Spinner />
        ) : !hist.length ? (
          <p className="text-sm text-slate-400">Belum ada riwayat main.</p>
        ) : (
          <div className="space-y-3">
            {hist.map((b) => (
              <div key={b.id} className={cn("bg-white border border-slate-200 rounded-2xl p-5", b.status !== "completed" && "opacity-70")}>
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">#{b.bookingCode}</span>
                  <StatusPill status={b.status} />
                </div>
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base mb-1">{b.station.name}</h3>
                    <p className="text-xs text-slate-500">
                      {fmtDateLong(b.startTime)} • {fmtRange(b.startTime, b.endTime)} WIB · {rupiah(b.totalPrice)}
                    </p>
                  </div>
                  {b.status === "completed" &&
                    (b.review ? (
                      <span className="flex gap-0.5" aria-label={`Ulasanmu ${b.review.rating} bintang`}>
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className={cn("w-4 h-4", i < b.review!.rating ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
                        ))}
                      </span>
                    ) : (
                      <button type="button" onClick={() => setReviewing(b)} className="text-xs font-semibold text-indigo-600 border border-indigo-100 rounded-lg px-3 py-2 hover:bg-indigo-50 flex items-center gap-1.5 w-fit">
                        <Star className="w-3.5 h-3.5" /> Beri ulasan
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}
        {history.hasNextPage && (
          <button type="button" onClick={() => history.fetchNextPage()} className="mt-4 w-full text-sm font-semibold text-indigo-600 py-3 rounded-xl border border-slate-200 hover:bg-slate-50">
            Muat lebih banyak
          </button>
        )}
      </section>

      {detail && <DetailModal b={detail} onClose={() => setDetail(null)} storeName={settings.data?.name} address={settings.data?.address} />}
      {reviewing && <ReviewModal b={reviewing} onClose={() => setReviewing(null)} />}
    </div>
  );
}

function BookingCard({ b, onDetail, address, storeName }: { b: Booking; onDetail: () => void; address?: string | null; storeName?: string }) {
  const p = jktParts(b.startTime);
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-indigo-300 transition-colors">
      <div className="flex justify-between items-center mb-4">
        <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono">{b.bookingCode}</span>
        <StatusPill status={b.status} />
      </div>
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
        <div className="flex gap-4 items-start">
          <div className="bg-[#F8F9FF] text-indigo-600 rounded-xl w-14 h-14 flex flex-col justify-center items-center shrink-0 border border-indigo-50">
            <span className="text-lg font-black leading-none">{p.day}</span>
            <span className="text-[10px] font-bold uppercase mt-0.5 tracking-wider">{p.month}</span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900 text-base mb-1.5">{b.station.name}</h3>
            <div className="space-y-1">
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> {fmtDateLong(b.startTime)}
              </p>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> {fmtRange(b.startTime, b.endTime)} WIB · {b.durationHours} jam
              </p>
            </div>
          </div>
        </div>
        <div className="md:text-right flex flex-col justify-center bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
          <p className="text-xs font-semibold text-slate-700 flex items-center md:justify-end gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400" /> {storeName ?? "JadwalAn"}
          </p>
          {address && <p className="text-[10px] text-slate-500 md:ml-0 ml-5">{address}</p>}
        </div>
      </div>
      <div className="mt-5 pt-5 border-t border-slate-100 flex justify-between items-center gap-3">
        <div>
          <p className="text-[10px] text-slate-400 font-medium mb-0.5">
            Total {b.payment?.status === "paid" ? "· lunas" : b.status === "pending" ? "· belum dibayar" : "· bayar di kasir"}
          </p>
          <p className="font-extrabold text-slate-900">{rupiah(b.totalPrice)}</p>
        </div>
        <div className="flex gap-2">
          {b.status === "pending" && (
            <Link to="/bayar/$bookingId" params={{ bookingId: b.id }} className="text-xs font-bold text-white bg-indigo-600 rounded-lg px-4 py-2.5 hover:bg-indigo-700">
              Bayar sekarang
            </Link>
          )}
          <button type="button" onClick={onDetail} className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 border border-slate-200 rounded-lg px-4 py-2.5 hover:bg-slate-50 active:scale-95 transition-all">
            <ArrowUpRight className="w-4 h-4" /> Lihat detail
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ b, onClose, storeName, address }: { b: Booking; onClose: () => void; storeName?: string; address?: string | null }) {
  const qc = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const canCancel = ["pending", "confirmed"].includes(b.status) && (b.status === "pending" || new Date(b.startTime).getTime() - Date.now() > 60 * 60 * 1000);
  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(b.id, "Dibatalkan pelanggan"),
    onSuccess: () => {
      toast.success("Booking dibatalkan");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Detail booking ${b.bookingCode}`} onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden max-h-[92vh] overflow-y-auto">
        <div className="bg-indigo-600 text-white p-6 flex justify-between items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-200 mb-1">Kode booking</p>
            <h3 className="font-black text-2xl font-mono tracking-wider">{b.bookingCode}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          {["pending", "confirmed", "checked_in"].includes(b.status) && b.bookingCode && (
            <div className="flex flex-col items-center gap-2">
              <div className="p-3 bg-white border border-slate-200 rounded-2xl">
                <QRCodeSVG value={b.bookingCode} size={150} level="M" title="QR kode booking" />
              </div>
              <p className="text-[11px] text-slate-500 flex items-center gap-1">
                <QrCode className="w-3.5 h-3.5" /> Tunjukkan ke kasir saat check-in
              </p>
            </div>
          )}
          <div className="flex justify-center">
            <StatusPill status={b.status} />
          </div>
          <dl className="space-y-3 text-sm">
            {[
              ["Unit", b.station.name],
              ["Tanggal", fmtDateLong(b.startTime)],
              ["Jam", `${fmtRange(b.startTime, b.endTime)} WIB (${b.durationHours} jam)`],
              ["Lokasi", `${storeName ?? "JadwalAn"}${address ? ` · ${address}` : ""}`],
              ["Subtotal", rupiah(b.subtotal)],
              ...(b.discount > 0 ? [[`Diskon ${b.promo?.code ?? ""}`, `−${rupiah(b.discount)}`]] : []),
              ["Pembayaran", b.payment ? `${b.payment.method.toUpperCase()} · ${b.payment.status === "paid" ? "lunas" : b.payment.status}` : "Bayar di kasir"],
              ...(b.notes ? [["Catatan", b.notes]] : []),
              ...(b.cancelReason ? [["Alasan batal", b.cancelReason]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-slate-500">{k}</dt>
                <dd className="font-semibold text-slate-900 text-right">{v}</dd>
              </div>
            ))}
            <div className="flex justify-between pt-3 border-t border-slate-100">
              <dt className="font-bold text-slate-900">Total</dt>
              <dd className="font-black text-lg text-slate-900">{rupiah(b.totalPrice)}</dd>
            </div>
          </dl>

          {b.status === "pending" && (
            <Link to="/bayar/$bookingId" params={{ bookingId: b.id }} className="block text-center w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700">
              Bayar sekarang
            </Link>
          )}
          {canCancel &&
            (confirming ? (
              <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-3">
                <p className="text-sm font-semibold text-red-700">
                  Yakin batalkan booking ini?{b.payment?.status === "paid" ? " Refund akan diproses admin." : ""}
                </p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setConfirming(false)} className="flex-1 py-2.5 rounded-lg bg-white border border-slate-200 text-sm font-semibold">
                    Tidak
                  </button>
                  <button type="button" onClick={() => cancel.mutate()} disabled={cancel.isPending} className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-2">
                    {cancel.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Ya, batalkan
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="w-full bg-white border border-red-200 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-50">
                Batalkan booking
              </button>
            ))}
          {b.status === "confirmed" && !canCancel && <p className="text-xs text-center text-slate-500">Kurang dari 1 jam sebelum main — pembatalan dibantu admin lewat Chat AI.</p>}
        </div>
      </div>
    </div>
  );
}

function ReviewModal({ b, onClose }: { b: Booking; onClose: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const submit = useMutation({
    mutationFn: () => reviewApi.create({ bookingId: b.id, rating, comment: comment || undefined }),
    onSuccess: () => {
      toast.success("Terima kasih atas ulasanmu!");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      qc.invalidateQueries({ queryKey: ["reviews"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="fixed inset-0 z-[90] bg-slate-900/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Beri ulasan" onClick={(e) => e.stopPropagation()} className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-5">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-bold text-lg text-slate-900">Gimana mainnya?</h3>
            <p className="text-xs text-slate-500">
              {b.station.name} · {fmtDateLong(b.startTime)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex justify-center gap-2" role="radiogroup" aria-label="Rating">
          {Array.from({ length: 5 }).map((_, i) => (
            <button key={i} type="button" role="radio" aria-checked={rating === i + 1} aria-label={`${i + 1} bintang`} onClick={() => setRating(i + 1)}>
              <Star className={cn("w-9 h-9 transition-colors", i < rating ? "text-amber-400 fill-amber-400" : "text-slate-200")} />
            </button>
          ))}
        </div>
        <textarea
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm min-h-[100px] focus:outline-none focus:border-indigo-500"
          placeholder="Ceritakan pengalamanmu: unit, kebersihan, pelayanan…"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-label="Ulasan"
        />
        <button type="button" onClick={() => submit.mutate()} disabled={submit.isPending} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-70">
          {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />} Kirim ulasan
        </button>
      </div>
    </div>
  );
}

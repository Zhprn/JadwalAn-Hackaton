import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Check, Clock, Download, RefreshCcw, Loader2, PartyPopper, XCircle, Wallet } from "lucide-react";
import { toast } from "sonner";
import { bookingApi, paymentApi } from "@/services/api";
import { ApiError, errorMessage } from "@/lib/api-client";
import { fmtDateLong, fmtRange, rupiah } from "@/lib/format";
import { Spinner, StatusPill } from "./ui-bits";
import type { Payment } from "@/types";

export function PaymentQRIS({ bookingId }: { bookingId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const qrBox = useRef<HTMLDivElement>(null);

  const booking = useQuery({ queryKey: ["booking", bookingId], queryFn: () => bookingApi.get(bookingId) });
  const b = booking.data;

  // Buat / ambil QRIS saat booking masih pending.
  const createQr = useMutation({
    mutationFn: () => paymentApi.qris(bookingId),
    onSuccess: (p) => {
      setPayment(p);
      setQrError(null);
    },
    onError: (e) => setQrError(e instanceof ApiError && e.statusCode === 503 ? "QRIS belum tersedia di rental ini. Silakan bayar di kasir saat datang." : errorMessage(e)),
  });

  useEffect(() => {
    if (!b) return;
    if (b.payment) setPayment(b.payment);
    const needQr =
      b.status === "pending" &&
      (!b.payment || b.payment.status === "expired" || b.payment.status === "failed" || (b.payment.status === "pending" && (!b.payment.qrUrl || (b.payment.expiredAt && new Date(b.payment.expiredAt).getTime() < Date.now()))));
    if (needQr && !createQr.isPending && !createQr.isSuccess && !qrError) createQr.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [b?.id, b?.status]);

  // Cek status otomatis selama belum lunas.
  const paid = payment?.status === "paid" || b?.payment?.status === "paid";
  const status = useQuery({
    queryKey: ["payment", bookingId],
    queryFn: () => paymentApi.status(bookingId),
    enabled: !!payment && !paid && b?.status === "pending",
    refetchInterval: 4000,
  });
  useEffect(() => {
    if (status.data) setPayment((p) => ({ ...(p ?? status.data), ...status.data }));
    if (status.data?.status === "paid") {
      toast.success("Pembayaran diterima! Booking terkonfirmasi 🎉");
      qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
    }
  }, [status.data, bookingId, qc]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId, "Dibatalkan pelanggan dari halaman pembayaran"),
    onSuccess: () => {
      toast.success("Booking dibatalkan");
      qc.invalidateQueries({ queryKey: ["my-bookings"] });
      navigate({ to: "/jadwal" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (booking.isLoading) return <Spinner label="Memuat booking..." />;
  if (!b) return <p className="text-center text-sm text-slate-500 py-12">Booking tidak ditemukan.</p>;

  const leftMs = payment?.expiredAt ? new Date(payment.expiredAt).getTime() - now : 0;
  const minutes = Math.max(0, Math.floor(leftMs / 60000))
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, Math.floor((leftMs % 60000) / 1000))
    .toString()
    .padStart(2, "0");
  const expired = (payment?.status === "pending" && leftMs <= 0) || payment?.status === "expired";
  const isUrl = payment?.qrUrl?.startsWith("http");

  const saveQr = () => {
    if (isUrl && payment?.qrUrl) return window.open(payment.qrUrl, "_blank", "noopener");
    const svg = qrBox.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `QRIS-${b.bookingCode}.svg`;
    a.click();
  };

  const step = paid || b.status === "confirmed" ? 3 : 2;

  return (
    <div className="w-full animate-in fade-in slide-in-from-right-4 duration-300">
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 md:gap-4 mb-8 text-sm font-semibold">
        <div className="flex items-center gap-2 text-emerald-600">
          <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span className="hidden sm:inline">Pilih jadwal</span>
        </div>
        <div className="w-8 md:w-12 h-px bg-emerald-600" />
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-emerald-600" : "text-indigo-600"}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 3 ? "bg-emerald-100" : "bg-indigo-600 text-white"}`}>{step >= 3 ? <Check className="w-3.5 h-3.5" /> : "2"}</div>
          <span className="hidden sm:inline">Bayar</span>
        </div>
        <div className={`w-8 md:w-12 h-px ${step >= 3 ? "bg-emerald-600" : "bg-slate-200"}`} />
        <div className={`flex items-center gap-2 ${step >= 3 ? "text-indigo-600" : "text-slate-400"}`}>
          <div className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= 3 ? "bg-indigo-600 text-white" : "bg-slate-100"}`}>3</div>
          <span className="hidden sm:inline">Selesai</span>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* KIRI */}
        <div className="flex-[1.2] bg-white rounded-[2rem] border border-slate-200 p-8 md:p-10 shadow-sm flex flex-col items-center text-center">
          {paid || b.status === "confirmed" || b.status === "checked_in" ? (
            <>
              <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-6">
                <PartyPopper className="w-10 h-10" />
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">Booking terkonfirmasi!</h2>
              <p className="text-slate-500 text-sm mb-8">Tunjukkan kode booking ke kasir saat datang. Sampai ketemu!</p>
              <p className="text-4xl font-black font-mono tracking-wider text-slate-900 mb-8">{b.bookingCode}</p>
              <Link to="/jadwal" className="w-full sm:w-auto bg-indigo-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-indigo-700">
                Lihat booking saya
              </Link>
            </>
          ) : b.status === "cancelled" || expired ? (
            <>
              <div className="w-20 h-20 rounded-full bg-red-50 text-red-500 flex items-center justify-center mb-6">
                <XCircle className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{b.status === "cancelled" ? "Booking dibatalkan" : "Waktu pembayaran habis"}</h2>
              <p className="text-slate-500 text-sm mb-8">{b.cancelReason ?? "Slot sudah dilepas. Silakan booking ulang."}</p>
              <Link to="/booking" className="bg-indigo-600 text-white font-bold py-3.5 px-8 rounded-xl hover:bg-indigo-700">
                Booking ulang
              </Link>
            </>
          ) : qrError ? (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-6">
                <Wallet className="w-10 h-10" />
              </div>
              <h2 className="text-xl font-extrabold text-slate-900 mb-2">QRIS belum bisa dibuat</h2>
              <p className="text-slate-500 text-sm mb-6 max-w-sm">{qrError}</p>
              <button type="button" onClick={() => (setQrError(null), createQr.mutate())} className="bg-white border border-slate-200 text-slate-700 font-bold py-3 px-6 rounded-xl hover:bg-slate-50">
                Coba lagi
              </button>
            </>
          ) : (
            <>
              <div className="bg-orange-50 text-orange-600 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1.5 mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" /> Menunggu pembayaran
              </div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 mb-2">Scan QRIS untuk membayar</h2>
              <p className="text-slate-500 text-sm mb-8">Gunakan GoPay, OVO, DANA, ShopeePay, atau m-banking apa pun.</p>

              <div ref={qrBox} className="w-64 h-64 bg-white border border-slate-200 rounded-2xl flex items-center justify-center mb-8 p-4">
                {!payment?.qrUrl ? (
                  <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
                ) : isUrl ? (
                  <img src={payment.qrUrl} alt={`QRIS untuk booking ${b.bookingCode}`} className="w-full h-full object-contain" />
                ) : (
                  <QRCodeSVG value={payment.qrUrl} size={224} level="M" title={`QRIS untuk booking ${b.bookingCode}`} />
                )}
              </div>

              <p className="text-slate-500 text-xs font-medium mb-1 uppercase tracking-widest">Total pembayaran</p>
              <p className="text-4xl font-black text-slate-900 tracking-tighter mb-8">{rupiah(b.totalPrice)}</p>

              {payment?.expiredAt && (
                <div className="w-full bg-orange-50/80 text-orange-700 text-sm font-bold p-4 rounded-xl flex items-center justify-center gap-2 mb-6 border border-orange-100">
                  <Clock className="w-4 h-4" /> Bayar dalam{" "}
                  <span className="font-mono">
                    {minutes}:{seconds}
                  </span>{" "}
                  <span className="font-normal text-orange-600 hidden sm:inline">sebelum booking batal otomatis</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row w-full gap-3">
                <button
                  type="button"
                  onClick={saveQr}
                  disabled={!payment?.qrUrl}
                  className="flex-1 bg-white border border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" /> Simpan QR
                </button>
                <button
                  type="button"
                  onClick={() => status.refetch()}
                  disabled={status.isFetching || !payment}
                  className="flex-[1.5] bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                >
                  <RefreshCcw className={`w-4 h-4 ${status.isFetching ? "animate-spin" : ""}`} />
                  {status.isFetching ? "Mengecek..." : "Cek status pembayaran"}
                </button>
              </div>
              <p className="text-[10px] text-slate-400 mt-5">Status dicek otomatis setiap beberapa detik.</p>
            </>
          )}
        </div>

        {/* KANAN */}
        <div className="flex-1 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Kode Booking</p>
              <StatusPill status={paid && b.status === "pending" ? "confirmed" : b.status} />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-6 tracking-wide font-mono">{b.bookingCode}</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Unit</span>
                <span className="font-bold text-slate-900">{b.station.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tanggal</span>
                <span className="font-bold text-slate-900">{fmtDateLong(b.startTime)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jam</span>
                <span className="font-bold text-slate-900">
                  {fmtRange(b.startTime, b.endTime)} WIB ({b.durationHours} jam)
                </span>
              </div>
              <div className="flex justify-between pt-3 border-t border-slate-100">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-bold text-slate-900">{rupiah(b.subtotal)}</span>
              </div>
              {b.promo && b.discount > 0 && (
                <div className="flex justify-between items-center">
                  <div className="text-slate-500 flex items-center gap-2">
                    Promo <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded uppercase">{b.promo.code}</span>
                  </div>
                  <span className="font-bold text-emerald-600">−{rupiah(b.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t border-slate-200 mt-2">
                <span className="font-bold text-slate-900">Total</span>
                <span className="text-xl font-black text-slate-900">{rupiah(b.totalPrice)}</span>
              </div>
            </div>
          </div>

          {b.status === "pending" && !paid && (
            <>
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
                <h4 className="font-bold text-slate-900 mb-4">Cara bayar</h4>
                <ol className="list-decimal list-inside text-sm text-slate-600 space-y-2.5">
                  <li>Buka aplikasi e-wallet atau m-banking.</li>
                  <li>Pilih menu Scan / QRIS, arahkan ke kode di samping.</li>
                  <li>Pastikan nominal {rupiah(b.totalPrice)}, lalu konfirmasi.</li>
                </ol>
              </div>
              <div className="pt-2 flex flex-col gap-4 items-center">
                <Link to="/jadwal" className="text-sm font-bold text-slate-700 hover:text-indigo-600 transition-colors">
                  Bayar nanti, ke Jadwal Saya
                </Link>
                <button
                  type="button"
                  onClick={() => confirm("Batalkan booking ini?") && cancel.mutate()}
                  disabled={cancel.isPending}
                  className="w-full bg-white border border-red-200 text-red-600 font-bold py-3.5 rounded-xl hover:bg-red-50 transition-colors shadow-sm disabled:opacity-60"
                >
                  {cancel.isPending ? "Membatalkan..." : "Batalkan booking"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

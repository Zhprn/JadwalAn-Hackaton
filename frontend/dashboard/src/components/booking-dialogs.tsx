/* eslint-disable react-refresh/only-export-components -- file ini sengaja mengekspor helper bersama komponen */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, CalendarClock, CheckCircle2, LogIn, Search, UserPlus, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, Btn, Field, SourceBadge, Spinner, StatusBadge, TierBadge, inputCls, textareaCls } from "@/components/common";
import { bookingApi, customerApi, paymentApi, settingsApi, stationApi, type AdminBookingInput } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import { fmtDateLong, fmtDateTime, fmtRange, formatWa, rupiah, todayJkt } from "@/lib/format";
import type { BookingStatus } from "@/types";

/** Invalidate semua query yang terdampak perubahan booking. */
export function useInvalidateBookings() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["bookings"] });
    qc.invalidateQueries({ queryKey: ["booking"] });
    qc.invalidateQueries({ queryKey: ["schedule"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

// =====================================================================
// Detail booking + aksi status
// =====================================================================

export function BookingDetailDialog({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const invalidate = useInvalidateBookings();
  const { data: b, isLoading } = useQuery({
    queryKey: ["booking", bookingId],
    queryFn: () => bookingApi.get(bookingId!),
    enabled: !!bookingId,
  });
  const [notes, setNotes] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [askCancel, setAskCancel] = useState(false);
  const [reschedule, setReschedule] = useState(false);

  useEffect(() => {
    setNotes(b?.notes ?? "");
    setAskCancel(false);
    setReschedule(false);
    setCancelReason("");
  }, [b?.id, b?.notes]);

  const run = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onSuccess: () => invalidate(),
    onError: (err) => toast.error(errorMessage(err)),
  });

  const setStatus = (status: BookingStatus, reason?: string, msg?: string) =>
    run.mutate(() => bookingApi.setStatus(b!.id, status, reason), { onSuccess: () => toast.success(msg ?? "Status diperbarui") });

  const paid = b?.payment?.status === "paid";

  return (
    <Dialog open={!!bookingId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        {isLoading || !b ? (
          <Spinner />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-mono tracking-wide">{b.bookingCode ?? "Booking"}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <StatusBadge status={b.status} />
                  <SourceBadge source={b.source} />
                  {b.chatSession && <span className="text-xs text-violet-600 font-medium">via chat: {b.chatSession.title ?? "sesi AI"}</span>}
                </div>
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl border border-gray-100 p-3">
              <Avatar name={b.customer.name} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 flex items-center gap-2">
                  {b.customer.name} <TierBadge tier={b.customer.tier} />
                </p>
                <p className="text-xs text-slate-500">{formatWa(b.customer.whatsapp)}</p>
              </div>
              <a
                href={`https://wa.me/${b.customer.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-emerald-600 hover:underline"
              >
                WhatsApp
              </a>
            </div>

            <dl className="rounded-xl bg-slate-50 p-4 space-y-2 text-sm">
              <Row label="Unit" value={b.station.name} />
              <Row label="Jadwal" value={`${fmtDateLong(b.startTime)}, ${fmtRange(b.startTime, b.endTime)} (${b.durationHours} jam)`} />
              <Row label="Subtotal" value={rupiah(b.subtotal)} />
              {b.discount > 0 && <Row label={`Diskon ${b.promo?.code ?? ""}`} value={<span className="text-emerald-600">−{rupiah(b.discount)}</span>} />}
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <dt className="font-semibold text-slate-800">Total</dt>
                <dd className="font-bold text-slate-900 text-base">{rupiah(b.totalPrice)}</dd>
              </div>
              <Row
                label="Pembayaran"
                value={
                  b.payment ? (
                    <span className={paid ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                      {b.payment.method.toUpperCase()} · {b.payment.status}
                    </span>
                  ) : (
                    <span className="text-slate-500">Belum ada</span>
                  )
                }
              />
              {b.cancelReason && <Row label="Alasan batal" value={b.cancelReason} />}
            </dl>

            {/* Aksi */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Aksi</p>
              <div className="flex flex-wrap gap-2">
                {b.status === "pending" && (
                  <Btn onClick={() => setStatus("confirmed", undefined, "Booking dikonfirmasi")} loading={run.isPending}>
                    <CheckCircle2 className="w-4 h-4" /> Konfirmasi
                  </Btn>
                )}
                {b.status === "confirmed" && (
                  <Btn onClick={() => setStatus("checked_in", undefined, "Pelanggan check-in")} loading={run.isPending}>
                    <LogIn className="w-4 h-4" /> Check-in
                  </Btn>
                )}
                {b.status === "checked_in" && (
                  <Btn onClick={() => setStatus("completed", undefined, "Sesi selesai")} loading={run.isPending}>
                    <CheckCircle2 className="w-4 h-4" /> Selesaikan
                  </Btn>
                )}
                {["pending", "confirmed", "checked_in"].includes(b.status) && !paid && (
                  <>
                    <Btn variant="outline" onClick={() => run.mutate(() => paymentApi.manual(b.id, "cash"), { onSuccess: () => toast.success("Pembayaran tunai dicatat") })}>
                      <Wallet className="w-4 h-4" /> Bayar tunai
                    </Btn>
                    <Btn variant="outline" onClick={() => run.mutate(() => paymentApi.manual(b.id, "transfer"), { onSuccess: () => toast.success("Pembayaran transfer dicatat") })}>
                      Transfer
                    </Btn>
                  </>
                )}
                {["pending", "confirmed"].includes(b.status) && (
                  <Btn variant="outline" onClick={() => setReschedule((v) => !v)}>
                    <CalendarClock className="w-4 h-4" /> Ubah jadwal
                  </Btn>
                )}
                {b.status === "confirmed" && (
                  <Btn variant="ghost" onClick={() => setStatus("no_show", undefined, "Ditandai no-show")}>
                    No-show
                  </Btn>
                )}
                {["pending", "confirmed"].includes(b.status) && (
                  <Btn variant="danger" onClick={() => setAskCancel((v) => !v)}>
                    <XCircle className="w-4 h-4" /> Batalkan
                  </Btn>
                )}
                {paid && ["cancelled", "no_show"].includes(b.status) && (
                  <Btn variant="outline" onClick={() => run.mutate(() => paymentApi.refund(b.id), { onSuccess: () => toast.success("Ditandai refund") })}>
                    Tandai refund
                  </Btn>
                )}
              </div>

              {askCancel && (
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-3 space-y-2">
                  <Field label="Alasan pembatalan">
                    <input className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Mis. pelanggan minta batal" />
                  </Field>
                  <div className="flex justify-end gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => setAskCancel(false)}>
                      Tidak jadi
                    </Btn>
                    <Btn variant="danger" size="sm" loading={run.isPending} onClick={() => setStatus("cancelled", cancelReason || undefined, "Booking dibatalkan")}>
                      Ya, batalkan
                    </Btn>
                  </div>
                </div>
              )}

              {reschedule && <RescheduleForm bookingId={b.id} stationId={b.stationId} duration={b.durationHours} onDone={() => setReschedule(false)} />}
            </div>

            <Field label="Catatan admin">
              <textarea className={textareaCls} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Mis. minta stik tambahan" />
            </Field>
            {notes !== (b.notes ?? "") && (
              <div className="flex justify-end -mt-2">
                <Btn size="sm" variant="outline" onClick={() => run.mutate(() => bookingApi.setNotes(b.id, notes || null), { onSuccess: () => toast.success("Catatan disimpan") })}>
                  Simpan catatan
                </Btn>
              </div>
            )}

            {!!b.history?.length && (
              <div className="space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Riwayat</p>
                <ol className="space-y-2">
                  {b.history.map((h) => (
                    <li key={h.id} className="flex gap-3 text-xs">
                      <span className="mt-1 w-2 h-2 rounded-full bg-indigo-400 shrink-0" />
                      <span className="flex-1">
                        <span className="font-semibold text-slate-700">{h.action.replace("booking.", "")}</span>
                        <span className="text-slate-400"> · {h.user?.name ?? "sistem"} · {fmtDateTime(h.createdAt)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800 text-right">{value}</dd>
    </div>
  );
}

function hourOptions(open = "10:00", close = "23:00") {
  const start = Number(open.split(":")[0]);
  let end = Number(close.split(":")[0]);
  if (end <= start) end += 24;
  return Array.from({ length: end - start }, (_, i) => `${String((start + i) % 24).padStart(2, "0")}:00`);
}

function RescheduleForm({ bookingId, stationId, duration, onDone }: { bookingId: string; stationId: string; duration: number; onDone: () => void }) {
  const invalidate = useInvalidateBookings();
  const { data: stations } = useQuery({ queryKey: ["stations"], queryFn: () => stationApi.list() });
  const { data: setting } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get });
  const [form, setForm] = useState({ stationId, date: todayJkt(), startTime: "16:00", durationHours: duration });
  const save = useMutation({
    mutationFn: () => bookingApi.reschedule(bookingId, form),
    onSuccess: () => {
      toast.success("Jadwal diubah");
      invalidate();
      onDone();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 grid grid-cols-2 gap-2">
      <Field label="Unit" className="col-span-2">
        <select className={inputCls} value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })}>
          {stations?.filter((s) => s.status !== "inactive").map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tanggal">
        <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
      </Field>
      <Field label="Mulai">
        <select className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
          {hourOptions(setting?.openTime, setting?.closeTime).map((h) => (
            <option key={h}>{h}</option>
          ))}
        </select>
      </Field>
      <Field label="Durasi (jam)">
        <input type="number" min={1} max={setting?.maxBookingHours ?? 8} className={inputCls} value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })} />
      </Field>
      <div className="flex items-end justify-end gap-2">
        <Btn variant="ghost" size="sm" onClick={onDone}>
          Batal
        </Btn>
        <Btn size="sm" loading={save.isPending} onClick={() => save.mutate()}>
          Simpan
        </Btn>
      </div>
    </div>
  );
}

// =====================================================================
// Booking manual (walk-in / telepon)
// =====================================================================

export type CreateDefaults = { stationId?: string; date?: string; startTime?: string };

export function CreateBookingDialog({ open, onClose, defaults }: { open: boolean; onClose: () => void; defaults?: CreateDefaults }) {
  const invalidate = useInvalidateBookings();
  const { data: stations } = useQuery({ queryKey: ["stations"], queryFn: () => stationApi.list(), enabled: open });
  const { data: setting } = useQuery({ queryKey: ["settings"], queryFn: settingsApi.get, enabled: open });
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState<{ id: string; name: string } | null>(null);
  const [newCustomer, setNewCustomer] = useState({ name: "", whatsapp: "" });
  const [form, setForm] = useState({ stationId: "", date: todayJkt(), startTime: "16:00", durationHours: 2, promoCode: "", notes: "", pay: "none" as "none" | "cash" | "transfer" });

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({
      ...f,
      stationId: defaults?.stationId ?? f.stationId,
      date: defaults?.date ?? todayJkt(),
      startTime: defaults?.startTime ?? f.startTime,
    }));
  }, [open, defaults?.stationId, defaults?.date, defaults?.startTime]);

  useEffect(() => {
    if (!form.stationId && stations?.length) setForm((f) => ({ ...f, stationId: stations.find((s) => s.status === "active")?.id ?? "" }));
  }, [stations, form.stationId]);

  const { data: found } = useQuery({
    queryKey: ["customers", "search", search],
    queryFn: () => customerApi.list({ search, limit: 6 }),
    enabled: open && mode === "existing" && search.trim().length >= 2,
  });

  const quoteInput = useMemo(
    () => ({ stationId: form.stationId, date: form.date, startTime: form.startTime, durationHours: form.durationHours, promoCode: form.promoCode || null }),
    [form.stationId, form.date, form.startTime, form.durationHours, form.promoCode],
  );
  const { data: quote } = useQuery({
    queryKey: ["quote", quoteInput],
    queryFn: () => bookingApi.quote(quoteInput),
    enabled: open && !!form.stationId && form.durationHours > 0,
  });

  const create = useMutation({
    mutationFn: () => {
      const payload: AdminBookingInput = {
        stationId: form.stationId,
        date: form.date,
        startTime: form.startTime,
        durationHours: form.durationHours,
        promoCode: form.promoCode || null,
        notes: form.notes || undefined,
        status: "confirmed",
        markPaid: form.pay === "none" ? undefined : form.pay,
        ...(mode === "existing" ? { customerId: customer?.id } : { newCustomer }),
      };
      return bookingApi.create(payload);
    },
    onSuccess: (b) => {
      toast.success(`Booking ${b.bookingCode} dibuat`);
      invalidate();
      onClose();
      setCustomer(null);
      setSearch("");
      setNewCustomer({ name: "", whatsapp: "" });
      setForm((f) => ({ ...f, promoCode: "", notes: "", pay: "none" }));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const canSubmit = !!form.stationId && (mode === "existing" ? !!customer : newCustomer.name.trim().length >= 2 && newCustomer.whatsapp.trim().length >= 9);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tambah reservasi</DialogTitle>
          <DialogDescription>Booking manual untuk pelanggan walk-in atau via telepon.</DialogDescription>
        </DialogHeader>

        <div className="flex bg-slate-100 p-1 rounded-lg w-fit">
          <button type="button" onClick={() => setMode("existing")} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${mode === "existing" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
            Pelanggan lama
          </button>
          <button type="button" onClick={() => setMode("new")} className={`px-3 py-1.5 text-xs font-semibold rounded-md flex items-center gap-1 ${mode === "new" ? "bg-white shadow-sm text-slate-800" : "text-slate-500"}`}>
            <UserPlus className="w-3.5 h-3.5" /> Pelanggan baru
          </button>
        </div>

        {mode === "existing" ? (
          customer ? (
            <div className="flex items-center justify-between rounded-xl border border-indigo-100 bg-indigo-50/50 p-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Avatar name={customer.name} className="w-8 h-8" /> {customer.name}
              </span>
              <Btn size="sm" variant="ghost" onClick={() => setCustomer(null)}>
                Ganti
              </Btn>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${inputCls} pl-9`} placeholder="Cari nama atau nomor WhatsApp (min. 2 huruf)" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {!!found?.data.length && (
                <ul className="rounded-xl border border-gray-100 divide-y divide-gray-50 max-h-48 overflow-y-auto">
                  {found.data.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setCustomer({ id: c.id, name: c.name })} className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-slate-50">
                        <Avatar name={c.name} className="w-8 h-8" />
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-slate-800">{c.name}</span>
                          <span className="block text-xs text-slate-500">{formatWa(c.whatsapp)}</span>
                        </span>
                        <TierBadge tier={c.tier} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {search.length >= 2 && found && !found.data.length && <p className="text-xs text-slate-500">Tidak ditemukan — pakai tab "Pelanggan baru".</p>}
            </div>
          )
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama">
              <input className={inputCls} value={newCustomer.name} onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })} />
            </Field>
            <Field label="No. WhatsApp" hint="Jika sudah terdaftar, booking memakai akun yang ada.">
              <input className={inputCls} inputMode="tel" value={newCustomer.whatsapp} onChange={(e) => setNewCustomer({ ...newCustomer, whatsapp: e.target.value })} placeholder="08xx" />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Field label="Unit" className="col-span-2 sm:col-span-3">
            <select className={inputCls} value={form.stationId} onChange={(e) => setForm({ ...form, stationId: e.target.value })}>
              {stations?.filter((s) => s.status === "active").map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {rupiah(s.pricePerHour)}/jam
                </option>
              ))}
            </select>
          </Field>
          <Field label="Tanggal">
            <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Jam mulai">
            <select className={inputCls} value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}>
              {hourOptions(setting?.openTime, setting?.closeTime).map((h) => (
                <option key={h}>{h}</option>
              ))}
            </select>
          </Field>
          <Field label="Durasi (jam)">
            <input type="number" min={setting?.minBookingHours ?? 1} max={setting?.maxBookingHours ?? 8} className={inputCls} value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: Number(e.target.value) })} />
          </Field>
          <Field label="Kode promo">
            <input className={`${inputCls} font-mono uppercase`} value={form.promoCode} onChange={(e) => setForm({ ...form, promoCode: e.target.value.toUpperCase() })} placeholder="Opsional" />
          </Field>
          <Field label="Pembayaran" className="sm:col-span-2">
            <select className={inputCls} value={form.pay} onChange={(e) => setForm({ ...form, pay: e.target.value as typeof form.pay })}>
              <option value="none">Belum bayar</option>
              <option value="cash">Tunai (lunas)</option>
              <option value="transfer">Transfer (lunas)</option>
            </select>
          </Field>
          <Field label="Catatan" className="col-span-2 sm:col-span-3">
            <input className={inputCls} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Opsional" />
          </Field>
        </div>

        <div className="rounded-xl bg-slate-50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-medium">{rupiah(quote?.subtotal)}</span>
          </div>
          {!!quote?.discount && (
            <div className="flex justify-between">
              <span className="text-slate-500">Diskon</span>
              <span className="font-medium text-emerald-600">−{rupiah(quote.discount)}</span>
            </div>
          )}
          {quote?.promoError && <p className="text-xs text-red-600">{quote.promoError}</p>}
          <div className="flex justify-between border-t border-slate-200 pt-1">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-base">{rupiah(quote?.totalPrice)}</span>
          </div>
        </div>

        <DialogFooter>
          <Btn variant="ghost" onClick={onClose}>
            Batal
          </Btn>
          <Btn onClick={() => create.mutate()} disabled={!canSubmit} loading={create.isPending}>
            Simpan booking
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AiMark() {
  return <Bot className="w-3.5 h-3.5" aria-label="Dibuat oleh AI" />;
}

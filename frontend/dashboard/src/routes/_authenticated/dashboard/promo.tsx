import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Sparkles, TicketPercent, TrendingUp, Pencil, Trash2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn, EmptyState, Field, SkeletonRows, Toggle, inputCls, textareaCls } from "@/components/common";
import { aiApi, promoApi, type PromoInput } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import { fmtDate, rupiah, todayJkt, addDays } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Promo } from "@/types";

export const Route = createFileRoute("/_authenticated/dashboard/promo")({
  component: PromoPage,
});

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const discountLabel = (p: Promo) =>
  p.discountType === "nominal" ? rupiah(p.discountAmount) : `${p.discountPercentage}%${p.maxDiscount ? ` (maks ${rupiah(p.maxDiscount)})` : ""}`;

function promoState(p: Promo): { label: string; cls: string } {
  const now = Date.now();
  if (!p.isActive) return { label: "Nonaktif", cls: "bg-slate-100 text-slate-500" };
  if (new Date(p.validUntil).getTime() < now) return { label: "Berakhir", cls: "bg-red-50 text-red-600" };
  if (new Date(p.startDate).getTime() > now) return { label: "Terjadwal", cls: "bg-amber-50 text-amber-700" };
  if (p.usageLimit != null && p.usedCount >= p.usageLimit) return { label: "Kuota habis", cls: "bg-red-50 text-red-600" };
  return { label: "Aktif", cls: "bg-emerald-50 text-emerald-700" };
}

function PromoPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");
  const [editing, setEditing] = useState<Promo | "new" | null>(null);

  const { data: promos, isLoading } = useQuery({ queryKey: ["promos"], queryFn: () => promoApi.list() });
  const insight = useQuery({ queryKey: ["ai", "insight", "dashboard"], queryFn: () => aiApi.dashboardInsight(), retry: 0, staleTime: 10 * 60_000 });

  const remove = useMutation({
    mutationFn: (id: string) => promoApi.remove(id),
    onSuccess: () => {
      toast.success("Promo dihapus / dinonaktifkan");
      qc.invalidateQueries({ queryKey: ["promos"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const toggle = useMutation({
    mutationFn: (p: Promo) => promoApi.update(p.id, { isActive: !p.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["promos"] }),
    onError: (e) => toast.error(errorMessage(e)),
  });

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (promos ?? []).filter((p) => {
      if (filter === "active" && !p.isActive) return false;
      if (filter === "inactive" && p.isActive) return false;
      return !term || p.code.toLowerCase().includes(term) || (p.title ?? "").toLowerCase().includes(term);
    });
  }, [promos, q, filter]);

  const activeCount = promos?.filter((p) => promoState(p).label === "Aktif").length ?? 0;
  const totalUsed = promos?.reduce((s, p) => s + p.usedCount, 0) ?? 0;
  const recommendation = insight.data?.data?.recommendations?.[0];

  return (
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Promo</h1>
          <p className="text-sm text-slate-500 mt-1">Buat, kelola, dan analisis performa kode diskon untuk pelangganmu.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/dashboard/costumer" className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Sparkles className="w-4 h-4" /> Kirim via AI
          </Link>
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-md shadow-indigo-500/20"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} /> Buat Promo Baru
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-indigo-100 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TicketPercent className="w-16 h-16 text-indigo-600" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <TicketPercent className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-medium text-slate-500">Total Promo Aktif</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-2">
            {activeCount} <span className="text-sm font-medium text-slate-400">dari {promos?.length ?? 0} kode</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden group hover:border-emerald-100 transition-colors">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
            <TrendingUp className="w-16 h-16 text-emerald-600" />
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-medium text-slate-500">Total Pemakaian</h3>
          </div>
          <p className="text-3xl font-bold text-slate-800 mt-2">
            {totalUsed} <span className="text-sm font-medium text-slate-400">kali</span>
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-16 h-16 text-indigo-400" />
          </div>
          <h3 className="text-sm font-medium text-slate-500 mb-2 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-slate-500" /> Rekomendasi AI
          </h3>
          <p className="text-sm text-slate-800 mt-2 leading-relaxed">
            {recommendation ? `"${recommendation}"` : insight.isLoading ? "Memuat insight…" : "Insight AI belum tersedia. Pastikan GEMINI_API_KEY terisi di backend."}
          </p>
          {recommendation && (
            <button type="button" onClick={() => setEditing("new")} className="mt-3 text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              Buat promo dari saran ini <Plus className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Cari nama promo atau kode..."
              aria-label="Cari promo"
              className="w-full bg-white border border-gray-200 text-sm rounded-xl pl-9 pr-4 py-2.5 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 outline-none text-slate-700 placeholder:text-slate-400 shadow-sm"
            />
          </div>
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            {(["all", "active", "inactive"] as const).map((f) => (
              <button key={f} type="button" onClick={() => setFilter(f)} className={cn("px-3 py-1.5 text-xs font-semibold rounded-md", filter === f ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}>
                {f === "all" ? "Semua" : f === "active" ? "Aktif" : "Nonaktif"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[960px]">
            <thead>
              <tr className="border-b border-gray-100 text-xs text-slate-400">
                <th className="py-4 px-6 font-semibold">Nama Promo</th>
                <th className="py-4 px-6 font-semibold">Kode</th>
                <th className="py-4 px-6 font-semibold">Diskon</th>
                <th className="py-4 px-6 font-semibold">Status & Periode</th>
                <th className="py-4 px-6 font-semibold">Pemakaian</th>
                <th className="py-4 px-6 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {isLoading && <SkeletonRows rows={4} cols={6} />}
              {list.map((p) => {
                const st = promoState(p);
                const pct = p.usageLimit ? Math.min(100, (p.usedCount / p.usageLimit) * 100) : Math.min(100, p.usedCount);
                return (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-slate-50/50">
                    <td className="py-4 px-6">
                      <p className="font-semibold text-slate-800">{p.title ?? p.code}</p>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xs truncate">
                        {p.consoleType === "ALL" ? "Semua konsol" : p.consoleType} · min {p.minHours} jam
                        {p.validDays.length ? ` · ${p.validDays.map((d) => DAYS[d]).join("/")}` : ""}
                        {p.validFrom && p.validTo ? ` · ${p.validFrom}–${p.validTo}` : ""}
                        {p.targetTier ? ` · khusus ${p.targetTier}` : ""}
                        {!p.isPublic ? " · privat" : ""}
                      </p>
                    </td>
                    <td className="py-4 px-6">
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(p.code).then(() => toast.success("Kode disalin"))}
                        className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-md inline-flex items-center gap-1.5 hover:bg-indigo-100"
                      >
                        {p.code} <Copy className="w-3 h-3" />
                      </button>
                    </td>
                    <td className="py-4 px-6 font-semibold text-slate-800">{discountLabel(p)}</td>
                    <td className="py-4 px-6">
                      <span className={cn("inline-flex px-2 py-0.5 rounded-md text-xs font-semibold", st.cls)}>{st.label}</span>
                      <p className="text-xs text-slate-500 mt-1">
                        {fmtDate(p.startDate)} – {fmtDate(p.validUntil)}
                      </p>
                    </td>
                    <td className="py-4 px-6 w-44">
                      <p className="text-xs text-slate-600 mb-1">
                        {p.usedCount} / {p.usageLimit ?? "∞"}
                      </p>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <Toggle checked={p.isActive} onChange={() => toggle.mutate(p)} label={p.isActive ? "Nonaktifkan" : "Aktifkan"} />
                        <button type="button" onClick={() => setEditing(p)} aria-label="Edit promo" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-indigo-600">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          aria-label="Hapus promo"
                          onClick={() => confirm(`Hapus promo ${p.code}? Promo yang sudah dipakai akan dinonaktifkan.`) && remove.mutate(p.id)}
                          className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {promos && !list.length && <EmptyState title="Belum ada promo" description="Buat kode promo pertama untuk menarik pelanggan." icon={<TicketPercent className="w-5 h-5" />} />}
        </div>
      </div>

      <PromoForm promo={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

type FormState = {
  code: string;
  title: string;
  description: string;
  consoleType: "ALL" | "PS5" | "PS4";
  discountType: "percent" | "nominal";
  discountPercentage: number;
  discountAmount: number;
  maxDiscount: string;
  minHours: number;
  minTransaction: number;
  validDays: number[];
  validFrom: string;
  validTo: string;
  startDate: string;
  validUntil: string;
  isActive: boolean;
  isPublic: boolean;
  targetTier: string;
  usageLimit: string;
  perCustomerLimit: string;
};

const toDateInput = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(iso));

function emptyForm(): FormState {
  return {
    code: "",
    title: "",
    description: "",
    consoleType: "ALL",
    discountType: "percent",
    discountPercentage: 10,
    discountAmount: 5000,
    maxDiscount: "",
    minHours: 1,
    minTransaction: 0,
    validDays: [],
    validFrom: "",
    validTo: "",
    startDate: todayJkt(),
    validUntil: addDays(todayJkt(), 30),
    isActive: true,
    isPublic: true,
    targetTier: "",
    usageLimit: "",
    perCustomerLimit: "",
  };
}

function PromoForm({ promo, onClose }: { promo: Promo | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState<FormState>(emptyForm);
  const isNew = promo === "new";

  useEffect(() => {
    if (!promo) return;
    if (promo === "new") return setF(emptyForm());
    setF({
      code: promo.code,
      title: promo.title ?? "",
      description: promo.description ?? "",
      consoleType: promo.consoleType,
      discountType: promo.discountType,
      discountPercentage: promo.discountPercentage,
      discountAmount: promo.discountAmount,
      maxDiscount: promo.maxDiscount?.toString() ?? "",
      minHours: promo.minHours,
      minTransaction: promo.minTransaction,
      validDays: promo.validDays,
      validFrom: promo.validFrom ?? "",
      validTo: promo.validTo ?? "",
      startDate: toDateInput(promo.startDate),
      validUntil: toDateInput(promo.validUntil),
      isActive: promo.isActive,
      isPublic: promo.isPublic,
      targetTier: promo.targetTier ?? "",
      usageLimit: promo.usageLimit?.toString() ?? "",
      perCustomerLimit: promo.perCustomerLimit?.toString() ?? "",
    });
  }, [promo]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? null : Number(v));

  const save = useMutation({
    mutationFn: () => {
      const payload: PromoInput = {
        code: f.code.trim().toUpperCase(),
        title: f.title || null,
        description: f.description || null,
        consoleType: f.consoleType,
        discountType: f.discountType,
        discountPercentage: f.discountType === "percent" ? f.discountPercentage : 0,
        discountAmount: f.discountType === "nominal" ? f.discountAmount : 0,
        maxDiscount: f.discountType === "percent" ? num(f.maxDiscount) : null,
        minHours: f.minHours,
        minTransaction: f.minTransaction,
        validDays: f.validDays,
        validFrom: f.validFrom || null,
        validTo: f.validTo || null,
        startDate: new Date(`${f.startDate}T00:00:00+07:00`).toISOString(),
        validUntil: new Date(`${f.validUntil}T23:59:59+07:00`).toISOString(),
        isActive: f.isActive,
        isPublic: f.isPublic,
        targetTier: (f.targetTier || null) as PromoInput["targetTier"],
        usageLimit: num(f.usageLimit),
        perCustomerLimit: num(f.perCustomerLimit),
      };
      return isNew ? promoApi.create(payload) : promoApi.update((promo as Promo).id, payload);
    },
    onSuccess: () => {
      toast.success(isNew ? "Promo dibuat" : "Promo diperbarui");
      qc.invalidateQueries({ queryKey: ["promos"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <Dialog open={!!promo} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Buat promo baru" : `Edit promo ${f.code}`}</DialogTitle>
          <DialogDescription>Promo publik tampil di halaman promo pelanggan dan bisa disebut oleh AI.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Field label="Kode" className="col-span-2">
            <input className={`${inputCls} font-mono uppercase font-bold`} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="WEEKEND20" />
          </Field>
          <Field label="Konsol" className="col-span-2">
            <select className={inputCls} value={f.consoleType} onChange={(e) => set("consoleType", e.target.value as FormState["consoleType"])}>
              <option value="ALL">Semua konsol</option>
              <option value="PS5">PS5</option>
              <option value="PS4">PS4</option>
            </select>
          </Field>
          <Field label="Judul" className="col-span-2 sm:col-span-4">
            <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Weekend Mabar" />
          </Field>
          <Field label="Deskripsi" className="col-span-2 sm:col-span-4">
            <textarea className={textareaCls} rows={2} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <Field label="Tipe diskon">
            <select className={inputCls} value={f.discountType} onChange={(e) => set("discountType", e.target.value as FormState["discountType"])}>
              <option value="percent">Persen</option>
              <option value="nominal">Nominal (Rp)</option>
            </select>
          </Field>
          {f.discountType === "percent" ? (
            <>
              <Field label="Diskon (%)">
                <input type="number" min={1} max={100} className={inputCls} value={f.discountPercentage} onChange={(e) => set("discountPercentage", Number(e.target.value))} />
              </Field>
              <Field label="Maks diskon (Rp)" className="col-span-2">
                <input type="number" min={0} className={inputCls} value={f.maxDiscount} onChange={(e) => set("maxDiscount", e.target.value)} placeholder="Tanpa batas" />
              </Field>
            </>
          ) : (
            <Field label="Potongan (Rp)" className="col-span-3">
              <input type="number" min={0} className={inputCls} value={f.discountAmount} onChange={(e) => set("discountAmount", Number(e.target.value))} />
            </Field>
          )}

          <Field label="Min. jam">
            <input type="number" min={1} className={inputCls} value={f.minHours} onChange={(e) => set("minHours", Number(e.target.value))} />
          </Field>
          <Field label="Min. transaksi (Rp)">
            <input type="number" min={0} className={inputCls} value={f.minTransaction} onChange={(e) => set("minTransaction", Number(e.target.value))} />
          </Field>
          <Field label="Mulai berlaku">
            <input type="date" className={inputCls} value={f.startDate} onChange={(e) => set("startDate", e.target.value)} />
          </Field>
          <Field label="Berlaku sampai">
            <input type="date" className={inputCls} value={f.validUntil} onChange={(e) => set("validUntil", e.target.value)} />
          </Field>

          <div className="col-span-2 sm:col-span-4 flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-600">Hari berlaku (kosong = setiap hari)</span>
            <div className="flex flex-wrap gap-2">
              {DAYS.map((d, i) => {
                const on = f.validDays.includes(i);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set("validDays", on ? f.validDays.filter((x) => x !== i) : [...f.validDays, i].sort())}
                    className={cn("h-8 px-3 rounded-lg text-xs font-semibold border", on ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-gray-200")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
          <Field label="Jam dari" hint="Kosong = sepanjang jam buka">
            <input type="time" className={inputCls} value={f.validFrom} onChange={(e) => set("validFrom", e.target.value)} />
          </Field>
          <Field label="Jam sampai">
            <input type="time" className={inputCls} value={f.validTo} onChange={(e) => set("validTo", e.target.value)} />
          </Field>
          <Field label="Kuota total">
            <input type="number" min={1} className={inputCls} value={f.usageLimit} onChange={(e) => set("usageLimit", e.target.value)} placeholder="∞" />
          </Field>
          <Field label="Per pelanggan">
            <input type="number" min={1} className={inputCls} value={f.perCustomerLimit} onChange={(e) => set("perCustomerLimit", e.target.value)} placeholder="∞" />
          </Field>
          <Field label="Target tier" className="col-span-2">
            <select className={inputCls} value={f.targetTier} onChange={(e) => set("targetTier", e.target.value)}>
              <option value="">Semua pelanggan</option>
              <option value="regular">Regular</option>
              <option value="loyal">Loyal</option>
              <option value="vip">VIP</option>
            </select>
          </Field>
          <div className="col-span-2 flex items-end gap-6 pb-2">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} label="Aktif" /> Aktif
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Toggle checked={f.isPublic} onChange={(v) => set("isPublic", v)} label="Publik" /> Tampil publik
            </label>
          </div>
        </div>

        <DialogFooter>
          <Btn variant="ghost" onClick={onClose}>
            Batal
          </Btn>
          <Btn onClick={() => save.mutate()} loading={save.isPending} disabled={f.code.trim().length < 3}>
            {isNew ? "Simpan promo" : "Simpan perubahan"}
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

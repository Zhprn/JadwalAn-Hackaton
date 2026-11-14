import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Download, Users, Heart, UserCheck, Search, Sparkles, X, RefreshCcw, Send, Copy, Loader2, Brain, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { aiApi, customerApi, promoApi, promoMessageApi } from "@/services/api";
import { Avatar, EmptyState, Pagination, SkeletonRows, TierBadge, inputCls, textareaCls } from "@/components/common";
import { errorMessage } from "@/lib/api-client";
import { formatWa, relativeTime, rupiah } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Customer, PromoMessage, Tier } from "@/types";

export const Route = createFileRoute("/_authenticated/dashboard/costumer")({
  component: CustomerPage,
});

type Selected = { id: string; name: string; whatsapp: string; tier: Tier; totalSessions: number; totalHours: number; lastPlayed: string | null };

const TONES = [
  { value: "friendly", label: "Ramah" },
  { value: "casual", label: "Santai" },
  { value: "exclusive", label: "Eksklusif" },
  { value: "urgent", label: "Mendesak" },
];

const daysSince = (d: string | null) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000) : null);

function CustomerPage() {
  const [tab, setTab] = useState<"all" | "loyal" | "comeback">("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("lastPlayed");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Selected | null>(null);

  useEffect(() => setPage(1), [tab, q, sort]);

  const params = {
    search: q || undefined,
    sort,
    inactiveDays: tab === "comeback" ? 14 : undefined,
    page,
    limit: 10,
  };
  const list = useQuery({
    queryKey: ["customers", tab, params],
    queryFn: async () => {
      if (tab !== "loyal") return customerApi.list(params);
      // "Loyal" = loyal + vip, urut berdasarkan belanja.
      const [vip, loyal] = await Promise.all([
        customerApi.list({ ...params, tier: "vip", sort: "totalSpent", limit: 50, page: 1 }),
        customerApi.list({ ...params, tier: "loyal", sort: "totalSpent", limit: 50, page: 1 }),
      ]);
      const data = [...vip.data, ...loyal.data];
      return { data, meta: { page: 1, limit: data.length || 1, total: data.length, totalPages: 1 } };
    },
    placeholderData: keepPreviousData,
  });

  const total = useQuery({ queryKey: ["customers", "count"], queryFn: () => customerApi.list({ limit: 1 }) });
  const loyalCount = useQuery({
    queryKey: ["customers", "count", "loyal"],
    queryFn: async () => {
      const [a, b] = await Promise.all([customerApi.list({ tier: "loyal", limit: 1 }), customerApi.list({ tier: "vip", limit: 1 })]);
      return a.meta.total + b.meta.total;
    },
  });
  const targets = useQuery({ queryKey: ["promo-targets"], queryFn: () => promoMessageApi.targets({ inactiveDays: 14, limit: 200 }) });
  const stats = useQuery({ queryKey: ["promo-messages", "stats"], queryFn: promoMessageApi.stats });

  const handleExportPDF = () => {
    const rows = list.data?.data ?? [];
    const doc = new jsPDF("landscape");
    doc.setFontSize(18);
    doc.setTextColor(31, 41, 55);
    doc.text("Daftar Pelanggan - JadwalAn", 14, 22);
    doc.setFontSize(11);
    doc.setTextColor(107, 114, 128);
    doc.text(`Diekspor ${new Date().toLocaleString("id-ID")}`, 14, 30);
    autoTable(doc, {
      startY: 36,
      head: [["Nama", "WhatsApp", "Tier", "Sesi", "Jam main", "Total belanja", "Terakhir main"]],
      body: rows.map((c) => [c.name, formatWa(c.whatsapp), c.tier, c.totalSessions, c.totalHours, rupiah(c.totalSpent), c.lastPlayed ? relativeTime(c.lastPlayed) : "-"]),
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 10 },
    });
    doc.save("pelanggan-jadwalan.pdf");
  };

  const pick = (c: Customer) =>
    setSelected({ id: c.id, name: c.name, whatsapp: c.whatsapp, tier: c.tier, totalSessions: c.totalSessions, totalHours: c.totalHours, lastPlayed: c.lastPlayed });

  return (
    <div className="flex flex-col font-sans text-gray-900 max-w-[1400px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-[28px] font-bold text-gray-900">Bikin pelanggan balik lagi</h1>
          <p className="text-gray-500 mt-1 text-sm">Promo personal yang relevan, dibuat AI dari kebiasaan main pelanggan.</p>
        </div>
        <button
          type="button"
          onClick={handleExportPDF}
          className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 active:scale-95 px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 shadow-sm transition-all"
        >
          <Download className="w-4 h-4" /> Ekspor pelanggan
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <StatCard icon={<Users className="w-6 h-6" />} tone="bg-blue-50 text-blue-600" value={total.data?.meta.total ?? "–"} label="Pelanggan terdaftar" />
        <StatCard icon={<Heart className="w-6 h-6" />} tone="bg-purple-50 text-purple-600" value={loyalCount.data ?? "–"} label="Member loyal & VIP" />
        <StatCard icon={<UserCheck className="w-6 h-6" />} tone="bg-emerald-50 text-emerald-600" value={targets.data?.length ?? "–"} label="Perlu disapa kembali" />
        <StatCard
          icon={<Send className="w-6 h-6" />}
          tone="bg-indigo-50 text-indigo-600"
          value={stats.data ? `${Math.round(stats.data.conversionRate * 100)}%` : "–"}
          label={`Konversi promo · ${stats.data?.sent ?? 0} terkirim`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        {/* Tabel pelanggan */}
        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-3xl shadow-sm p-6 flex flex-col overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start gap-3 mb-5">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{tab === "comeback" ? "Perlu disapa kembali" : tab === "loyal" ? "Pelanggan Loyal" : "Semua pelanggan"}</h2>
              <p className="text-sm text-gray-500 mt-0.5">Pilih pelanggan untuk membuat promo personal dengan AI.</p>
            </div>
            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              {(
                [
                  ["all", "Semua"],
                  ["loyal", "Loyal"],
                  ["comeback", "Absen ≥14 hari"],
                ] as const
              ).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setTab(k)} className={cn("px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap", tab === k ? "bg-white shadow-sm text-slate-800" : "text-slate-500")}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input className={`${inputCls} pl-9 rounded-xl`} placeholder="Cari nama atau nomor WhatsApp" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Cari pelanggan" />
            </div>
            {tab !== "loyal" && (
              <select className={`${inputCls} sm:w-48 rounded-xl`} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Urutkan">
                <option value="lastPlayed">Terakhir main</option>
                <option value="totalSpent">Total belanja</option>
                <option value="totalSessions">Total sesi</option>
                <option value="newest">Terbaru daftar</option>
                <option value="name">Nama A–Z</option>
              </select>
            )}
          </div>

          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-left min-w-[720px]">
              <thead>
                <tr className="text-xs text-gray-400 border-b border-gray-100">
                  <th className="py-3 px-6 font-semibold">Pelanggan</th>
                  <th className="py-3 px-6 font-semibold">Tier</th>
                  <th className="py-3 px-6 font-semibold">Main</th>
                  <th className="py-3 px-6 font-semibold">Belanja</th>
                  <th className="py-3 px-6 font-semibold">Terakhir main</th>
                  <th className="py-3 px-6" />
                </tr>
              </thead>
              <tbody className="text-sm">
                {list.isLoading && <SkeletonRows rows={6} cols={6} />}
                {list.data?.data.map((c) => {
                  const d = daysSince(c.lastPlayed);
                  return (
                    <tr key={c.id} className={cn("border-b border-gray-50 hover:bg-slate-50/50", selected?.id === c.id && "bg-indigo-50/40")}>
                      <td className="py-3 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar name={c.name} />
                          <div>
                            <p className="font-semibold text-gray-900">{c.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatWa(c.whatsapp)}
                              {c.optOutPromo && <span className="ml-1 text-red-500">· tolak promo</span>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-6">
                        <TierBadge tier={c.tier} />
                      </td>
                      <td className="py-3 px-6 text-gray-600">
                        {c.totalSessions} sesi · {c.totalHours} jam
                      </td>
                      <td className="py-3 px-6 font-semibold text-gray-800">{rupiah(c.totalSpent)}</td>
                      <td className={cn("py-3 px-6", d != null && d >= 14 ? "text-indigo-600 font-semibold" : "text-gray-500")}>
                        {c.lastPlayed ? relativeTime(c.lastPlayed) : "Belum pernah"}
                      </td>
                      <td className="py-3 px-6 text-right">
                        <button
                          type="button"
                          onClick={() => pick(c)}
                          disabled={c.optOutPromo}
                          className="text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg inline-flex items-center gap-1.5 disabled:opacity-40"
                        >
                          <Sparkles className="w-3.5 h-3.5" /> Buat promo
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {list.data && !list.data.data.length && <EmptyState title="Tidak ada pelanggan" description="Coba ubah pencarian atau filter." />}
          </div>
          {tab !== "loyal" && (
            <div className="-mx-6 -mb-6 mt-2">
              <Pagination meta={list.data?.meta} onPage={setPage} />
            </div>
          )}
        </div>

        {/* AI Promo Generator */}
        <PromoGenerator customer={selected} onClose={() => setSelected(null)} />
      </div>
    </div>
  );
}

function StatCard({ icon, tone, value, label }: { icon: ReactNode; tone: string; value: ReactNode; label: string }) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-4">
      <div className={cn("p-3.5 rounded-xl", tone)}>{icon}</div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
      </div>
    </div>
  );
}

function PromoGenerator({ customer, onClose }: { customer: Selected | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [tone, setTone] = useState("friendly");
  const [promoId, setPromoId] = useState("");
  const [instruction, setInstruction] = useState("");
  const [draft, setDraft] = useState<PromoMessage | null>(null);
  const [content, setContent] = useState("");

  const { data: promos } = useQuery({ queryKey: ["promos", "valid"], queryFn: () => promoApi.list({ isActive: true, valid: true }) });
  const insight = useQuery({
    queryKey: ["ai", "insight", "customer", customer?.id],
    queryFn: () => aiApi.customerInsight(customer!.id),
    enabled: false,
    retry: 0,
  });

  // Ambil draft terakhir pelanggan ini (jika ada).
  const latest = useQuery({
    queryKey: ["promo-messages", "draft", customer?.id],
    queryFn: () => promoMessageApi.list({ customerId: customer!.id, status: "draft", limit: 1 }),
    enabled: !!customer,
  });
  useEffect(() => {
    const d = latest.data?.data[0] ?? null;
    setDraft(d);
    setContent(d?.content ?? "");
  }, [latest.data, customer?.id]);

  const onDraft = (d: PromoMessage) => {
    setDraft(d);
    setContent(d.content);
    qc.invalidateQueries({ queryKey: ["promo-messages"] });
  };

  const generate = useMutation({
    mutationFn: () => promoMessageApi.generate({ customerId: customer!.id, promoId: promoId || null, tone, instruction: instruction || undefined }),
    onSuccess: onDraft,
    onError: (e) => toast.error(errorMessage(e, "AI gagal membuat pesan")),
  });
  const regenerate = useMutation({
    mutationFn: () => promoMessageApi.regenerate(draft!.id, { tone, instruction: instruction || undefined }),
    onSuccess: onDraft,
    onError: (e) => toast.error(errorMessage(e)),
  });
  const send = useMutation({
    mutationFn: async () => {
      if (draft && content !== draft.content) await promoMessageApi.update(draft.id, { content });
      return promoMessageApi.send(draft!.id);
    },
    onSuccess: (res) => {
      if (res.waLink) window.open(res.waLink, "_blank", "noopener");
      toast.success("Ditandai terkirim — WhatsApp dibuka di tab baru");
      setDraft(null);
      setContent("");
      qc.invalidateQueries({ queryKey: ["promo-messages"] });
      qc.invalidateQueries({ queryKey: ["promo-targets"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!customer) {
    return (
      <div className="bg-white border-2 border-indigo-50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 text-center flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Sparkles className="w-7 h-7" />
        </div>
        <h3 className="font-bold text-gray-900">AI Promo Generator</h3>
        <p className="text-sm text-gray-500 max-w-xs">Pilih pelanggan di tabel, lalu AI akan menulis pesan WhatsApp personal berdasarkan kebiasaan mainnya.</p>
      </div>
    );
  }

  const absent = daysSince(customer.lastPlayed);
  const busy = generate.isPending || regenerate.isPending;

  return (
    <div className="bg-white border-2 border-indigo-50 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col relative xl:sticky xl:top-24">
      <div className="bg-indigo-50/50 p-5 px-6 border-b border-indigo-100 flex justify-between items-center rounded-t-3xl">
        <div className="flex items-center gap-2 text-indigo-600 font-bold">
          <Sparkles className="w-5 h-5" /> AI Promo Generator
        </div>
        <button type="button" onClick={onClose} aria-label="Tutup" className="text-gray-400 hover:text-gray-600">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={customer.name} className="w-10 h-10 text-sm" />
            <div className="min-w-0">
              <h3 className="font-bold text-gray-900 text-sm truncate">{customer.name}</h3>
              <p className="text-xs text-gray-500">
                {customer.totalSessions} sesi · {customer.totalHours} jam · {formatWa(customer.whatsapp)}
              </p>
            </div>
          </div>
          <TierBadge tier={customer.tier} />
        </div>

        <div className="flex flex-wrap gap-2">
          {absent != null && (
            <span className={cn("px-3 py-1 rounded-full border text-xs font-semibold", absent >= 14 ? "bg-indigo-50 border-indigo-100 text-indigo-600" : "bg-gray-50 border-gray-200 text-gray-600")}>
              Absen {absent} hari
            </span>
          )}
          {draft?.tags.map((t) => (
            <span key={t} className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-600 text-xs font-semibold">
              {t}
            </span>
          ))}
        </div>

        {/* Analisis AI */}
        <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4">
          {insight.data ? (
            <div className="space-y-1.5">
              <p className="text-xs font-bold text-violet-700 flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5" /> {insight.data.title}
                {insight.data.data?.churnRisk && <span className="ml-auto font-semibold text-violet-600">risiko churn: {insight.data.data.churnRisk}</span>}
              </p>
              <p className="text-xs text-violet-900/80 leading-relaxed">{insight.data.content}</p>
              {!!insight.data.data?.recommendations?.length && (
                <ul className="list-disc list-inside text-xs text-violet-900/80">
                  {insight.data.data.recommendations.slice(0, 3).map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <button type="button" onClick={() => insight.refetch()} disabled={insight.isFetching} className="w-full text-xs font-semibold text-violet-700 flex items-center justify-center gap-2">
              {insight.isFetching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
              {insight.isFetching ? "Menganalisis riwayat…" : insight.error ? errorMessage(insight.error) : "Analisis kebiasaan pelanggan dengan AI"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
            Promo
            <select className={inputCls} value={promoId} onChange={(e) => setPromoId(e.target.value)}>
              <option value="">Tanpa kode promo</option>
              {promos?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold text-gray-600">
            Gaya bahasa
            <select className={inputCls} value={tone} onChange={(e) => setTone(e.target.value)}>
              {TONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <input className={`${inputCls} col-span-2`} placeholder="Instruksi tambahan (opsional), mis. sebut turnamen Sabtu" value={instruction} onChange={(e) => setInstruction(e.target.value)} />
        </div>

        {draft ? (
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4">
            <div className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase mb-2 flex justify-between">
              <span>Draf pesan WhatsApp</span>
              <span className="text-indigo-400">versi {draft.version}</span>
            </div>
            <textarea className={`${textareaCls} bg-white min-h-[120px]`} value={content} onChange={(e) => setContent(e.target.value)} aria-label="Isi pesan" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => generate.mutate()}
            disabled={busy}
            className="w-full bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm py-3 rounded-xl flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
            {busy ? "AI sedang menulis…" : "Buat pesan dengan AI"}
          </button>
        )}

        {draft && (
          <>
            <div className="flex justify-center">
              <button type="button" onClick={() => regenerate.mutate()} disabled={busy} className="text-indigo-600 text-sm font-semibold flex items-center gap-2 hover:text-indigo-700 disabled:opacity-50">
                <RefreshCcw className={cn("w-4 h-4", busy && "animate-spin")} /> Buat versi lain
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => send.mutate()}
                disabled={send.isPending || !content.trim()}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm disabled:opacity-70"
              >
                {send.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Kirim via WA Web
              </button>
              <button
                type="button"
                onClick={() => navigator.clipboard.writeText(content).then(() => toast.success("Teks disalin"))}
                className="w-full bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold text-sm py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-sm"
              >
                <Copy className="w-4 h-4" /> Salin teks
              </button>
            </div>
            <p className="text-center text-[11px] font-medium text-gray-400">Tinjau draf sebelum membuka WhatsApp Web.</p>
          </>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Check, Copy, Info, Gamepad2, Crown, Clock, TicketPercent } from "lucide-react";
import { toast } from "sonner";
import { publicApi } from "@/services/api";
import { Empty, Spinner } from "@/components/ui-bits";
import { fmtDateLong, rupiah } from "@/lib/format";
import type { Promo } from "@/types";

export const Route = createFileRoute("/promo")({
  component: PromoPage,
});

const DAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function terms(p: Promo) {
  const t: string[] = [`Minimal ${p.minHours} jam`];
  if (p.minTransaction > 0) t.push(`min. transaksi ${rupiah(p.minTransaction)}`);
  if (p.validDays.length) t.push(`hari ${p.validDays.map((d) => DAYS[d]).join("/")}`);
  if (p.validFrom && p.validTo) t.push(`jam ${p.validFrom}–${p.validTo}`);
  if (p.maxDiscount) t.push(`diskon maks ${rupiah(p.maxDiscount)}`);
  return t.join(" · ");
}

function badge(p: Promo) {
  if (p.targetTier) return { icon: <Crown className="w-3 h-3" />, label: `Khusus ${p.targetTier}` };
  if (p.validFrom) return { icon: <Clock className="w-3 h-3" />, label: "Jam tertentu" };
  if (p.consoleType !== "ALL") return { icon: <Gamepad2 className="w-3 h-3" />, label: p.consoleType };
  return { icon: <TicketPercent className="w-3 h-3" />, label: "Semua unit" };
}

function PromoPage() {
  const [copied, setCopied] = useState<string | null>(null);
  const { data: promos, isLoading } = useQuery({ queryKey: ["promos"], queryFn: publicApi.promos });
  const settings = useQuery({ queryKey: ["settings"], queryFn: publicApi.settings });

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      toast.success(`Kode ${code} disalin`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Gagal menyalin kode");
    }
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-10 space-y-8">
      <div className="space-y-3">
        <p className="text-indigo-600 font-bold text-[10px] tracking-widest uppercase">Promo Pilihan JadwalAn</p>
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">Main seru, lebih hemat.</h1>
        <p className="text-slate-500 text-sm">Sedikit bonus untuk waktu bermainmu. Pilih promo yang paling pas.</p>
      </div>

      <div>
        <div className="flex justify-between items-end mb-4 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">Semua promo</h2>
            <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full">{promos?.length ?? 0} tersedia</span>
          </div>
          <span className="text-xs text-slate-400 font-medium">Berlaku di {settings.data?.name ?? "JadwalAn"}</span>
        </div>

        {isLoading ? (
          <Spinner />
        ) : !promos?.length ? (
          <Empty title="Belum ada promo aktif" description="Pantau terus, promo baru sering muncul di akhir pekan!" icon={<TicketPercent className="w-5 h-5" />} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {promos.map((p) => {
              const b = badge(p);
              return (
                <div key={p.id} className="bg-white border border-slate-200 rounded-3xl p-6 hover:border-indigo-300 hover:shadow-lg hover:shadow-indigo-50/50 transition-all flex flex-col justify-between group">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h3 className="text-4xl font-black text-indigo-600 tracking-tight leading-none">
                          {p.discountType === "percent" ? `${p.discountPercentage}%` : rupiah(p.discountAmount)}
                        </h3>
                        <p className="text-[10px] font-bold text-indigo-600 tracking-wider mt-1">{p.discountType === "percent" ? "DISKON" : "POTONGAN HARGA"}</p>
                      </div>
                      <span className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100/50 capitalize">
                        {b.icon} {b.label}
                      </span>
                    </div>
                    <h4 className="font-bold text-slate-900 text-lg mb-1.5">{p.title ?? p.code}</h4>
                    {p.description && <p className="text-xs text-slate-500 leading-relaxed mb-6">{p.description}</p>}
                    <div className="space-y-1.5 mb-6">
                      <p className="text-[11px] text-slate-500 flex items-center gap-2 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Berlaku s.d. {fmtDateLong(p.validUntil)}
                      </p>
                      <p className="text-[11px] text-slate-500 pl-5 font-medium">{terms(p)}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-slate-50 rounded-xl p-1.5 pl-4 flex items-center justify-between border border-slate-100 group-hover:border-indigo-100 transition-colors">
                      <span className="font-bold font-mono text-sm text-slate-700 tracking-wide">{p.code}</span>
                      <button
                        type="button"
                        onClick={() => copy(p.code)}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 text-indigo-600 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-indigo-50 hover:border-indigo-100 transition-colors shadow-sm"
                      >
                        {copied === p.code ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" /> <span className="text-emerald-700">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5" /> Salin kode
                          </>
                        )}
                      </button>
                    </div>
                    <Link to="/booking" search={{ promo: p.code }} className="block text-center text-xs font-bold text-indigo-600 hover:text-indigo-700 py-2">
                      Pakai sekarang →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 md:p-8 mt-4">
        <h3 className="font-bold text-slate-900 text-base mb-6">Pakai promo, semudah ini.</h3>
        <div className="flex flex-col md:flex-row gap-6 md:gap-12 mb-8">
          {[
            ["Salin kode promo", "Pilih penawaran favoritmu."],
            ["Pilih jadwal main", "Tentukan sesi yang sesuai syarat promo."],
            ["Tempel saat booking", "Diskon langsung mengurangi total."],
          ].map(([t, d], i) => (
            <div key={t} className="flex items-start gap-3 flex-1">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">{i + 1}</div>
              <div>
                <h4 className="font-bold text-slate-900 text-xs mb-1">{t}</h4>
                <p className="text-[11px] text-slate-500">{d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-start gap-2 pt-5 border-t border-slate-200/60">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <p className="text-[11px] text-slate-500">Satu kode untuk satu transaksi. Promo tidak dapat digabung dan mengikuti periode serta syarat masing-masing penawaran.</p>
        </div>
      </div>
    </div>
  );
}

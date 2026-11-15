import { useEffect, useRef, useState, type DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  Clock,
  Copy,
  ImagePlus,
  Lightbulb,
  MessageCircle,
  Music2,
  RefreshCw,
  ScanText,
  Sparkles,
  Target,
  Trash2,
  Users,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Btn, EmptyState, Field, Spinner, textareaCls } from "@/components/common";
import { copywriterApi } from "@/services/api";
import { API_BASE_URL, errorMessage } from "@/lib/api-client";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CaptionPlatform, CaptionTone, CaptionVariant, PosterCaption } from "@/types";

export const Route = createFileRoute("/_authenticated/dashboard/copywriter")({
  component: CopywriterPage,
});

const PLATFORMS: { value: CaptionPlatform; label: string; icon: React.ElementType; hint: string }[] = [
  { value: "instagram", label: "Instagram", icon: Camera, hint: "Feed: hook kuat + hashtag" },
  { value: "tiktok", label: "TikTok", icon: Music2, hint: "Singkat & gaul" },
  { value: "facebook", label: "Facebook", icon: Users, hint: "Lebih informatif" },
  { value: "whatsapp", label: "Status WA", icon: MessageCircle, hint: "Padat, tanpa hashtag" },
];
const TONES: { value: CaptionTone; label: string }[] = [
  { value: "friendly", label: "Friendly" },
  { value: "hype", label: "Hype 🔥" },
  { value: "elegan", label: "Elegan" },
  { value: "lucu", label: "Lucu 😆" },
];
const MAX_MB = 5;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const ASSET_BASE = API_BASE_URL.replace(/\/api\/?$/, "");
const imgSrc = (url: string) => (url.startsWith("http") ? url : `${ASSET_BASE}${url}`);
const platformLabel = (p: CaptionPlatform) => PLATFORMS.find((x) => x.value === p)?.label ?? p;

const fullCaption = (c: CaptionVariant) => [c.caption.trim(), c.cta?.trim(), c.hashtags.length ? c.hashtags.join(" ") : ""].filter(Boolean).join("\n\n");

async function copy(text: string, label = "Disalin ke clipboard") {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(label);
  } catch {
    toast.error("Gagal menyalin, salin manual ya");
  }
}

function CopywriterPage() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [platform, setPlatform] = useState<CaptionPlatform>("instagram");
  const [tone, setTone] = useState<CaptionTone>("friendly");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState<PosterCaption | null>(null);

  const history = useQuery({ queryKey: ["copywriter", "history"], queryFn: copywriterApi.history });

  // URL pratinjau lokal dibersihkan saat file berganti.
  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f?: File | null) => {
    if (!f) return;
    if (!ACCEPT.includes(f.type)) return toast.error("Format harus JPG, PNG, atau WebP");
    if (f.size > MAX_MB * 1024 * 1024) return toast.error(`Ukuran maksimal ${MAX_MB} MB`);
    setFile(f);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const done = (r: PosterCaption) => {
    setResult(r);
    qc.invalidateQueries({ queryKey: ["copywriter", "history"] });
    toast.success("Caption siap! ✨");
  };

  const generate = useMutation({
    mutationFn: () => copywriterApi.generate({ image: file!, platform, tone, notes }),
    onSuccess: done,
    onError: (e) => toast.error(errorMessage(e, "AI gagal membuat caption")),
  });
  const regenerate = useMutation({
    mutationFn: (id: string) => copywriterApi.regenerate(id, { platform, tone, notes: notes.trim() || null }),
    onSuccess: done,
    onError: (e) => toast.error(errorMessage(e, "AI gagal membuat ulang caption")),
  });
  const remove = useMutation({
    mutationFn: (id: string) => copywriterApi.remove(id),
    onSuccess: (_d, id) => {
      if (result?.id === id) setResult(null);
      qc.invalidateQueries({ queryKey: ["copywriter", "history"] });
      toast.success("Riwayat dihapus");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const busy = generate.isPending || regenerate.isPending;
  // Jika poster yang tampil berasal dari riwayat (bukan file baru), tombol utama = buat ulang dari poster itu.
  const canRegenerate = !!result && !file;

  const openHistory = (h: PosterCaption) => {
    setResult(h);
    setFile(null);
    setPlatform(h.platform);
    setTone(h.tone);
    setNotes(h.notes ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const shownImage = preview ?? (result ? imgSrc(result.imageUrl) : null);

  return (
    <div className="flex flex-col gap-8 max-w-[1400px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            Copywriter AI <span className="text-[10px] font-bold uppercase tracking-wider bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">Vision</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">Unggah poster atau flyer. AI membaca isinya, lalu menuliskan caption siap posting lengkap dengan hashtag.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-6 items-start">
        {/* ------------------------------------------------ FORM */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5 xl:sticky xl:top-6">
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInput.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "relative rounded-xl border-2 border-dashed transition-colors cursor-pointer overflow-hidden",
              dragging ? "border-violet-500 bg-violet-50" : "border-gray-200 hover:border-violet-300 bg-slate-50/50",
              shownImage ? "p-2" : "p-8",
            )}
          >
            {shownImage ? (
              <>
                <img src={shownImage} alt="Poster yang dianalisis" className="w-full max-h-[420px] object-contain rounded-lg bg-white" />
                {file && (
                  <button
                    type="button"
                    aria-label="Hapus gambar"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="absolute top-3 right-3 bg-white/90 hover:bg-white rounded-full p-1.5 shadow text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <p className="text-[11px] text-center text-slate-400 mt-2">{file ? file.name : "Poster dari riwayat"} · klik untuk ganti</p>
              </>
            ) : (
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-600 flex items-center justify-center">
                  <ImagePlus className="w-7 h-7" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Tarik & lepas poster di sini</p>
                  <p className="text-xs text-slate-400 mt-1">atau klik untuk memilih · JPG, PNG, WebP · maks {MAX_MB} MB</p>
                </div>
              </div>
            )}
            <input
              ref={fileInput}
              type="file"
              accept={ACCEPT.join(",")}
              className="hidden"
              onChange={(e) => {
                pick(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-600">Platform</span>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlatform(p.value)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                    platform === p.value ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100" : "border-gray-200 hover:bg-slate-50",
                  )}
                >
                  <p.icon className={cn("w-4 h-4 shrink-0", platform === p.value ? "text-violet-600" : "text-slate-400")} />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-800">{p.label}</span>
                    <span className="block text-[10px] text-slate-400 truncate">{p.hint}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-600">Gaya bahasa</span>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTone(t.value)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                    tone === t.value ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-600 border-gray-200 hover:bg-slate-50",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Catatan untuk AI (opsional)" hint="Mis. tonjolkan PS5 VIP Room, sebut promo berlaku sampai akhir bulan.">
            <textarea className={textareaCls} rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Info tambahan yang tidak ada di poster…" />
          </Field>

          {canRegenerate ? (
            <Btn variant="ai" className="h-11" loading={busy} onClick={() => regenerate.mutate(result!.id)}>
              {!busy && <RefreshCw className="w-4 h-4" />} {busy ? "AI sedang menulis ulang…" : "Buat caption baru dari poster ini"}
            </Btn>
          ) : (
            <Btn variant="ai" className="h-11" loading={busy} disabled={!file} onClick={() => generate.mutate()}>
              {!busy && <Wand2 className="w-4 h-4" />} {busy ? "AI sedang membaca poster…" : "Analisis & buat caption"}
            </Btn>
          )}
          {busy && <p className="text-[11px] text-center text-slate-400 -mt-2">Biasanya 5–15 detik</p>}
        </div>

        {/* ------------------------------------------------ HASIL */}
        <div className="flex flex-col gap-6 min-w-0">
          {busy && !result ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16">
              <Spinner label="AI sedang menganalisis poster dan menulis caption…" />
            </div>
          ) : !result ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10">
              <EmptyState
                title="Belum ada caption"
                description="Unggah poster promo, event, atau pengumuman. AI akan membaca teks & visualnya lalu membuat caption langsung ke promo."
                icon={<Sparkles className="w-5 h-5" />}
              />
            </div>
          ) : (
            <ResultView result={result} busy={busy} onRegenerate={() => regenerate.mutate(result.id)} />
          )}
        </div>
      </div>

      {/* ------------------------------------------------ RIWAYAT */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-slate-800">Riwayat caption</h2>
          <span className="text-xs text-slate-400">{history.data?.length ?? 0} poster</span>
        </div>
        {history.isLoading ? (
          <Spinner />
        ) : !history.data?.length ? (
          <p className="text-sm text-slate-400 py-6 text-center">Riwayat caption akan muncul di sini.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {history.data.map((h) => (
              <div
                key={h.id}
                className={cn(
                  "group relative rounded-xl border overflow-hidden text-left transition-shadow hover:shadow-md",
                  result?.id === h.id ? "border-violet-500 ring-2 ring-violet-100" : "border-gray-100",
                )}
              >
                <button type="button" onClick={() => openHistory(h)} className="block w-full text-left">
                  <img src={imgSrc(h.imageUrl)} alt={h.analysis.headline} className="w-full aspect-[4/5] object-cover bg-slate-100" loading="lazy" />
                  <div className="p-3">
                    <p className="text-xs font-semibold text-slate-800 line-clamp-2">{h.analysis.headline}</p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      {platformLabel(h.platform)} · {relativeTime(h.createdAt)}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Hapus riwayat"
                  onClick={() => confirm("Hapus riwayat caption ini?") && remove.mutate(h.id)}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-white/90 text-red-500 shadow opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultView({ result, busy, onRegenerate }: { result: PosterCaption; busy: boolean; onRegenerate: () => void }) {
  const a = result.analysis;
  // Hanya 1 caption: "Langsung ke promo" (riwayat lama berisi 3 variasi → ambil yang promo).
  const mainCaption = result.captions.find((c) => /promo/i.test(c.angle)) ?? result.captions[0];
  return (
    <>
      {/* Analisis */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{a.poster_type}</span>
              <span className="text-[10px] text-slate-400">
                {platformLabel(result.platform)} · {result.tone}
              </span>
            </div>
            <h2 className="text-lg font-bold text-slate-900">{a.headline}</h2>
            <p className="text-sm text-slate-500 mt-1">{a.summary}</p>
          </div>
          <Btn variant="outline" size="sm" loading={busy} onClick={onRegenerate}>
            {!busy && <RefreshCw className="w-3.5 h-3.5" />} Versi lain
          </Btn>
        </div>

        {a.key_points?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {a.key_points.map((k) => (
              <span key={k} className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                <Check className="w-3 h-3 text-emerald-600" /> {k}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Info icon={ScanText} label="Teks terbaca" value={a.detected_text} />
          <Info icon={Target} label="Target audiens" value={a.target_audience} />
          <Info icon={Sparkles} label="Gaya visual" value={a.visual_style} />
        </div>

        {a.missing_info?.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-100 p-3.5 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <p className="font-semibold mb-1">Info yang belum ada di poster</p>
              <ul className="list-disc pl-4 space-y-0.5">
                {a.missing_info.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Caption */}
      {mainCaption && <CaptionCard key={result.id} c={mainCaption} />}

      {/* Waktu & tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 mb-1">Waktu posting terbaik</p>
            <p className="text-sm text-slate-600 leading-relaxed">{result.best_time}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800 mb-1">Saran untuk poster</p>
            <ul className="text-sm text-slate-600 leading-relaxed list-disc pl-4 space-y-1">
              {result.poster_tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}

function Info({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <p className="text-xs text-slate-700 leading-relaxed">{value || "-"}</p>
    </div>
  );
}

function CaptionCard({ c }: { c: CaptionVariant }) {
  // Caption bisa diedit sebelum disalin.
  const [text, setText] = useState(c.caption);
  useEffect(() => setText(c.caption), [c.caption]);
  const edited = { ...c, caption: text };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-violet-700 flex items-center gap-2">
          Caption
        </span>
        <Btn size="sm" variant="primary" onClick={() => copy(fullCaption(edited), "Caption lengkap disalin 📋")}>
          <Copy className="w-3.5 h-3.5" /> Salin
        </Btn>
      </div>
      <textarea
        className={cn(textareaCls, "text-[13px] leading-relaxed min-h-[180px] flex-1")}
        value={text}
        onChange={(e) => setText(e.target.value)}
        aria-label="Caption"
      />
      {c.cta && (
        <p className="text-xs text-slate-600">
          <span className="font-semibold text-slate-800">CTA:</span> {c.cta}
        </p>
      )}
      {c.hashtags.length > 0 && (
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-indigo-600 leading-relaxed break-words min-w-0">{c.hashtags.join(" ")}</p>
          <button type="button" onClick={() => copy(c.hashtags.join(" "), "Hashtag disalin")} className="text-[10px] font-semibold text-slate-400 hover:text-slate-600 shrink-0">
            Salin #
          </button>
        </div>
      )}
    </div>
  );
}

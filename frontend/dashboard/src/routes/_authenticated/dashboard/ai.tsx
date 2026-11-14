import { useEffect, useRef, useState, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, BookOpen, FlaskConical, Activity, Plus, Pencil, Trash2, Send, Zap, CheckCircle2, AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Btn, Card, EmptyState, Field, PageHeader, Pagination, Spinner, Toggle, inputCls, textareaCls } from "@/components/common";
import { aiApi } from "@/services/api";
import { errorMessage } from "@/lib/api-client";
import { fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AiAgent, AiKnowledge, PlaygroundResult } from "@/types";

type AiSearch = { tab?: "agent" | "knowledge" | "playground" | "logs" };

export const Route = createFileRoute("/_authenticated/dashboard/ai")({
  validateSearch: (s: Record<string, unknown>): AiSearch => ({
    tab: ["agent", "knowledge", "playground", "logs"].includes(String(s.tab)) ? (s.tab as AiSearch["tab"]) : undefined,
  }),
  component: AiPage,
});

const TABS = [
  { key: "agent", label: "Agent", icon: Bot },
  { key: "knowledge", label: "Basis pengetahuan", icon: BookOpen },
  { key: "playground", label: "Playground", icon: FlaskConical },
  { key: "logs", label: "Log & statistik", icon: Activity },
] as const;

function AiPage() {
  const { tab = "agent" } = Route.useSearch();
  const navigate = Route.useNavigate();
  const status = useQuery({ queryKey: ["ai", "status"], queryFn: () => aiApi.status(false) });
  const [pinging, setPinging] = useState(false);
  const [ping, setPing] = useState<{ ok: boolean; latencyMs: number; error?: string; model?: string } | null>(null);

  const testConnection = async () => {
    setPinging(true);
    try {
      const res = await aiApi.status(true);
      setPing(res.ping);
      if (res.ping?.ok) toast.success(`Gemini terhubung (${res.ping.latencyMs} ms)`);
      else toast.error(res.ping?.error ?? "Gemini tidak merespons");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setPinging(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto">
      <PageHeader
        title="Pengaturan AI"
        subtitle="Gemini multi-agent: Router → Booking / Info / Support agent."
        actions={
          <>
            {status.data &&
              (status.data.configured ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> GEMINI_API_KEY terpasang
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-semibold">
                  <AlertTriangle className="w-3.5 h-3.5" /> GEMINI_API_KEY belum diisi
                </span>
              ))}
            <Btn variant="outline" onClick={testConnection} loading={pinging}>
              <Zap className="w-4 h-4" /> Tes koneksi
            </Btn>
          </>
        }
      />

      {(status.data || ping) && (
        <div className="flex flex-wrap gap-2 text-xs">
          {status.data &&
            Object.entries(status.data.models).map(([k, v]) => (
              <span key={k} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-600">
                {k}: <b className="font-mono">{v}</b>
              </span>
            ))}
          {ping && (
            <span className={cn("px-2.5 py-1 rounded-md font-semibold", ping.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600")}>
              {ping.ok ? `OK · ${ping.model} · ${ping.latencyMs} ms` : `Gagal: ${ping.error}`}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => navigate({ search: { tab: t.key } })}
            className={cn("flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap", tab === t.key ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700")}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "agent" && <AgentTab />}
      {tab === "knowledge" && <KnowledgeTab />}
      {tab === "playground" && <PlaygroundTab />}
      {tab === "logs" && <LogsTab />}
    </div>
  );
}

// ===================================================================== Agent

const FEATURE_LABEL: Record<string, string> = {
  chat: "Chat pelanggan",
  crm_promo: "Copywriter promo",
  copywriter: "Copywriter umum",
  insight: "Insight bisnis",
};

function AgentTab() {
  const { data: agents, isLoading } = useQuery({ queryKey: ["ai", "agents"], queryFn: aiApi.agents });
  const [feature, setFeature] = useState("chat");
  const agent = agents?.find((a) => a.feature === feature);
  if (isLoading) return <Spinner />;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <Card className="p-2 h-fit">
        {agents?.map((a) => (
          <button
            key={a.feature}
            type="button"
            onClick={() => setFeature(a.feature)}
            className={cn("w-full text-left px-4 py-3 rounded-xl flex items-center justify-between", feature === a.feature ? "bg-indigo-50 text-indigo-700" : "hover:bg-slate-50 text-slate-700")}
          >
            <span>
              <span className="block text-sm font-semibold">{FEATURE_LABEL[a.feature] ?? a.feature}</span>
              <span className="block text-xs text-slate-500">{a.name}</span>
            </span>
            <span className={cn("w-2 h-2 rounded-full", a.isActive ? "bg-emerald-500" : "bg-slate-300")} />
          </button>
        ))}
      </Card>
      <div className="lg:col-span-3">{agent && <AgentForm key={agent.feature} agent={agent} />}</div>
    </div>
  );
}

function AgentForm({ agent }: { agent: AiAgent }) {
  const qc = useQueryClient();
  const [f, setF] = useState(agent);
  const [keyword, setKeyword] = useState("");
  useEffect(() => setF(agent), [agent]);
  const set = <K extends keyof AiAgent>(k: K, v: AiAgent[K]) => setF((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      aiApi.updateAgent(agent.feature, {
        name: f.name,
        model: f.model,
        systemPrompt: f.systemPrompt,
        temperature: f.temperature,
        maxTokens: f.maxTokens,
        isActive: f.isActive,
        ...(agent.feature === "chat"
          ? {
              autoReply: f.autoReply,
              canCreateBooking: f.canCreateBooking,
              bookingStatus: f.bookingStatus,
              greetingMessage: f.greetingMessage || null,
              fallbackMessage: f.fallbackMessage || null,
              handoffKeywords: f.handoffKeywords,
              activeFrom: f.activeFrom || null,
              activeTo: f.activeTo || null,
            }
          : {}),
      }),
    onSuccess: () => {
      toast.success("Konfigurasi AI disimpan");
      qc.invalidateQueries({ queryKey: ["ai", "agents"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const isChat = agent.feature === "chat";

  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{FEATURE_LABEL[agent.feature] ?? agent.feature}</h2>
          <p className="text-sm text-slate-500">Perubahan berlaku dalam ±1 menit (cache backend).</p>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Toggle checked={f.isActive} onChange={(v) => set("isActive", v)} color="violet" label="Aktif" /> Aktif
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Nama asisten">
          <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} />
        </Field>
        <Field label="Model Gemini" hint="Jika model tidak tersedia, backend otomatis pakai model cadangan.">
          <input className={`${inputCls} font-mono`} value={f.model} onChange={(e) => set("model", e.target.value)} list="gemini-models" />
          <datalist id="gemini-models">
            <option value="gemini-3.5-flash-lite" />
            <option value="gemini-2.5-flash" />
            <option value="gemini-2.5-flash-lite" />
            <option value="gemini-2.5-pro" />
          </datalist>
        </Field>
        <Field label="Persona / system prompt" className="sm:col-span-2">
          <textarea className={textareaCls} rows={6} value={f.systemPrompt} onChange={(e) => set("systemPrompt", e.target.value)} />
        </Field>
        <Field label={`Temperature: ${f.temperature.toFixed(1)}`} hint="Rendah = konsisten, tinggi = kreatif">
          <input type="range" min={0} max={1.5} step={0.1} value={f.temperature} onChange={(e) => set("temperature", Number(e.target.value))} className="accent-violet-600" />
        </Field>
        <Field label="Max tokens">
          <input type="number" min={64} max={8192} className={inputCls} value={f.maxTokens} onChange={(e) => set("maxTokens", Number(e.target.value))} />
        </Field>
      </div>

      {isChat && (
        <>
          <div className="rounded-xl bg-slate-50 p-4 space-y-4">
            <Row title="Balas otomatis" desc="AI menjawab sesi yang belum diambil admin.">
              <Toggle checked={f.autoReply} onChange={(v) => set("autoReply", v)} color="violet" label="Balas otomatis" />
            </Row>
            <Row title="Boleh membuat booking" desc="AI membuat booking setelah pelanggan mengonfirmasi.">
              <Toggle checked={f.canCreateBooking} onChange={(v) => set("canCreateBooking", v)} color="violet" label="Boleh membuat booking" />
            </Row>
            <Row title="Status booking dari AI" desc="pending = pelanggan wajib bayar QRIS dulu.">
              <div className="flex bg-white border border-gray-200 p-1 rounded-lg">
                {(["pending", "confirmed"] as const).map((s) => (
                  <button key={s} type="button" onClick={() => set("bookingStatus", s)} className={cn("px-3 py-1 text-xs font-semibold rounded-md", f.bookingStatus === s ? "bg-violet-600 text-white" : "text-slate-500")}>
                    {s}
                  </button>
                ))}
              </div>
            </Row>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Jam aktif dari" hint="Kosongkan keduanya = 24 jam">
              <input type="time" className={inputCls} value={f.activeFrom ?? ""} onChange={(e) => set("activeFrom", e.target.value || null)} />
            </Field>
            <Field label="Jam aktif sampai">
              <input type="time" className={inputCls} value={f.activeTo ?? ""} onChange={(e) => set("activeTo", e.target.value || null)} />
            </Field>
            <Field label="Kata kunci langsung ke admin" className="sm:col-span-2">
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-2">
                {f.handoffKeywords.map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-100 text-xs font-semibold text-slate-700">
                    {k}
                    <button type="button" aria-label={`Hapus ${k}`} onClick={() => set("handoffKeywords", f.handoffKeywords.filter((x) => x !== k))} className="text-slate-400 hover:text-red-500">
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && keyword.trim()) {
                      e.preventDefault();
                      if (!f.handoffKeywords.includes(keyword.trim().toLowerCase())) set("handoffKeywords", [...f.handoffKeywords, keyword.trim().toLowerCase()]);
                      setKeyword("");
                    }
                  }}
                  placeholder="ketik lalu Enter"
                  className="flex-1 min-w-[120px] text-sm outline-none"
                  aria-label="Tambah kata kunci"
                />
              </div>
            </Field>
            <Field label="Sapaan pembuka" className="sm:col-span-2">
              <textarea className={textareaCls} rows={2} value={f.greetingMessage ?? ""} onChange={(e) => set("greetingMessage", e.target.value)} />
            </Field>
            <Field label="Pesan cadangan (jika AI gagal)" className="sm:col-span-2">
              <textarea className={textareaCls} rows={2} value={f.fallbackMessage ?? ""} onChange={(e) => set("fallbackMessage", e.target.value)} />
            </Field>
          </div>
        </>
      )}

      <div className="flex justify-end gap-2">
        <Btn variant="ghost" onClick={() => setF(agent)}>
          <RotateCcw className="w-4 h-4" /> Reset
        </Btn>
        <Btn variant="ai" onClick={() => save.mutate()} loading={save.isPending}>
          Simpan perubahan
        </Btn>
      </div>
    </Card>
  );
}

function Row({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-slate-800">{title}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      {children}
    </div>
  );
}

// ===================================================================== Knowledge

const CATEGORIES = ["faq", "aturan", "harga", "lokasi", "game", "lainnya"];

function KnowledgeTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["ai", "knowledge"], queryFn: aiApi.knowledge });
  const [editing, setEditing] = useState<AiKnowledge | "new" | null>(null);
  const [cat, setCat] = useState("");

  const remove = useMutation({
    mutationFn: aiApi.deleteKnowledge,
    onSuccess: () => {
      toast.success("Dihapus");
      qc.invalidateQueries({ queryKey: ["ai", "knowledge"] });
    },
  });
  const toggle = useMutation({
    mutationFn: (k: AiKnowledge) => aiApi.updateKnowledge(k.id, { isActive: !k.isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ai", "knowledge"] }),
  });

  const list = (data ?? []).filter((k) => !cat || k.category === cat);

  return (
    <Card>
      <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Basis pengetahuan</h2>
          <p className="text-sm text-slate-500">AI membaca entri yang relevan dengan pertanyaan. Prioritas ≥ 10 selalu dibaca.</p>
        </div>
        <div className="flex gap-2">
          <select className={`${inputCls} w-40`} value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Kategori">
            <option value="">Semua kategori</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <Btn onClick={() => setEditing("new")}>
            <Plus className="w-4 h-4" /> Tambah
          </Btn>
        </div>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !list.length ? (
        <EmptyState title="Belum ada pengetahuan" description="Tambahkan aturan, FAQ, lokasi, dsb agar AI menjawab akurat." icon={<BookOpen className="w-5 h-5" />} />
      ) : (
        <ul className="divide-y divide-gray-50">
          {list.map((k) => (
            <li key={k.id} className={cn("p-5 flex gap-4 items-start", !k.isActive && "opacity-60")}>
              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[11px] font-bold uppercase shrink-0 mt-0.5">{k.category}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{k.question ?? "(tanpa judul)"}</p>
                <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap">{k.content}</p>
              </div>
              <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0", k.priority >= 10 ? "bg-violet-50 text-violet-700" : "bg-slate-50 text-slate-500")}>P{k.priority}</span>
              <Toggle checked={k.isActive} onChange={() => toggle.mutate(k)} label="Aktif" />
              <button type="button" onClick={() => setEditing(k)} aria-label="Edit" className="p-2 rounded-lg text-slate-500 hover:bg-slate-100">
                <Pencil className="w-4 h-4" />
              </button>
              <button type="button" onClick={() => confirm("Hapus entri ini?") && remove.mutate(k.id)} aria-label="Hapus" className="p-2 rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <KnowledgeForm item={editing} onClose={() => setEditing(null)} />
    </Card>
  );
}

function KnowledgeForm({ item, onClose }: { item: AiKnowledge | "new" | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ category: "faq", question: "", content: "", priority: 0, isActive: true });
  useEffect(() => {
    if (item && item !== "new") setF({ category: item.category, question: item.question ?? "", content: item.content, priority: item.priority, isActive: item.isActive });
    else if (item === "new") setF({ category: "faq", question: "", content: "", priority: 0, isActive: true });
  }, [item]);
  const save = useMutation({
    mutationFn: () => {
      const payload = { ...f, question: f.question || null };
      return item === "new" ? aiApi.createKnowledge(payload) : aiApi.updateKnowledge((item as AiKnowledge).id, payload);
    },
    onSuccess: () => {
      toast.success("Tersimpan");
      qc.invalidateQueries({ queryKey: ["ai", "knowledge"] });
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item === "new" ? "Tambah pengetahuan" : "Edit pengetahuan"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Kategori">
            <select className={inputCls} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Prioritas (0–100)">
            <input type="number" min={0} max={100} className={inputCls} value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })} />
          </Field>
          <Field label="Pertanyaan / judul" className="col-span-2">
            <input className={inputCls} value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} placeholder="Mis. Boleh bawa makanan?" />
          </Field>
          <Field label="Isi jawaban" className="col-span-2">
            <textarea className={textareaCls} rows={5} value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Btn variant="ghost" onClick={onClose}>
            Batal
          </Btn>
          <Btn onClick={() => save.mutate()} loading={save.isPending} disabled={f.content.trim().length < 3}>
            Simpan
          </Btn>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ===================================================================== Playground

type PlayMsg = { role: "user" | "model"; text: string; meta?: PlaygroundResult };

function PlaygroundTab() {
  const [msgs, setMsgs] = useState<PlayMsg[]>([]);
  const [text, setText] = useState("");
  const [lastIntent, setLastIntent] = useState<string | undefined>();
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [msgs.length]);

  const run = useMutation({
    mutationFn: (message: string) => aiApi.playground(message, msgs.map(({ role, text }) => ({ role, text })), lastIntent),
    onSuccess: (res) => {
      setMsgs((m) => [...m, { role: "model", text: res.reply, meta: res }]);
      setLastIntent(res.intent);
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const submit = (preset?: string) => {
    const msg = (preset ?? text).trim();
    if (!msg || run.isPending) return;
    setMsgs((m) => [...m, { role: "user", text: msg }]);
    setText("");
    run.mutate(msg);
  };

  return (
    <Card className="flex flex-col h-[620px]">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Playground chatbot</h2>
          <p className="text-sm text-slate-500">Mode uji — booking & pembatalan tidak benar-benar dibuat.</p>
        </div>
        <Btn variant="ghost" size="sm" onClick={() => (setMsgs([]), setLastIntent(undefined))}>
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </Btn>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
        {!msgs.length && (
          <div className="flex flex-wrap gap-2 justify-center pt-10">
            {["Halo, ada promo apa hari ini?", "Besok jam 4 sore PS5 kosong? Mau 2 jam", "Harga PS4 berapa per jam?", "Kemarin stiknya rusak, saya kecewa"].map((p) => (
              <button key={p} type="button" onClick={() => submit(p)} className="text-xs font-semibold text-violet-700 border border-violet-100 bg-white px-3 py-2 rounded-full hover:bg-violet-50">
                {p}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="bg-indigo-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] whitespace-pre-wrap">{m.text}</div>
            </div>
          ) : (
            <div key={i} className="flex flex-col gap-1 max-w-[80%]">
              <div className="bg-violet-50 border border-violet-100 text-violet-950 text-sm rounded-2xl rounded-tl-sm px-4 py-2.5 whitespace-pre-wrap">{m.text}</div>
              {m.meta && (
                <div className="flex flex-wrap gap-1.5 text-[10px] font-semibold">
                  <span className="px-2 py-0.5 rounded bg-violet-100 text-violet-700">agent: {m.meta.agent}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">router: {m.meta.routedBy}</span>
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">intent: {m.meta.intent}</span>
                  {m.meta.toolCalls.map((t, j) => (
                    <span key={j} className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700">
                      {t.name} {t.ms}ms
                    </span>
                  ))}
                  <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                    {(m.meta.latencyMs / 1000).toFixed(1)} dtk · {m.meta.usage.promptTokens + m.meta.usage.completionTokens} token
                  </span>
                  {m.meta.handoff && <span className="px-2 py-0.5 rounded bg-orange-50 text-orange-700">handoff ke admin</span>}
                  {m.meta.error && <span className="px-2 py-0.5 rounded bg-red-50 text-red-600">{m.meta.error}</span>}
                </div>
              )}
            </div>
          ),
        )}
        {run.isPending && (
          <div className="flex items-center gap-2 text-xs text-violet-600">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI sedang berpikir…
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-gray-100 flex gap-2">
        <input
          className={inputCls}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Tulis pesan uji seperti pelanggan…"
          aria-label="Pesan uji"
        />
        <Btn variant="ai" onClick={() => submit()} disabled={!text.trim()} loading={run.isPending}>
          <Send className="w-4 h-4" /> Kirim
        </Btn>
      </div>
    </Card>
  );
}

// ===================================================================== Logs

function LogsTab() {
  const [page, setPage] = useState(1);
  const [feature, setFeature] = useState("");
  const [status, setStatus] = useState("");
  const stats = useQuery({ queryKey: ["ai", "stats"], queryFn: () => aiApi.stats(7) });
  const logs = useQuery({
    queryKey: ["ai", "logs", feature, status, page],
    queryFn: () => aiApi.logs({ feature, status, page, limit: 15 }),
    placeholderData: keepPreviousData,
  });
  const s = stats.data;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Panggilan AI (7 hari)" value={s?.totalCalls ?? "–"} sub={`${((s?.promptTokens ?? 0) + (s?.completionTokens ?? 0)).toLocaleString("id-ID")} token`} />
        <StatBox label="Rata-rata latensi" value={s ? `${(s.avgLatencyMs / 1000).toFixed(1)} dtk` : "–"} />
        <StatBox label="Booking dibuat AI" value={s?.aiBookings ?? "–"} accent />
        <StatBox label="Handoff ke admin" value={s?.handoffs ?? "–"} sub={`${s?.byStatus?.error ?? 0} error`} />
      </div>

      <Card>
        <div className="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Log pemanggilan</h2>
          <div className="flex gap-2">
            <select className={`${inputCls} w-40`} value={feature} onChange={(e) => (setFeature(e.target.value), setPage(1))} aria-label="Fitur">
              <option value="">Semua fitur</option>
              <option value="chat">chat</option>
              <option value="chat_playground">playground</option>
              <option value="summary">summary</option>
              <option value="crm_promo">crm_promo</option>
              <option value="insight">insight</option>
            </select>
            <select className={`${inputCls} w-36`} value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))} aria-label="Status">
              <option value="">Semua status</option>
              <option value="success">success</option>
              <option value="handoff">handoff</option>
              <option value="error">error</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm min-w-[900px]">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-gray-100">
                <th className="py-3 px-5 font-semibold">Waktu</th>
                <th className="py-3 px-5 font-semibold">Fitur</th>
                <th className="py-3 px-5 font-semibold">Pesan / output</th>
                <th className="py-3 px-5 font-semibold">Tools</th>
                <th className="py-3 px-5 font-semibold">Model</th>
                <th className="py-3 px-5 font-semibold">Latensi</th>
                <th className="py-3 px-5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.data?.data.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 align-top">
                  <td className="py-3 px-5 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                  <td className="py-3 px-5">
                    <span className="text-xs font-semibold text-slate-700">{l.feature}</span>
                    {l.input?.agent && <span className="block text-[11px] text-violet-600">{l.input.agent}</span>}
                  </td>
                  <td className="py-3 px-5 max-w-sm">
                    {l.input?.message && <p className="text-xs text-slate-700 truncate">› {l.input.message}</p>}
                    {l.output?.reply && <p className="text-xs text-slate-500 truncate">‹ {l.output.reply}</p>}
                    {l.errorMessage && <p className="text-xs text-red-600 truncate">{l.errorMessage}</p>}
                  </td>
                  <td className="py-3 px-5 text-[11px] text-indigo-600">{l.toolCalls?.map((t) => t.name).join(", ") || "—"}</td>
                  <td className="py-3 px-5 text-[11px] font-mono text-slate-500">{l.model}</td>
                  <td className="py-3 px-5 text-xs text-slate-600 whitespace-nowrap">{(l.latencyMs / 1000).toFixed(1)} dtk</td>
                  <td className="py-3 px-5">
                    <span
                      className={cn(
                        "text-[11px] font-bold px-2 py-0.5 rounded-md",
                        l.status === "success" ? "bg-emerald-50 text-emerald-700" : l.status === "handoff" ? "bg-orange-50 text-orange-700" : "bg-red-50 text-red-600",
                      )}
                    >
                      {l.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.isLoading && <Spinner />}
          {logs.data && !logs.data.data.length && <EmptyState title="Belum ada log" />}
        </div>
        <Pagination meta={logs.data?.meta} onPage={setPage} />
      </Card>
    </div>
  );
}

function StatBox({ label, value, sub, accent }: { label: string; value: ReactNode; sub?: string; accent?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={cn("text-2xl font-bold mt-2", accent ? "text-violet-600" : "text-slate-800")}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </Card>
  );
}

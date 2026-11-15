import {
  GoogleGenerativeAI,
  type Content,
  type FunctionCall,
  type FunctionDeclaration,
  type GenerateContentResult,
  type GenerationConfig,
  type Part,
} from '@google/generative-ai';
import { HttpError } from '../../lib/http';

// ---------------------------------------------------------------------
// Konfigurasi model
// ---------------------------------------------------------------------

/**
 * Pool model cadangan (urut prioritas). Tiap model punya kuota gratis sendiri,
 * jadi kalau satu penuh/overload/timeout, request otomatis pindah ke model berikutnya.
 * Atur lewat GEMINI_MODELS="a,b,c" di .env.
 */
export const MODEL_POOL = (
  process.env.GEMINI_MODELS ||
  'gemini-3.5-flash-lite,gemini-3.1-flash-lite,gemini-flash-lite-latest,gemini-3-flash-preview,gemini-3.5-flash'
)
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);

/** Model utama (agent spesialis). Bisa ditimpa per-fitur lewat tabel AiAgent. */
export const DEFAULT_MODEL = process.env.GEMINI_MODEL || MODEL_POOL[0];
/** Model ringan & cepat untuk router, ringkasan, klasifikasi. */
export const FAST_MODEL = process.env.GEMINI_FAST_MODEL || DEFAULT_MODEL;
/** Cadangan pertama (info saja — fallback sebenarnya memakai seluruh MODEL_POOL). */
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || MODEL_POOL.find((m) => m !== DEFAULT_MODEL) || DEFAULT_MODEL;

/** Batas waktu per percobaan model (bukan total). Dibatasi maks 30 dtk supaya tidak menggantung. */
const ATTEMPT_TIMEOUT_MS = Math.min(Number(process.env.GEMINI_TIMEOUT_MS || 15_000), 30_000);
/** Maksimal model yang dicoba per request. */
const MAX_ATTEMPTS = Number(process.env.GEMINI_MAX_ATTEMPTS || 4);

let client: GoogleGenerativeAI | null = null;
export const isAiConfigured = () => !!process.env.GEMINI_API_KEY;

const getClient = () => {
  if (!process.env.GEMINI_API_KEY) throw new HttpError(503, 'AI belum dikonfigurasi (GEMINI_API_KEY kosong)');
  client ??= new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  return client;
};

export type Usage = { promptTokens: number; completionTokens: number };
const addUsage = (u: Usage, r: GenerateContentResult) => {
  u.promptTokens += r.response.usageMetadata?.promptTokenCount ?? 0;
  u.completionTokens += r.response.usageMetadata?.candidatesTokenCount ?? 0;
};

// ---------------------------------------------------------------------
// Cooldown: model yang barusan gagal diistirahatkan sementara
// ---------------------------------------------------------------------

const cooldownUntil = new Map<string, number>();

const errStatus = (e: any) => {
  const direct = Number(e?.status ?? e?.statusCode ?? 0);
  if (direct) return direct;
  const m = String(e?.message ?? '').match(/\[(\d{3})[^\]]*\]/);
  return m ? Number(m[1]) : 0;
};

/** Berapa lama model diistirahatkan (ms) setelah error ini; 0 = error bukan karena model (jangan pindah). */
const cooldownFor = (e: any) => {
  const status = errStatus(e);
  const msg = String(e?.message ?? '').toLowerCase();
  if (status === 404 || msg.includes('not found') || msg.includes('no longer available')) return 30 * 60_000;
  if (status === 429 || msg.includes('quota') || msg.includes('rate limit')) return 60_000;
  if (status === 503 || msg.includes('overloaded') || msg.includes('high demand') || msg.includes('unavailable')) return 30_000;
  if (msg.includes('abort') || msg.includes('timeout') || msg.includes('timed out')) return 30_000;
  if (status === 500 || status === 502 || status === 504) return 20_000;
  if (status === 400 && (msg.includes('not supported') || msg.includes('role'))) return 30 * 60_000;
  if (msg.includes('fetch failed') || msg.includes('econnreset')) return 5_000;
  return 0;
};

/** Urutan model yang dicoba: model pilihan dulu, lalu pool — model yang sedang cooldown ditaruh paling belakang. */
const candidates = (preferred: string) => {
  const now = Date.now();
  const all = [preferred, ...MODEL_POOL.filter((m) => m !== preferred)];
  const ready = all.filter((m) => (cooldownUntil.get(m) ?? 0) <= now);
  const cooling = all
    .filter((m) => (cooldownUntil.get(m) ?? 0) > now)
    .sort((a, b) => (cooldownUntil.get(a) ?? 0) - (cooldownUntil.get(b) ?? 0));
  return [...ready, ...cooling].slice(0, Math.max(1, MAX_ATTEMPTS));
};

/** Status pool (untuk dashboard / debugging). */
export const modelPoolStatus = () => {
  const now = Date.now();
  return MODEL_POOL.map((m) => ({ model: m, coolingSec: Math.max(0, Math.ceil(((cooldownUntil.get(m) ?? 0) - now) / 1000)) }));
};

/**
 * Jalankan fn dengan model pilihan; kalau gagal karena model (penuh, overload, timeout, tidak ada),
 * model itu di-cooldown dan otomatis dicoba model berikutnya di pool.
 */
export const withFallback = async <T>(model: string, fn: (model: string) => Promise<T>): Promise<{ result: T; model: string }> => {
  const list = candidates(model);
  let lastErr: unknown;
  for (let i = 0; i < list.length; i++) {
    const m = list[i];
    try {
      const result = await fn(m);
      cooldownUntil.delete(m);
      return { result, model: m };
    } catch (e) {
      lastErr = e;
      const cd = cooldownFor(e);
      if (!cd) throw e; // error bukan karena model (mis. prompt tidak valid) → tidak perlu pindah
      cooldownUntil.set(m, Date.now() + cd);
      const next = list[i + 1];
      const reason = String((e as any)?.message ?? e).replace(/\s+/g, ' ').slice(0, 140);
      console.warn(`[AI] ${m} gagal (${reason})${next ? ` → coba ${next}` : ''}`);
    }
  }
  throw lastErr;
};

const safeText = (r: GenerateContentResult) => {
  try {
    return r.response.text().trim();
  } catch {
    return '';
  }
};

// ---------------------------------------------------------------------
// Generate JSON terstruktur (router, ringkasan, copywriting, insight)
// ---------------------------------------------------------------------

export type JsonOptions = {
  model?: string;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  /** Gambar yang ikut dianalisis (multimodal), mis. poster/flyer. */
  images?: { data: Buffer; mimeType: string }[];
  /** Batas waktu per percobaan (default GEMINI_TIMEOUT_MS). Analisis gambar butuh lebih lama. */
  timeoutMs?: number;
};

export const generateJson = async <T>(opts: JsonOptions) => {
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const generationConfig: GenerationConfig = {
    temperature: opts.temperature ?? 0.2,
    maxOutputTokens: opts.maxTokens ?? 1024,
    responseMimeType: 'application/json',
    responseSchema: opts.schema as any,
  };

  const { result, model } = await withFallback(opts.model ?? FAST_MODEL, async (m) => {
    const gm = getClient().getGenerativeModel(
      { model: m, systemInstruction: opts.system, generationConfig },
      { timeout: opts.timeoutMs ?? ATTEMPT_TIMEOUT_MS },
    );
    const r = await gm.generateContent(
      opts.images?.length
        ? [{ text: opts.prompt }, ...opts.images.map((i) => ({ inlineData: { data: i.data.toString('base64'), mimeType: i.mimeType } }))]
        : opts.prompt,
    );
    addUsage(usage, r);
    return r;
  });

  const text = safeText(result);
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    // Kadang model membungkus JSON dengan ```json … ```
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('Respons AI bukan JSON yang valid');
    data = JSON.parse(match[0]) as T;
  }
  return { data, model, usage };
};

// ---------------------------------------------------------------------
// Chat dengan function calling (agent spesialis)
// ---------------------------------------------------------------------

export type ToolCallLog = { name: string; args: unknown; result: unknown; ms: number };

export type ToolChatOptions = {
  model: string;
  system: string;
  history: Content[];
  message: string;
  tools: FunctionDeclaration[];
  execute: (call: FunctionCall) => Promise<unknown>;
  temperature?: number;
  maxTokens?: number;
  maxRounds?: number;
};

/** Signature khusus Gemini 3 untuk melewati validasi saat riwayat tool berasal dari model lain. */
const SKIP_SIGNATURE = 'skip_thought_signature_validator';

export const chatWithTools = async (opts: ToolChatOptions) => {
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const toolCalls: ToolCallLog[] = [];
  const maxRounds = opts.maxRounds ?? 5;

  // Riwayat dikelola manual (bukan ChatSession) karena SDK mengirim hasil tool dengan role "function",
  // yang ditolak model Gemini baru — hasil tool harus memakai role "user".
  const contents: Content[] = [...opts.history, { role: 'user', parts: [{ text: opts.message }] }];
  /** Model yang menghasilkan tiap giliran "model" hasil tool (index → nama model). */
  const producedBy = new Map<number, string>();
  let preferred = opts.model;

  /** Satu langkah generate. Fallback terjadi per langkah, jadi tool yang sudah dijalankan TIDAK diulang. */
  const step = async () => {
    const { result, model } = await withFallback(preferred, async (m) => {
      const gm = getClient().getGenerativeModel(
        {
          model: m,
          systemInstruction: opts.system,
          tools: opts.tools.length ? [{ functionDeclarations: opts.tools }] : undefined,
          generationConfig: { temperature: opts.temperature ?? 0.6, maxOutputTokens: opts.maxTokens ?? 1024 },
        },
        { timeout: ATTEMPT_TIMEOUT_MS },
      );
      // Thought signature hanya valid untuk model yang membuatnya → ganti dengan signature "skip" bila pindah model.
      const payload = contents.map((c, i) => {
        const owner = producedBy.get(i);
        if (!owner || owner === m) return c;
        return {
          role: c.role,
          parts: c.parts
            .filter((p) => !(p as any).thought)
            .map((p) => (p.functionCall ? ({ ...p, thoughtSignature: SKIP_SIGNATURE } as Part) : p)),
        };
      });
      return gm.generateContent({ contents: payload });
    });
    preferred = model; // langkah berikutnya langsung pakai model yang terbukti jalan
    addUsage(usage, result);
    return { res: result, model };
  };

  let { res, model } = await step();

  for (let round = 0; round < maxRounds; round++) {
    const calls = res.response.functionCalls();
    if (!calls?.length) break;

    // Semua tool dalam satu putaran dijalankan paralel → lebih cepat.
    const parts: Part[] = await Promise.all(
      calls.map(async (call) => {
        const t0 = Date.now();
        let output: unknown;
        try {
          output = await opts.execute(call);
        } catch (e: any) {
          output = { ok: false, error: e?.message ?? 'Tool gagal dijalankan' };
        }
        toolCalls.push({ name: call.name, args: call.args, result: output, ms: Date.now() - t0 });
        return { functionResponse: { name: call.name, response: { result: output } as object } };
      }),
    );

    // Giliran model disimpan utuh (termasuk thought signature Gemini 3) agar konteks tool tidak hilang.
    const modelParts = res.response.candidates?.[0]?.content?.parts;
    producedBy.set(contents.length, model);
    contents.push({ role: 'model', parts: modelParts?.length ? modelParts : calls.map((c) => ({ functionCall: c })) });
    contents.push({ role: 'user', parts });
    ({ res, model } = await step());
  }

  return { text: safeText(res), model, usage, toolCalls };
};

/**
 * Ubah riwayat pesan menjadi format Gemini (dimulai dari user, role bergantian, diakhiri model).
 * Pesan user di ujung riwayat yang belum dibalas dikembalikan sebagai `carry`
 * supaya bisa digabung ke pesan baru (tidak hilang).
 */
export const toGeminiHistory = (messages: { role: 'user' | 'model'; text: string }[]) => {
  const history: Content[] = [];
  for (const m of messages) {
    if (!m.text?.trim()) continue;
    const last = history[history.length - 1];
    if (last && last.role === m.role) last.parts.push({ text: m.text });
    else history.push({ role: m.role, parts: [{ text: m.text }] });
  }
  while (history.length && history[0].role !== 'user') history.shift();

  const carry: string[] = [];
  const tail = history[history.length - 1];
  if (tail && tail.role === 'user') {
    history.pop();
    for (const p of tail.parts) if (p.text) carry.push(p.text);
  }
  return { history, carry };
};

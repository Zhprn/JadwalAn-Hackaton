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

/** Model utama (agent spesialis). Bisa ditimpa per-fitur lewat tabel AiAgent. */
export const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
/** Model ringan & cepat untuk router, ringkasan, klasifikasi. */
export const FAST_MODEL = process.env.GEMINI_FAST_MODEL || DEFAULT_MODEL;
/** Dipakai otomatis jika model utama tidak tersedia / overload. */
export const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';

const REQUEST_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS || 25_000);

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

/** Error yang layak dicoba ulang dengan model cadangan (model tidak ada, overload, rate limit). */
const isRetryable = (e: any) => {
  const status = Number(e?.status ?? e?.statusCode ?? 0);
  const msg = String(e?.message ?? '').toLowerCase();
  return (
    [404, 429, 500, 503].includes(status) ||
    msg.includes('not found') ||
    msg.includes('not supported') ||
    msg.includes('overloaded') ||
    msg.includes('unavailable') ||
    msg.includes('quota') ||
    msg.includes('timed out') ||
    msg.includes('timeout')
  );
};

/** Jalankan fn dengan model pilihan; jika gagal karena model/overload, ulangi sekali dengan FALLBACK_MODEL. */
export const withFallback = async <T>(model: string, fn: (model: string) => Promise<T>): Promise<{ result: T; model: string }> => {
  try {
    return { result: await fn(model), model };
  } catch (e) {
    if (model !== FALLBACK_MODEL && isRetryable(e)) {
      console.warn(`[AI] Model ${model} gagal (${(e as any)?.message}); mencoba ${FALLBACK_MODEL}`);
      return { result: await fn(FALLBACK_MODEL), model: FALLBACK_MODEL };
    }
    throw e;
  }
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
      { timeout: REQUEST_TIMEOUT_MS },
    );
    const r = await gm.generateContent(opts.prompt);
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

export const chatWithTools = async (opts: ToolChatOptions) => {
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const toolCalls: ToolCallLog[] = [];
  const maxRounds = opts.maxRounds ?? 5;

  const { result: text, model } = await withFallback(opts.model, async (m) => {
    toolCalls.length = 0;
    const gm = getClient().getGenerativeModel(
      {
        model: m,
        systemInstruction: opts.system,
        tools: opts.tools.length ? [{ functionDeclarations: opts.tools }] : undefined,
        generationConfig: { temperature: opts.temperature ?? 0.6, maxOutputTokens: opts.maxTokens ?? 1024 },
      },
      { timeout: REQUEST_TIMEOUT_MS },
    );

    const chat = gm.startChat({ history: opts.history });
    let res = await chat.sendMessage(opts.message);
    addUsage(usage, res);

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

      res = await chat.sendMessage(parts);
      addUsage(usage, res);
    }
    return safeText(res);
  });

  return { text, model, usage, toolCalls };
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

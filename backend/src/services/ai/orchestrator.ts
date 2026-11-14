import prisma from '../../lib/prisma';
import { AGENTS, COMMON_RULES, ROUTER_SCHEMA, ROUTER_SYSTEM, routeByRules, SUMMARY_SCHEMA, SUMMARY_SYSTEM, type Intent, type RouteDecision } from './agents';
import { buildCustomerContext, buildStoreContext, buildTimeContext, getAgentConfig, searchKnowledge } from './context';
import { chatWithTools, FAST_MODEL, generateJson, isAiConfigured, toGeminiHistory, type ToolCallLog, type Usage } from './gemini';
import { writeAiLog } from './log';
import { executeTool, TOOL_DECLARATIONS, type ToolContext } from './tools';

export type HistoryItem = { role: 'user' | 'model'; text: string };

export type ChatTurnInput = {
  message: string;
  history: HistoryItem[];
  customerId?: string | null;
  sessionId?: string | null;
  channel?: string;
  previousIntent?: string | null;
  /** Playground admin: tool yang mengubah data tidak benar-benar dijalankan. */
  dryRun?: boolean;
};

export type ChatTurnResult = {
  reply: string;
  agent: string;
  intent: Intent;
  priority: 'normal' | 'high';
  routedBy: 'rule' | 'model' | 'keyword' | 'none';
  handoff: boolean;
  handoffReason?: string;
  bookingIds: string[];
  toolCalls: ToolCallLog[];
  model: string;
  latencyMs: number;
  usage: Usage;
  status: 'success' | 'error' | 'handoff';
  error?: string;
};

const HANDOFF_REPLY = 'Baik kak, percakapan ini aku teruskan ke admin ya. Mohon tunggu sebentar, admin akan segera membalas 🙏';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Router: aturan dulu (instan), kalau ragu pakai model cepat. */
const decideRoute = async (input: ChatTurnInput, usage: Usage): Promise<RouteDecision> => {
  const byRule = routeByRules(input.message, input.previousIntent);
  if (byRule) return byRule;
  try {
    const recent = input.history
      .slice(-4)
      .map((h) => `${h.role === 'user' ? 'Pelanggan' : 'AI'}: ${h.text.slice(0, 300)}`)
      .join('\n');
    const { data, usage: u } = await generateJson<{ agent: RouteDecision['agent']; intent: Intent; priority: 'normal' | 'high' }>({
      model: FAST_MODEL,
      system: ROUTER_SYSTEM,
      prompt: `${recent ? `Percakapan sebelumnya:\n${recent}\n\n` : ''}Pesan terakhir pelanggan: ${input.message}`,
      schema: ROUTER_SCHEMA,
      temperature: 0,
      maxTokens: 100,
    });
    usage.promptTokens += u.promptTokens;
    usage.completionTokens += u.completionTokens;
    if (!AGENTS[data.agent]) throw new Error('agent tidak dikenal');
    return { ...data, via: 'model' };
  } catch {
    return { agent: 'info', intent: 'lainnya', priority: 'normal', via: 'model' };
  }
};

/** Proses satu pesan pelanggan melalui pipeline multi-agent. */
export const runChatTurn = async (input: ChatTurnInput): Promise<ChatTurnResult> => {
  const t0 = Date.now();
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const config = await getAgentConfig('chat');

  const base = {
    bookingIds: [] as string[],
    toolCalls: [] as ToolCallLog[],
    usage,
    model: config.model,
  };

  // 1) Kata kunci handoff → langsung ke admin tanpa memanggil AI.
  const keyword = config.handoffKeywords.find((k) => k.trim() && new RegExp(`(^|\\W)${escapeRe(k.trim())}(\\W|$)`, 'i').test(input.message));
  if (keyword) {
    const result: ChatTurnResult = {
      ...base,
      reply: HANDOFF_REPLY,
      agent: 'support',
      intent: 'komplain',
      priority: 'high',
      routedBy: 'keyword',
      handoff: true,
      handoffReason: `Kata kunci "${keyword}"`,
      latencyMs: Date.now() - t0,
      status: 'handoff',
    };
    await logTurn(input, result);
    return result;
  }

  // 2) AI belum dikonfigurasi → balasan fallback + teruskan ke admin.
  if (!isAiConfigured()) {
    const result: ChatTurnResult = {
      ...base,
      reply: config.fallbackMessage || HANDOFF_REPLY,
      agent: 'none',
      intent: 'lainnya',
      priority: 'normal',
      routedBy: 'none',
      handoff: true,
      handoffReason: 'GEMINI_API_KEY belum diisi',
      latencyMs: Date.now() - t0,
      status: 'error',
      error: 'GEMINI_API_KEY belum diisi',
    };
    await logTurn(input, result);
    return result;
  }

  // 3) Router + pemuatan konteks berjalan paralel.
  const [route, store, customer, knowledge] = await Promise.all([
    decideRoute(input, usage),
    buildStoreContext(),
    buildCustomerContext(input.customerId),
    searchKnowledge(input.message),
  ]);
  const agent = AGENTS[route.agent];

  const knowledgeBlock =
    agent.useKnowledge && knowledge.length
      ? `\n\nBASIS PENGETAHUAN (sumber resmi rental):\n${knowledge
          .map((k) => `- [${k.category}] ${k.question ? `${k.question} → ` : ''}${k.content}`.slice(0, 600))
          .join('\n')}`
      : '';

  const system = `${config.systemPrompt}

${COMMON_RULES}

${agent.instructions}

${buildTimeContext()}
${customer}

${store}${knowledgeBlock}`;

  // 4) Agent spesialis dengan function calling.
  const { history, carry } = toGeminiHistory(input.history.slice(-14));
  const message = carry.length ? `${carry.join('\n')}\n${input.message}` : input.message;

  const toolCtx: ToolContext = {
    customerId: input.customerId,
    sessionId: input.sessionId,
    channel: input.channel,
    config,
    dryRun: input.dryRun,
    state: { bookingIds: [] },
  };
  const tools = agent.tools
    .filter((t) => t !== 'create_booking' || config.canCreateBooking)
    .map((t) => TOOL_DECLARATIONS[t]);

  try {
    const out = await chatWithTools({
      model: config.model,
      system,
      history,
      message,
      tools,
      execute: (call) => executeTool(call, toolCtx),
      temperature: agent.kind === 'booking' ? Math.min(config.temperature, agent.temperature) : config.temperature,
      maxTokens: config.maxTokens,
    });
    usage.promptTokens += out.usage.promptTokens;
    usage.completionTokens += out.usage.completionTokens;

    const handoff = !!toolCtx.state.handoffReason;
    const reply = out.text || (handoff ? HANDOFF_REPLY : config.fallbackMessage || HANDOFF_REPLY);

    const result: ChatTurnResult = {
      reply,
      agent: agent.kind,
      intent: route.intent,
      priority: handoff ? 'high' : route.priority,
      routedBy: route.via,
      handoff,
      handoffReason: toolCtx.state.handoffReason,
      bookingIds: toolCtx.state.bookingIds,
      toolCalls: out.toolCalls,
      model: out.model,
      latencyMs: Date.now() - t0,
      usage,
      status: handoff ? 'handoff' : 'success',
    };
    await logTurn(input, result);
    return result;
  } catch (e: any) {
    console.error('[AI] Chat gagal:', e?.message);
    const result: ChatTurnResult = {
      ...base,
      bookingIds: toolCtx.state.bookingIds,
      reply: config.fallbackMessage || HANDOFF_REPLY,
      agent: agent.kind,
      intent: route.intent,
      priority: 'high',
      routedBy: route.via,
      handoff: true,
      handoffReason: 'AI gagal merespons',
      latencyMs: Date.now() - t0,
      status: 'error',
      error: e?.message,
    };
    await logTurn(input, result);
    return result;
  }
};

const logTurn = (input: ChatTurnInput, r: ChatTurnResult) =>
  writeAiLog({
    feature: input.dryRun ? 'chat_playground' : 'chat',
    model: r.model,
    input: { message: input.message, agent: r.agent, intent: r.intent, routedBy: r.routedBy },
    output: { reply: r.reply, handoff: r.handoff, handoffReason: r.handoffReason, bookingIds: r.bookingIds },
    toolCalls: r.toolCalls,
    usage: r.usage,
    latencyMs: r.latencyMs,
    status: r.status,
    errorMessage: r.error,
    sessionId: input.dryRun ? null : input.sessionId,
    customerId: input.customerId,
  });

// ---------------------------------------------------------------------
// Summarizer (dijalankan di latar belakang, tidak menahan balasan)
// ---------------------------------------------------------------------

export const summarizeSession = async (sessionId: string) => {
  if (!isAiConfigured()) return;
  const t0 = Date.now();
  const messages = await prisma.chatMessage.findMany({
    where: { sessionId, sender: { in: ['customer', 'ai', 'admin'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { sender: true, message: true },
  });
  if (!messages.length) return;

  const transcript = messages
    .reverse()
    .map((m) => `${m.sender === 'customer' ? 'Pelanggan' : m.sender === 'ai' ? 'AI' : 'Admin'}: ${m.message.slice(0, 400)}`)
    .join('\n');

  try {
    const { data, model, usage } = await generateJson<{ title: string; summary: string; intent: Intent }>({
      system: SUMMARY_SYSTEM,
      prompt: transcript,
      schema: SUMMARY_SCHEMA,
      temperature: 0.2,
      maxTokens: 300,
    });
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: data.title?.slice(0, 120), summary: data.summary, intent: data.intent },
    });
    await writeAiLog({ feature: 'summary', model, usage, latencyMs: Date.now() - t0, status: 'success', sessionId, output: data });
  } catch (e: any) {
    await writeAiLog({ feature: 'summary', model: FAST_MODEL, latencyMs: Date.now() - t0, status: 'error', errorMessage: e?.message, sessionId });
  }
};

import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { notFound, pageMeta, paginate, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { dayRange, todayJkt, addDays, TIME_REGEX } from '../lib/time';
import { getAgentConfig, invalidateAi, type AiFeature } from '../services/ai/context';
import { DEFAULT_MODEL, FALLBACK_MODEL, FAST_MODEL, generateJson, isAiConfigured } from '../services/ai/gemini';
import { runChatTurn } from '../services/ai/orchestrator';
import { getCustomerAnalysis, getDashboardInsight } from '../services/ai/business';
import { AuthRequest } from '../middlewares/authMiddleware';

const FEATURES = ['chat', 'crm_promo', 'copywriter', 'insight'] as const;

// =====================================================================
// Status & tes koneksi
// =====================================================================

/** GET /ai/status — cek konfigurasi & (opsional) ping ke Gemini. */
export const aiStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  const ping = req.query.ping === 'true';
  let pingResult: unknown = null;
  if (ping && isAiConfigured()) {
    const t0 = Date.now();
    try {
      const { data, model } = await generateJson<{ ok: boolean }>({
        system: 'Balas JSON saja.',
        prompt: 'Kembalikan {"ok": true}',
        schema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
        maxTokens: 20,
      });
      pingResult = { ok: data.ok === true, model, latencyMs: Date.now() - t0 };
    } catch (e: any) {
      pingResult = { ok: false, error: e?.message, latencyMs: Date.now() - t0 };
    }
  }
  res.json({
    success: true,
    data: {
      configured: isAiConfigured(),
      models: { default: DEFAULT_MODEL, fast: FAST_MODEL, fallback: FALLBACK_MODEL },
      ping: pingResult,
    },
  });
};

/** POST /ai/playground — uji chat AI tanpa membuat booking sungguhan. */
export const playground = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({
      message: z.string().trim().min(1).max(2000),
      history: z.array(z.object({ role: z.enum(['user', 'model']), text: z.string() })).max(30).default([]),
      customerId: z.string().uuid().optional(),
      previousIntent: z.string().optional(),
    })
    .parse(req.body);
  const result = await runChatTurn({ ...input, dryRun: true, channel: 'web' });
  res.json({ success: true, data: result });
};

// =====================================================================
// Konfigurasi agent
// =====================================================================

export const listAgents = async (_req: AuthRequest, res: Response): Promise<any> => {
  const agents = await Promise.all(FEATURES.map((f) => getAgentConfig(f)));
  res.json({ success: true, data: agents });
};

export const getAgent = async (req: AuthRequest, res: Response): Promise<any> => {
  const feature = z.enum(FEATURES).parse(param(req, 'feature'));
  res.json({ success: true, data: await getAgentConfig(feature as AiFeature) });
};

const agentSchema = z
  .object({
    name: z.string().min(1),
    model: z.string().min(1),
    systemPrompt: z.string().min(10),
    temperature: z.number().min(0).max(2),
    maxTokens: z.number().int().min(64).max(8192),
    isActive: z.boolean(),
    autoReply: z.boolean(),
    canCreateBooking: z.boolean(),
    bookingStatus: z.enum(['pending', 'confirmed']),
    greetingMessage: z.string().nullable(),
    fallbackMessage: z.string().nullable(),
    handoffKeywords: z.array(z.string().min(1)),
    activeFrom: z.string().regex(TIME_REGEX).nullable(),
    activeTo: z.string().regex(TIME_REGEX).nullable(),
  })
  .partial();

export const upsertAgent = async (req: AuthRequest, res: Response): Promise<any> => {
  const feature = z.enum(FEATURES).parse(param(req, 'feature'));
  const data = agentSchema.parse(req.body);
  const current = await getAgentConfig(feature as AiFeature);
  const row = await prisma.aiAgent.upsert({
    where: { feature },
    create: {
      feature,
      name: data.name ?? current.name,
      model: data.model ?? current.model,
      systemPrompt: data.systemPrompt ?? current.systemPrompt,
      ...data,
    },
    update: data,
  });
  invalidateAi();
  await logActivity('ai_agent.update', 'AiAgent', row.id, data, req.user?.id);
  res.json({ success: true, data: row });
};

// =====================================================================
// Basis pengetahuan
// =====================================================================

const knowledgeSchema = z.object({
  category: z.enum(['faq', 'aturan', 'harga', 'lokasi', 'game', 'lainnya']),
  question: z.string().nullable().optional(),
  content: z.string().min(3),
  isActive: z.boolean().default(true),
  priority: z.number().int().min(0).max(100).default(0),
});

export const listKnowledge = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z.object({ category: z.string().optional(), search: z.string().optional(), isActive: z.enum(['true', 'false']).optional() }).parse(req.query);
  const rows = await prisma.aiKnowledge.findMany({
    where: {
      ...(q.category ? { category: q.category } : {}),
      ...(q.isActive ? { isActive: q.isActive === 'true' } : {}),
      ...(q.search
        ? { OR: [{ question: { contains: q.search, mode: 'insensitive' } }, { content: { contains: q.search, mode: 'insensitive' } }] }
        : {}),
    },
    orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
  });
  res.json({ success: true, data: rows });
};

export const createKnowledge = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = knowledgeSchema.parse(req.body);
  const row = await prisma.aiKnowledge.create({ data: { ...data, createdById: req.user!.id } });
  invalidateAi();
  res.status(201).json({ success: true, data: row });
};

export const updateKnowledge = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = z
    .object({
      category: knowledgeSchema.shape.category.optional(),
      question: z.string().nullable().optional(),
      content: z.string().min(3).optional(),
      isActive: z.boolean().optional(),
      priority: z.number().int().min(0).max(100).optional(),
    })
    .parse(req.body);
  const row = await prisma.aiKnowledge.update({ where: { id: param(req, 'id') }, data });
  invalidateAi();
  res.json({ success: true, data: row });
};

export const deleteKnowledge = async (req: AuthRequest, res: Response): Promise<any> => {
  await prisma.aiKnowledge.delete({ where: { id: param(req, 'id') } });
  invalidateAi();
  res.json({ success: true, message: 'Knowledge dihapus' });
};

// =====================================================================
// Log & statistik AI
// =====================================================================

export const listLogs = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z
    .object({ feature: z.string().optional(), status: z.string().optional(), sessionId: z.string().uuid().optional(), customerId: z.string().uuid().optional() })
    .parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where: Prisma.AiLogWhereInput = {
    ...(q.feature ? { feature: q.feature } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...(q.sessionId ? { sessionId: q.sessionId } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.aiLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { customer: { select: { id: true, name: true } } } }),
    prisma.aiLog.count({ where }),
  ]);
  res.json({ success: true, data: rows, meta: pageMeta(page, limit, total) });
};

export const getLog = async (req: AuthRequest, res: Response): Promise<any> => {
  const row = await prisma.aiLog.findUnique({ where: { id: param(req, 'id') } });
  if (!row) throw notFound('Log tidak ditemukan');
  res.json({ success: true, data: row });
};

/** GET /ai/stats?days=7 */
export const aiStats = async (req: AuthRequest, res: Response): Promise<any> => {
  const { days } = z.object({ days: z.coerce.number().int().min(1).max(90).default(7) }).parse(req.query);
  const since = dayRange(addDays(todayJkt(), -(days - 1))).start;
  const where = { createdAt: { gte: since } };

  const [byStatus, byFeature, agg, aiBookings, handoffs] = await Promise.all([
    prisma.aiLog.groupBy({ by: ['status'], where, _count: { _all: true } }),
    prisma.aiLog.groupBy({ by: ['feature'], where, _count: { _all: true }, _avg: { latencyMs: true } }),
    prisma.aiLog.aggregate({ where, _sum: { promptTokens: true, completionTokens: true }, _avg: { latencyMs: true }, _count: { _all: true } }),
    prisma.booking.count({ where: { source: 'ai', createdAt: { gte: since } } }),
    prisma.chatSessionEvent.count({ where: { type: 'takeover', adminId: null, createdAt: { gte: since } } }),
  ]);

  res.json({
    success: true,
    data: {
      days,
      totalCalls: agg._count._all,
      avgLatencyMs: Math.round(agg._avg.latencyMs ?? 0),
      promptTokens: agg._sum.promptTokens ?? 0,
      completionTokens: agg._sum.completionTokens ?? 0,
      byStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count._all])),
      byFeature: byFeature.map((f) => ({ feature: f.feature, calls: f._count._all, avgLatencyMs: Math.round(f._avg.latencyMs ?? 0) })),
      aiBookings,
      handoffs,
    },
  });
};

// =====================================================================
// Insight
// =====================================================================

export const dashboardInsight = async (req: AuthRequest, res: Response): Promise<any> => {
  const insight = await getDashboardInsight({ refresh: req.query.refresh === 'true' });
  res.json({ success: true, data: insight });
};

export const customerInsight = async (req: AuthRequest, res: Response): Promise<any> => {
  const insight = await getCustomerAnalysis(param(req, 'customerId'), { refresh: req.query.refresh === 'true' });
  res.json({ success: true, data: insight });
};

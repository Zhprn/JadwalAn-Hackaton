import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, notFound, pageMeta, paginate, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { generatePromoCopy, type Tone } from '../services/ai/business';
import { AuthRequest } from '../middlewares/authMiddleware';

const TONES = ['friendly', 'urgent', 'exclusive', 'casual'] as const;

const waLink = (whatsapp: string, text: string) => `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;

/** GET /promo-messages/targets?inactiveDays=14 — pelanggan yang layak dikirimi promo comeback. */
export const getTargets = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z
    .object({
      inactiveDays: z.coerce.number().int().min(1).default(14),
      cooldownDays: z.coerce.number().int().min(0).default(7),
      tier: z.enum(['regular', 'loyal', 'vip']).optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    })
    .parse(req.query);
  const now = Date.now();
  const customers = await prisma.customer.findMany({
    where: {
      optOutPromo: false,
      lastPlayed: { lt: new Date(now - q.inactiveDays * 86_400_000) },
      OR: [{ lastPromoSentAt: null }, { lastPromoSentAt: { lt: new Date(now - q.cooldownDays * 86_400_000) } }],
      ...(q.tier ? { tier: q.tier } : {}),
    },
    orderBy: [{ totalSpent: 'desc' }],
    take: q.limit,
    select: { id: true, name: true, whatsapp: true, tier: true, lastPlayed: true, totalSessions: true, totalSpent: true, favoriteConsole: true, lastPromoSentAt: true },
  });
  res.json({
    success: true,
    data: customers.map((c) => ({ ...c, daysAbsent: c.lastPlayed ? Math.floor((now - c.lastPlayed.getTime()) / 86_400_000) : null })),
  });
};

/** POST /promo-messages/generate — AI menulis draft pesan promo personal. */
export const generate = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({
      customerId: z.string().uuid(),
      promoId: z.string().uuid().nullable().optional(),
      tone: z.enum(TONES).default('friendly'),
      instruction: z.string().max(300).optional(),
    })
    .parse(req.body);
  const copy = await generatePromoCopy({ customerId: input.customerId, promoId: input.promoId, tone: input.tone, extraInstruction: input.instruction });
  const row = await prisma.promoMessage.create({
    data: {
      content: copy.content,
      tags: copy.tags,
      tone: input.tone,
      customerId: input.customerId,
      promoId: input.promoId ?? null,
      generatedById: req.user!.id,
    },
    include: { customer: { select: { id: true, name: true, whatsapp: true } }, promo: { select: { id: true, code: true } } },
  });
  res.status(201).json({ success: true, data: row });
};

/** POST /promo-messages/generate-bulk — buat draft untuk banyak pelanggan sekaligus (paralel terbatas). */
export const generateBulk = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({
      customerIds: z.array(z.string().uuid()).min(1).max(30),
      promoId: z.string().uuid().nullable().optional(),
      tone: z.enum(TONES).default('friendly'),
    })
    .parse(req.body);

  const results: { customerId: string; ok: boolean; id?: string; error?: string }[] = [];
  const queue = [...input.customerIds];
  const worker = async () => {
    while (queue.length) {
      const customerId = queue.shift()!;
      try {
        const copy = await generatePromoCopy({ customerId, promoId: input.promoId, tone: input.tone });
        const row = await prisma.promoMessage.create({
          data: { content: copy.content, tags: copy.tags, tone: input.tone, customerId, promoId: input.promoId ?? null, generatedById: req.user!.id },
        });
        results.push({ customerId, ok: true, id: row.id });
      } catch (e: any) {
        results.push({ customerId, ok: false, error: e?.message });
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, input.customerIds.length) }, worker));
  res.status(201).json({ success: true, data: results });
};

/** POST /promo-messages/:id/regenerate — "Buat versi lain" (versi baru, draft lama tetap disimpan). */
export const regenerate = async (req: AuthRequest, res: Response): Promise<any> => {
  const { tone, instruction } = z.object({ tone: z.enum(TONES).optional(), instruction: z.string().max(300).optional() }).parse(req.body ?? {});
  const prev = await prisma.promoMessage.findUnique({ where: { id: param(req, 'id') } });
  if (!prev) throw notFound('Pesan promo tidak ditemukan');
  const useTone = (tone ?? prev.tone) as Tone;
  const copy = await generatePromoCopy({
    customerId: prev.customerId,
    promoId: prev.promoId,
    tone: useTone,
    extraInstruction: instruction,
    previousContent: prev.content,
  });
  const row = await prisma.promoMessage.create({
    data: {
      content: copy.content,
      tags: copy.tags,
      tone: useTone,
      version: prev.version + 1,
      customerId: prev.customerId,
      promoId: prev.promoId,
      generatedById: req.user!.id,
    },
    include: { customer: { select: { id: true, name: true, whatsapp: true } }, promo: { select: { id: true, code: true } } },
  });
  res.status(201).json({ success: true, data: row });
};

export const list = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z.object({ status: z.string().optional(), customerId: z.string().uuid().optional(), promoId: z.string().uuid().optional() }).parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where: Prisma.PromoMessageWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.customerId ? { customerId: q.customerId } : {}),
    ...(q.promoId ? { promoId: q.promoId } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.promoMessage.findMany({
      where,
      include: { customer: { select: { id: true, name: true, whatsapp: true, tier: true } }, promo: { select: { id: true, code: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.promoMessage.count({ where }),
  ]);
  res.json({ success: true, data: rows, meta: pageMeta(page, limit, total) });
};

export const update = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = z.object({ content: z.string().min(1).max(1500).optional(), tags: z.array(z.string()).optional() }).parse(req.body);
  const row = await prisma.promoMessage.update({ where: { id: param(req, 'id') }, data });
  res.json({ success: true, data: row });
};

/**
 * POST /promo-messages/:id/send — tandai terkirim & kembalikan link wa.me.
 * (Belum ada integrasi WhatsApp API, jadi admin mengirim lewat link ini.)
 */
export const send = async (req: AuthRequest, res: Response): Promise<any> => {
  const msg = await prisma.promoMessage.findUnique({ where: { id: param(req, 'id') }, include: { customer: true } });
  if (!msg) throw notFound('Pesan promo tidak ditemukan');
  if (msg.customer.optOutPromo) throw badRequest('Pelanggan memilih tidak menerima promo');

  const now = new Date();
  const [row] = await prisma.$transaction([
    prisma.promoMessage.update({ where: { id: msg.id }, data: { status: 'sent', sentAt: now, channel: 'whatsapp' } }),
    prisma.customer.update({ where: { id: msg.customerId }, data: { lastPromoSentAt: now } }),
  ]);
  await logActivity('promo_message.send', 'PromoMessage', msg.id, { customerId: msg.customerId }, req.user?.id);
  res.json({ success: true, data: { ...row, waLink: waLink(msg.customer.whatsapp, msg.content) } });
};

export const remove = async (req: AuthRequest, res: Response): Promise<any> => {
  await prisma.promoMessage.delete({ where: { id: param(req, 'id') } });
  res.json({ success: true, message: 'Pesan promo dihapus' });
};

/** GET /promo-messages/stats — konversi promo (booking dalam 7 hari setelah dikirim). */
export const stats = async (_req: AuthRequest, res: Response): Promise<any> => {
  const sent = await prisma.promoMessage.findMany({
    where: { status: 'sent', sentAt: { not: null } },
    select: { id: true, customerId: true, sentAt: true, convertedBookingId: true },
    orderBy: { sentAt: 'desc' },
    take: 500,
  });

  // Hitung konversi yang belum tercatat.
  let converted = 0;
  for (const m of sent) {
    if (m.convertedBookingId) {
      converted++;
      continue;
    }
    const booking = await prisma.booking.findFirst({
      where: {
        customerId: m.customerId,
        createdAt: { gte: m.sentAt!, lte: new Date(m.sentAt!.getTime() + 7 * 86_400_000) },
        status: { notIn: ['cancelled'] },
      },
      select: { id: true },
    });
    if (booking) {
      converted++;
      await prisma.promoMessage.update({ where: { id: m.id }, data: { convertedBookingId: booking.id } });
    }
  }
  const drafts = await prisma.promoMessage.count({ where: { status: 'draft' } });
  res.json({
    success: true,
    data: { sent: sent.length, drafts, converted, conversionRate: sent.length ? converted / sent.length : 0 },
  });
};

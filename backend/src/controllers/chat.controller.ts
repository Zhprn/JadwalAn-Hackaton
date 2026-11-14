import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { notFound, pageMeta, paginate, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import {
  assertSessionAccess,
  assignSession,
  closeSession,
  getOrCreateCustomerSession,
  handleCustomerMessage,
  listMessages,
  markSessionRead,
  releaseSession,
  reopenSession,
  sendAdminMessage,
  sessionInclude,
  takeoverSession,
} from '../services/chat.service';
import { AuthRequest } from '../middlewares/authMiddleware';

const messagesQuery = z.object({
  after: z.coerce.date().optional(),
  before: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

// =====================================================================
// Pelanggan
// =====================================================================

/** POST /chat/sessions — ambil sesi aktif atau buat baru. */
export const startSession = async (req: AuthRequest, res: Response): Promise<any> => {
  const { channel } = z.object({ channel: z.enum(['web', 'whatsapp']).default('web') }).parse(req.body ?? {});
  const { session, created } = await getOrCreateCustomerSession(req.user!.id, channel);
  const messages = await listMessages(session.id, { limit: 50 });
  res.status(created ? 201 : 200).json({ success: true, data: { session, messages } });
};

/** GET /chat/sessions/me */
export const mySessions = async (req: AuthRequest, res: Response): Promise<any> => {
  const sessions = await prisma.chatSession.findMany({
    where: { customerId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
    take: 20,
    select: { id: true, title: true, status: true, lastMessage: true, lastMessageAt: true, unreadByCustomer: true, createdAt: true },
  });
  res.json({ success: true, data: sessions });
};

/** GET /chat/sessions/:id/messages?after= — pelanggan & admin (polling pakai `after`). */
export const getMessages = async (req: AuthRequest, res: Response): Promise<any> => {
  const id = param(req, 'id');
  const session = await assertSessionAccess(id, req.user!);
  const q = messagesQuery.parse(req.query);
  const messages = await listMessages(id, q);
  res.json({
    success: true,
    data: messages,
    meta: { status: session.status, unreadByCustomer: session.unreadByCustomer, unreadByAdmin: session.unreadByAdmin },
  });
};

/** POST /chat/sessions/:id/messages — pelanggan kirim pesan, AI langsung membalas. */
export const sendCustomerMessage = async (req: AuthRequest, res: Response): Promise<any> => {
  const { message } = z.object({ message: z.string().trim().min(1).max(2000) }).parse(req.body);
  const result = await handleCustomerMessage(param(req, 'id'), req.user!.id, message);
  res.status(201).json({ success: true, data: result });
};

/** POST /chat/sessions/:id/read */
export const markRead = async (req: AuthRequest, res: Response): Promise<any> => {
  const id = param(req, 'id');
  await assertSessionAccess(id, req.user!);
  await markSessionRead(id, req.user!.role === 'ADMIN' ? 'admin' : 'customer');
  res.json({ success: true, message: 'Ditandai sudah dibaca' });
};

/** POST /chat/sessions/:id/rate — pelanggan menilai chat (1–5). */
export const rateSession = async (req: AuthRequest, res: Response): Promise<any> => {
  const id = param(req, 'id');
  await assertSessionAccess(id, req.user!);
  const { rating } = z.object({ rating: z.number().int().min(1).max(5) }).parse(req.body);
  const session = await prisma.chatSession.update({ where: { id }, data: { rating } });
  res.json({ success: true, data: session });
};

// =====================================================================
// Admin
// =====================================================================

/** GET /chat/admin/sessions?status=&search=&mine=true */
export const adminListSessions = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z
    .object({
      status: z.string().optional(),
      priority: z.enum(['normal', 'high']).optional(),
      search: z.string().optional(),
      mine: z.enum(['true', 'false']).optional(),
      unread: z.enum(['true', 'false']).optional(),
    })
    .parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);

  const where: Prisma.ChatSessionWhereInput = {
    ...(q.status ? { status: { in: q.status.split(',') } } : {}),
    ...(q.priority ? { priority: q.priority } : {}),
    ...(q.mine === 'true' ? { assignedAdminId: req.user!.id } : {}),
    ...(q.unread === 'true' ? { unreadByAdmin: { gt: 0 } } : {}),
    ...(q.search
      ? {
          OR: [
            { title: { contains: q.search, mode: 'insensitive' } },
            { lastMessage: { contains: q.search, mode: 'insensitive' } },
            { customer: { name: { contains: q.search, mode: 'insensitive' } } },
          ],
        }
      : {}),
  };

  const [rows, total, counts] = await Promise.all([
    prisma.chatSession.findMany({
      where,
      include: sessionInclude,
      orderBy: [{ priority: 'asc' }, { lastMessageAt: { sort: 'desc', nulls: 'last' } }],
      skip,
      take,
    }),
    prisma.chatSession.count({ where }),
    prisma.chatSession.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  // priority: "high" < "normal" secara alfabet, jadi 'asc' menaruh high di atas.
  res.json({
    success: true,
    data: rows,
    meta: { ...pageMeta(page, limit, total), byStatus: Object.fromEntries(counts.map((c) => [c.status, c._count._all])) },
  });
};

/** GET /chat/admin/sessions/:id */
export const adminGetSession = async (req: AuthRequest, res: Response): Promise<any> => {
  const id = param(req, 'id');
  const session = await prisma.chatSession.findUnique({
    where: { id },
    include: {
      ...sessionInclude,
      events: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { id: true, name: true } } } },
      bookings: { select: { id: true, bookingCode: true, status: true, startTime: true, totalPrice: true } },
    },
  });
  if (!session) throw notFound('Sesi chat tidak ditemukan');
  const messages = await listMessages(id, { limit: 100 });
  res.json({ success: true, data: { session, messages } });
};

export const adminSendMessage = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({
      message: z.string().trim().min(1).max(4000),
      type: z.enum(['text', 'image', 'booking_card', 'promo_card']).default('text'),
      attachmentUrl: z.string().url().nullable().optional(),
      bookingId: z.string().uuid().nullable().optional(),
    })
    .parse(req.body);
  const result = await sendAdminMessage(param(req, 'id'), req.user!.id, input);
  res.status(201).json({ success: true, data: result });
};

export const adminTakeover = async (req: AuthRequest, res: Response): Promise<any> => {
  res.json({ success: true, data: await takeoverSession(param(req, 'id'), req.user!.id) });
};

export const adminRelease = async (req: AuthRequest, res: Response): Promise<any> => {
  res.json({ success: true, data: await releaseSession(param(req, 'id'), req.user!.id) });
};

export const adminClose = async (req: AuthRequest, res: Response): Promise<any> => {
  res.json({ success: true, data: await closeSession(param(req, 'id'), req.user!.id) });
};

export const adminReopen = async (req: AuthRequest, res: Response): Promise<any> => {
  res.json({ success: true, data: await reopenSession(param(req, 'id'), req.user!.id) });
};

export const adminAssign = async (req: AuthRequest, res: Response): Promise<any> => {
  const { adminId } = z.object({ adminId: z.string().uuid() }).parse(req.body);
  res.json({ success: true, data: await assignSession(param(req, 'id'), adminId, req.user!.id) });
};

export const adminUpdateSession = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = z
    .object({
      priority: z.enum(['normal', 'high']).optional(),
      title: z.string().max(120).optional(),
      intent: z.enum(['booking', 'tanya_harga', 'tanya_promo', 'komplain', 'lainnya']).optional(),
    })
    .parse(req.body);
  const session = await prisma.chatSession.update({ where: { id: param(req, 'id') }, data, include: sessionInclude });
  res.json({ success: true, data: session });
};

// =====================================================================
// Quick reply (template balasan admin)
// =====================================================================

const quickReplySchema = z.object({
  shortcut: z
    .string()
    .min(2)
    .transform((v) => (v.startsWith('/') ? v : `/${v}`).toLowerCase()),
  title: z.string().min(1),
  content: z.string().min(1),
  isActive: z.boolean().default(true),
});

export const listQuickReplies = async (req: AuthRequest, res: Response): Promise<any> => {
  const { search } = z.object({ search: z.string().optional() }).parse(req.query);
  const rows = await prisma.quickReply.findMany({
    where: search ? { OR: [{ shortcut: { contains: search.toLowerCase() } }, { title: { contains: search, mode: 'insensitive' } }] } : {},
    orderBy: { shortcut: 'asc' },
  });
  res.json({ success: true, data: rows });
};

export const createQuickReply = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = quickReplySchema.parse(req.body);
  const row = await prisma.quickReply.create({ data: { ...data, createdById: req.user!.id } });
  res.status(201).json({ success: true, data: row });
};

export const updateQuickReply = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = quickReplySchema.partial().parse(req.body);
  const row = await prisma.quickReply.update({ where: { id: param(req, 'id') }, data });
  res.json({ success: true, data: row });
};

export const deleteQuickReply = async (req: AuthRequest, res: Response): Promise<any> => {
  await prisma.quickReply.delete({ where: { id: param(req, 'id') } });
  res.json({ success: true, message: 'Quick reply dihapus' });
};

// =====================================================================
// Channel (WhatsApp / Web)
// =====================================================================

const hideConfig = <T extends { config: unknown }>(c: T) => ({ ...c, config: undefined, hasConfig: !!c.config });

export const listChannels = async (_req: AuthRequest, res: Response): Promise<any> => {
  const rows = await prisma.channel.findMany({ orderBy: { type: 'asc' } });
  res.json({ success: true, data: rows.map(hideConfig) });
};

export const upsertChannel = async (req: AuthRequest, res: Response): Promise<any> => {
  const type = z.enum(['whatsapp', 'web']).parse(param(req, 'type'));
  const data = z
    .object({
      name: z.string().min(1).optional(),
      phoneNumber: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
      status: z.enum(['connected', 'disconnected', 'error']).optional(),
      config: z.record(z.string(), z.unknown()).nullable().optional(),
    })
    .parse(req.body);
  const config = data.config === null ? Prisma.JsonNull : (data.config as Prisma.InputJsonValue | undefined);
  const row = await prisma.channel.upsert({
    where: { type },
    create: { type, name: data.name ?? type, phoneNumber: data.phoneNumber, isActive: data.isActive ?? true, status: data.status ?? 'disconnected', config },
    update: { ...data, config },
  });
  await logActivity('channel.update', 'Channel', row.id, { type, ...data, config: data.config ? '[hidden]' : data.config }, req.user?.id);
  res.json({ success: true, data: hideConfig(row) });
};

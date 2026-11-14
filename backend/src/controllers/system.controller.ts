import { Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { pageMeta, paginate, param } from '../lib/http';
import { AuthRequest } from '../middlewares/authMiddleware';

// =====================================================================
// Notifikasi admin
// =====================================================================

const myNotifications = (userId: string): Prisma.NotificationWhereInput => ({ OR: [{ userId: null }, { userId }] });

/** GET /notifications?unread=true */
export const listNotifications = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z.object({ unread: z.enum(['true', 'false']).optional(), type: z.string().optional() }).parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where: Prisma.NotificationWhereInput = {
    ...myNotifications(req.user!.id),
    ...(q.unread === 'true' ? { isRead: false } : {}),
    ...(q.type ? { type: q.type } : {}),
  };
  const [rows, total, unread] = await Promise.all([
    prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...myNotifications(req.user!.id), isRead: false } }),
  ]);
  res.json({ success: true, data: rows, meta: { ...pageMeta(page, limit, total), unread } });
};

export const readNotification = async (req: AuthRequest, res: Response): Promise<any> => {
  await prisma.notification.updateMany({ where: { id: param(req, 'id'), ...myNotifications(req.user!.id) }, data: { isRead: true } });
  res.json({ success: true, message: 'Notifikasi dibaca' });
};

export const readAllNotifications = async (req: AuthRequest, res: Response): Promise<any> => {
  const { count } = await prisma.notification.updateMany({ where: { ...myNotifications(req.user!.id), isRead: false }, data: { isRead: true } });
  res.json({ success: true, data: { updated: count } });
};

export const deleteNotification = async (req: AuthRequest, res: Response): Promise<any> => {
  await prisma.notification.deleteMany({ where: { id: param(req, 'id'), ...myNotifications(req.user!.id) } });
  res.json({ success: true, message: 'Notifikasi dihapus' });
};

// =====================================================================
// Activity log
// =====================================================================

/** GET /activity-logs?entity=&entityId=&userId=&action= */
export const listActivityLogs = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z
    .object({ entity: z.string().optional(), entityId: z.string().optional(), userId: z.string().uuid().optional(), action: z.string().optional() })
    .parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where: Prisma.ActivityLogWhereInput = {
    ...(q.entity ? { entity: q.entity } : {}),
    ...(q.entityId ? { entityId: q.entityId } : {}),
    ...(q.userId ? { userId: q.userId } : {}),
    ...(q.action ? { action: { startsWith: q.action } } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({ where, include: { user: { select: { id: true, name: true } } }, orderBy: { createdAt: 'desc' }, skip, take }),
    prisma.activityLog.count({ where }),
  ]);
  res.json({ success: true, data: rows, meta: pageMeta(page, limit, total) });
};

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest } from '../lib/http';
import { logActivity } from '../lib/activity';
import { TIME_REGEX } from '../lib/time';
import { getStoreSetting, invalidateSettings } from '../services/settings.service';
import { AuthRequest } from '../middlewares/authMiddleware';

// Catatan: error dari handler async otomatis diteruskan Express 5 ke errorMiddleware.

const settingSchema = z
  .object({
    name: z.string().min(1),
    address: z.string().nullable(),
    phone: z.string().nullable(),
    logoUrl: z.string().url().nullable().or(z.literal('')),
    timezone: z.string(),
    openTime: z.string().regex(TIME_REGEX, 'Format jam HH:mm'),
    closeTime: z.string().regex(TIME_REGEX, 'Format jam HH:mm'),
    closedDays: z.array(z.number().int().min(0).max(6)),
    minBookingHours: z.number().int().min(1).max(24),
    maxBookingHours: z.number().int().min(1).max(24),
    slotIntervalMins: z.number().int().refine((v) => [15, 30, 60].includes(v), 'slotIntervalMins harus 15, 30, atau 60'),
    bookingLeadMins: z.number().int().min(0).max(24 * 60),
    pendingExpiryMins: z.number().int().min(5).max(24 * 60),
  })
  .partial();

export const getSettings = async (_req: Request, res: Response): Promise<any> => {
  const setting = await getStoreSetting();
  res.json({ success: true, data: setting });
};

export const updateSettings = async (req: AuthRequest, res: Response): Promise<any> => {
  const data = settingSchema.parse(req.body);
  const current = await getStoreSetting();
  const min = data.minBookingHours ?? current.minBookingHours;
  const max = data.maxBookingHours ?? current.maxBookingHours;
  if (min > max) throw badRequest('minBookingHours tidak boleh lebih besar dari maxBookingHours');
  if ((data.openTime ?? current.openTime) === (data.closeTime ?? current.closeTime)) {
    throw badRequest('Jam buka dan jam tutup tidak boleh sama');
  }

  const updated = await prisma.storeSetting.update({ where: { id: current.id }, data });
  invalidateSettings();
  await logActivity('settings.update', 'StoreSetting', updated.id, data, req.user?.id);
  res.json({ success: true, data: updated });
};

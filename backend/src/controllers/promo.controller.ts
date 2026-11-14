import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, handleError, notFound, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { TIME_REGEX } from '../lib/time';
import { AuthRequest } from '../middlewares/authMiddleware';

const time = z.string().regex(TIME_REGEX, 'Format jam HH:mm');

const promoFields = {
  code: z
    .string()
    .min(3, 'Kode promo minimal 3 karakter')
    .transform((v) => v.trim().toUpperCase()),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  consoleType: z.enum(['ALL', 'PS5', 'PS4']),
  discountType: z.enum(['percent', 'nominal']),
  discountPercentage: z.number().int().min(0).max(100),
  discountAmount: z.number().int().min(0),
  maxDiscount: z.number().int().min(0).nullable().optional(),
  minHours: z.number().int().min(1),
  minTransaction: z.number().int().min(0),
  validDays: z.array(z.number().int().min(0).max(6)),
  validFrom: time.nullable().optional(),
  validTo: time.nullable().optional(),
  startDate: z.coerce.date().optional(),
  validUntil: z.coerce.date({ error: 'validUntil wajib berupa tanggal (ISO-8601)' }),
  isActive: z.boolean(),
  isPublic: z.boolean(),
  targetTier: z.enum(['regular', 'loyal', 'vip']).nullable().optional(),
  usageLimit: z.number().int().min(1).nullable().optional(),
  perCustomerLimit: z.number().int().min(1).nullable().optional(),
};

const promoSchema = z.object({
  ...promoFields,
  consoleType: promoFields.consoleType.default('ALL'),
  discountType: promoFields.discountType.default('percent'),
  discountPercentage: promoFields.discountPercentage.default(0),
  discountAmount: promoFields.discountAmount.default(0),
  minHours: promoFields.minHours.default(1),
  minTransaction: promoFields.minTransaction.default(0),
  validDays: promoFields.validDays.default([]),
  isActive: promoFields.isActive.default(true),
  isPublic: promoFields.isPublic.default(true),
});

// Update parsial tanpa default.
const promoUpdateSchema = z.object(promoFields).partial();

type PromoInput = Partial<z.infer<typeof promoUpdateSchema>>;

/** Validasi lintas-field. */
const assertConsistent = (p: PromoInput) => {
  if (p.discountType === 'percent' && p.discountPercentage !== undefined && p.discountPercentage <= 0) {
    throw badRequest('discountPercentage harus > 0 untuk tipe percent');
  }
  if (p.discountType === 'nominal' && p.discountAmount !== undefined && p.discountAmount <= 0) {
    throw badRequest('discountAmount harus > 0 untuk tipe nominal');
  }
  if ((p.validFrom && !p.validTo) || (!p.validFrom && p.validTo)) throw badRequest('validFrom dan validTo harus diisi berpasangan');
  if (p.startDate && p.validUntil && p.startDate > p.validUntil) throw badRequest('startDate harus sebelum validUntil');
};

export const getAllPromos = async (req: Request, res: Response): Promise<any> => {
  try {
    const { isPublic, isActive, valid } = req.query;
    const where: any = {};
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';
    if (isActive !== undefined) where.isActive = isActive === 'true';
    if (valid === 'true') {
      const now = new Date();
      where.startDate = { lte: now };
      where.validUntil = { gte: now };
    }
    const promos = await prisma.promo.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, data: promos });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getPromoById = async (req: Request, res: Response): Promise<any> => {
  try {
    const promo = await prisma.promo.findUnique({ where: { id: param(req, 'id') } });
    if (!promo) throw notFound('Promo tidak ditemukan');
    return res.json({ success: true, data: promo });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const createPromo = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const parsedData = promoSchema.parse(req.body);
    assertConsistent(parsedData);

    const existingCode = await prisma.promo.findUnique({ where: { code: parsedData.code } });
    if (existingCode) return res.status(400).json({ success: false, message: 'Kode promo sudah digunakan' });

    const newPromo = await prisma.promo.create({ data: parsedData });
    await logActivity('promo.create', 'Promo', newPromo.id, { code: newPromo.code }, req.user?.id);
    return res.status(201).json({ success: true, data: newPromo });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const updatePromo = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const parsedData = promoUpdateSchema.parse(req.body);

    const current = await prisma.promo.findUnique({ where: { id } });
    if (!current) throw notFound('Promo tidak ditemukan');
    assertConsistent({ ...current, ...parsedData } as PromoInput);

    if (parsedData.code) {
      const existingCode = await prisma.promo.findUnique({ where: { code: parsedData.code } });
      if (existingCode && existingCode.id !== id) {
        return res.status(400).json({ success: false, message: 'Kode promo sudah digunakan oleh promo lain' });
      }
    }

    const updatedPromo = await prisma.promo.update({ where: { id }, data: parsedData });
    await logActivity('promo.update', 'Promo', id, parsedData, req.user?.id);
    return res.json({ success: true, data: updatedPromo });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const deletePromo = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const used = await prisma.booking.count({ where: { promoId: id } });
    if (used > 0) {
      // Promo yang pernah dipakai dinonaktifkan supaya riwayat booking tetap konsisten.
      await prisma.promo.update({ where: { id }, data: { isActive: false } });
      await logActivity('promo.deactivate', 'Promo', id, null, req.user?.id);
      return res.json({ success: true, message: `Promo sudah dipakai di ${used} booking, jadi dinonaktifkan (bukan dihapus)` });
    }
    await prisma.promo.delete({ where: { id } });
    await logActivity('promo.delete', 'Promo', id, null, req.user?.id);
    return res.json({ success: true, message: 'Promo berhasil dihapus' });
  } catch (error: any) {
    return handleError(res, error);
  }
};

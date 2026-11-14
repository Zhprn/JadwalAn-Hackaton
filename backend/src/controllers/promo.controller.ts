import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Skema Validasi Zod
const promoSchema = z.object({
  code: z.string().min(3, "Kode promo minimal 3 karakter").toUpperCase(),
  title: z.string().optional(),
  description: z.string().optional(),
  consoleType: z.enum(["ALL", "PS5", "PS4"]).default("ALL"),
  discountType: z.enum(["percent", "nominal"]).default("percent"),
  discountPercentage: z.number().int().min(0).max(100).optional().default(0),
  discountAmount: z.number().int().min(0).optional().default(0),
  maxDiscount: z.number().int().nullable().optional(),
  minHours: z.number().int().min(1).default(1),
  minTransaction: z.number().int().min(0).default(0),
  validDays: z.array(z.number().int().min(0).max(6)).default([]),
  validFrom: z.string().nullable().optional(),
  validTo: z.string().nullable().optional(),
  validUntil: z.string().datetime("Format tanggal validUntil harus ISO-8601 (YYYY-MM-DDTHH:mm:ssZ)"),
  isActive: z.boolean().default(true),
  isPublic: z.boolean().default(true),
  targetTier: z.string().nullable().optional(),
  usageLimit: z.number().int().nullable().optional(),
  perCustomerLimit: z.number().int().nullable().optional(),
});

export const getAllPromos = async (req: Request, res: Response): Promise<any> => {
  try {
    const { isPublic, isActive } = req.query;
    
    const where: any = {};
    if (isPublic !== undefined) where.isPublic = isPublic === 'true';
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const promos = await prisma.promo.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ success: true, data: promos });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getPromoById = async (req: Request, res: Response): Promise<any> => {
  try {
    const promo = await prisma.promo.findUnique({
      where: { id: req.params.id }
    });
    
    if (!promo) {
      return res.status(404).json({ success: false, message: "Promo tidak ditemukan" });
    }
    
    return res.json({ success: true, data: promo });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createPromo = async (req: Request, res: Response): Promise<any> => {
  try {
    const parsedData = promoSchema.parse(req.body);
    
    // Cek duplikasi kode promo
    const existingCode = await prisma.promo.findUnique({ where: { code: parsedData.code } });
    if (existingCode) {
      return res.status(400).json({ success: false, message: "Kode promo sudah digunakan" });
    }

    const newPromo = await prisma.promo.create({
      data: parsedData
    });
    return res.status(201).json({ success: true, data: newPromo });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, errors: error.issues });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updatePromo = async (req: Request, res: Response): Promise<any> => {
  try {
    const parsedData = promoSchema.parse(req.body);
    
    // Cek duplikasi jika kode promo diubah
    const existingCode = await prisma.promo.findUnique({ where: { code: parsedData.code } });
    if (existingCode && existingCode.id !== req.params.id) {
      return res.status(400).json({ success: false, message: "Kode promo sudah digunakan oleh promo lain" });
    }

    const updatedPromo = await prisma.promo.update({
      where: { id: req.params.id },
      data: parsedData
    });
    return res.json({ success: true, data: updatedPromo });
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ success: false, errors: error.issues });
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: "Promo tidak ditemukan" });
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deletePromo = async (req: Request, res: Response): Promise<any> => {
  try {
    await prisma.promo.delete({
      where: { id: req.params.id }
    });
    return res.json({ success: true, message: "Promo berhasil dihapus" });
  } catch (error: any) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: "Promo tidak ditemukan" });
    return res.status(500).json({ success: false, message: error.message });
  }
};
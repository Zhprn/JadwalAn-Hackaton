import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, handleError, notFound, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { invalidateStations } from '../services/settings.service';
import { AuthRequest } from '../middlewares/authMiddleware';

const stationSchema = z.object({
  name: z.string().min(1, 'Nama unit wajib diisi'),
  category: z
    .string()
    .min(1, 'Kategori (PS4/PS5) wajib diisi')
    .transform((v) => v.trim().toUpperCase()),
  pricePerHour: z.number().int().positive('Harga per jam harus valid'),
  status: z.enum(['active', 'maintenance', 'inactive']).default('active'),
  description: z.string().optional(),
  imageUrl: z.string().url('Format URL gambar tidak valid').optional().or(z.literal('')),
  maxPlayers: z.number().int().min(1).default(2),
  games: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});

// Untuk update: semua field opsional & TANPA default, supaya field yang tidak dikirim tidak tertimpa.
const stationUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z
    .string()
    .min(1)
    .transform((v) => v.trim().toUpperCase())
    .optional(),
  pricePerHour: z.number().int().positive().optional(),
  status: z.enum(['active', 'maintenance', 'inactive']).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
  maxPlayers: z.number().int().min(1).optional(),
  games: z.array(z.string()).optional(),
  sortOrder: z.number().int().optional(),
});

export const getAllStations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, status } = req.query;
    const where: any = {};
    if (category) where.category = { equals: String(category), mode: 'insensitive' };
    if (status) where.status = String(status);

    const stations = await prisma.station.findMany({ where, orderBy: { sortOrder: 'asc' } });
    return res.json({ success: true, data: stations });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const getStationById = async (req: Request, res: Response): Promise<any> => {
  try {
    const station = await prisma.station.findUnique({ where: { id: param(req, 'id') } });
    if (!station) throw notFound('Unit tidak ditemukan');
    return res.json({ success: true, data: station });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const createStation = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const parsedData = stationSchema.parse(req.body);
    const newStation = await prisma.station.create({ data: parsedData });
    invalidateStations();
    await logActivity('station.create', 'Station', newStation.id, parsedData, req.user?.id);
    return res.status(201).json({ success: true, data: newStation });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const updateStation = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const parsedData = stationUpdateSchema.parse(req.body);
    const updatedStation = await prisma.station.update({ where: { id }, data: parsedData });
    invalidateStations();
    await logActivity('station.update', 'Station', id, parsedData, req.user?.id);
    return res.json({ success: true, data: updatedStation });
  } catch (error: any) {
    return handleError(res, error);
  }
};

export const deleteStation = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const bookingCount = await prisma.booking.count({ where: { stationId: id } });
    if (bookingCount > 0) {
      // Unit yang punya riwayat booking tidak dihapus agar laporan tetap utuh → nonaktifkan saja.
      if (req.query.force !== 'true') {
        throw badRequest(`Unit punya ${bookingCount} riwayat booking. Ubah status ke "inactive", atau kirim ?force=true untuk menonaktifkan otomatis.`);
      }
      await prisma.station.update({ where: { id }, data: { status: 'inactive' } });
      invalidateStations();
      await logActivity('station.deactivate', 'Station', id, null, req.user?.id);
      return res.json({ success: true, message: 'Unit memiliki riwayat booking, jadi dinonaktifkan (bukan dihapus)' });
    }
    await prisma.station.delete({ where: { id } });
    invalidateStations();
    await logActivity('station.delete', 'Station', id, null, req.user?.id);
    return res.json({ success: true, message: 'Unit berhasil dihapus' });
  } catch (error: any) {
    return handleError(res, error);
  }
};

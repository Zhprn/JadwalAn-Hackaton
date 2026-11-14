import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

const prisma = new PrismaClient();

// Skema Validasi Zod
const stationSchema = z.object({
  name: z.string().min(1, "Nama unit wajib diisi"),
  category: z.string().min(1, "Kategori (PS4/PS5) wajib diisi"),
  pricePerHour: z.number().int().positive("Harga per jam harus valid"),
  status: z.enum(["active", "maintenance", "inactive"]).default("active"),
  description: z.string().optional(),
  imageUrl: z.string().url("Format URL gambar tidak valid").optional().or(z.literal('')),
  maxPlayers: z.number().int().min(1).default(2),
  games: z.array(z.string()).default([]),
  sortOrder: z.number().int().default(0),
});

export const getAllStations = async (req: Request, res: Response): Promise<any> => {
  try {
    const { category, status } = req.query;
    
    // Filter dinamis
    const where: any = {};
    if (category) where.category = String(category);
    if (status) where.status = String(status);

    const stations = await prisma.station.findMany({
      where,
      orderBy: { sortOrder: 'asc' }
    });

    return res.json({ success: true, data: stations });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getStationById = async (req: Request, res: Response): Promise<any> => {
  try {
    const station = await prisma.station.findUnique({
      where: { id: req.params.id }
    });
    
    if (!station) {
      return res.status(404).json({ success: false, message: "Unit tidak ditemukan" });
    }
    
    return res.json({ success: true, data: station });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createStation = async (req: Request, res: Response): Promise<any> => {
  try {
    const parsedData = stationSchema.parse(req.body);
    const newStation = await prisma.station.create({
      data: parsedData
    });
    return res.status(201).json({ success: true, data: newStation });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.issues });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const updateStation = async (req: Request, res: Response): Promise<any> => {
  try {
    const parsedData = stationSchema.parse(req.body);
    const updatedStation = await prisma.station.update({
      where: { id: req.params.id },
      data: parsedData
    });
    return res.json({ success: true, data: updatedStation });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: error.issues });
    }
    // Prisma error "Record to update not found" (P2025)
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: "Unit tidak ditemukan" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteStation = async (req: Request, res: Response): Promise<any> => {
  try {
    await prisma.station.delete({
      where: { id: req.params.id }
    });
    return res.json({ success: true, message: "Unit berhasil dihapus" });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ success: false, message: "Unit tidak ditemukan" });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};
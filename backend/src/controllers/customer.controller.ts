import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { recordFailedLogin, resetLoginAttempts } from '../middlewares/rateLimiter';
import { tokenBlacklist, AuthRequest } from '../middlewares/authMiddleware';

const prisma = new PrismaClient();

export const registerCustomer = async (req: Request, res: Response): Promise<any> => {
  try {
    const schema = z.object({ name: z.string().min(2), whatsapp: z.string().min(10), password: z.string().min(6) });
    const data = schema.parse(req.body);
    
    const existing = await prisma.customer.findUnique({ where: { whatsapp: data.whatsapp } });
    if (existing) return res.status(400).json({ success: false, message: "Nomor WhatsApp sudah terdaftar" });

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newCustomer = await prisma.customer.create({
      data: { ...data, password: hashedPassword },
      select: { id: true, name: true, whatsapp: true, tier: true }
    });
    res.status(201).json({ success: true, data: newCustomer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginCustomer = async (req: Request, res: Response): Promise<any> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const { whatsapp, password } = req.body;
    const customer = await prisma.customer.findUnique({ where: { whatsapp } });

    if (!customer || !(await bcrypt.compare(password, customer.password))) {
      recordFailedLogin(ip);
      return res.status(401).json({ success: false, message: "WhatsApp atau password salah" });
    }

    resetLoginAttempts(ip);
    const accessToken = jwt.sign({ id: customer.id, role: 'CUSTOMER' }, process.env.JWT_SECRET as string, { expiresIn: '7d' });
    const refreshToken = jwt.sign({ id: customer.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '30d' });
    
    await prisma.customer.update({ where: { id: customer.id }, data: { refreshToken } });
    res.json({ success: true, data: { customer: { id: customer.id, name: customer.name, whatsapp: customer.whatsapp }, accessToken, refreshToken } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const logoutCustomer = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) tokenBlacklist.add(authHeader.split(' ')[1]);
    if (req.user?.id) await prisma.customer.update({ where: { id: req.user.id }, data: { refreshToken: null } });
    res.json({ success: true, message: "Berhasil logout" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: req.user?.id },
      select: { id: true, name: true, whatsapp: true, tier: true, totalHours: true, totalSessions: true, avatarUrl: true }
    });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const schema = z.object({ name: z.string().min(2), whatsapp: z.string().min(10) });
    const data = schema.parse(req.body);
    const customer = await prisma.customer.update({
      where: { id: req.user?.id },
      data,
      select: { id: true, name: true, whatsapp: true, tier: true }
    });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
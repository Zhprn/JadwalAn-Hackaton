import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { recordFailedLogin, resetLoginAttempts } from '../middlewares/rateLimiter';
import { tokenBlacklist, AuthRequest } from '../middlewares/authMiddleware';

const prisma = new PrismaClient();

const generateTokens = (user: { id: string, role: string }) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
  const refreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

export const registerAdmin = async (req: Request, res: Response): Promise<any> => {
  try {
    const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });
    const data = schema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) return res.status(400).json({ success: false, message: "Email sudah terdaftar" });

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newAdmin = await prisma.user.create({
      data: { ...data, password: hashedPassword, role: 'ADMIN' },
      select: { id: true, name: true, email: true, role: true }
    });
    res.status(201).json({ success: true, data: newAdmin });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const loginAdmin = async (req: Request, res: Response): Promise<any> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      recordFailedLogin(ip);
      return res.status(401).json({ success: false, message: "Email atau password salah" });
    }
    resetLoginAttempts(ip);
    const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken, lastLoginAt: new Date() } });

    res.json({ success: true, data: { user: { id: user.id, name: user.name, email: user.email, role: user.role }, accessToken, refreshToken } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ success: false, message: "Refresh token dibutuhkan" });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.refreshToken !== refreshToken) return res.status(403).json({ success: false, message: "Refresh token tidak valid" });

    const tokens = generateTokens({ id: user.id, role: user.role });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });
    res.json({ success: true, data: tokens });
  } catch (error: any) {
    res.status(403).json({ success: false, message: "Token kadaluarsa atau tidak valid" });
  }
};

export const logoutAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) tokenBlacklist.add(authHeader.split(' ')[1]);
    if (req.user?.id) await prisma.user.update({ where: { id: req.user.id }, data: { refreshToken: null } });
    res.json({ success: true, message: "Berhasil logout" });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id }, select: { id: true, name: true, email: true, role: true, avatarUrl: true } });
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const schema = z.object({ name: z.string().min(2), email: z.string().email() });
    const data = schema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.user?.id }, data, select: { id: true, name: true, email: true, role: true } });
    res.json({ success: true, data: user });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
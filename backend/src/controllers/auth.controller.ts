import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, forbidden, handleError, notFound, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { recordFailedLogin, resetLoginAttempts } from '../middlewares/rateLimiter';
import { tokenBlacklist, AuthRequest } from '../middlewares/authMiddleware';

const generateTokens = (user: { id: string; role: string }) => {
  const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET as string, { expiresIn: '1d' });
  const refreshToken = jwt.sign({ id: user.id, type: 'admin' }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '7d' });
  return { accessToken, refreshToken };
};

const publicUser = { id: true, name: true, email: true, role: true, avatarUrl: true, isActive: true, lastLoginAt: true, createdAt: true } as const;

export const registerAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const schema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6) });
    const data = schema.parse(req.body);
    const email = data.email.toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ success: false, message: 'Email sudah terdaftar' });

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newAdmin = await prisma.user.create({
      data: { name: data.name, email, password: hashedPassword, role: 'ADMIN' },
      select: publicUser,
    });
    await logActivity('admin.create', 'User', newAdmin.id, { email }, req.user?.id);
    res.status(201).json({ success: true, data: newAdmin });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const loginAdmin = async (req: Request, res: Response): Promise<any> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      recordFailedLogin(ip);
      return res.status(401).json({ success: false, message: 'Email atau password salah' });
    }
    if (user.role !== 'ADMIN') return res.status(403).json({ success: false, message: 'Akun ini bukan admin' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Akun admin dinonaktifkan' });

    resetLoginAttempts(ip);
    const { accessToken, refreshToken } = generateTokens({ id: user.id, role: user.role });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken, lastLoginAt: new Date() } });

    res.json({
      success: true,
      data: {
        user: { id: user.id, name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const refreshToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token dibutuhkan' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.refreshToken !== refreshToken || !user.isActive) {
      return res.status(403).json({ success: false, message: 'Refresh token tidak valid' });
    }

    const tokens = generateTokens({ id: user.id, role: user.role });
    await prisma.user.update({ where: { id: user.id }, data: { refreshToken: tokens.refreshToken } });
    res.json({ success: true, data: tokens });
  } catch {
    res.status(403).json({ success: false, message: 'Token kadaluarsa atau tidak valid' });
  }
};

export const logoutAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) tokenBlacklist.add(authHeader.split(' ')[1]);
    if (req.user?.id) await prisma.user.update({ where: { id: req.user.id }, data: { refreshToken: null } });
    res.json({ success: true, message: 'Berhasil logout' });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user?.id }, select: publicUser });
    if (!user) throw notFound('Akun tidak ditemukan');
    res.json({ success: true, data: user });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      email: z.string().email().optional(),
      avatarUrl: z.string().url().nullable().optional(),
    });
    const data = schema.parse(req.body);
    if (data.email) {
      data.email = data.email.toLowerCase();
      const taken = await prisma.user.findFirst({ where: { email: data.email, id: { not: req.user!.id } } });
      if (taken) throw badRequest('Email sudah dipakai akun lain');
    }
    const user = await prisma.user.update({ where: { id: req.user!.id }, data, select: publicUser });
    res.json({ success: true, data: user });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const changePassword = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) })
      .parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.password))) throw badRequest('Password lama salah');
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(newPassword, 10), refreshToken: null },
    });
    res.json({ success: true, message: 'Password berhasil diubah. Silakan login ulang.' });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const listAdmins = async (_req: AuthRequest, res: Response): Promise<any> => {
  try {
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: publicUser, orderBy: { createdAt: 'asc' } });
    res.json({ success: true, data: admins });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const setAdminStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    if (id === req.user?.id && !isActive) throw forbidden('Tidak bisa menonaktifkan akun sendiri');
    const user = await prisma.user.update({
      where: { id },
      data: { isActive, ...(isActive ? {} : { refreshToken: null }) },
      select: publicUser,
    });
    await logActivity(isActive ? 'admin.activate' : 'admin.deactivate', 'User', id, null, req.user?.id);
    res.json({ success: true, data: user });
  } catch (error: any) {
    handleError(res, error);
  }
};

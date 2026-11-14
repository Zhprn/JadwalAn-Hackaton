import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, handleError, notFound, pageMeta, paginate, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { bookingInclude, recalcCustomerStats } from '../services/booking.service';
import { recordFailedLogin, resetLoginAttempts } from '../middlewares/rateLimiter';
import { tokenBlacklist, AuthRequest } from '../middlewares/authMiddleware';

/** Normalisasi nomor WA ke format 62xxxxxxxx. */
export const normalizeWhatsapp = (raw: string) => {
  let n = raw.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (n.startsWith('0')) n = `62${n.slice(1)}`;
  else if (n.startsWith('8')) n = `62${n}`;
  return n;
};

const whatsappSchema = z
  .string()
  .min(9, 'Nomor WhatsApp tidak valid')
  .transform(normalizeWhatsapp)
  .refine((v) => /^62\d{8,13}$/.test(v), 'Nomor WhatsApp tidak valid');

const generateTokens = (id: string) => ({
  accessToken: jwt.sign({ id, role: 'CUSTOMER' }, process.env.JWT_SECRET as string, { expiresIn: '7d' }),
  refreshToken: jwt.sign({ id, type: 'customer' }, process.env.JWT_REFRESH_SECRET as string, { expiresIn: '30d' }),
});

const publicCustomer = {
  id: true,
  name: true,
  whatsapp: true,
  avatarUrl: true,
  tier: true,
  totalHours: true,
  totalSessions: true,
  totalSpent: true,
  lastPlayed: true,
  favoriteConsole: true,
  favoriteHour: true,
  optOutPromo: true,
  createdAt: true,
} as const;

// =====================================================================
// Pelanggan (self-service)
// =====================================================================

export const registerCustomer = async (req: Request, res: Response): Promise<any> => {
  try {
    const schema = z.object({ name: z.string().min(2), whatsapp: whatsappSchema, password: z.string().min(6) });
    const data = schema.parse(req.body);

    const existing = await prisma.customer.findUnique({ where: { whatsapp: data.whatsapp } });
    if (existing) return res.status(400).json({ success: false, message: 'Nomor WhatsApp sudah terdaftar' });

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const customer = await prisma.customer.create({ data: { ...data, password: hashedPassword }, select: publicCustomer });

    // Langsung login setelah daftar.
    const tokens = generateTokens(customer.id);
    await prisma.customer.update({ where: { id: customer.id }, data: { refreshToken: tokens.refreshToken } });
    res.status(201).json({ success: true, data: { customer, ...tokens } });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const loginCustomer = async (req: Request, res: Response): Promise<any> => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  try {
    const { whatsapp, password } = z.object({ whatsapp: whatsappSchema, password: z.string().min(1) }).parse(req.body);
    const customer = await prisma.customer.findUnique({ where: { whatsapp } });

    if (!customer || !(await bcrypt.compare(password, customer.password))) {
      recordFailedLogin(ip);
      return res.status(401).json({ success: false, message: 'WhatsApp atau password salah' });
    }

    resetLoginAttempts(ip);
    const tokens = generateTokens(customer.id);
    await prisma.customer.update({ where: { id: customer.id }, data: { refreshToken: tokens.refreshToken } });
    res.json({
      success: true,
      data: {
        customer: { id: customer.id, name: customer.name, whatsapp: customer.whatsapp, tier: customer.tier, avatarUrl: customer.avatarUrl },
        ...tokens,
      },
    });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const refreshCustomerToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const { refreshToken } = req.body ?? {};
    if (!refreshToken) return res.status(401).json({ success: false, message: 'Refresh token dibutuhkan' });
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET as string) as any;
    const customer = await prisma.customer.findUnique({ where: { id: decoded.id } });
    if (!customer || customer.refreshToken !== refreshToken) {
      return res.status(403).json({ success: false, message: 'Refresh token tidak valid' });
    }
    const tokens = generateTokens(customer.id);
    await prisma.customer.update({ where: { id: customer.id }, data: { refreshToken: tokens.refreshToken } });
    res.json({ success: true, data: tokens });
  } catch {
    res.status(403).json({ success: false, message: 'Token kadaluarsa atau tidak valid' });
  }
};

export const logoutCustomer = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) tokenBlacklist.add(authHeader.split(' ')[1]);
    if (req.user?.id) await prisma.customer.update({ where: { id: req.user.id }, data: { refreshToken: null } });
    res.json({ success: true, message: 'Berhasil logout' });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: req.user?.id }, select: publicCustomer });
    if (!customer) throw notFound('Akun tidak ditemukan');
    res.json({ success: true, data: customer });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const updateMe = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const schema = z.object({
      name: z.string().min(2).optional(),
      whatsapp: whatsappSchema.optional(),
      avatarUrl: z.string().url().nullable().optional(),
      optOutPromo: z.boolean().optional(),
    });
    const data = schema.parse(req.body);
    if (data.whatsapp) {
      const taken = await prisma.customer.findFirst({ where: { whatsapp: data.whatsapp, id: { not: req.user!.id } } });
      if (taken) throw badRequest('Nomor WhatsApp sudah dipakai akun lain');
    }
    const customer = await prisma.customer.update({ where: { id: req.user!.id }, data, select: publicCustomer });
    res.json({ success: true, data: customer });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const changeCustomerPassword = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { currentPassword, newPassword } = z
      .object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) })
      .parse(req.body);
    const customer = await prisma.customer.findUnique({ where: { id: req.user!.id } });
    if (!customer || !(await bcrypt.compare(currentPassword, customer.password))) throw badRequest('Password lama salah');
    await prisma.customer.update({
      where: { id: customer.id },
      data: { password: await bcrypt.hash(newPassword, 10), refreshToken: null },
    });
    res.json({ success: true, message: 'Password berhasil diubah. Silakan login ulang.' });
  } catch (error: any) {
    handleError(res, error);
  }
};

// =====================================================================
// Admin: manajemen pelanggan / CRM
// =====================================================================

const listQuery = z.object({
  search: z.string().optional(),
  tier: z.enum(['regular', 'loyal', 'vip']).optional(),
  tag: z.string().optional(),
  /** Pelanggan yang tidak main ≥ N hari (target promo comeback). */
  inactiveDays: z.coerce.number().int().min(1).optional(),
  sort: z.enum(['newest', 'lastPlayed', 'totalSpent', 'totalSessions', 'name']).default('newest'),
});

export const listCustomers = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const q = listQuery.parse(req.query);
    const { page, limit, skip, take } = paginate(req.query);

    const where: Prisma.CustomerWhereInput = {
      ...(q.tier ? { tier: q.tier } : {}),
      ...(q.tag ? { tags: { has: q.tag } } : {}),
      ...(q.search
        ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { whatsapp: { contains: q.search.replace(/\D/g, '') || q.search } }] }
        : {}),
      ...(q.inactiveDays ? { lastPlayed: { lt: new Date(Date.now() - q.inactiveDays * 86_400_000) } } : {}),
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput =
      q.sort === 'lastPlayed'
        ? { lastPlayed: { sort: 'desc', nulls: 'last' } }
        : q.sort === 'totalSpent'
          ? { totalSpent: 'desc' }
          : q.sort === 'totalSessions'
            ? { totalSessions: 'desc' }
            : q.sort === 'name'
              ? { name: 'asc' }
              : { createdAt: 'desc' };

    const [rows, total] = await Promise.all([
      prisma.customer.findMany({ where, orderBy, skip, take, select: { ...publicCustomer, tags: true, lastPromoSentAt: true } }),
      prisma.customer.count({ where }),
    ]);
    res.json({ success: true, data: rows, meta: pageMeta(page, limit, total) });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const getCustomerById = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const customer = await prisma.customer.findUnique({
      where: { id },
      select: {
        ...publicCustomer,
        tags: true,
        notes: true,
        lastPromoSentAt: true,
        bookings: { orderBy: { startTime: 'desc' }, take: 20, include: bookingInclude },
        reviews: { orderBy: { createdAt: 'desc' }, take: 10 },
        promoMessages: { orderBy: { createdAt: 'desc' }, take: 10 },
        _count: { select: { bookings: true, chatSessions: true } },
      },
    });
    if (!customer) throw notFound('Pelanggan tidak ditemukan');
    res.json({ success: true, data: customer });
  } catch (error: any) {
    handleError(res, error);
  }
};

/** Admin membuat pelanggan (mis. walk-in). Password acak jika tidak diisi. */
export const createCustomerByAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const data = z
      .object({ name: z.string().min(2), whatsapp: whatsappSchema, password: z.string().min(6).optional(), notes: z.string().optional() })
      .parse(req.body);
    const exists = await prisma.customer.findUnique({ where: { whatsapp: data.whatsapp } });
    if (exists) throw badRequest('Nomor WhatsApp sudah terdaftar');
    const password = data.password ?? Math.random().toString(36).slice(2, 10);
    const customer = await prisma.customer.create({
      data: { name: data.name, whatsapp: data.whatsapp, notes: data.notes, password: await bcrypt.hash(password, 10) },
      select: publicCustomer,
    });
    await logActivity('customer.create', 'Customer', customer.id, { name: data.name }, req.user?.id);
    res.status(201).json({ success: true, data: { ...customer, ...(data.password ? {} : { temporaryPassword: password }) } });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const updateCustomerByAdmin = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const data = z
      .object({
        name: z.string().min(2).optional(),
        whatsapp: whatsappSchema.optional(),
        tier: z.enum(['regular', 'loyal', 'vip']).optional(),
        tags: z.array(z.string().min(1)).optional(),
        notes: z.string().nullable().optional(),
        optOutPromo: z.boolean().optional(),
      })
      .parse(req.body);
    if (data.whatsapp) {
      const taken = await prisma.customer.findFirst({ where: { whatsapp: data.whatsapp, id: { not: id } } });
      if (taken) throw badRequest('Nomor WhatsApp sudah dipakai pelanggan lain');
    }
    const customer = await prisma.customer.update({ where: { id }, data, select: { ...publicCustomer, tags: true, notes: true } });
    await logActivity('customer.update', 'Customer', id, data, req.user?.id);
    res.json({ success: true, data: customer });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const recalcCustomer = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const customer = await recalcCustomerStats(param(req, 'id'));
    res.json({ success: true, data: customer });
  } catch (error: any) {
    handleError(res, error);
  }
};

export const resetCustomerPassword = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const id = param(req, 'id');
    const password = Math.random().toString(36).slice(2, 10);
    await prisma.customer.update({ where: { id }, data: { password: await bcrypt.hash(password, 10), refreshToken: null } });
    await logActivity('customer.reset_password', 'Customer', id, null, req.user?.id);
    res.json({ success: true, data: { temporaryPassword: password } });
  } catch (error: any) {
    handleError(res, error);
  }
};

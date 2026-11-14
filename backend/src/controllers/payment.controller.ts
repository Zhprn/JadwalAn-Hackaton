import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { forbidden, notFound, pageMeta, paginate, param } from '../lib/http';
import {
  createQrisPayment,
  getPaymentStatus,
  handleMidtransNotification,
  recordManualPayment,
  refundPayment,
} from '../services/payment.service';
import { AuthRequest } from '../middlewares/authMiddleware';

const assertBookingAccess = async (req: AuthRequest, bookingId: string) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, select: { customerId: true } });
  if (!booking) throw notFound('Booking tidak ditemukan');
  if (req.user?.role === 'CUSTOMER' && booking.customerId !== req.user.id) throw forbidden('Ini bukan booking milikmu');
};

/** POST /payments/:bookingId/qris — buat / ambil QRIS aktif (pelanggan pemilik atau admin). */
export const createQris = async (req: AuthRequest, res: Response): Promise<any> => {
  const bookingId = param(req, 'bookingId');
  await assertBookingAccess(req, bookingId);
  const payment = await createQrisPayment(bookingId);
  res.status(201).json({ success: true, data: payment });
};

/** GET /payments/:bookingId — status pembayaran (disinkronkan ke Midtrans jika masih pending). */
export const getStatus = async (req: AuthRequest, res: Response): Promise<any> => {
  const bookingId = param(req, 'bookingId');
  await assertBookingAccess(req, bookingId);
  const payment = await getPaymentStatus(bookingId);
  const { rawResponse: _raw, ...safe } = payment as any;
  res.json({ success: true, data: req.user?.role === 'ADMIN' ? payment : safe });
};

/** POST /payments/midtrans/webhook — notifikasi dari Midtrans (tanpa auth, diverifikasi dengan signature). */
export const midtransWebhook = async (req: Request, res: Response): Promise<any> => {
  const result = await handleMidtransNotification(req.body);
  res.json({ success: true, data: result });
};

/** POST /payments/:bookingId/manual (admin) — catat bayar tunai/transfer. */
export const manualPayment = async (req: AuthRequest, res: Response): Promise<any> => {
  const { method } = z.object({ method: z.enum(['cash', 'transfer']).default('cash') }).parse(req.body ?? {});
  const payment = await recordManualPayment(param(req, 'bookingId'), method, req.user!.id);
  res.json({ success: true, data: payment });
};

/** POST /payments/:bookingId/refund (admin) */
export const refund = async (req: AuthRequest, res: Response): Promise<any> => {
  const payment = await refundPayment(param(req, 'bookingId'), req.user!.id);
  res.json({ success: true, data: payment });
};

/** GET /payments (admin) */
export const listPayments = async (req: AuthRequest, res: Response): Promise<any> => {
  const q = z
    .object({ status: z.string().optional(), method: z.string().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() })
    .parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where: Prisma.PaymentWhereInput = {
    ...(q.status ? { status: q.status } : {}),
    ...(q.method ? { method: q.method } : {}),
    ...(q.from || q.to ? { createdAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
  };
  const [rows, total, sum] = await Promise.all([
    prisma.payment.findMany({
      where,
      omit: { rawResponse: true },
      include: { booking: { select: { id: true, bookingCode: true, startTime: true, customer: { select: { name: true, whatsapp: true } } } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({ where: { ...where, status: 'paid' }, _sum: { amount: true } }),
  ]);
  res.json({ success: true, data: rows, meta: { ...pageMeta(page, limit, total), totalPaid: sum._sum.amount ?? 0 } });
};

import { Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { badRequest, forbidden, notFound, pageMeta, paginate, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { AuthRequest } from '../middlewares/authMiddleware';

/** POST /reviews — pelanggan memberi ulasan untuk booking yang sudah selesai. */
export const createReview = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({ bookingId: z.string().uuid(), rating: z.number().int().min(1).max(5), comment: z.string().max(1000).optional() })
    .parse(req.body);
  const booking = await prisma.booking.findUnique({ where: { id: input.bookingId }, include: { review: true } });
  if (!booking) throw notFound('Booking tidak ditemukan');
  if (booking.customerId !== req.user!.id) throw forbidden('Ini bukan booking milikmu');
  if (booking.status !== 'completed') throw badRequest('Ulasan hanya untuk booking yang sudah selesai');
  if (booking.review) throw badRequest('Booking ini sudah diulas');

  const review = await prisma.review.create({
    data: { bookingId: booking.id, customerId: req.user!.id, rating: input.rating, comment: input.comment },
  });
  res.status(201).json({ success: true, data: review });
};

/** GET /reviews — publik: daftar ulasan + rata-rata rating. */
export const listReviews = async (req: Request, res: Response): Promise<any> => {
  const { rating } = z.object({ rating: z.coerce.number().int().min(1).max(5).optional() }).parse(req.query);
  const { page, limit, skip, take } = paginate(req.query);
  const where = rating ? { rating } : {};
  const [rows, total, agg, dist] = await Promise.all([
    prisma.review.findMany({
      where,
      include: {
        customer: { select: { name: true, avatarUrl: true } },
        booking: { select: { station: { select: { name: true, category: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ _avg: { rating: true }, _count: { _all: true } }),
    prisma.review.groupBy({ by: ['rating'], _count: { _all: true } }),
  ]);
  // Sembunyikan nama lengkap pelanggan di endpoint publik.
  const masked = rows.map((r) => ({ ...r, customer: { ...r.customer, name: r.customer.name.split(' ')[0] } }));
  res.json({
    success: true,
    data: masked,
    meta: {
      ...pageMeta(page, limit, total),
      average: Number((agg._avg.rating ?? 0).toFixed(2)),
      count: agg._count._all,
      distribution: Object.fromEntries(dist.map((d) => [d.rating, d._count._all])),
    },
  });
};

/** GET /reviews/me */
export const myReviews = async (req: AuthRequest, res: Response): Promise<any> => {
  const rows = await prisma.review.findMany({
    where: { customerId: req.user!.id },
    include: { booking: { select: { bookingCode: true, startTime: true, station: { select: { name: true } } } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: rows });
};

/** DELETE /reviews/:id (admin) */
export const deleteReview = async (req: AuthRequest, res: Response): Promise<any> => {
  const id = param(req, 'id');
  await prisma.review.delete({ where: { id } });
  await logActivity('review.delete', 'Review', id, null, req.user?.id);
  res.json({ success: true, message: 'Ulasan dihapus' });
};

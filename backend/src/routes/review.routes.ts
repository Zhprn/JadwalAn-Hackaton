import { Router } from 'express';
import { createReview, listReviews, myReviews, deleteReview } from '../controllers/review.controller';
import { verifyToken, requireAdmin, requireCustomer } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/reviews:
 *   get:
 *     summary: Ulasan publik + rata-rata rating
 *     tags: [Reviews]
 *     parameters:
 *       - { in: query, name: rating, schema: { type: integer } }
 *     responses:
 *       200: { description: Daftar ulasan }
 *   post:
 *     summary: Pelanggan mengulas booking yang sudah selesai
 *     tags: [Reviews]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookingId, rating]
 *             properties:
 *               bookingId: { type: string }
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *               comment: { type: string }
 *     responses:
 *       201: { description: Ulasan dibuat }
 * /api/reviews/me:
 *   get:
 *     summary: Ulasan milik pelanggan
 *     tags: [Reviews]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar ulasan }
 * /api/reviews/{id}:
 *   delete:
 *     summary: Hapus ulasan (admin)
 *     tags: [Reviews]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Dihapus }
 */
router.get('/', listReviews);
router.post('/', verifyToken, requireCustomer, createReview);
router.get('/me', verifyToken, requireCustomer, myReviews);
router.delete('/:id', verifyToken, requireAdmin, deleteReview);

export default router;

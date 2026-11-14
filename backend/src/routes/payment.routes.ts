import { Router } from 'express';
import { createQris, getStatus, midtransWebhook, manualPayment, refund, listPayments } from '../controllers/payment.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/payments/midtrans/webhook:
 *   post:
 *     summary: Webhook notifikasi Midtrans
 *     description: "Daftarkan URL ini di dashboard Midtrans → Settings → Payment → Notification URL. Diverifikasi dengan signature_key."
 *     tags: [Payments]
 *     responses:
 *       200: { description: Notifikasi diproses }
 *       403: { description: Signature tidak valid }
 */
router.post('/midtrans/webhook', midtransWebhook);

/**
 * @openapi
 * /api/payments:
 *   get:
 *     summary: Daftar pembayaran (admin)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [pending, paid, expired, failed, refunded] } }
 *       - { in: query, name: method, schema: { type: string, enum: [qris, cash, transfer] } }
 *       - { in: query, name: from, schema: { type: string } }
 *       - { in: query, name: to, schema: { type: string } }
 *     responses:
 *       200: { description: Daftar pembayaran + total lunas }
 */
router.get('/', verifyToken, requireAdmin, listPayments);

/**
 * @openapi
 * /api/payments/{bookingId}/qris:
 *   post:
 *     summary: Buat / ambil QRIS aktif untuk booking (pelanggan pemilik atau admin)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: bookingId, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: "Data pembayaran; qrUrl = gambar QR untuk ditampilkan" }
 *       503: { description: Midtrans belum dikonfigurasi }
 */
router.post('/:bookingId/qris', verifyToken, createQris);

/**
 * @openapi
 * /api/payments/{bookingId}:
 *   get:
 *     summary: Status pembayaran (otomatis sinkron ke Midtrans jika pending) — untuk polling
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: bookingId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status pembayaran }
 */
router.get('/:bookingId', verifyToken, getStatus);

/**
 * @openapi
 * /api/payments/{bookingId}/manual:
 *   post:
 *     summary: Catat pembayaran tunai / transfer (admin)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: bookingId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               method: { type: string, enum: [cash, transfer], default: cash }
 *     responses:
 *       200: { description: Pembayaran tercatat, booking terkonfirmasi }
 */
router.post('/:bookingId/manual', verifyToken, requireAdmin, manualPayment);

/**
 * @openapi
 * /api/payments/{bookingId}/refund:
 *   post:
 *     summary: Tandai pembayaran sudah direfund (admin)
 *     tags: [Payments]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: bookingId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status refunded }
 */
router.post('/:bookingId/refund', verifyToken, requireAdmin, refund);

export default router;

import { Router } from 'express';
import { getTargets, generate, generateBulk, regenerate, list, update, send, sendBulk, remove, stats } from '../controllers/promoMessage.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';
import { aiRateLimiter } from '../middlewares/rateLimiter';

const router = Router();
router.use(verifyToken, requireAdmin);

/**
 * @openapi
 * /api/promo-messages/targets:
 *   get:
 *     summary: Pelanggan target promo comeback (lama tidak main, belum dikirimi promo baru-baru ini)
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: inactiveDays, schema: { type: integer, default: 14 } }
 *       - { in: query, name: cooldownDays, schema: { type: integer, default: 7 } }
 *       - { in: query, name: tier, schema: { type: string } }
 *     responses:
 *       200: { description: Daftar target }
 * /api/promo-messages/stats:
 *   get:
 *     summary: Statistik konversi promo (booking ≤ 7 hari setelah dikirim)
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Statistik }
 */
router.get('/targets', getTargets);
router.get('/stats', stats);

/**
 * @openapi
 * /api/promo-messages/generate:
 *   post:
 *     summary: AI menulis draft pesan promo WhatsApp yang personal
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId]
 *             properties:
 *               customerId: { type: string }
 *               promoId: { type: string }
 *               tone: { type: string, enum: [friendly, urgent, exclusive, casual] }
 *               instruction: { type: string }
 *     responses:
 *       201: { description: Draft dibuat }
 * /api/promo-messages/generate-bulk:
 *   post:
 *     summary: Draft promo untuk banyak pelanggan sekaligus (maks 30)
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerIds]
 *             properties:
 *               customerIds: { type: array, items: { type: string } }
 *               promoId: { type: string }
 *               tone: { type: string, enum: [friendly, urgent, exclusive, casual] }
 *     responses:
 *       201: { description: Hasil per pelanggan }
 */
router.post('/generate', aiRateLimiter, generate);
router.post('/generate-bulk', aiRateLimiter, generateBulk);

/**
 * @openapi
 * /api/promo-messages:
 *   get:
 *     summary: Daftar pesan promo
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string, enum: [draft, sent, failed] } }
 *       - { in: query, name: customerId, schema: { type: string } }
 *       - { in: query, name: promoId, schema: { type: string } }
 *     responses:
 *       200: { description: Daftar }
 * /api/promo-messages/{id}:
 *   patch:
 *     summary: Edit isi draft
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Diubah }
 *   delete:
 *     summary: Hapus pesan promo
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Dihapus }
 * /api/promo-messages/{id}/regenerate:
 *   post:
 *     summary: Buat versi lain dari draft
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Versi baru }
 * /api/promo-messages/{id}/send:
 *   post:
 *     summary: Tandai terkirim & dapatkan link wa.me untuk dikirim admin
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "Berisi waLink" }
 */
router.get('/', list);
router.patch('/:id', update);
router.delete('/:id', remove);
router.post('/:id/regenerate', aiRateLimiter, regenerate);
router.post('/:id/send', send);

/**
 * @openapi
 * /api/promo-messages/send-bulk:
 *   post:
 *     summary: Kirim banyak draft promo lewat WhatsApp (latar belakang, jeda acak 4–9 detik)
 *     tags: [AI Promo CRM]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *     responses:
 *       202: { description: Diantrikan }
 */
router.post('/send-bulk', sendBulk);

export default router;

import { Router } from 'express';
import { status, connect, logout, config, test, publicInfo } from '../controllers/whatsapp.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();
const admin = [verifyToken, requireAdmin];

/**
 * @openapi
 * /api/whatsapp/public:
 *   get:
 *     summary: Info publik WhatsApp rental (terhubung? nomor?) untuk tombol "Chat via WhatsApp"
 *     tags: [WhatsApp]
 *     responses:
 *       200: { description: "{ connected, phone, aiReply }" }
 * /api/whatsapp/status:
 *   get:
 *     summary: Status koneksi WhatsApp + string QR saat menunggu scan (admin)
 *     description: "status: disconnected | connecting | qr | connected. Saat status=qr, render field `qr` sebagai QR code lalu scan dari WhatsApp di HP (Perangkat tertaut)."
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Status }
 * /api/whatsapp/connect:
 *   post:
 *     summary: Mulai koneksi WhatsApp (memunculkan QR) (admin)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Status terbaru }
 * /api/whatsapp/logout:
 *   post:
 *     summary: Putuskan WhatsApp & hapus sesi perangkat (admin)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Terputus }
 * /api/whatsapp/config:
 *   put:
 *     summary: Atur balas otomatis AI & notifikasi booking/pengingat (admin)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               autoReply: { type: boolean }
 *               notifyBooking: { type: boolean }
 *               notifyReminder: { type: boolean }
 *               reminderMins: { type: integer, example: 60 }
 *     responses:
 *       200: { description: Konfigurasi tersimpan }
 * /api/whatsapp/test:
 *   post:
 *     summary: Kirim pesan uji (admin)
 *     tags: [WhatsApp]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, message]
 *             properties:
 *               to: { type: string, example: "08123456789" }
 *               message: { type: string }
 *     responses:
 *       200: { description: Terkirim }
 */
router.get('/public', publicInfo);
router.get('/status', ...admin, status);
router.post('/connect', ...admin, connect);
router.post('/logout', ...admin, logout);
router.put('/config', ...admin, config);
router.post('/test', ...admin, test);

export default router;

import { Router } from 'express';
import {
  startSession,
  mySessions,
  getMessages,
  sendCustomerMessage,
  markRead,
  rateSession,
  adminListSessions,
  adminGetSession,
  adminSendMessage,
  adminTakeover,
  adminRelease,
  adminClose,
  adminReopen,
  adminAssign,
  adminUpdateSession,
  listQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
  listChannels,
  upsertChannel,
} from '../controllers/chat.controller';
import { verifyToken, requireAdmin, requireCustomer } from '../middlewares/authMiddleware';
import { chatRateLimiter } from '../middlewares/rateLimiter';

const router = Router();
const admin = [verifyToken, requireAdmin];

// ============================ Pelanggan ============================

/**
 * @openapi
 * /api/chat/sessions:
 *   post:
 *     summary: Mulai chat (ambil sesi aktif atau buat baru dengan sapaan AI)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Sesi yang sudah ada + 50 pesan terakhir }
 *       201: { description: Sesi baru }
 */
router.post('/sessions', verifyToken, requireCustomer, startSession);

/**
 * @openapi
 * /api/chat/sessions/me:
 *   get:
 *     summary: Riwayat sesi chat pelanggan
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar sesi }
 */
router.get('/sessions/me', verifyToken, requireCustomer, mySessions);

/**
 * @openapi
 * /api/chat/sessions/{id}/messages:
 *   get:
 *     summary: Ambil pesan (pelanggan pemilik / admin). Pakai `after` untuk polling pesan baru.
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: after, schema: { type: string, format: date-time } }
 *       - { in: query, name: before, schema: { type: string, format: date-time } }
 *       - { in: query, name: limit, schema: { type: integer, default: 50 } }
 *     responses:
 *       200: { description: Daftar pesan (urut naik) }
 *   post:
 *     summary: Pelanggan kirim pesan — AI multi-agent langsung membalas
 *     description: "Respons berisi customerMessage, replies (balasan AI, kartu booking, pesan sistem), dan info agent yang menjawab."
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: "Besok jam 4 sore PS5 kosong ga? mau main 2 jam" }
 *     responses:
 *       201: { description: Pesan terkirim + balasan AI }
 */
router.get('/sessions/:id/messages', verifyToken, getMessages);
router.post('/sessions/:id/messages', verifyToken, requireCustomer, chatRateLimiter, sendCustomerMessage);

/**
 * @openapi
 * /api/chat/sessions/{id}/read:
 *   post:
 *     summary: Tandai pesan sudah dibaca (pelanggan atau admin)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.post('/sessions/:id/read', verifyToken, markRead);

/**
 * @openapi
 * /api/chat/sessions/{id}/rate:
 *   post:
 *     summary: Pelanggan menilai layanan chat (1–5)
 *     tags: [Chat]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               rating: { type: integer, minimum: 1, maximum: 5 }
 *     responses:
 *       200: { description: OK }
 */
router.post('/sessions/:id/rate', verifyToken, requireCustomer, rateSession);

// ============================== Admin ==============================

/**
 * @openapi
 * /api/chat/admin/sessions:
 *   get:
 *     summary: Daftar sesi live chat (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string }, description: "ai_pilot,human,closed (pisah koma)" }
 *       - { in: query, name: priority, schema: { type: string, enum: [normal, high] } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: mine, schema: { type: boolean } }
 *       - { in: query, name: unread, schema: { type: boolean } }
 *     responses:
 *       200: { description: Daftar sesi + jumlah per status }
 */
router.get('/admin/sessions', ...admin, adminListSessions);

/**
 * @openapi
 * /api/chat/admin/sessions/{id}:
 *   get:
 *     summary: Detail sesi + pesan + riwayat event (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Detail sesi }
 *   patch:
 *     summary: Ubah prioritas / judul / intent sesi (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               priority: { type: string, enum: [normal, high] }
 *               title: { type: string }
 *               intent: { type: string }
 *     responses:
 *       200: { description: Sesi diperbarui }
 */
router.get('/admin/sessions/:id', ...admin, adminGetSession);
router.patch('/admin/sessions/:id', ...admin, adminUpdateSession);

/**
 * @openapi
 * /api/chat/admin/sessions/{id}/messages:
 *   post:
 *     summary: Admin membalas (otomatis mengambil alih dari AI)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string }
 *               type: { type: string, enum: [text, image, booking_card, promo_card] }
 *               attachmentUrl: { type: string }
 *               bookingId: { type: string }
 *     responses:
 *       201: { description: Pesan terkirim }
 */
router.post('/admin/sessions/:id/messages', ...admin, adminSendMessage);

/**
 * @openapi
 * /api/chat/admin/sessions/{id}/takeover:
 *   post:
 *     summary: Ambil alih percakapan dari AI
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status human }
 * /api/chat/admin/sessions/{id}/release:
 *   post:
 *     summary: Kembalikan percakapan ke AI
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status ai_pilot }
 * /api/chat/admin/sessions/{id}/close:
 *   post:
 *     summary: Tutup sesi
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Status closed }
 * /api/chat/admin/sessions/{id}/reopen:
 *   post:
 *     summary: Buka kembali sesi
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Sesi dibuka }
 * /api/chat/admin/sessions/{id}/assign:
 *   post:
 *     summary: Tugaskan sesi ke admin lain
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminId: { type: string }
 *     responses:
 *       200: { description: Ditugaskan }
 */
router.post('/admin/sessions/:id/takeover', ...admin, adminTakeover);
router.post('/admin/sessions/:id/release', ...admin, adminRelease);
router.post('/admin/sessions/:id/close', ...admin, adminClose);
router.post('/admin/sessions/:id/reopen', ...admin, adminReopen);
router.post('/admin/sessions/:id/assign', ...admin, adminAssign);

/**
 * @openapi
 * /api/chat/quick-replies:
 *   get:
 *     summary: Daftar template balasan cepat (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string } }
 *     responses:
 *       200: { description: Daftar quick reply }
 *   post:
 *     summary: Tambah quick reply (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [shortcut, title, content]
 *             properties:
 *               shortcut: { type: string, example: "/harga" }
 *               title: { type: string }
 *               content: { type: string }
 *               isActive: { type: boolean }
 *     responses:
 *       201: { description: Dibuat }
 * /api/chat/quick-replies/{id}:
 *   put:
 *     summary: Ubah quick reply (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Diubah }
 *   delete:
 *     summary: Hapus quick reply (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Dihapus }
 */
router.get('/quick-replies', ...admin, listQuickReplies);
router.post('/quick-replies', ...admin, createQuickReply);
router.put('/quick-replies/:id', ...admin, updateQuickReply);
router.delete('/quick-replies/:id', ...admin, deleteQuickReply);

/**
 * @openapi
 * /api/chat/channels:
 *   get:
 *     summary: Daftar channel chat (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar channel (config disembunyikan) }
 * /api/chat/channels/{type}:
 *   put:
 *     summary: Buat / ubah channel whatsapp atau web (admin)
 *     tags: [Chat Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: type, required: true, schema: { type: string, enum: [whatsapp, web] } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               phoneNumber: { type: string }
 *               isActive: { type: boolean }
 *               status: { type: string, enum: [connected, disconnected, error] }
 *               config: { type: object }
 *     responses:
 *       200: { description: Channel disimpan }
 */
router.get('/channels', ...admin, listChannels);
router.put('/channels/:type', ...admin, upsertChannel);

export default router;

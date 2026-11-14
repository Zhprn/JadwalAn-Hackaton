import { Router } from 'express';
import {
  aiStatus,
  playground,
  listAgents,
  getAgent,
  upsertAgent,
  listKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  listLogs,
  getLog,
  aiStats,
  dashboardInsight,
  customerInsight,
} from '../controllers/ai.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';
import { aiRateLimiter } from '../middlewares/rateLimiter';

const router = Router();
router.use(verifyToken, requireAdmin);

/**
 * @openapi
 * /api/ai/status:
 *   get:
 *     summary: Status konfigurasi AI (+ ?ping=true untuk tes koneksi ke Gemini)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: ping, schema: { type: boolean } }
 *     responses:
 *       200: { description: Status AI }
 */
router.get('/status', aiStatus);

/**
 * @openapi
 * /api/ai/playground:
 *   post:
 *     summary: Uji chatbot multi-agent (mode uji, tidak membuat/membatalkan booking)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message: { type: string, example: "Ada promo apa minggu ini? sabtu jam 7 malam ps5 kosong?" }
 *               history:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     role: { type: string, enum: [user, model] }
 *                     text: { type: string }
 *               customerId: { type: string, description: "Opsional: simulasikan sebagai pelanggan ini" }
 *               previousIntent: { type: string }
 *     responses:
 *       200: { description: "Balasan + agent yang dipilih, tool calls, latensi, token" }
 */
router.post('/playground', aiRateLimiter, playground);

/**
 * @openapi
 * /api/ai/agents:
 *   get:
 *     summary: Konfigurasi semua agent (chat, crm_promo, copywriter, insight)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar agent }
 * /api/ai/agents/{feature}:
 *   get:
 *     summary: Konfigurasi satu agent
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: feature, required: true, schema: { type: string, enum: [chat, crm_promo, copywriter, insight] } }
 *     responses:
 *       200: { description: Agent }
 *   put:
 *     summary: Ubah konfigurasi agent (persona, model, auto-reply, handoff keyword, jam aktif)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: feature, required: true, schema: { type: string, enum: [chat, crm_promo, copywriter, insight] } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               model: { type: string }
 *               systemPrompt: { type: string }
 *               temperature: { type: number }
 *               maxTokens: { type: integer }
 *               isActive: { type: boolean }
 *               autoReply: { type: boolean }
 *               canCreateBooking: { type: boolean }
 *               bookingStatus: { type: string, enum: [pending, confirmed] }
 *               greetingMessage: { type: string }
 *               fallbackMessage: { type: string }
 *               handoffKeywords: { type: array, items: { type: string } }
 *               activeFrom: { type: string, example: "10:00" }
 *               activeTo: { type: string, example: "22:00" }
 *     responses:
 *       200: { description: Agent disimpan }
 */
router.get('/agents', listAgents);
router.get('/agents/:feature', getAgent);
router.put('/agents/:feature', upsertAgent);

/**
 * @openapi
 * /api/ai/knowledge:
 *   get:
 *     summary: Basis pengetahuan AI
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: isActive, schema: { type: boolean } }
 *     responses:
 *       200: { description: Daftar knowledge }
 *   post:
 *     summary: Tambah knowledge (priority ≥ 10 = selalu dibaca AI)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [category, content]
 *             properties:
 *               category: { type: string, enum: [faq, aturan, harga, lokasi, game, lainnya] }
 *               question: { type: string }
 *               content: { type: string }
 *               isActive: { type: boolean }
 *               priority: { type: integer }
 *     responses:
 *       201: { description: Dibuat }
 * /api/ai/knowledge/{id}:
 *   put:
 *     summary: Ubah knowledge
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Diubah }
 *   delete:
 *     summary: Hapus knowledge
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Dihapus }
 */
router.get('/knowledge', listKnowledge);
router.post('/knowledge', createKnowledge);
router.put('/knowledge/:id', updateKnowledge);
router.delete('/knowledge/:id', deleteKnowledge);

/**
 * @openapi
 * /api/ai/logs:
 *   get:
 *     summary: Log pemanggilan AI
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: feature, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string, enum: [success, error, handoff] } }
 *       - { in: query, name: sessionId, schema: { type: string } }
 *       - { in: query, name: customerId, schema: { type: string } }
 *     responses:
 *       200: { description: Daftar log }
 * /api/ai/logs/{id}:
 *   get:
 *     summary: Detail log (termasuk tool calls)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Detail log }
 * /api/ai/stats:
 *   get:
 *     summary: Statistik AI (panggilan, latensi, token, booking oleh AI, handoff)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, default: 7 } }
 *     responses:
 *       200: { description: Statistik }
 */
router.get('/logs', listLogs);
router.get('/logs/:id', getLog);
router.get('/stats', aiStats);

/**
 * @openapi
 * /api/ai/insights/dashboard:
 *   get:
 *     summary: Insight bisnis harian dari AI (cache 3 jam, ?refresh=true untuk buat ulang)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: refresh, schema: { type: boolean } }
 *     responses:
 *       200: { description: Insight }
 * /api/ai/insights/customers/{customerId}:
 *   get:
 *     summary: Analisis pelanggan oleh AI (segmen, risiko churn, rekomendasi; cache 24 jam)
 *     tags: [AI]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: customerId, required: true, schema: { type: string } }
 *       - { in: query, name: refresh, schema: { type: boolean } }
 *     responses:
 *       200: { description: Analisis }
 */
router.get('/insights/dashboard', aiRateLimiter, dashboardInsight);
router.get('/insights/customers/:customerId', aiRateLimiter, customerInsight);

export default router;

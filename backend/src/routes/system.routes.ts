import { Router } from 'express';
import {
  listNotifications,
  readNotification,
  readAllNotifications,
  deleteNotification,
  listActivityLogs,
} from '../controllers/system.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

// Router ini di-mount di root /api, jadi auth dipasang per-route (bukan router.use)
// agar tidak ikut mengunci endpoint lain.
const router = Router();
const admin = [verifyToken, requireAdmin];

/**
 * @openapi
 * /api/notifications:
 *   get:
 *     summary: Notifikasi admin (booking baru, handoff chat, pembayaran, pembatalan)
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: unread, schema: { type: boolean } }
 *       - { in: query, name: type, schema: { type: string } }
 *     responses:
 *       200: { description: "Daftar notifikasi + meta.unread (untuk badge, cukup di-polling)" }
 * /api/notifications/read-all:
 *   post:
 *     summary: Tandai semua notifikasi dibaca
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: OK }
 * /api/notifications/{id}/read:
 *   patch:
 *     summary: Tandai satu notifikasi dibaca
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 * /api/notifications/{id}:
 *   delete:
 *     summary: Hapus notifikasi
 *     tags: [Notifications]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: OK }
 */
router.get('/notifications', ...admin, listNotifications);
router.post('/notifications/read-all', ...admin, readAllNotifications);
router.patch('/notifications/:id/read', ...admin, readNotification);
router.delete('/notifications/:id', ...admin, deleteNotification);

/**
 * @openapi
 * /api/activity-logs:
 *   get:
 *     summary: Log aktivitas admin & sistem
 *     tags: [Activity Logs]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: entity, schema: { type: string, example: Booking } }
 *       - { in: query, name: entityId, schema: { type: string } }
 *       - { in: query, name: userId, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string, example: booking. } }
 *     responses:
 *       200: { description: Daftar log }
 */
router.get('/activity-logs', ...admin, listActivityLogs);

export default router;

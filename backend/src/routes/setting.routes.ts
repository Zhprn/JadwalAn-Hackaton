import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/setting.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/settings:
 *   get:
 *     summary: Pengaturan rental (jam buka, hari libur, aturan booking)
 *     tags: [Settings]
 *     responses:
 *       200: { description: Pengaturan rental }
 *   put:
 *     summary: Ubah pengaturan rental (admin)
 *     tags: [Settings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: "PS Cuku Sunguik" }
 *               address: { type: string }
 *               phone: { type: string }
 *               logoUrl: { type: string }
 *               openTime: { type: string, example: "10:00" }
 *               closeTime: { type: string, example: "23:00", description: "Boleh lewat tengah malam, mis. 02:00" }
 *               closedDays: { type: array, items: { type: integer }, description: "0 = Minggu … 6 = Sabtu" }
 *               minBookingHours: { type: integer, example: 1 }
 *               maxBookingHours: { type: integer, example: 8 }
 *               slotIntervalMins: { type: integer, enum: [15, 30, 60] }
 *               bookingLeadMins: { type: integer, example: 30 }
 *               pendingExpiryMins: { type: integer, example: 30 }
 *     responses:
 *       200: { description: Pengaturan diperbarui }
 */
router.get('/', getSettings);
router.put('/', verifyToken, requireAdmin, updateSettings);

export default router;

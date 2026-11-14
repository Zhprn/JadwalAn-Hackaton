import { Router } from 'express';
import {
  getAvailabilityHandler,
  quoteBooking,
  createMyBooking,
  listMyBookings,
  getMyBooking,
  cancelMyBooking,
  listBookings,
  getSchedule,
  getBooking,
  createAdminBooking,
  changeBookingStatus,
  rescheduleHandler,
  updateBookingNotes,
  exportBookings,
} from '../controllers/booking.controller';
import { verifyToken, requireAdmin, requireCustomer, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/bookings/availability:
 *   get:
 *     summary: Slot jam kosong per unit pada suatu tanggal
 *     tags: [Bookings]
 *     parameters:
 *       - { in: query, name: date, schema: { type: string, example: "2026-11-15" }, description: "Default hari ini (WIB)" }
 *       - { in: query, name: stationId, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string, example: PS5 } }
 *     responses:
 *       200: { description: "Slot per unit: start, end, available, maxHours (jam berturut-turut yang bisa dibooking)" }
 */
router.get('/availability', getAvailabilityHandler);

/**
 * @openapi
 * /api/bookings/quote:
 *   post:
 *     summary: Hitung harga & validasi promo (tanpa menyimpan)
 *     tags: [Bookings]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SlotInput' }
 *     responses:
 *       200: { description: Rincian harga }
 */
router.post('/quote', optionalAuth, quoteBooking);

/**
 * @openapi
 * /api/bookings:
 *   post:
 *     summary: Pelanggan membuat booking
 *     description: "paymentMethod qris → status pending + QRIS dibuat (batal otomatis jika tidak dibayar). cash → confirmed, bayar di kasir."
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SlotInput'
 *               - type: object
 *                 properties:
 *                   notes: { type: string }
 *                   paymentMethod: { type: string, enum: [qris, cash], default: qris }
 *     responses:
 *       201: { description: Booking dibuat (+ data QRIS jika ada) }
 *       409: { description: Slot sudah terisi }
 *   get:
 *     summary: Daftar booking (admin)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: date, schema: { type: string } }
 *       - { in: query, name: from, schema: { type: string } }
 *       - { in: query, name: to, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string }, description: "Bisa dipisah koma: pending,confirmed" }
 *       - { in: query, name: stationId, schema: { type: string } }
 *       - { in: query, name: customerId, schema: { type: string } }
 *       - { in: query, name: source, schema: { type: string, enum: [manual, web, ai] } }
 *       - { in: query, name: search, schema: { type: string }, description: "Kode booking / nama / WA" }
 *       - { in: query, name: sort, schema: { type: string, enum: [startTime, -startTime, createdAt, -createdAt] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: Daftar booking }
 */
router.post('/', verifyToken, requireCustomer, createMyBooking);
router.get('/', verifyToken, requireAdmin, listBookings);

/**
 * @openapi
 * /api/bookings/me:
 *   get:
 *     summary: Booking milik pelanggan
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: status, schema: { type: string }, description: "upcoming | history | <status>" }
 *     responses:
 *       200: { description: Daftar booking }
 */
router.get('/me', verifyToken, requireCustomer, listMyBookings);

/**
 * @openapi
 * /api/bookings/me/{id}:
 *   get:
 *     summary: Detail booking milik pelanggan
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Detail booking }
 */
router.get('/me/:id', verifyToken, requireCustomer, getMyBooking);

/**
 * @openapi
 * /api/bookings/me/{id}/cancel:
 *   post:
 *     summary: Pelanggan membatalkan booking (maks 1 jam sebelum main)
 *     tags: [Bookings]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string }
 *     responses:
 *       200: { description: Booking dibatalkan }
 */
router.post('/me/:id/cancel', verifyToken, requireCustomer, cancelMyBooking);

/**
 * @openapi
 * /api/bookings/schedule:
 *   get:
 *     summary: Timeline jadwal per unit untuk satu hari (admin)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: date, schema: { type: string } }
 *     responses:
 *       200: { description: Unit beserta booking-nya }
 */
router.get('/schedule', verifyToken, requireAdmin, getSchedule);

/**
 * @openapi
 * /api/bookings/export:
 *   get:
 *     summary: Unduh booking sebagai Excel (admin)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, schema: { type: string } }
 *       - { in: query, name: to, schema: { type: string } }
 *       - { in: query, name: status, schema: { type: string } }
 *     responses:
 *       200: { description: File .xlsx }
 */
router.get('/export', verifyToken, requireAdmin, exportBookings);

/**
 * @openapi
 * /api/bookings/admin:
 *   post:
 *     summary: Booking manual oleh admin (walk-in / telepon)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SlotInput'
 *               - type: object
 *                 properties:
 *                   customerId: { type: string }
 *                   newCustomer:
 *                     type: object
 *                     properties:
 *                       name: { type: string }
 *                       whatsapp: { type: string }
 *                   notes: { type: string }
 *                   status: { type: string, enum: [pending, confirmed], default: confirmed }
 *                   markPaid: { type: string, enum: [cash, transfer] }
 *                   enforceLead: { type: boolean, default: false }
 *     responses:
 *       201: { description: Booking dibuat }
 */
router.post('/admin', verifyToken, requireAdmin, createAdminBooking);

/**
 * @openapi
 * /api/bookings/{id}:
 *   get:
 *     summary: Detail booking + riwayat perubahan (admin)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Detail booking }
 */
router.get('/:id', verifyToken, requireAdmin, getBooking);

/**
 * @openapi
 * /api/bookings/{id}/status:
 *   patch:
 *     summary: Ubah status booking (admin)
 *     description: "Alur: pending → confirmed/cancelled; confirmed → checked_in/cancelled/no_show; checked_in → completed"
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [pending, confirmed, checked_in, completed, cancelled, no_show] }
 *               reason: { type: string }
 *     responses:
 *       200: { description: Status diubah }
 */
router.patch('/:id/status', verifyToken, requireAdmin, changeBookingStatus);

/**
 * @openapi
 * /api/bookings/{id}/reschedule:
 *   patch:
 *     summary: Ubah jadwal / unit / durasi booking (admin)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               stationId: { type: string }
 *               date: { type: string }
 *               startTime: { type: string }
 *               durationHours: { type: integer }
 *     responses:
 *       200: { description: Jadwal diubah }
 */
router.patch('/:id/reschedule', verifyToken, requireAdmin, rescheduleHandler);

/**
 * @openapi
 * /api/bookings/{id}/notes:
 *   patch:
 *     summary: Ubah catatan booking (admin)
 *     tags: [Bookings Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string }
 *     responses:
 *       200: { description: Catatan diubah }
 */
router.patch('/:id/notes', verifyToken, requireAdmin, updateBookingNotes);

export default router;

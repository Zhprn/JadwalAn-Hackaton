import { Router } from 'express';
import { getAllPromos, getPromoById, createPromo, updatePromo, deletePromo } from '../controllers/promo.controller';
import { quoteBooking } from '../controllers/booking.controller';
import { verifyToken, requireAdmin, optionalAuth } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/promos/validate:
 *   post:
 *     summary: Validasi kode promo untuk sebuah slot (sama dengan /api/bookings/quote)
 *     description: Login pelanggan opsional, diperlukan untuk promo khusus tier / batas per pelanggan.
 *     tags: [Promos]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SlotInput' }
 *     responses:
 *       200: { description: Rincian harga + promoValid & promoError }
 */
router.post('/validate', optionalAuth, quoteBooking);

/**
 * @openapi
 * /api/promos:
 *   get:
 *     summary: Mendapatkan daftar promo
 *     tags: [Promos]
 *     parameters:
 *       - in: query
 *         name: isPublic
 *         schema:
 *           type: boolean
 *         description: Filter promo yang bersifat publik (muncul di halaman Promo client)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter promo yang sedang aktif
 *     responses:
 *       200:
 *         description: Berhasil mengambil data promo
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       code:
 *                         type: string
 *                       title:
 *                         type: string
 *                       consoleType:
 *                         type: string
 *                       discountType:
 *                         type: string
 *                       discountPercentage:
 *                         type: integer
 *                       discountAmount:
 *                         type: integer
 *                       isActive:
 *                         type: boolean
 *                       isPublic:
 *                         type: boolean
 *                       validUntil:
 *                         type: string
 *                         format: date-time
 *       500:
 *         description: Internal server error
 */
router.get('/', getAllPromos);

/**
 * @openapi
 * /api/promos/{id}:
 *   get:
 *     summary: Mendapatkan detail promo
 *     tags: [Promos]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Promo
 *     responses:
 *       200:
 *         description: Data promo ditemukan
 *       404:
 *         description: Promo tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.get('/:id', getPromoById);

/**
 * @openapi
 * /api/promos:
 *   post:
 *     summary: Menambahkan promo baru
 *     tags: [Promos]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, validUntil]
 *             properties:
 *               code:
 *                 type: string
 *                 example: "WEEKEND15"
 *               title:
 *                 type: string
 *                 example: "Diskon Weekend"
 *               description:
 *                 type: string
 *               consoleType:
 *                 type: string
 *                 enum: [ALL, PS5, PS4]
 *                 default: ALL
 *               discountType:
 *                 type: string
 *                 enum: [percent, nominal]
 *                 default: percent
 *               discountPercentage:
 *                 type: integer
 *                 example: 15
 *               discountAmount:
 *                 type: integer
 *                 example: 0
 *               maxDiscount:
 *                 type: integer
 *                 nullable: true
 *               minHours:
 *                 type: integer
 *                 default: 1
 *               minTransaction:
 *                 type: integer
 *                 default: 0
 *               validDays:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 description: "Array angka hari (0=Minggu, 6=Sabtu). Kosong berarti setiap hari."
 *                 example: [6, 0]
 *               validFrom:
 *                 type: string
 *                 nullable: true
 *                 example: "10:00"
 *               validTo:
 *                 type: string
 *                 nullable: true
 *                 example: "17:00"
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-12-31T23:59:59Z"
 *               isActive:
 *                 type: boolean
 *                 default: true
 *               isPublic:
 *                 type: boolean
 *                 default: true
 *               targetTier:
 *                 type: string
 *                 nullable: true
 *                 example: "loyal"
 *               usageLimit:
 *                 type: integer
 *                 nullable: true
 *               perCustomerLimit:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Promo berhasil ditambahkan
 *       400:
 *         description: Validasi input gagal / Kode promo sudah ada
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Bukan admin)
 *       500:
 *         description: Internal server error
 */
router.post('/', verifyToken, requireAdmin, createPromo);

/**
 * @openapi
 * /api/promos/{id}:
 *   put:
 *     summary: Mengubah data promo
 *     tags: [Promos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Promo yang akan diubah
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, validUntil]
 *             properties:
 *               code:
 *                 type: string
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               consoleType:
 *                 type: string
 *                 enum: [ALL, PS5, PS4]
 *               discountType:
 *                 type: string
 *                 enum: [percent, nominal]
 *               discountPercentage:
 *                 type: integer
 *               discountAmount:
 *                 type: integer
 *               maxDiscount:
 *                 type: integer
 *                 nullable: true
 *               minHours:
 *                 type: integer
 *               minTransaction:
 *                 type: integer
 *               validDays:
 *                 type: array
 *                 items:
 *                   type: integer
 *               validFrom:
 *                 type: string
 *                 nullable: true
 *               validTo:
 *                 type: string
 *                 nullable: true
 *               validUntil:
 *                 type: string
 *                 format: date-time
 *               isActive:
 *                 type: boolean
 *               isPublic:
 *                 type: boolean
 *               targetTier:
 *                 type: string
 *                 nullable: true
 *               usageLimit:
 *                 type: integer
 *                 nullable: true
 *               perCustomerLimit:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Promo berhasil diubah
 *       400:
 *         description: Validasi input gagal / Kode promo duplikat
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Bukan admin)
 *       404:
 *         description: Promo tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.put('/:id', verifyToken, requireAdmin, updatePromo);

/**
 * @openapi
 * /api/promos/{id}:
 *   delete:
 *     summary: Menghapus promo
 *     tags: [Promos]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID Promo yang akan dihapus
 *     responses:
 *       200:
 *         description: Promo berhasil dihapus
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Bukan admin)
 *       404:
 *         description: Promo tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', verifyToken, requireAdmin, deletePromo);

export default router;
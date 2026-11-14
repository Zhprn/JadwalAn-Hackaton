import { Router } from 'express';
import {
  registerCustomer,
  loginCustomer,
  logoutCustomer,
  getMe,
  updateMe,
  refreshCustomerToken,
  changeCustomerPassword,
  listCustomers,
  getCustomerById,
  createCustomerByAdmin,
  updateCustomerByAdmin,
  recalcCustomer,
  resetCustomerPassword,
} from '../controllers/customer.controller';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { verifyToken, requireCustomer, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/customers/register:
 *   post:
 *     summary: Pendaftaran Pelanggan Baru
 *     tags: [Customer Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, whatsapp, password]
 *             properties:
 *               name:
 *                 type: string
 *               whatsapp:
 *                 type: string
 *                 description: Nomor WhatsApp (contoh 08123456789)
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Pelanggan berhasil mendaftar
 *       400:
 *         description: Nomor WhatsApp sudah terdaftar
 */
router.post('/register', registerCustomer);

/**
 * @openapi
 * /api/customers/login:
 *   post:
 *     summary: Login Pelanggan
 *     tags: [Customer Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [whatsapp, password]
 *             properties:
 *               whatsapp:
 *                 type: string
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Berhasil login, mengembalikan accessToken
 *       401:
 *         description: Kredensial salah
 */
router.post('/login', loginRateLimiter, loginCustomer);

/**
 * @openapi
 * /api/customers/logout:
 *   post:
 *     summary: Logout Pelanggan
 *     tags: [Customer Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil logout
 */
router.post('/logout', verifyToken, requireCustomer, logoutCustomer);

/**
 * @openapi
 * /api/customers/me:
 *   get:
 *     summary: Dapatkan profil pelanggan (Jadwal Saya / Profil)
 *     tags: [Customer Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data profil dan statistik pelanggan
 */
router.get('/me', verifyToken, requireCustomer, getMe);

/**
 * @openapi
 * /api/customers/me:
 *   put:
 *     summary: Ubah profil pelanggan (Nama / WhatsApp)
 *     tags: [Customer Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               whatsapp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil berhasil diperbarui
 */
router.put('/me', verifyToken, requireCustomer, updateMe);

/**
 * @openapi
 * /api/customers/refresh:
 *   post:
 *     summary: Perbarui access token pelanggan
 *     tags: [Customer Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200: { description: Token baru }
 */
router.post('/refresh', refreshCustomerToken);

/**
 * @openapi
 * /api/customers/me/password:
 *   put:
 *     summary: Ganti password pelanggan
 *     tags: [Customer Auth]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string }
 *               newPassword: { type: string, minLength: 6 }
 *     responses:
 *       200: { description: Password diubah }
 */
router.put('/me/password', verifyToken, requireCustomer, changeCustomerPassword);

// ------------------------- Admin (CRM) -------------------------

/**
 * @openapi
 * /api/customers:
 *   get:
 *     summary: Daftar pelanggan (admin)
 *     tags: [Customer Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: search, schema: { type: string }, description: Nama atau nomor WA }
 *       - { in: query, name: tier, schema: { type: string, enum: [regular, loyal, vip] } }
 *       - { in: query, name: tag, schema: { type: string } }
 *       - { in: query, name: inactiveDays, schema: { type: integer }, description: Tidak main ≥ N hari }
 *       - { in: query, name: sort, schema: { type: string, enum: [newest, lastPlayed, totalSpent, totalSessions, name] } }
 *       - { in: query, name: page, schema: { type: integer } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200: { description: Daftar pelanggan + meta paginasi }
 *   post:
 *     summary: Tambah pelanggan (admin, mis. walk-in)
 *     tags: [Customer Admin]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, whatsapp]
 *             properties:
 *               name: { type: string }
 *               whatsapp: { type: string, example: "08123456789" }
 *               password: { type: string, description: Kosongkan untuk password acak }
 *               notes: { type: string }
 *     responses:
 *       201: { description: Pelanggan dibuat }
 */
router.get('/', verifyToken, requireAdmin, listCustomers);
router.post('/', verifyToken, requireAdmin, createCustomerByAdmin);

/**
 * @openapi
 * /api/customers/{id}:
 *   get:
 *     summary: Detail pelanggan + riwayat booking (admin)
 *     tags: [Customer Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Detail pelanggan }
 *   patch:
 *     summary: Ubah data CRM pelanggan (tier, tags, catatan, opt-out promo)
 *     tags: [Customer Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               whatsapp: { type: string }
 *               tier: { type: string, enum: [regular, loyal, vip] }
 *               tags: { type: array, items: { type: string } }
 *               notes: { type: string }
 *               optOutPromo: { type: boolean }
 *     responses:
 *       200: { description: Pelanggan diperbarui }
 */
router.get('/:id', verifyToken, requireAdmin, getCustomerById);
router.patch('/:id', verifyToken, requireAdmin, updateCustomerByAdmin);

/**
 * @openapi
 * /api/customers/{id}/recalculate:
 *   post:
 *     summary: Hitung ulang statistik & tier pelanggan (admin)
 *     tags: [Customer Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Statistik diperbarui }
 */
router.post('/:id/recalculate', verifyToken, requireAdmin, recalcCustomer);

/**
 * @openapi
 * /api/customers/{id}/reset-password:
 *   post:
 *     summary: Reset password pelanggan ke password sementara (admin)
 *     tags: [Customer Admin]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Password sementara }
 */
router.post('/:id/reset-password', verifyToken, requireAdmin, resetCustomerPassword);

export default router;
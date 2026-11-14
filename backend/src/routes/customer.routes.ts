import { Router } from 'express';
import { registerCustomer, loginCustomer, logoutCustomer, getMe, updateMe } from '../controllers/customer.controller';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { verifyToken, requireCustomer } from '../middlewares/authMiddleware';

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

export default router;
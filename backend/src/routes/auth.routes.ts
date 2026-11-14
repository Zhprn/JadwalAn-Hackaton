import { Router } from 'express';
import {
  registerAdmin,
  loginAdmin,
  refreshToken,
  logoutAdmin,
  getMe,
  updateMe,
  changePassword,
  listAdmins,
  setAdminStatus,
} from '../controllers/auth.controller';
import { loginRateLimiter } from '../middlewares/rateLimiter';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/auth/register:
 *   post:
 *     summary: Mendaftarkan admin baru (Membutuhkan token admin yang sudah ada)
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       201:
 *         description: Admin berhasil didaftarkan
 */
router.post('/register', verifyToken, requireAdmin, registerAdmin);

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     summary: Login Admin
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Berhasil login, mengembalikan accessToken & refreshToken
 *       401:
 *         description: Kredensial salah
 *       429:
 *         description: Terlalu banyak percobaan gagal (Rate limited)
 */
router.post('/login', loginRateLimiter, loginAdmin);

/**
 * @openapi
 * /api/auth/refresh:
 *   post:
 *     summary: Perbarui Access Token
 *     tags: [Admin Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Berhasil memperbarui token
 *       403:
 *         description: Refresh token tidak valid atau kadaluarsa
 */
router.post('/refresh', refreshToken);

/**
 * @openapi
 * /api/auth/logout:
 *   post:
 *     summary: Logout Admin
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Berhasil logout
 */
router.post('/logout', verifyToken, requireAdmin, logoutAdmin);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     summary: Dapatkan profil admin yang sedang login
 *     tags: [Admin Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Data profil admin
 */
router.get('/me', verifyToken, requireAdmin, getMe);

/**
 * @openapi
 * /api/auth/edit:
 *   put:
 *     summary: Ubah profil admin (Nama & Email)
 *     tags: [Admin Auth]
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
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profil berhasil diperbarui
 */
router.put('/edit', verifyToken, requireAdmin, updateMe);

/**
 * @openapi
 * /api/auth/password:
 *   put:
 *     summary: Ganti password admin
 *     tags: [Admin Auth]
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
router.put('/password', verifyToken, requireAdmin, changePassword);

/**
 * @openapi
 * /api/auth/admins:
 *   get:
 *     summary: Daftar semua admin
 *     tags: [Admin Auth]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Daftar admin }
 */
router.get('/admins', verifyToken, requireAdmin, listAdmins);

/**
 * @openapi
 * /api/auth/admins/{id}/status:
 *   patch:
 *     summary: Aktifkan / nonaktifkan admin
 *     tags: [Admin Auth]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isActive]
 *             properties:
 *               isActive: { type: boolean }
 *     responses:
 *       200: { description: Status admin diubah }
 */
router.patch('/admins/:id/status', verifyToken, requireAdmin, setAdminStatus);

export default router;
import { Router } from 'express';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Cek status server
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server berjalan
 */
router.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

// Daftarkan router fitur di sini, contoh:
// router.use('/auth', authRoutes);

export default router;

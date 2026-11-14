import { Router } from 'express';
import stationRoutes from './station.routes';
import promoRoutes from './promo.routers';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Cek status API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server sehat
 */
router.get('/health', (req, res) => {
  res.json({ success: true, message: 'Backend berjalan!' });
});

// Mounting master data routes
router.use('/stations', stationRoutes);
router.use('/promos', promoRoutes);

export default router;
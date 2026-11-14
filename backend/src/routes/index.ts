import { Router } from 'express';
import authRoutes from './auth.routes';
import customerRoutes from './customer.routes';
import stationRoutes from './station.routes';
import promoRoutes from './promo.routes';
import settingRoutes from './setting.routes';
import bookingRoutes from './booking.routes';
import paymentRoutes from './payment.routes';
import chatRoutes from './chat.routes';
import aiRoutes from './ai.routes';
import promoMessageRoutes from './promoMessage.routes';
import dashboardRoutes from './dashboard.routes';
import reviewRoutes from './review.routes';
import systemRoutes from './system.routes';
import { isAiConfigured } from '../services/ai/gemini';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Cek status API, database, AI, dan Midtrans
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server sehat
 */
router.get('/health', async (_req, res) => {
  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }
  res.status(database === 'ok' ? 200 : 503).json({
    success: database === 'ok',
    message: 'Backend berjalan!',
    data: {
      database,
      ai: isAiConfigured() ? 'configured' : 'missing GEMINI_API_KEY',
      midtrans: process.env.MIDTRANS_SERVER_KEY ? 'configured' : 'missing MIDTRANS_SERVER_KEY',
      time: new Date().toISOString(),
    },
  });
});

router.use('/auth', authRoutes);
router.use('/customers', customerRoutes);
router.use('/stations', stationRoutes);
router.use('/promos', promoRoutes);
router.use('/settings', settingRoutes);
router.use('/bookings', bookingRoutes);
router.use('/payments', paymentRoutes);
router.use('/chat', chatRoutes);
router.use('/ai', aiRoutes);
router.use('/promo-messages', promoMessageRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reviews', reviewRoutes);
router.use('/', systemRoutes); // /notifications, /activity-logs

export default router;

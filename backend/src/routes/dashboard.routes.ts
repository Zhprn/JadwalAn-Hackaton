import { Router } from 'express';
import { summary, revenueChart, peakHours, stationUtilization, topCustomers, metrics } from '../controllers/dashboard.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();
router.use(verifyToken, requireAdmin);

/**
 * @openapi
 * /api/dashboard/summary:
 *   get:
 *     summary: Ringkasan hari ini (pendapatan, okupansi, booking mendatang, sedang main, chat)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: date, schema: { type: string } }
 *     responses:
 *       200: { description: Ringkasan }
 * /api/dashboard/revenue:
 *   get:
 *     summary: Grafik pendapatan & booking per hari
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, default: 7 } }
 *     responses:
 *       200: { description: Data grafik }
 * /api/dashboard/peak-hours:
 *   get:
 *     summary: Heatmap jam ramai (hari × jam)
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, default: 30 } }
 *     responses:
 *       200: { description: Heatmap }
 * /api/dashboard/stations:
 *   get:
 *     summary: Utilisasi & pendapatan per unit
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, default: 30 } }
 *     responses:
 *       200: { description: Per unit }
 * /api/dashboard/top-customers:
 *   get:
 *     summary: Pelanggan dengan belanja terbesar
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, default: 30 } }
 *       - { in: query, name: limit, schema: { type: integer, default: 10 } }
 *     responses:
 *       200: { description: Top pelanggan }
 * /api/dashboard/metrics:
 *   get:
 *     summary: Data tabel Metric harian
 *     tags: [Dashboard]
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - { in: query, name: from, schema: { type: string } }
 *       - { in: query, name: to, schema: { type: string } }
 *     responses:
 *       200: { description: Metrik }
 */
router.get('/summary', summary);
router.get('/revenue', revenueChart);
router.get('/peak-hours', peakHours);
router.get('/stations', stationUtilization);
router.get('/top-customers', topCustomers);
router.get('/metrics', metrics);

export default router;

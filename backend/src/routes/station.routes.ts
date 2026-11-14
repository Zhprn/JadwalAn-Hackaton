import { Router } from 'express';
import { getAllStations, getStationById, createStation, updateStation, deleteStation } from '../controllers/station.controller';
import { verifyToken, requireAdmin } from '../middlewares/authMiddleware';

const router = Router();

/**
 * @openapi
 * /api/stations:
 *   get:
 *     summary: Mendapatkan daftar unit PlayStation
 *     tags: [Stations]
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [PS5, PS4]
 *         description: Filter berdasarkan kategori (misal PS5 atau PS4)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, maintenance, inactive]
 *         description: Filter berdasarkan status unit
 *     responses:
 *       200:
 *         description: Berhasil mengambil data
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
 *                       name:
 *                         type: string
 *                       category:
 *                         type: string
 *                       status:
 *                         type: string
 *                       pricePerHour:
 *                         type: integer
 *                       maxPlayers:
 *                         type: integer
 *                       games:
 *                         type: array
 *                         items:
 *                           type: string
 *                       sortOrder:
 *                         type: integer
 *       500:
 *         description: Internal server error
 */
router.get('/', getAllStations);

/**
 * @openapi
 * /api/stations/{id}:
 *   get:
 *     summary: Mendapatkan detail satu unit PS
 *     tags: [Stations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID unit PlayStation
 *     responses:
 *       200:
 *         description: Data unit ditemukan
 *       404:
 *         description: Unit tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.get('/:id', getStationById);

/**
 * @openapi
 * /api/stations:
 *   post:
 *     summary: Menambahkan unit PS baru
 *     tags: [Stations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, pricePerHour]
 *             properties:
 *               name:
 *                 type: string
 *                 example: "PS5 - TV 1"
 *               category:
 *                 type: string
 *                 example: "PS5"
 *               pricePerHour:
 *                 type: integer
 *                 example: 15000
 *               status:
 *                 type: string
 *                 enum: [active, maintenance, inactive]
 *                 default: active
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               maxPlayers:
 *                 type: integer
 *                 default: 2
 *               games:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["FC 24", "Tekken 8"]
 *               sortOrder:
 *                 type: integer
 *                 default: 0
 *     responses:
 *       201:
 *         description: Unit berhasil ditambahkan
 *       400:
 *         description: Validasi input gagal
 *       401:
 *         description: Unauthorized (Token tidak ada/tidak valid)
 *       403:
 *         description: Forbidden (Bukan admin)
 *       500:
 *         description: Internal server error
 */
router.post('/', verifyToken, requireAdmin, createStation);

/**
 * @openapi
 * /api/stations/{id}:
 *   put:
 *     summary: Mengubah data unit PS
 *     tags: [Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID unit yang akan diubah
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, pricePerHour]
 *             properties:
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               pricePerHour:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [active, maintenance, inactive]
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 format: uri
 *               maxPlayers:
 *                 type: integer
 *               games:
 *                 type: array
 *                 items:
 *                   type: string
 *               sortOrder:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Unit berhasil diubah
 *       400:
 *         description: Validasi input gagal
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Bukan admin)
 *       404:
 *         description: Unit tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.put('/:id', verifyToken, requireAdmin, updateStation);

/**
 * @openapi
 * /api/stations/{id}:
 *   delete:
 *     summary: Menghapus unit PS
 *     tags: [Stations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID unit yang akan dihapus
 *     responses:
 *       200:
 *         description: Unit berhasil dihapus
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Bukan admin)
 *       404:
 *         description: Unit tidak ditemukan
 *       500:
 *         description: Internal server error
 */
router.delete('/:id', verifyToken, requireAdmin, deleteStation);

export default router;
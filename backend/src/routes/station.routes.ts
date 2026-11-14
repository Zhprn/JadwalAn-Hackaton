import { Router } from 'express';
import { getAllStations, getStationById, createStation, updateStation, deleteStation } from '../controllers/station.controller';

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
 *         description: Filter berdasarkan kategori (misal PS5)
 *     responses:
 *       200:
 *         description: Berhasil mengambil data
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
 */
// TODO: Tambahkan middleware otentikasi admin di sini
router.post('/', createStation);

/**
 * @openapi
 * /api/stations/{id}:
 *   put:
 *     summary: Mengubah data unit PS
 *     tags: [Stations]
 *     security:
 *       - bearerAuth: []
 */
// TODO: Tambahkan middleware otentikasi admin di sini
router.put('/:id', updateStation);

/**
 * @openapi
 * /api/stations/{id}:
 *   delete:
 *     summary: Menghapus unit PS
 *     tags: [Stations]
 *     security:
 *       - bearerAuth: []
 */
// TODO: Tambahkan middleware otentikasi admin di sini
router.delete('/:id', deleteStation);

export default router;
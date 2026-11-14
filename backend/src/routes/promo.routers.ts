import { Router } from 'express';
import { getAllPromos, getPromoById, createPromo, updatePromo, deletePromo } from '../controllers/promo.controller';

const router = Router();

/**
 * @openapi
 * /api/promos:
 *   get:
 *     summary: Mendapatkan daftar promo
 *     tags: [Promos]
 */
router.get('/', getAllPromos);

/**
 * @openapi
 * /api/promos/{id}:
 *   get:
 *     summary: Mendapatkan detail promo
 *     tags: [Promos]
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
 */
router.post('/', createPromo);

/**
 * @openapi
 * /api/promos/{id}:
 *   put:
 *     summary: Mengubah data promo
 *     tags: [Promos]
 *     security:
 *       - bearerAuth: []
 */
router.put('/:id', updatePromo);

/**
 * @openapi
 * /api/promos/{id}:
 *   delete:
 *     summary: Menghapus promo
 *     tags: [Promos]
 *     security:
 *       - bearerAuth: []
 */
router.delete('/:id', deletePromo);

export default router;
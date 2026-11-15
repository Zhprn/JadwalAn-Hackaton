import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { HttpError, param } from '../lib/http';
import { logActivity } from '../lib/activity';
import { AuthRequest } from '../middlewares/authMiddleware';
import {
  ALLOWED_MIME,
  CAPTION_TONES,
  PLATFORMS,
  deletePosterCaption,
  generatePosterCaption,
  listPosterCaptions,
  regeneratePosterCaption,
  savePosterImage,
} from '../services/ai/copywriter';

const MAX_MB = 5;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new HttpError(400, 'Format gambar harus JPG, PNG, atau WebP'));
  },
}).single('image');

/** Middleware upload poster; error multer diubah jadi pesan yang jelas. */
export const posterUpload = (req: Request, res: Response, next: NextFunction) =>
  upload(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      return next(new HttpError(400, err.code === 'LIMIT_FILE_SIZE' ? `Ukuran gambar maksimal ${MAX_MB} MB` : `Upload gagal: ${err.message}`));
    }
    next(err);
  });

const optionsSchema = z.object({
  platform: z.enum(PLATFORMS).default('instagram'),
  tone: z.enum(CAPTION_TONES).default('friendly'),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
});

/** POST /ai/copywriter/poster (multipart: image, platform, tone, notes) */
export const posterCaption = async (req: AuthRequest, res: Response): Promise<any> => {
  const file = (req as Request).file;
  if (!file) throw new HttpError(400, 'Unggah gambar poster/flyer terlebih dahulu (field "image")');
  const input = optionsSchema.parse(req.body ?? {});
  const imageUrl = await savePosterImage(file.buffer, file.mimetype);
  const result = await generatePosterCaption({ image: file.buffer, mimeType: file.mimetype, imageUrl, ...input });
  await logActivity('ai.poster_caption', 'AiInsight', result.id, { platform: input.platform, tone: input.tone }, req.user?.id);
  res.status(201).json({ success: true, data: result });
};

/** POST /ai/copywriter/history/:id/regenerate { platform?, tone?, notes? } */
export const regeneratePoster = async (req: AuthRequest, res: Response): Promise<any> => {
  const input = z
    .object({
      platform: z.enum(PLATFORMS).optional(),
      tone: z.enum(CAPTION_TONES).optional(),
      notes: z.string().trim().max(500).nullable().optional(),
    })
    .parse(req.body ?? {});
  const result = await regeneratePosterCaption(param(req, 'id'), input);
  res.status(201).json({ success: true, data: result });
};

/** GET /ai/copywriter/history */
export const posterHistory = async (req: AuthRequest, res: Response): Promise<any> => {
  const { limit } = z.object({ limit: z.coerce.number().int().min(1).max(50).default(20) }).parse(req.query);
  res.json({ success: true, data: await listPosterCaptions(limit) });
};

/** DELETE /ai/copywriter/history/:id */
export const removePosterCaption = async (req: AuthRequest, res: Response): Promise<any> => {
  await deletePosterCaption(param(req, 'id'));
  res.json({ success: true, message: 'Riwayat caption dihapus' });
};

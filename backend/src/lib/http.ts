import { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

/** Error yang sengaja dilempar dengan status HTTP tertentu. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
export const notFound = (msg = 'Data tidak ditemukan') => new HttpError(404, msg);
export const forbidden = (msg = 'Akses terlarang') => new HttpError(403, msg);
export const conflict = (msg: string) => new HttpError(409, msg);

/** Ubah error apa pun menjadi respons JSON yang konsisten: { success: false, message, errors? }. */
export const handleError = (res: Response, error: any): any => {
  if (error instanceof z.ZodError) {
    const first = error.issues[0];
    const message = first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Input tidak valid';
    return res.status(400).json({ success: false, message, errors: error.issues });
  }
  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, message: error.message, errors: error.details });
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Data tidak ditemukan' });
    if (error.code === 'P2002') {
      const target = (error.meta as any)?.target;
      return res.status(409).json({ success: false, message: `Data duplikat pada kolom ${String(target ?? '')}` });
    }
    if (error.code === 'P2003') return res.status(400).json({ success: false, message: 'Relasi data tidak valid' });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Body JSON tidak valid' });
  }
  console.error(error);
  return res.status(500).json({ success: false, message: error?.message || 'Terjadi kesalahan server' });
};

/** Error handler global (Express 5 meneruskan error dari handler async ke sini secara otomatis). */
export const errorMiddleware = (err: any, _req: Request, res: Response, _next: NextFunction): any =>
  handleError(res, err);

export const notFoundMiddleware = (req: Request, res: Response): any =>
  res.status(404).json({ success: false, message: `Endpoint ${req.method} ${req.originalUrl} tidak ditemukan` });

/** Ambil route param sebagai string (di Express 5 tipenya string | string[]). */
export const param = (req: Request, name: string): string => {
  const v = (req.params as Record<string, unknown>)[name];
  return Array.isArray(v) ? String(v[0]) : String(v ?? '');
};

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const paginate = (query: unknown) => {
  const { page, limit } = paginationSchema.parse(query);
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

export const pageMeta = (page: number, limit: number, total: number) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

/** Query boolean dari string "true"/"false". */
export const queryBool = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

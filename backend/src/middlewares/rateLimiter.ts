import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 Menit

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction): any => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown-ip';
  const record = loginAttempts.get(ip);

  if (record && record.lockedUntil && record.lockedUntil > Date.now()) {
    const timeLeft = Math.ceil((record.lockedUntil - Date.now()) / 1000 / 60);
    return res.status(429).json({ 
      success: false, 
      message: `Terlalu banyak percobaan login gagal. Coba lagi dalam ${timeLeft} menit.` 
    });
  }

  if (record && record.lockedUntil && record.lockedUntil <= Date.now()) {
    loginAttempts.delete(ip);
  }

  next();
};

export const recordFailedLogin = (ip: string) => {
  const record = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  record.count += 1;
  if (record.count >= MAX_ATTEMPTS) {
    record.lockedUntil = Date.now() + LOCK_TIME_MS;
  }
  loginAttempts.set(ip, record);
};

export const resetLoginAttempts = (ip: string) => {
  loginAttempts.delete(ip);
};

/**
 * Rate limiter jendela tetap (in-memory) untuk endpoint umum, mis. chat AI.
 * Kunci default: id user jika login, selain itu IP.
 */
export const createRateLimiter = (opts: { windowMs: number; max: number; message?: string }) => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  // Bersihkan entri kedaluwarsa secara berkala agar Map tidak membengkak.
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, opts.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction): any => {
    const key = (req as any).user?.id || req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const rec = hits.get(key);
    if (!rec || rec.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }
    rec.count += 1;
    if (rec.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((rec.resetAt - now) / 1000));
      return res.status(429).json({ success: false, message: opts.message ?? 'Terlalu banyak permintaan, coba lagi sebentar lagi.' });
    }
    next();
  };
};

/** Maks 20 pesan chat per menit per pengguna. */
export const chatRateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 20,
  message: 'Kamu mengirim pesan terlalu cepat. Tunggu sebentar ya.',
});

/** Fitur AI admin (generate promo/insight) maks 30 per menit. */
export const aiRateLimiter = createRateLimiter({ windowMs: 60_000, max: 30 });
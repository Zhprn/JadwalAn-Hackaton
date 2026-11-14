import { Request, Response, NextFunction } from 'express';

const MAX_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000;

const loginAttempts = new Map<string, { count: number; lockedUntil?: number }>();

export const loginRateLimiter = (req: Request, res: Response, next: NextFunction): any => {
  const ip = req.ip ?? 'unknown';
  const entry = loginAttempts.get(ip);

  if (entry?.lockedUntil && entry.lockedUntil > Date.now()) {
    const minutes = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    return res.status(429).json({ error: `Terlalu banyak percobaan login. Coba lagi dalam ${minutes} menit.` });
  }
  if (entry?.lockedUntil) loginAttempts.delete(ip);

  next();
};

export const recordFailedLogin = (ip: string) => {
  const entry = loginAttempts.get(ip) ?? { count: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) entry.lockedUntil = Date.now() + LOCK_TIME_MS;
  loginAttempts.set(ip, entry);
};

export const resetLoginAttempts = (ip: string) => {
  loginAttempts.delete(ip);
};

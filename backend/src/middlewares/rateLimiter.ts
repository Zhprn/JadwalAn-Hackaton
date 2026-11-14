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
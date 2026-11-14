import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const tokenBlacklist = new Set<string>();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    role: string;
    [key: string]: any;
  };
}

export const verifyToken = (req: AuthRequest, res: Response, next: NextFunction): any => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Akses ditolak. Token tidak ditemukan.' });
  }

  const token = authHeader.split(' ')[1];

  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ success: false, message: 'Token sudah tidak valid (logout).' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token tidak valid atau kadaluarsa.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): any => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Akses terlarang. Membutuhkan role ADMIN.' });
  }
  next();
};

export const requireCustomer = (req: AuthRequest, res: Response, next: NextFunction): any => {
  if (req.user?.role !== 'CUSTOMER') {
    return res.status(403).json({ success: false, message: 'Akses terlarang. Membutuhkan role CUSTOMER.' });
  }
  next();
};
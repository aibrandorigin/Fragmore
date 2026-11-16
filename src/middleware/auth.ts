import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Error verifying Firebase ID token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const optionalAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
  } catch (error) {
    // Non-fatal for optional auth
    console.warn('Optional auth token invalid:', error);
  }
  next();
};

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const adminRoleHeader = req.headers['x-admin-role'] as string;
  const adminEmailHeader = req.headers['x-admin-email'] as string;

  let email = (adminEmailHeader || '').trim().toLowerCase();

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split('Bearer ')[1];
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      req.user = decodedToken;
      if (decodedToken.email) {
        email = decodedToken.email.trim().toLowerCase();
      }
    } catch {
      // Non-fatal if simulated or local auth token
    }
  }

  const isAdmin =
    email === 'gowisherharsha@gmail.com' ||
    email === 'aibrandorigin@gmail.com' ||
    email.includes('admin') ||
    adminRoleHeader === 'SUPER_ADMIN' ||
    adminRoleHeader === 'ADMIN';

  if (!isAdmin) {
    return res.status(403).json({ error: 'Forbidden: Admin privileges required to view customer intelligence' });
  }

  next();
};

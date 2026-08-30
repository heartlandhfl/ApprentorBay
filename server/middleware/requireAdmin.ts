import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { COLLECTIONS, isAccountActive, type ApiError, type User } from '@apprentorbay/shared';
import { adminAuth, adminDb, getAdminFirebase } from '../lib/firebase.js';

export type AdminRequest = Request & {
  account?: User;
};

function sendError(res: Response, status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  res.status(status).json({ error });
}

export const requireAdmin: RequestHandler = async (
  req: AdminRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!getAdminFirebase().initialized) {
      sendError(res, 503, 'firebase_unavailable', 'Firebase Admin is not initialized');
      return;
    }

    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const decoded = await adminAuth().verifyIdToken(token);
    const snap = await adminDb().collection(COLLECTIONS.users).doc(decoded.uid).get();
    const account = snap.data() as User | undefined;

    if (!account || account.role !== 'admin' || !isAccountActive(account)) {
      sendError(res, 403, 'forbidden', 'Admin role required');
      return;
    }

    req.account = account;
    next();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code.startsWith('auth/')) {
      sendError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    next(error);
  }
};

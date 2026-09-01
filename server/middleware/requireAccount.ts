import type { NextFunction, Request, RequestHandler, Response } from 'express';
import {
  ACCOUNT_STATUS,
  COLLECTIONS,
  accountStatusOf,
  isAccountActive,
  type ApiError,
  type User,
} from '@apprentorbay/shared';
import { adminAuth, adminDb, getAdminFirebase } from '../lib/firebase.js';

export type AccountRequest = Request & {
  account?: User;
};

export function sendApiError(res: Response, status: number, code: string, message: string) {
  const error: ApiError = { code, message };
  res.status(status).json({ error });
}

export const requireAccount: RequestHandler = async (
  req: AccountRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!getAdminFirebase().initialized) {
      sendApiError(res, 503, 'firebase_unavailable', 'Firebase Admin is not initialized');
      return;
    }

    const header = req.header('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const decoded = await adminAuth().verifyIdToken(token);
    const snap = await adminDb().collection(COLLECTIONS.users).doc(decoded.uid).get();
    const account = snap.data() as User | undefined;

    if (!account) {
      sendApiError(res, 403, 'forbidden', 'No user document');
      return;
    }
    if (!isAccountActive(account)) {
      const status = accountStatusOf(account);
      sendApiError(
        res,
        403,
        status === ACCOUNT_STATUS.terminated ? 'terminated' : 'suspended',
        status === ACCOUNT_STATUS.terminated
          ? 'This account has been terminated.'
          : 'This account has been suspended.',
      );
      return;
    }

    req.account = account;
    next();
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code.startsWith('auth/')) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    next(error);
  }
};

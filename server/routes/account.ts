import { Router } from 'express';
import {
  COLLECTIONS,
  buildTermsAcceptance,
  isAccountActive,
  validateSignupTermsAcceptance,
} from '@apprentorbay/shared';
import { adminAuth, adminDb, getAdminFirebase } from '../lib/firebase.js';
import { hydrateAccountFromOperator } from '../lib/seedAdmin.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const accountRouter = Router();

accountRouter.post('/session', async (req, res, next) => {
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
    const account = await hydrateAccountFromOperator({
      uid: decoded.uid,
      email: decoded.email,
      displayName: decoded.name,
    });
    if (!account) {
      sendApiError(res, 403, 'forbidden', 'No user document');
      return;
    }
    if (!isAccountActive(account)) {
      sendApiError(res, 403, 'suspended', 'This account has been suspended.');
      return;
    }

    res.json({ account });
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code.startsWith('auth/')) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }
    next(error);
  }
});

accountRouter.post('/terms', requireAccount, async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const check = validateSignupTermsAcceptance({
      accepted: req.body?.accepted === true,
    });
    if (!check.ok) {
      sendApiError(res, 400, 'terms_required', check.error ?? 'Terms acceptance is required');
      return;
    }

    const acceptance = buildTermsAcceptance(new Date().toISOString());
    await adminDb().collection(COLLECTIONS.users).doc(account.uid).set(acceptance, { merge: true });
    res.json({ acceptance });
  } catch (error) {
    next(error);
  }
});

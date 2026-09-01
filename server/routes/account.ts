import { Router } from 'express';
import {
  COLLECTIONS,
  buildTermsAcceptance,
  validateSignupTermsAcceptance,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const accountRouter = Router();

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

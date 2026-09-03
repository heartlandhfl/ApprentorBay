import { Router } from 'express';
import { REFUND_REASON, canRequestRefund } from '@apprentorbay/shared';
import { paymentService } from '../lib/payments/paymentService.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';
import { adminDb } from '../lib/firebase.js';
import { COLLECTIONS, normalizePaymentIntent, type PaymentIntent } from '@apprentorbay/shared';

export const refundsRouter = Router();

refundsRouter.use(requireAccount);

refundsRouter.post('/', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const paymentIntentId =
      typeof req.body?.paymentIntentId === 'string' ? req.body.paymentIntentId.trim() : '';
    if (!paymentIntentId) {
      sendApiError(res, 400, 'invalid', 'paymentIntentId is required');
      return;
    }

    const snap = await adminDb().collection(COLLECTIONS.paymentIntents).doc(paymentIntentId).get();
    if (!snap.exists) {
      sendApiError(res, 404, 'not_found', 'Payment intent not found');
      return;
    }
    const intent = normalizePaymentIntent({
      ...(snap.data() as PaymentIntent),
      id: snap.id,
    });

    if (!canRequestRefund(account, intent)) {
      sendApiError(res, 403, 'forbidden', 'You cannot refund this payment');
      return;
    }

    const idempotencyKey =
      req.header('Idempotency-Key')?.trim() || `refund-${paymentIntentId}-${account.uid}`;
    const refund = await paymentService.createRefund({
      paymentIntentId,
      requestedBy: account.uid,
      reason: REFUND_REASON.admin,
      idempotencyKey,
    });

    res.status(201).json({ refund });
  } catch (error) {
    next(error);
  }
});

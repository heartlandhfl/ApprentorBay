import { Router } from 'express';
import {
  COLLECTIONS,
  canReadPaymentIntent,
  canStartCheckout,
  normalizeCheckoutSession,
  normalizeMentorshipBooking,
  normalizePaymentIntent,
  validateCreateCheckoutBody,
  type CheckoutSession,
  type MentorshipBooking,
  type PaymentIntent,
} from '@apprentorbay/shared';
import { adminDb } from '../lib/firebase.js';
import { paymentService } from '../lib/payments/paymentService.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const paymentsRouter = Router();

paymentsRouter.use(requireAccount);

async function loadBooking(bookingId: string) {
  const snap = await adminDb().collection(COLLECTIONS.bookings).doc(bookingId).get();
  if (!snap.exists) return null;
  return normalizeMentorshipBooking({
    ...(snap.data() as MentorshipBooking),
    id: snap.id,
  });
}

async function loadPaymentIntent(paymentIntentId: string) {
  const snap = await adminDb().collection(COLLECTIONS.paymentIntents).doc(paymentIntentId).get();
  if (!snap.exists) return null;
  return normalizePaymentIntent({
    ...(snap.data() as PaymentIntent),
    id: snap.id,
  });
}

function idempotencyKeyFromRequest(req: AccountRequest): string {
  const header = req.header('Idempotency-Key')?.trim();
  if (header) return header.slice(0, 128);
  return `checkout-${req.account?.uid ?? 'anon'}-${Date.now()}`;
}

paymentsRouter.post('/checkout', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const parsed = validateCreateCheckoutBody(req.body);
    if (!parsed.ok) {
      sendApiError(res, 400, 'invalid', parsed.error);
      return;
    }

    const booking = await loadBooking(parsed.bookingId!);
    if (!booking) {
      sendApiError(res, 404, 'not_found', 'Booking not found');
      return;
    }

    if (!canStartCheckout(account, booking)) {
      sendApiError(res, 403, 'forbidden', 'You cannot start checkout for this booking');
      return;
    }

    const result = await paymentService.createCheckout({
      booking,
      learnerId: account.uid,
      idempotencyKey: idempotencyKeyFromRequest(req),
    });

    res.status(201).json({
      paymentIntentId: result.paymentIntent.id,
      checkoutSessionId: result.checkoutSession.id,
      checkoutUrl: result.checkoutUrl,
      status: result.paymentIntent.status,
    });
  } catch (error) {
    next(error);
  }
});

paymentsRouter.get('/intents/:id', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const intent = await loadPaymentIntent(String(req.params.id ?? ''));
    if (!intent) {
      sendApiError(res, 404, 'not_found', 'Payment intent not found');
      return;
    }

    if (!canReadPaymentIntent(account, intent)) {
      sendApiError(res, 403, 'forbidden', 'You cannot view this payment');
      return;
    }

    res.json({
      paymentIntent: intent,
      authoritative: intent.status === 'paid',
      message:
        intent.status === 'paid'
          ? 'Payment confirmed server-side'
          : 'Status may update after webhook processing',
    });
  } catch (error) {
    next(error);
  }
});

/** Non-authoritative return handler — never marks a payment paid. */
paymentsRouter.get('/return', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const sessionId = typeof req.query.session_id === 'string' ? req.query.session_id.trim() : '';
    if (!sessionId) {
      sendApiError(res, 400, 'invalid', 'session_id is required');
      return;
    }

    const snap = await adminDb()
      .collection(COLLECTIONS.checkoutSessions)
      .where('providerCheckoutSessionId', '==', sessionId)
      .limit(1)
      .get();
    if (snap.empty) {
      sendApiError(res, 404, 'not_found', 'Checkout session not found');
      return;
    }

    const checkoutSession = normalizeCheckoutSession({
      ...(snap.docs[0].data() as CheckoutSession),
      id: snap.docs[0].id,
    });
    const intent = await loadPaymentIntent(checkoutSession.paymentIntentId);
    if (!intent || !canReadPaymentIntent(account, intent)) {
      sendApiError(res, 403, 'forbidden', 'You cannot view this payment return');
      return;
    }

    res.json({
      checkoutSession,
      paymentIntent: intent,
      authoritative: false,
      message: 'Return URL is not authoritative. Await verified server payment confirmation.',
    });
  } catch (error) {
    next(error);
  }
});

/** Non-authoritative cancel handler — never marks a payment paid. */
paymentsRouter.get('/cancel', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const bookingId = typeof req.query.bookingId === 'string' ? req.query.bookingId.trim() : '';
    if (!bookingId) {
      sendApiError(res, 400, 'invalid', 'bookingId is required');
      return;
    }

    const booking = await loadBooking(bookingId);
    if (!booking || booking.learnerId !== account.uid) {
      sendApiError(res, 403, 'forbidden', 'You cannot view this checkout cancellation');
      return;
    }

    const snap = await adminDb()
      .collection(COLLECTIONS.checkoutSessions)
      .where('bookingId', '==', bookingId)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    const checkoutSession = snap.empty
      ? null
      : normalizeCheckoutSession({
          ...(snap.docs[0].data() as CheckoutSession),
          id: snap.docs[0].id,
        });
    const intent = checkoutSession
      ? await loadPaymentIntent(checkoutSession.paymentIntentId)
      : null;

    res.json({
      booking,
      checkoutSession,
      paymentIntent: intent,
      authoritative: false,
      message: 'Checkout cancellation is not authoritative. Payment status follows verified webhooks.',
    });
  } catch (error) {
    next(error);
  }
});

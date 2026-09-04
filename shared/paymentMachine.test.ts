import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOKING_CURRENCY,
  BOOKING_PAYMENT_STATUS,
  BOOKING_SERVICE_TYPE,
  BOOKING_STATUS,
  CHECKOUT_SESSION_STATUS,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  PAYMENT_PROVIDER_ID,
  PAYMENT_STATUS,
  REFUND_STATUS,
  buildPaymentIntentFromBooking,
  buildMentorshipBooking,
  canApplyPaymentIntentAction,
  markMentorshipBookingPaid,
  normalizeMentorOfferingFields,
  reduceCheckoutSession,
  reducePaymentIntent,
  reducePaymentRefund,
  validateCreateCheckoutBody,
  validatePaymentMatchesBooking,
  type PaymentRefund,
} from './domain/index.js';

const now = '2026-09-03T18:00:00.000Z';

const offering = normalizeMentorOfferingFields({
  mentorType: MENTOR_TYPE.accomplished,
  commercialMode: COMMERCIAL_MODE.professional,
  baseSessionPriceUsd: 7500,
  sessionDurationMinutes: 60,
  serviceDescription: 'Leadership coaching',
});

const booking = buildMentorshipBooking({
  id: 'booking-1',
  relationship: {
    id: 'learner-1_mentor-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
  },
  snapshot: {
    unitPriceCents: 7500,
    currency: BOOKING_CURRENCY.usd,
    platformFeeCents: 1125,
    mentorAmountCents: 6375,
    platformFeeBps: 1500,
    commercialMode: COMMERCIAL_MODE.professional,
    mentorType: MENTOR_TYPE.accomplished,
    sessionDurationMinutes: 60,
    serviceType: BOOKING_SERVICE_TYPE.mentorshipSession,
    title: 'Leadership coaching',
  },
  now,
});

describe('payment machine', () => {
  it('marks a payment paid only from processing via webhook', () => {
    let intent = buildPaymentIntentFromBooking({
      id: 'pi-1',
      booking,
      provider: PAYMENT_PROVIDER_ID.stripe,
      idempotencyKey: 'idem-1',
      now,
    });
    intent = reducePaymentIntent(
      intent,
      {
        type: 'CHECKOUT_CREATED',
        checkoutSessionId: 'cs-1',
        providerPaymentIntentId: 'pi_stripe_1',
      },
      now,
    );
    intent = reducePaymentIntent(intent, { type: 'PROVIDER_PROCESSING' }, now);
    const paid = reducePaymentIntent(
      intent,
      { type: 'WEBHOOK_PAYMENT_SUCCEEDED', paidAt: now },
      now,
    );
    assert.equal(paid.status, PAYMENT_STATUS.paid);
    assert.equal(paid.paidAt, now);
    assert.equal(
      canApplyPaymentIntentAction(PAYMENT_STATUS.draft, 'WEBHOOK_PAYMENT_SUCCEEDED'),
      false,
    );
  });

  it('records failed payments and cancelled checkout sessions', () => {
    let intent = buildPaymentIntentFromBooking({
      id: 'pi-2',
      booking,
      provider: PAYMENT_PROVIDER_ID.stripe,
      idempotencyKey: 'idem-2',
      now,
    });
    intent = reducePaymentIntent(
      intent,
      {
        type: 'CHECKOUT_CREATED',
        checkoutSessionId: 'cs-2',
        providerPaymentIntentId: 'pi_stripe_2',
      },
      now,
    );
    const failed = reducePaymentIntent(
      intent,
      { type: 'WEBHOOK_PAYMENT_FAILED', failureCode: 'card_declined' },
      now,
    );
    assert.equal(failed.status, PAYMENT_STATUS.failed);

    const checkout = {
      id: 'cs-2',
      paymentIntentId: 'pi-2',
      bookingId: booking.id,
      learnerId: booking.learnerId,
      status: CHECKOUT_SESSION_STATUS.open,
      provider: PAYMENT_PROVIDER_ID.stripe,
      providerCheckoutSessionId: 'cs_stripe_2',
      checkoutUrl: 'https://checkout.test',
      expiresAt: now,
      idempotencyKey: 'idem-2',
      createdAt: now,
      updatedAt: now,
    };
    const expired = reduceCheckoutSession(checkout, { type: 'CHECKOUT_EXPIRED' }, now);
    assert.equal(expired.status, CHECKOUT_SESSION_STATUS.expired);
  });

  it('confirms bookings only after payment is paid', () => {
    const paidBooking = markMentorshipBookingPaid(booking, now);
    assert.equal(paidBooking.paymentStatus, BOOKING_PAYMENT_STATUS.paid);
    assert.equal(paidBooking.bookingStatus, BOOKING_STATUS.paid);
  });

  it('processes refunds from paid payments', () => {
    let intent = buildPaymentIntentFromBooking({
      id: 'pi-3',
      booking,
      provider: PAYMENT_PROVIDER_ID.stripe,
      idempotencyKey: 'idem-3',
      now,
    });
    intent = reducePaymentIntent(
      intent,
      {
        type: 'CHECKOUT_CREATED',
        checkoutSessionId: 'cs-3',
        providerPaymentIntentId: 'pi_stripe_3',
      },
      now,
    );
    intent = reducePaymentIntent(intent, { type: 'PROVIDER_PROCESSING' }, now);
    intent = reducePaymentIntent(intent, { type: 'WEBHOOK_PAYMENT_SUCCEEDED', paidAt: now }, now);

    const refund: PaymentRefund = {
      id: 'rf-1',
      paymentIntentId: intent.id,
      bookingId: booking.id,
      status: REFUND_STATUS.pending,
      amountCents: 7500,
      reason: 'admin',
      idempotencyKey: 'refund-1',
      provider: PAYMENT_PROVIDER_ID.stripe,
      providerRefundId: null,
      requestedBy: 'admin-1',
      createdAt: now,
      updatedAt: now,
      succeededAt: null,
    };
    let nextRefund = reducePaymentRefund(
      refund,
      { type: 'REFUND_SUBMITTED', providerRefundId: 're_stripe_1' },
      now,
    );
    nextRefund = reducePaymentRefund(nextRefund, { type: 'REFUND_SUCCEEDED', succeededAt: now }, now);
    const refundedIntent = reducePaymentIntent(intent, { type: 'REFUND_SUCCEEDED' }, now);
    assert.equal(nextRefund.status, REFUND_STATUS.succeeded);
    assert.equal(refundedIntent.status, PAYMENT_STATUS.refunded);
  });
});

describe('payment request tampering', () => {
  it('accepts only bookingId for checkout creation', () => {
    const valid = validateCreateCheckoutBody({ bookingId: 'booking-1' });
    assert.equal(valid.ok, true);
  });

  it('rejects amount tampering on checkout requests', () => {
    const result = validateCreateCheckoutBody({
      bookingId: 'booking-1',
      amountCents: 1,
      unitPriceCents: 1,
      platformFeeCents: 0,
      mentorAmountCents: 1,
    });
    assert.equal(result.ok, false);
  });

  it('rejects currency tampering on checkout requests', () => {
    const result = validateCreateCheckoutBody({
      bookingId: 'booking-1',
      currency: 'EUR',
    });
    assert.equal(result.ok, false);
  });

  it('rejects booking/payment amount and currency mismatches', () => {
    const intent = buildPaymentIntentFromBooking({
      id: 'pi-4',
      booking,
      provider: PAYMENT_PROVIDER_ID.stripe,
      idempotencyKey: 'idem-4',
      now,
    });
    assert.equal(validatePaymentMatchesBooking(intent, booking).ok, true);

    const tamperedAmount = {
      ...intent,
      amount: { currency: BOOKING_CURRENCY.usd, amountCents: 100 },
    };
    assert.equal(validatePaymentMatchesBooking(tamperedAmount, booking).ok, false);

    const tamperedCurrency = {
      ...intent,
      amount: { currency: BOOKING_CURRENCY.usd, amountCents: booking.unitPriceCents },
      split: { ...intent.split, grossAmountCents: booking.unitPriceCents },
    };
    assert.equal(validatePaymentMatchesBooking(tamperedCurrency, booking).ok, true);

    const tamperedFeeBps = {
      ...intent,
      split: { ...intent.split, platformFeeBps: 1000 },
    };
    assert.equal(validatePaymentMatchesBooking(tamperedFeeBps, booking).ok, false);
  });
});

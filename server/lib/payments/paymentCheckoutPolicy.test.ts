import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  CHECKOUT_SESSION_STATUS,
  PAYMENT_PROVIDER_ID,
  type CheckoutSession,
  type MentorshipBooking,
} from '@apprentorbay/shared';
import {
  bookingAcceptsIncomingPayment,
  isReusableCheckoutSession,
  selectCheckoutForBooking,
} from './paymentCheckoutPolicy.js';

const NOW = '2026-09-03T12:00:00.000Z';
const LATER = '2026-09-03T13:00:00.000Z';
const EARLIER = '2026-09-03T11:00:00.000Z';

function checkout(overrides: Partial<CheckoutSession> = {}): CheckoutSession {
  return {
    id: 'cs-1',
    paymentIntentId: 'pi-1',
    bookingId: 'booking-1',
    learnerId: 'learner-1',
    status: CHECKOUT_SESSION_STATUS.open,
    provider: PAYMENT_PROVIDER_ID.mock,
    providerCheckoutSessionId: 'provider-cs-1',
    checkoutUrl: 'https://mock-payments.test/checkout/provider-cs-1',
    expiresAt: LATER,
    idempotencyKey: 'idem-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function booking(overrides: Partial<MentorshipBooking> = {}): MentorshipBooking {
  return {
    id: 'booking-1',
    relationshipId: 'rel-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
    unitPriceCents: 7500,
    currency: 'USD',
    platformFeeCents: 1125,
    mentorAmountCents: 6375,
    platformFeeBps: 1500,
    paymentStatus: BOOKING_PAYMENT_STATUS.pendingPayment,
    bookingStatus: BOOKING_STATUS.pendingPayment,
    sessionId: null,
    title: 'Mentorship session',
    serviceType: 'mentorship_session',
    sessionDurationMinutes: 60,
    commercialMode: 'professional',
    mentorType: 'accomplished',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  } as MentorshipBooking;
}

describe('paymentCheckoutPolicy', () => {
  it('treats only open, unexpired checkout sessions as reusable', () => {
    assert.equal(isReusableCheckoutSession(checkout(), NOW), true);
    assert.equal(isReusableCheckoutSession(checkout({ expiresAt: EARLIER }), NOW), false);
    assert.equal(
      isReusableCheckoutSession(checkout({ status: CHECKOUT_SESSION_STATUS.expired }), NOW),
      false,
    );
  });

  it('accepts payment only while booking payment status is pending_payment', () => {
    assert.equal(bookingAcceptsIncomingPayment(booking()), true);
    assert.equal(
      bookingAcceptsIncomingPayment(
        booking({
          paymentStatus: BOOKING_PAYMENT_STATUS.cancelled,
          bookingStatus: BOOKING_STATUS.cancelled,
        }),
      ),
      false,
    );
  });

  it('reuses an open checkout for the same booking even with a different idempotency key', () => {
    const existing = checkout({ idempotencyKey: 'idem-first' });
    const selected = selectCheckoutForBooking([existing], 'booking-1', 'idem-second', NOW);
    assert.equal(selected?.id, 'cs-1');
  });
});

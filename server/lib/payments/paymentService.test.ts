import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  BOOKING_CURRENCY,
  BOOKING_SERVICE_TYPE,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  PAYMENT_STATUS,
  REQUEST_TYPE,
  buildActiveRelationship,
  buildMentorshipBooking,
  cancelMentorshipBooking,
  reducePaymentIntent,
} from '@apprentorbay/shared';
import { MemoryPaymentRepository } from './memoryPaymentRepository.js';
import { PaymentService } from './paymentService.js';
import { MockPaymentProvider } from './providers/mockProvider.js';

const NOW = '2026-09-03T12:00:00.000Z';
const LATER = '2026-09-03T13:00:00.000Z';

class CountingMockProvider extends MockPaymentProvider {
  createCheckoutCalls = 0;

  override async createCheckoutSession(
    input: Parameters<MockPaymentProvider['createCheckoutSession']> extends [infer A] ? A : never,
  ) {
    this.createCheckoutCalls += 1;
    return super.createCheckoutSession(input);
  }
}

function paidBooking(now = NOW) {
  const relationship = buildActiveRelationship({
    id: 'learner-1_mentor-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
    applicationId: 'app-1',
    now,
    commercial: {
      requestType: REQUEST_TYPE.paidRequest,
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 7500,
      sessionDurationMinutes: 60,
      paymentRequired: true,
      paymentSatisfied: false,
    },
  });
  const booking = buildMentorshipBooking({
    id: 'booking-1',
    relationship,
    snapshot: {
      unitPriceCents: 7500,
      currency: BOOKING_CURRENCY.usd,
      platformFeeCents: 1125,
      mentorAmountCents: 6375,
      platformFeeBps: 1500,
      sessionDurationMinutes: 60,
      title: 'Mentorship session',
      serviceType: BOOKING_SERVICE_TYPE.mentorshipSession,
      commercialMode: COMMERCIAL_MODE.professional,
      mentorType: MENTOR_TYPE.accomplished,
    },
    now,
  });
  return { relationship, booking };
}

describe('PaymentService checkout and webhook guards', () => {
  let repository: MemoryPaymentRepository;
  let provider: CountingMockProvider;
  let service: PaymentService;

  beforeEach(() => {
    repository = new MemoryPaymentRepository();
    provider = new CountingMockProvider();
    provider.reset();
    service = new PaymentService(provider, repository);
  });

  it('reuses an open checkout instead of creating a second provider session', async () => {
    const { booking } = paidBooking();
    repository.bookings.set(booking.id, booking);

    const first = await service.createCheckout({
      booking,
      learnerId: booking.learnerId,
      idempotencyKey: 'checkout-idem-1',
      now: NOW,
    });
    const second = await service.createCheckout({
      booking,
      learnerId: booking.learnerId,
      idempotencyKey: 'checkout-idem-2',
      now: NOW,
    });

    assert.equal(provider.createCheckoutCalls, 1);
    assert.equal(second.checkoutSession.id, first.checkoutSession.id);
    assert.equal(second.paymentIntent.id, first.paymentIntent.id);
  });

  it('ignores payment_succeeded for a cancelled booking', async () => {
    const { booking, relationship } = paidBooking();
    const cancelled = cancelMentorshipBooking(booking, NOW);
    repository.bookings.set(booking.id, cancelled);
    repository.relationships.set(relationship.id, relationship);

    const intent = reducePaymentIntent(
      {
        id: 'pi-1',
        bookingId: booking.id,
        relationshipId: booking.relationshipId,
        learnerId: booking.learnerId,
        mentorId: booking.mentorId,
        status: PAYMENT_STATUS.requiresPaymentMethod,
        amount: {
          amountCents: booking.unitPriceCents,
          currency: 'USD',
        },
        split: {
          grossAmountCents: booking.unitPriceCents,
          platformFeeCents: booking.platformFeeCents,
          mentorNetCents: booking.mentorAmountCents,
          platformFeeBps: booking.platformFeeBps,
        },
        provider: provider.id,
        providerPaymentIntentId: 'pi_mock_stale',
        latestCheckoutSessionId: null,
        idempotencyKey: 'checkout-idem-stale',
        failureCode: null,
        failureMessage: null,
        paidAt: null,
        cancelledAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      },
      {
        type: 'CHECKOUT_CREATED',
        checkoutSessionId: 'cs-1',
        providerPaymentIntentId: 'pi_mock_stale',
      },
      NOW,
    );
    repository.paymentIntents.set(intent.id, intent);

    await service.handleWebhookEvents([
      {
        type: 'payment_succeeded',
        providerPaymentIntentId: 'pi_mock_stale',
        paidAt: NOW,
        providerEventId: 'evt_stale_1',
      },
    ]);

    const stored = repository.bookings.get(booking.id);
    assert.equal(stored?.paymentStatus, BOOKING_PAYMENT_STATUS.cancelled);
    assert.equal(stored?.bookingStatus, BOOKING_STATUS.cancelled);
    assert.equal(repository.paymentIntents.get(intent.id)?.status, PAYMENT_STATUS.requiresPaymentMethod);
  });
});

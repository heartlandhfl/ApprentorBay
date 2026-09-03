import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  BOOKING_CURRENCY,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  RELATIONSHIP_STATUS,
  REQUEST_TYPE,
  USER_ROLE,
  buildBookingFinancialSnapshot,
  buildMentorshipBooking,
  canCancelBooking,
  canCreateBooking,
  canReadBooking,
  canTransitionBookingPaymentStatus,
  canTransitionBookingStatus,
  computeMentorAmountCents,
  computePlatformFeeCents,
  detectClientBookingFieldTampering,
  normalizeMentorOfferingFields,
  normalizeMentorshipBooking,
  validateCreateBookingBody,
  type MentorshipBooking,
  type MentorshipRelationship,
} from './domain/index.js';

const learner = {
  uid: 'learner-1',
  role: USER_ROLE.learner,
  active: true,
  accountStatus: 'active' as const,
};

const mentor = {
  uid: 'mentor-1',
  role: USER_ROLE.mentor,
  active: true,
  accountStatus: 'active' as const,
};

const stranger = {
  uid: 'stranger-1',
  role: USER_ROLE.learner,
  active: true,
  accountStatus: 'active' as const,
};

const paidRelationship: MentorshipRelationship = {
  id: 'learner-1_mentor-1',
  learnerId: 'learner-1',
  mentorId: 'mentor-1',
  applicationId: 'app-1',
  status: RELATIONSHIP_STATUS.active,
  createdAt: '2026-09-01T00:00:00.000Z',
  startedAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-01T00:00:00.000Z',
  endedAt: null,
  requestType: REQUEST_TYPE.paidRequest,
  commercialMode: COMMERCIAL_MODE.professional,
  baseSessionPriceUsd: 7500,
  sessionDurationMinutes: 60,
  paymentRequired: true,
  paymentSatisfied: false,
};

const paidOffering = normalizeMentorOfferingFields({
  mentorType: MENTOR_TYPE.accomplished,
  commercialMode: COMMERCIAL_MODE.professional,
  baseSessionPriceUsd: 7500,
  sessionDurationMinutes: 60,
  serviceDescription: 'Career coaching session',
});

describe('booking financial snapshot', () => {
  it('computes platform fee and mentor amount with integer cents only', () => {
    assert.equal(computePlatformFeeCents(7500, 1500), 1125);
    assert.equal(computeMentorAmountCents(7500, 1125), 6375);
    assert.equal(1125 + 6375, 7500);
  });

  it('builds an immutable snapshot from the mentor service configuration', () => {
    const result = buildBookingFinancialSnapshot(paidOffering, 1500);
    assert.equal(result.ok, true);
    if (!result.ok || !result.snapshot) return;
    assert.equal(result.snapshot.unitPriceCents, 7500);
    assert.equal(result.snapshot.currency, BOOKING_CURRENCY.usd);
    assert.equal(result.snapshot.platformFeeCents, 1125);
    assert.equal(result.snapshot.mentorAmountCents, 6375);
    assert.equal(result.snapshot.sessionDurationMinutes, 60);
    assert.equal(result.snapshot.title, 'Career coaching session');
  });

  it('does not change an existing booking when the mentor later updates their price', () => {
    const snapshot = buildBookingFinancialSnapshot(paidOffering, 1500);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok || !snapshot.snapshot) return;

    const booking = buildMentorshipBooking({
      id: 'booking-1',
      relationship: paidRelationship,
      snapshot: snapshot.snapshot,
      now: '2026-09-03T12:00:00.000Z',
    });

    const laterOffering = normalizeMentorOfferingFields({
      ...paidOffering,
      baseSessionPriceUsd: 99_900,
      sessionDurationMinutes: 90,
      serviceDescription: 'New premium package',
    });
    const laterSnapshot = buildBookingFinancialSnapshot(laterOffering, 1500);
    assert.equal(laterSnapshot.ok, true);
    if (!laterSnapshot.ok || !laterSnapshot.snapshot) return;
    assert.equal(laterSnapshot.snapshot.unitPriceCents, 99_900);

    const normalized = normalizeMentorshipBooking(booking);
    assert.equal(normalized.unitPriceCents, 7500);
    assert.equal(normalized.sessionDurationMinutes, 60);
    assert.equal(normalized.title, 'Career coaching session');
    assert.equal(normalized.currency, BOOKING_CURRENCY.usd);
  });
});

describe('booking create request tampering', () => {
  it('accepts only relationshipId from the client', () => {
    const valid = validateCreateBookingBody({ relationshipId: 'learner-1_mentor-1' });
    assert.equal(valid.ok, true);
    if (valid.ok) assert.equal(valid.relationshipId, 'learner-1_mentor-1');
  });

  it('rejects price tampering fields', () => {
    const result = validateCreateBookingBody({
      relationshipId: 'learner-1_mentor-1',
      unitPriceCents: 1,
      platformFeeCents: 0,
      mentorAmountCents: 1,
      baseSessionPriceUsd: 1,
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /unitPriceCents/);
      assert.match(result.error, /platformFeeCents/);
    }
  });

  it('rejects mentor tampering fields', () => {
    const result = validateCreateBookingBody({
      relationshipId: 'learner-1_mentor-1',
      mentorId: 'attacker-mentor',
      learnerId: 'attacker-learner',
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.error, /mentorId/);
      assert.match(result.error, /learnerId/);
    }
  });

  it('rejects currency tampering fields', () => {
    const result = validateCreateBookingBody({
      relationshipId: 'learner-1_mentor-1',
      currency: 'EUR',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /currency/);
  });

  it('detects forbidden client booking fields', () => {
    const tampered = detectClientBookingFieldTampering({
      relationshipId: 'rel-1',
      unitPriceCents: 100,
      currency: 'BRL',
      mentorId: 'evil',
    });
    assert.ok(tampered.includes('unitPriceCents'));
    assert.ok(tampered.includes('currency'));
    assert.ok(tampered.includes('mentorId'));
  });
});

describe('booking authorization', () => {
  it('lets the learner create a booking for their active paid relationship', () => {
    assert.equal(canCreateBooking(learner, paidRelationship), true);
  });

  it('blocks unauthorized booking creation', () => {
    assert.equal(canCreateBooking(stranger, paidRelationship), false);
    assert.equal(canCreateBooking(mentor, paidRelationship), false);
    assert.equal(
      canCreateBooking(learner, { ...paidRelationship, learnerId: 'other-learner' }),
      false,
    );
    assert.equal(
      canCreateBooking(learner, { ...paidRelationship, status: RELATIONSHIP_STATUS.paused }),
      false,
    );
    assert.equal(
      canCreateBooking(learner, {
        ...paidRelationship,
        paymentRequired: false,
        requestType: REQUEST_TYPE.freeRequest,
      }),
      false,
    );
    assert.equal(
      canCreateBooking(learner, { ...paidRelationship, paymentSatisfied: true }),
      false,
    );
  });

  it('blocks a second open booking for the same relationship', () => {
    const openBooking: Pick<MentorshipBooking, 'paymentStatus' | 'bookingStatus'> = {
      paymentStatus: BOOKING_PAYMENT_STATUS.pendingPayment,
      bookingStatus: BOOKING_STATUS.pendingPayment,
    };
    assert.equal(canCreateBooking(learner, paidRelationship, [openBooking]), false);
  });

  it('limits booking reads to pairing members and admins', () => {
    const booking = buildMentorshipBooking({
      id: 'booking-1',
      relationship: paidRelationship,
      snapshot: buildBookingFinancialSnapshot(paidOffering, 1500).snapshot!,
      now: '2026-09-03T12:00:00.000Z',
    });
    assert.equal(canReadBooking(learner, booking), true);
    assert.equal(canReadBooking(mentor, booking), true);
    assert.equal(canReadBooking(stranger, booking), false);
    assert.equal(
      canReadBooking({ ...mentor, role: USER_ROLE.admin }, booking),
      true,
    );
  });

  it('lets pairing members cancel only open pending bookings', () => {
    const pending = buildMentorshipBooking({
      id: 'booking-1',
      relationship: paidRelationship,
      snapshot: buildBookingFinancialSnapshot(paidOffering, 1500).snapshot!,
      now: '2026-09-03T12:00:00.000Z',
    });
    assert.equal(canCancelBooking(learner, pending), true);
    assert.equal(canCancelBooking(mentor, pending), true);
    assert.equal(canCancelBooking(stranger, pending), false);

    const paidBooking = {
      ...pending,
      paymentStatus: BOOKING_PAYMENT_STATUS.paid,
      bookingStatus: BOOKING_STATUS.paid,
    };
    assert.equal(canCancelBooking(learner, paidBooking), false);
  });
});

describe('booking state machine', () => {
  it('allows only documented booking transitions', () => {
    assert.equal(
      canTransitionBookingStatus(BOOKING_STATUS.pendingPayment, BOOKING_STATUS.paid),
      true,
    );
    assert.equal(
      canTransitionBookingStatus(BOOKING_STATUS.pendingPayment, BOOKING_STATUS.cancelled),
      true,
    );
    assert.equal(
      canTransitionBookingStatus(BOOKING_STATUS.paid, BOOKING_STATUS.pendingPayment),
      false,
    );
    assert.equal(
      canTransitionBookingPaymentStatus(
        BOOKING_PAYMENT_STATUS.pendingPayment,
        BOOKING_PAYMENT_STATUS.failed,
      ),
      true,
    );
    assert.equal(
      canTransitionBookingPaymentStatus(BOOKING_PAYMENT_STATUS.paid, BOOKING_PAYMENT_STATUS.refunded),
      true,
    );
  });
});

describe('booking server authority', () => {
  it('derives mentor and learner ids from the relationship, not the client body', () => {
    const snapshot = buildBookingFinancialSnapshot(paidOffering, 1500);
    assert.equal(snapshot.ok, true);
    if (!snapshot.ok || !snapshot.snapshot) return;

    const booking = buildMentorshipBooking({
      id: 'booking-1',
      relationship: paidRelationship,
      snapshot: snapshot.snapshot,
      now: '2026-09-03T12:00:00.000Z',
    });

    assert.equal(booking.learnerId, paidRelationship.learnerId);
    assert.equal(booking.mentorId, paidRelationship.mentorId);
    assert.equal(booking.relationshipId, paidRelationship.id);
    assert.equal(booking.currency, BOOKING_CURRENCY.usd);
    assert.equal(booking.paymentStatus, BOOKING_PAYMENT_STATUS.pendingPayment);
    assert.equal(booking.bookingStatus, BOOKING_STATUS.pendingPayment);
    assert.equal(booking.sessionId, null);
  });

  it('rejects free mentorship offerings at snapshot time', () => {
    const freeOffering = normalizeMentorOfferingFields({
      mentorType: MENTOR_TYPE.learningGuide,
      commercialMode: COMMERCIAL_MODE.givingBack,
    });
    const result = buildBookingFinancialSnapshot(freeOffering, 1500);
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /paid mentorship/i);
  });
});

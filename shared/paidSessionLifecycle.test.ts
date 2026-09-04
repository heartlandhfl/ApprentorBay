import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_STATUS,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  RELATIONSHIP_STATUS,
  REQUEST_TYPE,
  SESSION_STATUS,
  USER_ROLE,
  buildActiveRelationship,
  buildMentorshipBooking,
  buildMentorshipSession,
  canJoinSession,
  canRemainInSessionMeeting,
  canStartLearningJourney,
  markMentorshipBookingPaid,
  normalizeMentorOfferingFields,
  sessionPaymentAccessGranted,
  type MentorshipBooking,
} from './domain/index.js';

const NOW = '2026-09-03T12:00:00.000Z';
const START = '2026-09-10T14:00:00.000Z';
const END = '2026-09-10T15:00:00.000Z';
const JOIN_AT = '2026-09-10T13:55:00.000Z';

function actor(uid: string, role: (typeof USER_ROLE)[keyof typeof USER_ROLE]) {
  return {
    uid,
    role,
    active: true,
    accountStatus: ACCOUNT_STATUS.active,
  };
}

function freeRelationship() {
  return buildActiveRelationship({
    id: 'learner-1_mentor-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
    applicationId: 'app-1',
    now: NOW,
  });
}

function paidRelationship(overrides: { paymentSatisfied?: boolean } = {}) {
  return buildActiveRelationship({
    id: 'learner-1_mentor-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
    applicationId: 'app-1',
    now: NOW,
    commercial: {
      requestType: REQUEST_TYPE.paidRequest,
      commercialMode: COMMERCIAL_MODE.professional,
      baseSessionPriceUsd: 7500,
      sessionDurationMinutes: 60,
      paymentRequired: true,
      paymentSatisfied: overrides.paymentSatisfied ?? false,
    },
  });
}

function paidBooking(sessionId: string, overrides: Partial<MentorshipBooking> = {}): MentorshipBooking {
  const offering = normalizeMentorOfferingFields({
    mentorType: MENTOR_TYPE.accomplished,
    commercialMode: COMMERCIAL_MODE.professional,
    baseSessionPriceUsd: 7500,
    sessionDurationMinutes: 60,
    serviceDescription: 'Career coaching session',
  });
  return {
    ...buildMentorshipBooking({
      id: 'booking-1',
      relationship: paidRelationship(),
      snapshot: {
        unitPriceCents: offering.baseSessionPriceUsd!,
        currency: 'USD',
        platformFeeCents: 1125,
        mentorAmountCents: 6375,
        platformFeeBps: 1500,
        commercialMode: offering.commercialMode,
        mentorType: offering.mentorType,
        sessionDurationMinutes: offering.sessionDurationMinutes,
        serviceType: 'mentorship_session',
        title: 'Career coaching session',
      },
      now: NOW,
      sessionId,
    }),
    ...overrides,
  };
}

describe('paid session lifecycle', () => {
  it('allows free mentorship sessions to join without a booking', () => {
    const relationship = freeRelationship();
    const session = buildMentorshipSession({
      id: 'session-1',
      relationship,
      title: 'Check-in',
      scheduledStart: START,
      scheduledEnd: END,
      now: NOW,
    });

    assert.equal(session.paymentRequired, false);
    assert.equal(sessionPaymentAccessGranted(session, null, relationship), true);
    assert.equal(
      canJoinSession(actor('learner-1', USER_ROLE.learner), session, relationship, null, JOIN_AT),
      true,
    );
  });

  it('blocks paid session join before verified payment', () => {
    const relationship = paidRelationship();
    const session = buildMentorshipSession({
      id: 'session-1',
      relationship,
      title: 'Paid session',
      scheduledStart: START,
      scheduledEnd: END,
      now: NOW,
    });
    const pending = paidBooking(session.id);

    assert.equal(session.paymentRequired, true);
    assert.equal(sessionPaymentAccessGranted(session, pending, relationship), false);
    assert.equal(
      canJoinSession(actor('learner-1', USER_ROLE.learner), session, relationship, pending, JOIN_AT),
      false,
    );
    assert.equal(
      canJoinSession(actor('mentor-1', USER_ROLE.mentor), session, relationship, pending, JOIN_AT),
      false,
    );
  });

  it('allows mentor and learner to join after verified payment', () => {
    const relationship = paidRelationship();
    const session = {
      ...buildMentorshipSession({
        id: 'session-1',
        relationship,
        title: 'Paid session',
        scheduledStart: START,
        scheduledEnd: END,
        now: NOW,
      }),
      bookingId: 'booking-1',
    };
    const paid = markMentorshipBookingPaid(paidBooking(session.id), NOW);

    assert.equal(sessionPaymentAccessGranted(session, paid, relationship), true);
    assert.equal(
      canJoinSession(actor('learner-1', USER_ROLE.learner), session, relationship, paid, JOIN_AT),
      true,
    );
    assert.equal(
      canJoinSession(actor('mentor-1', USER_ROLE.mentor), session, relationship, paid, JOIN_AT),
      true,
    );
  });

  it('denies unrelated users even after payment', () => {
    const relationship = paidRelationship();
    const session = {
      ...buildMentorshipSession({
        id: 'session-1',
        relationship,
        title: 'Paid session',
        scheduledStart: START,
        scheduledEnd: END,
        now: NOW,
      }),
      bookingId: 'booking-1',
    };
    const paid = markMentorshipBookingPaid(paidBooking(session.id), NOW);

    assert.equal(
      canJoinSession(actor('other-1', USER_ROLE.learner), session, relationship, paid, JOIN_AT),
      false,
    );
  });

  it('revokes join access when booking is refunded', () => {
    const relationship = paidRelationship({ paymentSatisfied: true });
    const session = {
      ...buildMentorshipSession({
        id: 'session-1',
        relationship,
        title: 'Paid session',
        scheduledStart: START,
        scheduledEnd: END,
        now: NOW,
      }),
      bookingId: 'booking-1',
    };
    const refunded = {
      ...markMentorshipBookingPaid(paidBooking(session.id), NOW),
      paymentStatus: BOOKING_PAYMENT_STATUS.refunded,
      bookingStatus: BOOKING_STATUS.refunded,
    };

    assert.equal(sessionPaymentAccessGranted(session, refunded, relationship), false);
    assert.equal(
      canJoinSession(actor('learner-1', USER_ROLE.learner), session, relationship, refunded, JOIN_AT),
      false,
    );
  });

  it('blocks learning journeys after refund clears relationship payment satisfaction', () => {
    const relationship = paidRelationship({ paymentSatisfied: false });
    assert.equal(
      canStartLearningJourney(actor('learner-1', USER_ROLE.learner), relationship),
      false,
    );
  });

  it('still allows learning journeys while paymentSatisfied remains stale after refund', () => {
    const relationship = paidRelationship({ paymentSatisfied: true });
    assert.equal(
      canStartLearningJourney(actor('learner-1', USER_ROLE.learner), relationship),
      true,
    );
  });

  it('revokes in-meeting access when booking is refunded without re-checking join window', () => {
    const relationship = paidRelationship({ paymentSatisfied: true });
    const session = {
      ...buildMentorshipSession({
        id: 'session-1',
        relationship,
        title: 'Paid session',
        scheduledStart: START,
        scheduledEnd: END,
        now: NOW,
      }),
      bookingId: 'booking-1',
    };
    const refunded = {
      ...markMentorshipBookingPaid(paidBooking(session.id), NOW),
      paymentStatus: BOOKING_PAYMENT_STATUS.refunded,
      bookingStatus: BOOKING_STATUS.refunded,
    };

    assert.equal(canRemainInSessionMeeting(session, refunded, relationship), false);
  });

  it('allows in-meeting access while booking remains paid', () => {
    const relationship = paidRelationship({ paymentSatisfied: true });
    const session = {
      ...buildMentorshipSession({
        id: 'session-1',
        relationship,
        title: 'Paid session',
        scheduledStart: START,
        scheduledEnd: END,
        now: NOW,
      }),
      bookingId: 'booking-1',
    };
    const paid = markMentorshipBookingPaid(paidBooking(session.id), NOW);

    assert.equal(canRemainInSessionMeeting(session, paid, relationship), true);
  });

  it('keeps paid sessions unavailable after failed payment', () => {
    const relationship = paidRelationship();
    const session = buildMentorshipSession({
      id: 'session-1',
      relationship,
      title: 'Paid session',
      scheduledStart: START,
      scheduledEnd: END,
      now: NOW,
    });
    const failed = {
      ...paidBooking(session.id),
      paymentStatus: BOOKING_PAYMENT_STATUS.failed,
      bookingStatus: BOOKING_STATUS.failed,
    };

    assert.equal(sessionPaymentAccessGranted(session, failed, relationship), false);
    assert.equal(
      canJoinSession(actor('learner-1', USER_ROLE.learner), session, relationship, failed, JOIN_AT),
      false,
    );
  });

  it('keeps paid sessions unavailable after booking cancellation', () => {
    const relationship = paidRelationship();
    const session = buildMentorshipSession({
      id: 'session-1',
      relationship,
      title: 'Paid session',
      scheduledStart: START,
      scheduledEnd: END,
      now: NOW,
    });
    const cancelled = {
      ...paidBooking(session.id),
      paymentStatus: BOOKING_PAYMENT_STATUS.cancelled,
      bookingStatus: BOOKING_STATUS.cancelled,
    };

    assert.equal(sessionPaymentAccessGranted(session, cancelled, relationship), false);
    assert.equal(
      canJoinSession(actor('learner-1', USER_ROLE.learner), session, relationship, cancelled, JOIN_AT),
      false,
    );
  });

  it('does not grant access when booking is linked to a different session', () => {
    const relationship = paidRelationship();
    const session = {
      ...buildMentorshipSession({
        id: 'session-1',
        relationship,
        title: 'Paid session',
        scheduledStart: START,
        scheduledEnd: END,
        now: NOW,
      }),
      bookingId: 'booking-1',
    };
    const paidOtherSession = markMentorshipBookingPaid(paidBooking('session-other'), NOW);

    assert.equal(sessionPaymentAccessGranted(session, paidOtherSession, relationship), false);
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_STATUS,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  COMMERCIAL_MODE,
  MENTOR_TYPE,
  REQUEST_TYPE,
  USER_ROLE,
  buildActiveRelationship,
  buildMentorshipBooking,
  markMentorshipBookingPaid,
  type MentorshipBooking,
  type MentorshipRelationship,
  type MentorshipSession,
  type User,
} from '@apprentorbay/shared';
import {
  SessionServiceError,
  createMentorshipSession,
  joinMentorshipSession,
  type SessionStore,
} from './sessionService.js';

const NOW = '2026-09-03T12:00:00.000Z';
const START = '2026-09-10T14:00:00.000Z';
const END = '2026-09-10T15:00:00.000Z';
const JOIN_AT = '2026-09-10T13:55:00.000Z';

function user(uid: string, role: (typeof USER_ROLE)[keyof typeof USER_ROLE]): User {
  return {
    uid,
    role,
    email: `${uid}@example.com`,
    displayName: uid,
    active: true,
    accountStatus: ACCOUNT_STATUS.active,
    createdAt: NOW,
    termsAcceptedAt: NOW,
    termsVersion: '1',
    profileSlug: uid,
  };
}

function paidRelationship(): MentorshipRelationship {
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
      paymentSatisfied: false,
    },
  });
}

class PaidSessionStore implements SessionStore {
  relationships = new Map<string, MentorshipRelationship>();
  sessions = new Map<string, MentorshipSession>();
  bookings = new Map<string, Pick<MentorshipBooking, 'id' | 'paymentStatus' | 'bookingStatus' | 'sessionId'>>();
  private counter = 0;

  constructor(seedRelationship = paidRelationship()) {
    this.relationships.set(seedRelationship.id, seedRelationship);
  }

  async getRelationship(relationshipId: string) {
    return this.relationships.get(relationshipId) ?? null;
  }

  async getSession(sessionId: string) {
    return this.sessions.get(sessionId) ?? null;
  }

  async saveSession(session: MentorshipSession) {
    this.sessions.set(session.id, session);
  }

  async listSessions(relationshipId: string) {
    return [...this.sessions.values()].filter((session) => session.relationshipId === relationshipId);
  }

  newSessionId() {
    this.counter += 1;
    return `session-${this.counter}`;
  }

  async getBookingForSession(sessionId: string) {
    for (const booking of this.bookings.values()) {
      if (booking.sessionId === sessionId) {
        return booking;
      }
    }
    return null;
  }

  linkBooking(booking: Pick<MentorshipBooking, 'id' | 'paymentStatus' | 'bookingStatus' | 'sessionId'>) {
    this.bookings.set(booking.id, booking);
  }
}

function fullBooking(sessionId: string): MentorshipBooking {
  const relationship = paidRelationship();
  return buildMentorshipBooking({
    id: 'booking-1',
    relationship,
    snapshot: {
      unitPriceCents: 7500,
      currency: 'USD',
      platformFeeCents: 1125,
      mentorAmountCents: 6375,
      platformFeeBps: 1500,
      commercialMode: COMMERCIAL_MODE.professional,
      mentorType: MENTOR_TYPE.accomplished,
      sessionDurationMinutes: 60,
      serviceType: 'mentorship_session',
      title: 'Career coaching session',
    },
    now: NOW,
    sessionId,
  });
}

describe('paid session service lifecycle', () => {
  it('denies join for paid sessions until booking payment is verified', async () => {
    const store = new PaidSessionStore();
    const session = await createMentorshipSession(
      store,
      user('learner-1', USER_ROLE.learner),
      {
        relationshipId: paidRelationship().id,
        title: 'Paid mentorship session',
        scheduledStart: START,
        scheduledEnd: END,
      },
      NOW,
    );

    const pending = fullBooking(session.id);
    store.linkBooking(pending);
    await store.saveSession({ ...session, bookingId: pending.id });

    await assert.rejects(
      joinMentorshipSession(store, user('learner-1', USER_ROLE.learner), session.id, JOIN_AT),
      (error: unknown) => {
        assert.ok(error instanceof SessionServiceError);
        assert.equal(error.code, 'forbidden');
        return true;
      },
    );
  });

  it('allows join after verified payment for learner and mentor', async () => {
    const store = new PaidSessionStore();
    const session = await createMentorshipSession(
      store,
      user('mentor-1', USER_ROLE.mentor),
      {
        relationshipId: paidRelationship().id,
        title: 'Paid mentorship session',
        scheduledStart: START,
        scheduledEnd: END,
      },
      NOW,
    );

    const paid = markMentorshipBookingPaid(fullBooking(session.id), NOW);
    store.linkBooking(paid);
    await store.saveSession({ ...session, bookingId: paid.id });

    const learnerJoin = await joinMentorshipSession(
      store,
      user('learner-1', USER_ROLE.learner),
      session.id,
      JOIN_AT,
    );
    assert.equal(learnerJoin.roomName, session.roomName);

    const mentorJoin = await joinMentorshipSession(
      store,
      user('mentor-1', USER_ROLE.mentor),
      session.id,
      JOIN_AT,
    );
    assert.equal(mentorJoin.roomName, session.roomName);
  });

  it('revokes join access after refund', async () => {
    const store = new PaidSessionStore();
    const session = await createMentorshipSession(
      store,
      user('learner-1', USER_ROLE.learner),
      {
        relationshipId: paidRelationship().id,
        title: 'Paid mentorship session',
        scheduledStart: START,
        scheduledEnd: END,
      },
      NOW,
    );

    store.linkBooking({
      id: 'booking-1',
      sessionId: session.id,
      paymentStatus: BOOKING_PAYMENT_STATUS.refunded,
      bookingStatus: BOOKING_STATUS.refunded,
    });
    await store.saveSession({ ...session, bookingId: 'booking-1' });

    await assert.rejects(
      joinMentorshipSession(store, user('learner-1', USER_ROLE.learner), session.id, JOIN_AT),
      (error: unknown) => {
        assert.ok(error instanceof SessionServiceError);
        assert.equal(error.code, 'forbidden');
        return true;
      },
    );
  });
});

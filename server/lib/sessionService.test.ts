import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_STATUS,
  SESSION_STATUS,
  USER_ROLE,
  buildActiveRelationship,
  type MentorshipRelationship,
  type MentorshipSession,
  type User,
} from '@apprentorbay/shared';
import {
  SessionServiceError,
  cancelMentorshipSession,
  completeMentorshipSession,
  createMentorshipSession,
  getMentorshipSession,
  joinMentorshipSession,
  listMentorshipSessions,
  type SessionStore,
} from './sessionService.js';

const NOW = '2026-09-03T12:00:00.000Z';
const START = '2026-09-10T14:00:00.000Z';
const END = '2026-09-10T15:00:00.000Z';

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

const learner = user('learner-1', USER_ROLE.learner);
const mentor = user('mentor-1', USER_ROLE.mentor);
const stranger = user('other-1', USER_ROLE.learner);
const admin = user('admin-1', USER_ROLE.admin);

function relationship(): MentorshipRelationship {
  return buildActiveRelationship({
    id: 'learner-1_mentor-1',
    learnerId: learner.uid,
    mentorId: mentor.uid,
    applicationId: 'app-1',
    now: NOW,
  });
}

class MemorySessionStore implements SessionStore {
  relationships = new Map<string, MentorshipRelationship>();
  sessions = new Map<string, MentorshipSession>();
  private counter = 0;

  constructor(seedRelationship = relationship()) {
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
    return [...this.sessions.values()]
      .filter((session) => session.relationshipId === relationshipId)
      .sort((a, b) => a.scheduledStart.localeCompare(b.scheduledStart));
  }

  newSessionId() {
    this.counter += 1;
    return `session-${this.counter}`;
  }
}

function createBody(overrides: Record<string, unknown> = {}) {
  return {
    relationshipId: relationship().id,
    title: 'Weekly check-in',
    scheduledStart: START,
    scheduledEnd: END,
    ...overrides,
  };
}

async function expectForbidden(promise: Promise<unknown>) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof SessionServiceError);
    assert.equal(error.code, 'forbidden');
    return true;
  });
}

describe('sessionService', () => {
  it('creates a valid mentor session', async () => {
    const store = new MemorySessionStore();
    const session = await createMentorshipSession(store, mentor, createBody(), NOW);

    assert.equal(session.mentorId, mentor.uid);
    assert.equal(session.learnerId, learner.uid);
    assert.equal(session.relationshipId, relationship().id);
    assert.equal(session.status, SESSION_STATUS.scheduled);
    assert.equal(session.roomName, `ab-${session.id}`);
    assert.equal(session.durationMinutes, 60);
  });

  it('creates a valid learner session when allowed', async () => {
    const store = new MemorySessionStore();
    const session = await createMentorshipSession(store, learner, createBody(), NOW);
    assert.equal(session.learnerId, learner.uid);
    assert.equal(session.mentorId, mentor.uid);
  });

  it('denies unrelated users', async () => {
    const store = new MemorySessionStore();
    await expectForbidden(createMentorshipSession(store, stranger, createBody(), NOW));
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    await expectForbidden(getMentorshipSession(store, stranger, created.id));
    await expectForbidden(listMentorshipSessions(store, stranger, relationship().id));
  });

  it('denies altered mentorId', async () => {
    const store = new MemorySessionStore();
    await expectForbidden(
      createMentorshipSession(
        store,
        mentor,
        createBody({ mentorId: 'evil-mentor' }),
        NOW,
      ),
    );
  });

  it('denies altered learnerId', async () => {
    const store = new MemorySessionStore();
    await expectForbidden(
      createMentorshipSession(
        store,
        learner,
        createBody({ learnerId: 'evil-learner' }),
        NOW,
      ),
    );
  });

  it('denies altered relationshipId for another pairing', async () => {
    const store = new MemorySessionStore();
    store.relationships.set('other-pair', {
      ...relationship(),
      id: 'other-pair',
      learnerId: 'learner-2',
      mentorId: 'mentor-2',
    });

    await expectForbidden(
      createMentorshipSession(
        store,
        mentor,
        createBody({ relationshipId: 'other-pair' }),
        NOW,
      ),
    );
  });

  it('cancels a scheduled session and blocks further completion', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    const { session: cancelled, changed } = await cancelMentorshipSession(store, learner, created.id, NOW);

    assert.equal(changed, true);
    assert.equal(cancelled.status, SESSION_STATUS.cancelled);
    assert.equal(cancelled.cancelledById, learner.uid);
    assert.equal(cancelled.cancelledAt, NOW);

    await expectForbidden(completeMentorshipSession(store, mentor, created.id, NOW));

    const again = await cancelMentorshipSession(store, mentor, created.id, NOW);
    assert.equal(again.changed, false);
  });

  it('completes a scheduled session and blocks cancellation afterwards', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, learner, createBody(), NOW);
    const { session: completed, changed } = await completeMentorshipSession(
      store,
      mentor,
      created.id,
      NOW,
    );

    assert.equal(changed, true);
    assert.equal(completed.status, SESSION_STATUS.completed);
    assert.equal(completed.endedAt, NOW);
    assert.equal(completed.startedAt, NOW);

    await expectForbidden(cancelMentorshipSession(store, learner, created.id, NOW));

    const again = await completeMentorshipSession(store, mentor, created.id, NOW);
    assert.equal(again.changed, false);
  });

  it('rejects sessions with mismatched stored ownership', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    await store.saveSession({
      ...created,
      mentorId: 'evil-mentor',
    });

    await expectForbidden(cancelMentorshipSession(store, mentor, created.id, NOW));
    await expectForbidden(completeMentorshipSession(store, mentor, created.id, NOW));
  });

  it('lets admins read sessions for support', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    const viewed = await getMentorshipSession(store, admin, created.id);
    assert.equal(viewed.id, created.id);
  });

  it('lists sessions only for authorized relationship members', async () => {
    const store = new MemorySessionStore();
    await createMentorshipSession(store, mentor, createBody({ title: 'First' }), NOW);
    await createMentorshipSession(store, learner, createBody({ title: 'Second' }), NOW);

    const sessions = await listMentorshipSessions(store, learner, relationship().id);
    assert.equal(sessions.length, 2);
    await expectForbidden(listMentorshipSessions(store, stranger, relationship().id));
  });

  it('authorises join and records startedAt', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    const joinAt = '2026-09-10T13:55:00.000Z';
    const join = await joinMentorshipSession(store, learner, created.id, joinAt);

    assert.equal(join.roomName, created.roomName);
    assert.equal(join.userInfo.displayName, learner.displayName);
    const updated = await store.getSession(created.id);
    assert.equal(updated?.startedAt, joinAt);
  });

  it('denies join for unrelated users', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    await expectForbidden(joinMentorshipSession(store, stranger, created.id, START));
  });

  it('denies join outside the join window', async () => {
    const store = new MemorySessionStore();
    const created = await createMentorshipSession(store, mentor, createBody(), NOW);
    await expectForbidden(joinMentorshipSession(store, learner, created.id, NOW));
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_STATUS,
  SESSION_STATUS,
  USER_ROLE,
  buildActiveRelationship,
  buildMentorshipSession,
  buildSessionRoomName,
  canCancelSession,
  canCompleteSession,
  canScheduleSession,
  canTransitionSession,
  findSchedulingConflict,
  sessionsOverlap,
  validateSessionScheduleInput,
  validateLocalScheduleFields,
} from './domain/index.js';

const NOW = '2026-09-03T12:00:00.000Z';
const START = '2026-09-10T14:00:00.000Z';
const END = '2026-09-10T15:00:00.000Z';

function actor(uid: string, role: (typeof USER_ROLE)[keyof typeof USER_ROLE]) {
  return {
    uid,
    role,
    active: true,
    accountStatus: ACCOUNT_STATUS.active,
  };
}

function activeRelationship() {
  return buildActiveRelationship({
    id: 'learner-1_mentor-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
    applicationId: 'app-1',
    now: NOW,
  });
}

function scheduledSession(overrides: Partial<ReturnType<typeof buildMentorshipSession>> = {}) {
  return buildMentorshipSession({
    id: 'session-1',
    relationship: activeRelationship(),
    title: 'Weekly check-in',
    scheduledStart: START,
    scheduledEnd: END,
    now: NOW,
    ...overrides,
  });
}

describe('mentorship session domain', () => {
  it('builds opaque room names without PII', () => {
    assert.equal(buildSessionRoomName('abc123'), 'ab-abc123');
    assert.throws(() => buildSessionRoomName(''), /sessionId is required/);
  });

  it('validates schedule windows', () => {
    const ok = validateSessionScheduleInput({
      title: 'Check-in',
      scheduledStart: START,
      scheduledEnd: END,
      now: NOW,
    });
    assert.equal(ok.ok, true);

    const short = validateSessionScheduleInput({
      title: 'Check-in',
      scheduledStart: START,
      scheduledEnd: '2026-09-10T14:10:00.000Z',
      now: NOW,
    });
    assert.equal(short.ok, false);
  });

  it('allows only scheduled to cancelled or completed transitions', () => {
    assert.equal(canTransitionSession(SESSION_STATUS.scheduled, SESSION_STATUS.cancelled), true);
    assert.equal(canTransitionSession(SESSION_STATUS.scheduled, SESSION_STATUS.completed), true);
    assert.equal(canTransitionSession(SESSION_STATUS.cancelled, SESSION_STATUS.completed), false);
    assert.equal(canTransitionSession(SESSION_STATUS.completed, SESSION_STATUS.cancelled), false);
  });

  it('lets active pairing members schedule sessions', () => {
    const relationship = activeRelationship();
    assert.equal(canScheduleSession(actor('learner-1', USER_ROLE.learner), relationship), true);
    assert.equal(canScheduleSession(actor('mentor-1', USER_ROLE.mentor), relationship), true);
    assert.equal(canScheduleSession(actor('other-1', USER_ROLE.learner), relationship), false);
  });

  it('blocks cancel and complete on terminal sessions', () => {
    const cancelled = { ...scheduledSession(), status: SESSION_STATUS.cancelled };
    const completed = { ...scheduledSession(), status: SESSION_STATUS.completed };
    assert.equal(canCancelSession(actor('learner-1', USER_ROLE.learner), cancelled), false);
    assert.equal(canCompleteSession(actor('mentor-1', USER_ROLE.mentor), completed), false);
  });

  it('detects overlapping scheduled sessions', () => {
    const existing = scheduledSession({
      id: 'session-a',
      scheduledStart: '2026-09-10T14:00:00.000Z',
      scheduledEnd: '2026-09-10T15:00:00.000Z',
    });
    assert.equal(
      sessionsOverlap(
        '2026-09-10T14:30:00.000Z',
        '2026-09-10T15:30:00.000Z',
        existing.scheduledStart,
        existing.scheduledEnd,
      ),
      true,
    );
    assert.equal(
      sessionsOverlap(
        '2026-09-10T15:00:00.000Z',
        '2026-09-10T16:00:00.000Z',
        existing.scheduledStart,
        existing.scheduledEnd,
      ),
      false,
    );
    const conflict = findSchedulingConflict(
      '2026-09-10T14:30:00.000Z',
      '2026-09-10T15:30:00.000Z',
      [existing],
    );
    assert.equal(conflict?.id, 'session-a');
  });
});

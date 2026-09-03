import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildActiveRelationship,
  buildMentorshipSession,
  sanitizeMentorshipSessionForClient,
} from './index.js';

const NOW = '2026-09-03T12:00:00.000Z';

describe('sanitizeMentorshipSessionForClient', () => {
  it('removes roomName from API-facing session payloads', () => {
    const relationship = buildActiveRelationship({
      id: 'learner-1_mentor-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      applicationId: 'app-1',
      now: NOW,
    });
    const session = buildMentorshipSession({
      id: 'session-1',
      relationship,
      title: 'Check-in',
      scheduledStart: '2026-09-10T14:00:00.000Z',
      scheduledEnd: '2026-09-10T15:00:00.000Z',
      now: NOW,
    });

    const clientSession = sanitizeMentorshipSessionForClient(session);
    assert.equal('roomName' in clientSession, false);
    assert.equal(clientSession.id, session.id);
    assert.equal(session.roomName, 'ab-session-1');
  });
});

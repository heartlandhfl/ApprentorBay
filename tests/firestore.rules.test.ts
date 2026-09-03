import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, describe, it } from 'node:test';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const relationshipId = 'learner-1_mentor-1';
const sessionId = 'session-1';

describe('mentorshipSessions read rules', () => {
  let testEnv: RulesTestEnvironment;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'apprentorbay-demo',
      firestore: {
        rules: readFileSync(path.join(projectRoot, 'firestore.rules'), 'utf8'),
        host: '127.0.0.1',
        port: 8080,
      },
    });
  });

  after(async () => {
    await testEnv.cleanup();
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();
  });

  async function seedSessionRelationship(status: 'active' | 'paused' | 'ended') {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, 'users', 'learner-1'), {
        uid: 'learner-1',
        role: 'learner',
        active: true,
        accountStatus: 'active',
      });
      await setDoc(doc(db, 'users', 'mentor-1'), {
        uid: 'mentor-1',
        role: 'mentor',
        active: true,
        accountStatus: 'active',
      });
      await setDoc(doc(db, 'mentorshipRelationships', relationshipId), {
        learnerId: 'learner-1',
        mentorId: 'mentor-1',
        status,
      });
      await setDoc(doc(db, 'mentorshipSessions', sessionId), {
        relationshipId,
        learnerId: 'learner-1',
        mentorId: 'mentor-1',
        roomName: 'ab-session-1',
        status: 'scheduled',
      });
    });
  }

  it('allows active relationship members to read sessions', async () => {
    await seedSessionRelationship('active');
    const learnerDb = testEnv.authenticatedContext('learner-1').firestore();
    const snapshot = await assertSucceeds(getDoc(doc(learnerDb, 'mentorshipSessions', sessionId)));
    assert.equal(snapshot.get('roomName'), 'ab-session-1');
  });

  it('denies paused relationship members from reading sessions', async () => {
    await seedSessionRelationship('paused');
    const learnerDb = testEnv.authenticatedContext('learner-1').firestore();
    await assertFails(getDoc(doc(learnerDb, 'mentorshipSessions', sessionId)));
  });

  it('denies ended relationship members from reading sessions', async () => {
    await seedSessionRelationship('ended');
    const mentorDb = testEnv.authenticatedContext('mentor-1').firestore();
    await assertFails(getDoc(doc(mentorDb, 'mentorshipSessions', sessionId)));
  });
});

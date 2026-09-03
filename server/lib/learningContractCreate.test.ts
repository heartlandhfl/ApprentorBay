import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ACCOUNT_STATUS,
  COMMERCIAL_MODE,
  RELATIONSHIP_STATUS,
  REQUEST_TYPE,
  USER_ROLE,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';
import {
  LearningContractCreateError,
  buildLearningContractForRelationship,
  validateCreateLearningContract,
} from './learningContractCreate.js';

const NOW = '2026-09-03T12:00:00.000Z';

function learner(): User {
  return {
    uid: 'learner-1',
    role: USER_ROLE.learner,
    email: 'learner@example.com',
    displayName: 'Learner',
    active: true,
    accountStatus: ACCOUNT_STATUS.active,
    createdAt: NOW,
    termsAcceptedAt: NOW,
    termsVersion: '1',
    profileSlug: 'learner-1',
  };
}

function unpaidPaidRelationship(
  commercialMode: (typeof COMMERCIAL_MODE)[keyof typeof COMMERCIAL_MODE],
): MentorshipRelationship {
  return {
    id: 'learner-1_mentor-1',
    learnerId: 'learner-1',
    mentorId: 'mentor-1',
    applicationId: 'app-1',
    status: RELATIONSHIP_STATUS.active,
    createdAt: NOW,
    startedAt: NOW,
    updatedAt: NOW,
    endedAt: null,
    requestType: REQUEST_TYPE.paidRequest,
    commercialMode,
    baseSessionPriceUsd: 7500,
    sessionDurationMinutes: 60,
    paymentRequired: true,
    paymentSatisfied: false,
  };
}

describe('POST /api/contracts create validation', () => {
  it('rejects an unpaid Professional relationship with payment_required', () => {
    assert.throws(
      () => validateCreateLearningContract(learner(), unpaidPaidRelationship(COMMERCIAL_MODE.professional)),
      (error: unknown) => {
        assert.ok(error instanceof LearningContractCreateError);
        assert.equal(error.code, 'payment_required');
        assert.equal(error.status, 403);
        assert.match(error.message, /payment/i);
        return true;
      },
    );
  });

  it('rejects an unpaid Premium relationship with payment_required', () => {
    assert.throws(
      () => validateCreateLearningContract(learner(), unpaidPaidRelationship(COMMERCIAL_MODE.premium)),
      (error: unknown) => {
        assert.ok(error instanceof LearningContractCreateError);
        assert.equal(error.code, 'payment_required');
        assert.equal(error.status, 403);
        return true;
      },
    );
  });

  it('allows contract creation once payment is satisfied', () => {
    const relationship = {
      ...unpaidPaidRelationship(COMMERCIAL_MODE.professional),
      paymentSatisfied: true,
    };
    const validated = validateCreateLearningContract(learner(), relationship);
    assert.equal(validated.id, relationship.id);

    const contract = buildLearningContractForRelationship({
      contractId: 'contract-1',
      relationship: validated,
      now: NOW,
    });
    assert.equal(contract.relationshipId, relationship.id);
    assert.equal(contract.learnerId, 'learner-1');
  });
});

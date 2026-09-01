import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  APPLICATION_STATUS,
  CANONICAL_LEARNER_ID_FIELD,
  COLLECTIONS,
  LEARNING_CONTRACT_STATUS,
  MILESTONE_STATUS,
  PUBLIC_LEARNER_LABEL,
  RELATIONSHIP_STATUS,
  RESERVED_COLLECTIONS,
  USER_ROLE,
  VERIFICATION_STATUS,
  buildActiveRelationship,
  canAcceptApplication,
  canApplyForMentorship,
  canEndRelationship,
  canPauseRelationship,
  canReadEvidenceObject,
  canStartLearningJourney,
  canWriteEvidenceObject,
  canTransitionApplication,
  canTransitionContract,
  canTransitionMilestone,
  canTransitionRelationship,
  evidenceStoragePath,
  isAccountActive,
  isLearnerRole,
  isOpenRelationship,
  normalizeRelationship,
  pairingIdFieldForRole,
  relationshipDocId,
  showcaseFromDeliverableRef,
  validateApplicationMessage,
  validateEvidenceDrafts,
  validateEvidenceSubmission,
} from './domain/index.js';

describe('domain identities', () => {
  it('keeps learner as the persisted role and field', () => {
    assert.equal(USER_ROLE.learner, 'learner');
    assert.equal(CANONICAL_LEARNER_ID_FIELD, 'learnerId');
    assert.equal(pairingIdFieldForRole(USER_ROLE.mentor), 'mentorId');
    assert.equal(pairingIdFieldForRole(USER_ROLE.learner), 'learnerId');
    assert.equal(isLearnerRole(USER_ROLE.learner), true);
    assert.equal(PUBLIC_LEARNER_LABEL, 'Apprentice/Learner');
  });

  it('does not rename live Firestore collections', () => {
    assert.equal(COLLECTIONS.applications, 'mentorshipApplications');
    assert.equal(COLLECTIONS.relationships, 'mentorshipRelationships');
    assert.equal(COLLECTIONS.contracts, 'learningContracts');
    assert.equal(COLLECTIONS.auditLogs, 'adminAuditLogs');
    assert.equal(RESERVED_COLLECTIONS.legacyMentorships, 'mentorships');
    assert.equal(RESERVED_COLLECTIONS.notifications, 'notifications');
    assert.equal(RESERVED_COLLECTIONS.adminAuditLogs, 'adminAuditLogs');
  });
});

describe('domain transitions', () => {
  it('allows only the documented application and relationship moves', () => {
    assert.equal(
      canTransitionApplication(APPLICATION_STATUS.pending, APPLICATION_STATUS.accepted),
      true,
    );
    assert.equal(
      canTransitionApplication(APPLICATION_STATUS.accepted, APPLICATION_STATUS.declined),
      false,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.active, RELATIONSHIP_STATUS.ended),
      true,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.active, RELATIONSHIP_STATUS.paused),
      true,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.paused, RELATIONSHIP_STATUS.active),
      true,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.ended, RELATIONSHIP_STATUS.active),
      false,
    );
    assert.equal(
      canTransitionRelationship(RELATIONSHIP_STATUS.terminated, RELATIONSHIP_STATUS.active),
      false,
    );
  });

  it('documents the Learning Goal Builder path and forbids skipping mutual approval', () => {
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.draft,
        LEARNING_CONTRACT_STATUS.submittedByLearner,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.underLearnerReview,
        LEARNING_CONTRACT_STATUS.inProgress,
      ),
      false,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.proposedByMentor,
        LEARNING_CONTRACT_STATUS.mutuallyApproved,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.mutuallyApproved,
        LEARNING_CONTRACT_STATUS.inProgress,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(LEARNING_CONTRACT_STATUS.agreed, LEARNING_CONTRACT_STATUS.inProgress),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.inProgress,
        LEARNING_CONTRACT_STATUS.completed,
      ),
      false,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.inProgress,
        LEARNING_CONTRACT_STATUS.paused,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.inProgress,
        LEARNING_CONTRACT_STATUS.completionPending,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.paused,
        LEARNING_CONTRACT_STATUS.inProgress,
      ),
      true,
    );
    assert.equal(
      canTransitionContract(
        LEARNING_CONTRACT_STATUS.completionPending,
        LEARNING_CONTRACT_STATUS.completed,
      ),
      true,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.rejected, MILESTONE_STATUS.submitted),
      true,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.submitted, MILESTONE_STATUS.underReview),
      true,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.approved, MILESTONE_STATUS.submitted),
      false,
    );
    assert.equal(
      canTransitionMilestone(MILESTONE_STATUS.declined, MILESTONE_STATUS.active),
      false,
    );
  });
});

describe('domain permissions and validation', () => {
  const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true };
  const mentor = { uid: 'mentor-1', role: USER_ROLE.mentor, active: true };
  const approvedMentor = {
    userId: 'mentor-1',
    verificationStatus: VERIFICATION_STATUS.approved,
  };

  it('lets a learner apply to an approved mentor with a message', () => {
    assert.equal(canApplyForMentorship(learner, approvedMentor, 'I want to learn joinery'), true);
    assert.equal(canApplyForMentorship(mentor, approvedMentor, 'I want to learn joinery'), false);
    assert.equal(
      canApplyForMentorship(learner, { ...approvedMentor, verificationStatus: VERIFICATION_STATUS.pending }, 'Hi'),
      false,
    );
  });

  it('lets only the assigned mentor accept a pending application', () => {
    assert.equal(
      canAcceptApplication(mentor, { mentorId: 'mentor-1', status: APPLICATION_STATUS.pending }),
      true,
    );
    assert.equal(
      canAcceptApplication(learner, { mentorId: 'mentor-1', status: APPLICATION_STATUS.pending }),
      false,
    );
  });

  it('lets only the learner start a journey on an active relationship', () => {
    const relationship = {
      id: 'rel-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-09-01T00:00:00.000Z',
    };
    assert.equal(canStartLearningJourney(learner, relationship), true);
    assert.equal(canStartLearningJourney(mentor, relationship), false);
  });

  it('validates application and evidence the same way the product already does', () => {
    assert.equal(validateApplicationMessage('').ok, false);
    assert.equal(validateApplicationMessage('Hello').ok, true);
    assert.equal(validateEvidenceSubmission({ text: '', link: '' }).ok, false);
    assert.equal(validateEvidenceSubmission({ text: 'Photo of the joint', link: '' }).ok, true);
  });

  it('still treats a missing active flag as an active account', () => {
    assert.equal(isAccountActive({ active: true }), true);
    assert.equal(isAccountActive({} as { active: boolean }), true);
    assert.equal(isAccountActive({ active: false }), false);
  });

  it('keeps evidence files private to the pairing and the owning learner', () => {
    const contract = { learnerId: 'learner-1', mentorId: 'mentor-1' };
    const stranger = { uid: 'other', role: USER_ROLE.learner, active: true };
    assert.equal(canReadEvidenceObject(learner, contract), true);
    assert.equal(canReadEvidenceObject(mentor, contract), true);
    assert.equal(canReadEvidenceObject(stranger, contract), false);
    assert.equal(canWriteEvidenceObject(learner, contract, 'learner-1'), true);
    assert.equal(canWriteEvidenceObject(mentor, contract, 'learner-1'), false);
    assert.equal(canWriteEvidenceObject(learner, contract, 'other'), false);

    const owned = evidenceStoragePath({
      contractId: 'c-1',
      milestoneId: 'm-1',
      userId: 'learner-1',
      fileId: 'shot.jpg',
    });
    assert.equal(
      validateEvidenceDrafts(
        [{ type: 'file', content: 'shot.jpg', storagePath: owned }],
        { contractId: 'c-1', milestoneId: 'm-1', userId: 'learner-1' },
      ).ok,
      true,
    );
    assert.equal(
      validateEvidenceDrafts(
        [{ type: 'file', content: 'shot.jpg', storagePath: `portfolios/learner-1/shot.jpg` }],
        { contractId: 'c-1', milestoneId: 'm-1', userId: 'learner-1' },
      ).ok,
      false,
    );
  });
});

describe('showcase projection', () => {
  it('derives showcase items from profile deliverable refs', () => {
    const item = showcaseFromDeliverableRef({
      id: 'del-1',
      contractId: 'c-1',
      title: 'A sawhorse',
      description: 'Square and load-bearing',
    });
    assert.equal(item.source, 'profile_deliverable_ref');
    assert.equal(item.contractId, 'c-1');
    assert.equal(item.title, 'A sawhorse');
  });
});

describe('mentorship relationship engine', () => {
  it('uses a deterministic id so accept retries hit the same document', () => {
    assert.equal(relationshipDocId('learner-1', 'mentor-1'), 'learner-1_mentor-1');
  });

  it('fills missing fields on older relationship documents', () => {
    const normalized = normalizeRelationship({
      id: 'rel-old',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      status: RELATIONSHIP_STATUS.active,
      createdAt: '2026-01-01T00:00:00.000Z',
    });
    assert.equal(normalized.applicationId, null);
    assert.equal(normalized.startedAt, '2026-01-01T00:00:00.000Z');
    assert.equal(normalized.endedAt, null);
    assert.equal(isOpenRelationship(normalized), true);
  });

  it('builds a complete active relationship from an accepted application', () => {
    const relationship = buildActiveRelationship({
      id: relationshipDocId('learner-1', 'mentor-1'),
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      applicationId: 'app-1',
      now: '2026-09-01T00:00:00.000Z',
    });
    assert.equal(relationship.status, RELATIONSHIP_STATUS.active);
    assert.equal(relationship.applicationId, 'app-1');
    assert.equal(relationship.startedAt, relationship.createdAt);
    assert.equal(relationship.endedAt, null);
  });

  it('lets either pairing member pause or end an active relationship', () => {
    const relationship = buildActiveRelationship({
      id: 'rel-1',
      learnerId: 'learner-1',
      mentorId: 'mentor-1',
      applicationId: 'app-1',
      now: '2026-09-01T00:00:00.000Z',
    });
    const learner = { uid: 'learner-1', role: USER_ROLE.learner, active: true };
    const stranger = { uid: 'other', role: USER_ROLE.learner, active: true };
    assert.equal(canPauseRelationship(learner, relationship), true);
    assert.equal(canEndRelationship(learner, relationship), true);
    assert.equal(canPauseRelationship(stranger, relationship), false);
  });
});


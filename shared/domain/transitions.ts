import {
  APPLICATION_STATUS,
  LEARNING_CONTRACT_STATUS,
  MILESTONE_STATUS,
  RELATIONSHIP_STATUS,
  VERIFICATION_STATUS,
  type ApplicationStatus,
  type LearningContractStatus,
  type MilestoneStatus,
  type RelationshipStatus,
  type VerificationStatus,
} from './statuses.js';

export type TransitionMap<Status extends string> = Record<Status, readonly Status[]>;

export function canTransition<Status extends string>(
  map: TransitionMap<Status>,
  from: Status,
  to: Status,
): boolean {
  return map[from].includes(to);
}

export const APPLICATION_TRANSITIONS: TransitionMap<ApplicationStatus> = {
  [APPLICATION_STATUS.pending]: [APPLICATION_STATUS.accepted, APPLICATION_STATUS.declined],
  [APPLICATION_STATUS.accepted]: [],
  [APPLICATION_STATUS.declined]: [],
};

export const RELATIONSHIP_TRANSITIONS: TransitionMap<RelationshipStatus> = {
  [RELATIONSHIP_STATUS.active]: [
    RELATIONSHIP_STATUS.paused,
    RELATIONSHIP_STATUS.ended,
    RELATIONSHIP_STATUS.terminated,
  ],
  [RELATIONSHIP_STATUS.paused]: [
    RELATIONSHIP_STATUS.active,
    RELATIONSHIP_STATUS.ended,
    RELATIONSHIP_STATUS.terminated,
  ],
  /**
   * Reactivation after ended happens only via application accept, not this map.
   */
  [RELATIONSHIP_STATUS.ended]: [],
  [RELATIONSHIP_STATUS.terminated]: [],
};

export const VERIFICATION_TRANSITIONS: TransitionMap<VerificationStatus> = {
  [VERIFICATION_STATUS.pending]: [VERIFICATION_STATUS.approved, VERIFICATION_STATUS.rejected],
  [VERIFICATION_STATUS.approved]: [],
  [VERIFICATION_STATUS.rejected]: [],
};

/**
 * Learning Goal Builder + journey path.
 * A contract cannot enter `in_progress` (ACTIVE) except from mutual approval.
 */
export const LEARNING_CONTRACT_TRANSITIONS: TransitionMap<LearningContractStatus> = {
  [LEARNING_CONTRACT_STATUS.draft]: [
    LEARNING_CONTRACT_STATUS.submittedByLearner,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.submittedByLearner]: [
    LEARNING_CONTRACT_STATUS.underMentorReview,
    LEARNING_CONTRACT_STATUS.proposedByMentor,
    LEARNING_CONTRACT_STATUS.rejected,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.underMentorReview]: [
    LEARNING_CONTRACT_STATUS.proposedByMentor,
    LEARNING_CONTRACT_STATUS.rejected,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.proposedByMentor]: [
    LEARNING_CONTRACT_STATUS.underLearnerReview,
    LEARNING_CONTRACT_STATUS.revisionRequested,
    LEARNING_CONTRACT_STATUS.mutuallyApproved,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.underLearnerReview]: [
    LEARNING_CONTRACT_STATUS.revisionRequested,
    LEARNING_CONTRACT_STATUS.mutuallyApproved,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.revisionRequested]: [
    LEARNING_CONTRACT_STATUS.underMentorReview,
    LEARNING_CONTRACT_STATUS.proposedByMentor,
    LEARNING_CONTRACT_STATUS.rejected,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.mutuallyApproved]: [LEARNING_CONTRACT_STATUS.inProgress],
  [LEARNING_CONTRACT_STATUS.agreed]: [LEARNING_CONTRACT_STATUS.inProgress],
  [LEARNING_CONTRACT_STATUS.inProgress]: [
    LEARNING_CONTRACT_STATUS.paused,
    LEARNING_CONTRACT_STATUS.completionPending,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.paused]: [
    LEARNING_CONTRACT_STATUS.inProgress,
    LEARNING_CONTRACT_STATUS.cancelled,
  ],
  [LEARNING_CONTRACT_STATUS.completionPending]: [
    LEARNING_CONTRACT_STATUS.completed,
    LEARNING_CONTRACT_STATUS.inProgress,
  ],
  [LEARNING_CONTRACT_STATUS.rejected]: [],
  [LEARNING_CONTRACT_STATUS.cancelled]: [],
  [LEARNING_CONTRACT_STATUS.completed]: [],
};

export const MILESTONE_TRANSITIONS: TransitionMap<MilestoneStatus> = {
  [MILESTONE_STATUS.locked]: [MILESTONE_STATUS.active],
  [MILESTONE_STATUS.active]: [MILESTONE_STATUS.submitted],
  [MILESTONE_STATUS.submitted]: [MILESTONE_STATUS.approved, MILESTONE_STATUS.rejected],
  [MILESTONE_STATUS.rejected]: [MILESTONE_STATUS.submitted],
  [MILESTONE_STATUS.approved]: [],
};

export function canTransitionApplication(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return canTransition(APPLICATION_TRANSITIONS, from, to);
}

export function canTransitionRelationship(
  from: RelationshipStatus,
  to: RelationshipStatus,
): boolean {
  return canTransition(RELATIONSHIP_TRANSITIONS, from, to);
}

export function canTransitionVerification(
  from: VerificationStatus,
  to: VerificationStatus,
): boolean {
  return canTransition(VERIFICATION_TRANSITIONS, from, to);
}

export function canTransitionContract(
  from: LearningContractStatus,
  to: LearningContractStatus,
): boolean {
  return canTransition(LEARNING_CONTRACT_TRANSITIONS, from, to);
}

export function canTransitionMilestone(from: MilestoneStatus, to: MilestoneStatus): boolean {
  return canTransition(MILESTONE_TRANSITIONS, from, to);
}

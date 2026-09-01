/**
 * Central status vocabularies. Persist these string values — they already
 * exist on production documents. Import the const objects instead of
 * repeating raw literals in UI and services.
 */

export const VERIFICATION_STATUS = {
  pending: 'pending',
  approved: 'approved',
  rejected: 'rejected',
} as const;

export type VerificationStatus =
  (typeof VERIFICATION_STATUS)[keyof typeof VERIFICATION_STATUS];

export const APPLICATION_STATUS = {
  pending: 'pending',
  accepted: 'accepted',
  declined: 'declined',
} as const;

export type ApplicationStatus =
  (typeof APPLICATION_STATUS)[keyof typeof APPLICATION_STATUS];

export const RELATIONSHIP_STATUS = {
  active: 'active',
  paused: 'paused',
  ended: 'ended',
  terminated: 'terminated',
} as const;

export type RelationshipStatus =
  (typeof RELATIONSHIP_STATUS)[keyof typeof RELATIONSHIP_STATUS];

export const LEARNING_CONTRACT_STATUS = {
  draft: 'draft',
  submittedByLearner: 'submitted_by_learner',
  underMentorReview: 'under_mentor_review',
  proposedByMentor: 'proposed_by_mentor',
  underLearnerReview: 'under_learner_review',
  revisionRequested: 'revision_requested',
  mutuallyApproved: 'mutually_approved',
  /** Persisted in the type union; the current machine never writes this value. */
  agreed: 'agreed',
  /**
   * Active contract (work underway). Persisted as `in_progress` so existing
   * documents and the milestone machine stay valid. UI label is ACTIVE.
   */
  inProgress: 'in_progress',
  paused: 'paused',
  completionPending: 'completion_pending',
  rejected: 'rejected',
  cancelled: 'cancelled',
  completed: 'completed',
} as const;

export type LearningContractStatus =
  (typeof LEARNING_CONTRACT_STATUS)[keyof typeof LEARNING_CONTRACT_STATUS];

/** Uppercase LGB / journey labels. Persisted values stay snake_case. */
export const LEARNING_CONTRACT_STATUS_LABEL: Record<LearningContractStatus, string> = {
  [LEARNING_CONTRACT_STATUS.draft]: 'DRAFT',
  [LEARNING_CONTRACT_STATUS.submittedByLearner]: 'SUBMITTED_BY_LEARNER',
  [LEARNING_CONTRACT_STATUS.underMentorReview]: 'UNDER_MENTOR_REVIEW',
  [LEARNING_CONTRACT_STATUS.proposedByMentor]: 'PROPOSED_BY_MENTOR',
  [LEARNING_CONTRACT_STATUS.underLearnerReview]: 'UNDER_LEARNER_REVIEW',
  [LEARNING_CONTRACT_STATUS.revisionRequested]: 'REVISION_REQUESTED',
  [LEARNING_CONTRACT_STATUS.mutuallyApproved]: 'MUTUALLY_APPROVED',
  [LEARNING_CONTRACT_STATUS.agreed]: 'MUTUALLY_APPROVED',
  [LEARNING_CONTRACT_STATUS.inProgress]: 'ACTIVE',
  [LEARNING_CONTRACT_STATUS.paused]: 'PAUSED',
  [LEARNING_CONTRACT_STATUS.completionPending]: 'COMPLETION_PENDING',
  [LEARNING_CONTRACT_STATUS.rejected]: 'REJECTED',
  [LEARNING_CONTRACT_STATUS.cancelled]: 'CANCELLED',
  [LEARNING_CONTRACT_STATUS.completed]: 'COMPLETED',
};

export const STEP_OWNER = {
  learner: 'learner',
  mentor: 'mentor',
} as const;

export type StepOwner = (typeof STEP_OWNER)[keyof typeof STEP_OWNER];

export const MILESTONE_STATUS = {
  locked: 'locked',
  active: 'active',
  submitted: 'submitted',
  approved: 'approved',
  rejected: 'rejected',
} as const;

export type MilestoneStatus = (typeof MILESTONE_STATUS)[keyof typeof MILESTONE_STATUS];

export const DELIVERABLE_STATUS = {
  draft: 'draft',
  inProgress: 'in_progress',
  completed: 'completed',
} as const;

export type DeliverableStatus =
  (typeof DELIVERABLE_STATUS)[keyof typeof DELIVERABLE_STATUS];

export const NOTIFICATION_STATUS = {
  unread: 'unread',
  read: 'read',
} as const;

export type NotificationStatus =
  (typeof NOTIFICATION_STATUS)[keyof typeof NOTIFICATION_STATUS];

/**
 * @deprecated Unused unified pairing model. Do not write. Collection
 * `mentorships` is not in COLLECTIONS. Kept so existing type imports compile.
 */
export const LEGACY_MENTORSHIP_STATUS = {
  pending: 'pending',
  active: 'active',
  paused: 'paused',
  completed: 'completed',
  declined: 'declined',
} as const;

/** @deprecated Use APPLICATION_STATUS or RELATIONSHIP_STATUS. */
export type MentorshipStatus =
  (typeof LEGACY_MENTORSHIP_STATUS)[keyof typeof LEGACY_MENTORSHIP_STATUS];

export function isVerificationStatus(value: unknown): value is VerificationStatus {
  return (
    value === VERIFICATION_STATUS.pending ||
    value === VERIFICATION_STATUS.approved ||
    value === VERIFICATION_STATUS.rejected
  );
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return (
    value === APPLICATION_STATUS.pending ||
    value === APPLICATION_STATUS.accepted ||
    value === APPLICATION_STATUS.declined
  );
}

export function isRelationshipStatus(value: unknown): value is RelationshipStatus {
  return (
    value === RELATIONSHIP_STATUS.active ||
    value === RELATIONSHIP_STATUS.paused ||
    value === RELATIONSHIP_STATUS.ended ||
    value === RELATIONSHIP_STATUS.terminated
  );
}

export function isLearningContractStatus(value: unknown): value is LearningContractStatus {
  return Object.values(LEARNING_CONTRACT_STATUS).includes(value as LearningContractStatus);
}

export function isMentorReviewStatus(status: LearningContractStatus): boolean {
  return (
    status === LEARNING_CONTRACT_STATUS.submittedByLearner ||
    status === LEARNING_CONTRACT_STATUS.underMentorReview ||
    status === LEARNING_CONTRACT_STATUS.revisionRequested
  );
}

export function isLearnerReviewStatus(status: LearningContractStatus): boolean {
  return (
    status === LEARNING_CONTRACT_STATUS.proposedByMentor ||
    status === LEARNING_CONTRACT_STATUS.underLearnerReview
  );
}

export function isContractActiveStatus(status: LearningContractStatus): boolean {
  return status === LEARNING_CONTRACT_STATUS.inProgress;
}

/** Mutually approved (or later) — the operational contract workspace. */
export function isOperationalContractStatus(status: LearningContractStatus): boolean {
  return (
    status === LEARNING_CONTRACT_STATUS.mutuallyApproved ||
    status === LEARNING_CONTRACT_STATUS.agreed ||
    status === LEARNING_CONTRACT_STATUS.inProgress ||
    status === LEARNING_CONTRACT_STATUS.paused ||
    status === LEARNING_CONTRACT_STATUS.completionPending ||
    status === LEARNING_CONTRACT_STATUS.completed
  );
}

export function isNegotiationOpen(status: LearningContractStatus): boolean {
  return (
    status === LEARNING_CONTRACT_STATUS.draft ||
    isMentorReviewStatus(status) ||
    isLearnerReviewStatus(status) ||
    status === LEARNING_CONTRACT_STATUS.mutuallyApproved
  );
}

export function isMilestoneStatus(value: unknown): value is MilestoneStatus {
  return (
    value === MILESTONE_STATUS.locked ||
    value === MILESTONE_STATUS.active ||
    value === MILESTONE_STATUS.submitted ||
    value === MILESTONE_STATUS.approved ||
    value === MILESTONE_STATUS.rejected
  );
}

export function isDeliverableStatus(value: unknown): value is DeliverableStatus {
  return (
    value === DELIVERABLE_STATUS.draft ||
    value === DELIVERABLE_STATUS.inProgress ||
    value === DELIVERABLE_STATUS.completed
  );
}

export function isStepOwner(value: unknown): value is StepOwner {
  return value === STEP_OWNER.learner || value === STEP_OWNER.mentor;
}

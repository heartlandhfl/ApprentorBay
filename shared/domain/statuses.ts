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
  ended: 'ended',
} as const;

export type RelationshipStatus =
  (typeof RELATIONSHIP_STATUS)[keyof typeof RELATIONSHIP_STATUS];

export const LEARNING_CONTRACT_STATUS = {
  draft: 'draft',
  underMentorReview: 'under_mentor_review',
  underLearnerReview: 'under_learner_review',
  /** Persisted in the type union; the current machine never writes this value. */
  agreed: 'agreed',
  inProgress: 'in_progress',
  completed: 'completed',
} as const;

export type LearningContractStatus =
  (typeof LEARNING_CONTRACT_STATUS)[keyof typeof LEARNING_CONTRACT_STATUS];

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
  return value === RELATIONSHIP_STATUS.active || value === RELATIONSHIP_STATUS.ended;
}

export function isLearningContractStatus(value: unknown): value is LearningContractStatus {
  return (
    value === LEARNING_CONTRACT_STATUS.draft ||
    value === LEARNING_CONTRACT_STATUS.underMentorReview ||
    value === LEARNING_CONTRACT_STATUS.underLearnerReview ||
    value === LEARNING_CONTRACT_STATUS.agreed ||
    value === LEARNING_CONTRACT_STATUS.inProgress ||
    value === LEARNING_CONTRACT_STATUS.completed
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

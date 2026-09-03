import {
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  type BookingPaymentStatus,
  type BookingStatus,
} from './bookings.js';
import {
  APPLICATION_STATUS,
  LEARNING_CONTRACT_STATUS,
  MILESTONE_STATUS,
  RELATIONSHIP_STATUS,
  SESSION_STATUS,
  VERIFICATION_STATUS,
  type ApplicationStatus,
  type LearningContractStatus,
  type MilestoneStatus,
  type RelationshipStatus,
  type SessionStatus,
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
  [VERIFICATION_STATUS.pending]: [
    VERIFICATION_STATUS.approved,
    VERIFICATION_STATUS.rejected,
    VERIFICATION_STATUS.suspended,
  ],
  [VERIFICATION_STATUS.approved]: [VERIFICATION_STATUS.rejected, VERIFICATION_STATUS.suspended],
  [VERIFICATION_STATUS.rejected]: [VERIFICATION_STATUS.approved, VERIFICATION_STATUS.pending],
  [VERIFICATION_STATUS.suspended]: [VERIFICATION_STATUS.approved, VERIFICATION_STATUS.rejected],
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

export const SESSION_TRANSITIONS: TransitionMap<SessionStatus> = {
  [SESSION_STATUS.scheduled]: [SESSION_STATUS.cancelled, SESSION_STATUS.completed],
  [SESSION_STATUS.cancelled]: [],
  [SESSION_STATUS.completed]: [],
};

export const MILESTONE_TRANSITIONS: TransitionMap<MilestoneStatus> = {
  [MILESTONE_STATUS.locked]: [MILESTONE_STATUS.active],
  [MILESTONE_STATUS.active]: [MILESTONE_STATUS.submitted],
  [MILESTONE_STATUS.submitted]: [
    MILESTONE_STATUS.underReview,
    MILESTONE_STATUS.approved,
    MILESTONE_STATUS.rejected,
    MILESTONE_STATUS.declined,
  ],
  [MILESTONE_STATUS.underReview]: [
    MILESTONE_STATUS.approved,
    MILESTONE_STATUS.rejected,
    MILESTONE_STATUS.declined,
  ],
  [MILESTONE_STATUS.rejected]: [MILESTONE_STATUS.submitted],
  [MILESTONE_STATUS.approved]: [],
  [MILESTONE_STATUS.declined]: [],
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

export const BOOKING_STATUS_TRANSITIONS: TransitionMap<BookingStatus> = {
  [BOOKING_STATUS.pendingPayment]: [
    BOOKING_STATUS.paid,
    BOOKING_STATUS.cancelled,
    BOOKING_STATUS.failed,
  ],
  [BOOKING_STATUS.paid]: [BOOKING_STATUS.refunded],
  [BOOKING_STATUS.cancelled]: [],
  [BOOKING_STATUS.refunded]: [],
  [BOOKING_STATUS.failed]: [],
};

export const BOOKING_PAYMENT_STATUS_TRANSITIONS: TransitionMap<BookingPaymentStatus> = {
  [BOOKING_PAYMENT_STATUS.pendingPayment]: [
    BOOKING_PAYMENT_STATUS.paid,
    BOOKING_PAYMENT_STATUS.cancelled,
    BOOKING_PAYMENT_STATUS.failed,
  ],
  [BOOKING_PAYMENT_STATUS.paid]: [BOOKING_PAYMENT_STATUS.refunded],
  [BOOKING_PAYMENT_STATUS.cancelled]: [],
  [BOOKING_PAYMENT_STATUS.refunded]: [],
  [BOOKING_PAYMENT_STATUS.failed]: [],
};

export function canTransitionBookingStatus(from: BookingStatus, to: BookingStatus): boolean {
  return canTransition(BOOKING_STATUS_TRANSITIONS, from, to);
}

export function canTransitionBookingPaymentStatus(
  from: BookingPaymentStatus,
  to: BookingPaymentStatus,
): boolean {
  return canTransition(BOOKING_PAYMENT_STATUS_TRANSITIONS, from, to);
}

export function canTransitionSession(from: SessionStatus, to: SessionStatus): boolean {
  return canTransition(SESSION_TRANSITIONS, from, to);
}

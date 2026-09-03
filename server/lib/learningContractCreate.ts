import {
  RELATIONSHIP_STATUS,
  USER_ROLE,
  canParticipate,
  canStartLearningJourney,
  createDraftContract,
  normalizeRelationship,
  paidMentorshipServicesBlocked,
  type LearningContract,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';

export type LearningContractCreateErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'invalid'
  | 'payment_required';

export class LearningContractCreateError extends Error {
  readonly code: LearningContractCreateErrorCode;
  readonly status: number;

  constructor(code: LearningContractCreateErrorCode, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function validateCreateLearningContract(
  account: User | undefined,
  rawRelationship: MentorshipRelationship | null | undefined,
): MentorshipRelationship {
  if (!account) {
    throw new LearningContractCreateError('unauthenticated', 'Sign in required', 401);
  }
  if (account.role !== USER_ROLE.learner) {
    throw new LearningContractCreateError(
      'forbidden',
      'Only the learner can start a learning journey',
      403,
    );
  }
  if (!canParticipate(account)) {
    throw new LearningContractCreateError(
      'forbidden',
      'This account cannot start a learning journey',
      403,
    );
  }

  if (!rawRelationship) {
    throw new LearningContractCreateError('not_found', 'Active relationship not found', 404);
  }

  const relationship = normalizeRelationship(rawRelationship);
  if (relationship.status !== RELATIONSHIP_STATUS.active) {
    throw new LearningContractCreateError('not_found', 'Active relationship not found', 404);
  }
  if (relationship.learnerId !== account.uid) {
    throw new LearningContractCreateError('forbidden', 'This is not your relationship', 403);
  }
  if (!canStartLearningJourney(account, relationship)) {
    if (paidMentorshipServicesBlocked(relationship)) {
      throw new LearningContractCreateError(
        'payment_required',
        'Complete payment before starting the learning journey',
        403,
      );
    }
    throw new LearningContractCreateError(
      'forbidden',
      'This account cannot start a learning journey',
      403,
    );
  }

  return relationship;
}

export function buildLearningContractForRelationship(input: {
  contractId: string;
  relationship: MentorshipRelationship;
  now?: string;
}): LearningContract {
  return createDraftContract({
    id: input.contractId,
    relationshipId: input.relationship.id,
    learnerId: input.relationship.learnerId,
    mentorId: input.relationship.mentorId,
    now: input.now ?? new Date().toISOString(),
  });
}

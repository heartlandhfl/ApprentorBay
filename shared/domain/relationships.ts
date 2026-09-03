import { PAIRING_ID_FIELD, USER_ROLE } from './identities.js';
import { RELATIONSHIP_STATUS, isRelationshipStatus, type RelationshipStatus } from './statuses.js';
import type { CommercialMode } from './mentorOffering.js';
import {
  normalizeApplicationCommercialFields,
  type RequestType,
} from './mentorshipRequest.js';
import type { IsoDateString, User } from './users.js';

/**
 * Mentorship Relationship — persisted as `mentorshipRelationships`.
 * This is a dedicated document, never inferred from application status.
 *
 * Older documents may omit applicationId / startedAt / updatedAt / endedAt.
 * Use `normalizeRelationship` when reading.
 */
export interface MentorshipRelationship {
  id: string;
  learnerId: string;
  mentorId: string;
  applicationId: string | null;
  status: RelationshipStatus;
  createdAt: IsoDateString;
  startedAt: IsoDateString;
  updatedAt: IsoDateString;
  endedAt: IsoDateString | null;
  /** Snapshot from the accepted application. Legacy docs omit commercial fields. */
  requestType?: RequestType;
  commercialMode?: CommercialMode;
  baseSessionPriceUsd?: number | null;
  sessionDurationMinutes?: number | null;
  /** True for paid requests until payment is recorded (future task). */
  paymentRequired?: boolean;
  paymentSatisfied?: boolean;
}

export type PairingMemberIds = Pick<MentorshipRelationship, 'learnerId' | 'mentorId'>;

export const RELATIONSHIP_STATUS_LABEL: Record<RelationshipStatus, string> = {
  [RELATIONSHIP_STATUS.active]: 'ACTIVE',
  [RELATIONSHIP_STATUS.paused]: 'PAUSED',
  [RELATIONSHIP_STATUS.ended]: 'ENDED',
  [RELATIONSHIP_STATUS.terminated]: 'TERMINATED',
};

/** One document per learner+mentor pair. Makes accept idempotent under retries. */
export function relationshipDocId(learnerId: string, mentorId: string): string {
  return `${learnerId}_${mentorId}`;
}

export function isActiveRelationship(
  relationship: Pick<MentorshipRelationship, 'status'>,
): boolean {
  return relationship.status === RELATIONSHIP_STATUS.active;
}

export function isOpenRelationship(
  relationship: Pick<MentorshipRelationship, 'status'>,
): boolean {
  return (
    relationship.status === RELATIONSHIP_STATUS.active ||
    relationship.status === RELATIONSHIP_STATUS.paused
  );
}

export function isClosedRelationship(
  relationship: Pick<MentorshipRelationship, 'status'>,
): boolean {
  return (
    relationship.status === RELATIONSHIP_STATUS.ended ||
    relationship.status === RELATIONSHIP_STATUS.terminated
  );
}

export function isPairingMember(uid: string, pairing: PairingMemberIds): boolean {
  return pairing.learnerId === uid || pairing.mentorId === uid;
}

export function otherPartyId(pairing: PairingMemberIds, uid: string): string {
  return pairing.learnerId === uid ? pairing.mentorId : pairing.learnerId;
}

export function pairingIdForAccount(
  account: Pick<User, 'uid' | 'role'>,
  pairing: PairingMemberIds,
): string {
  return account.role === USER_ROLE.mentor ? pairing.mentorId : pairing.learnerId;
}

export function counterpartField(uid: string, pairing: PairingMemberIds) {
  return pairing.learnerId === uid ? PAIRING_ID_FIELD.mentor : PAIRING_ID_FIELD.learner;
}

export function buildActiveRelationship(input: {
  id: string;
  learnerId: string;
  mentorId: string;
  applicationId: string;
  now: IsoDateString;
  commercial?: Pick<
    MentorshipRelationship,
    | 'requestType'
    | 'commercialMode'
    | 'baseSessionPriceUsd'
    | 'sessionDurationMinutes'
    | 'paymentRequired'
    | 'paymentSatisfied'
  >;
}): MentorshipRelationship {
  return {
    id: input.id,
    learnerId: input.learnerId,
    mentorId: input.mentorId,
    applicationId: input.applicationId,
    status: RELATIONSHIP_STATUS.active,
    createdAt: input.now,
    startedAt: input.now,
    updatedAt: input.now,
    endedAt: null,
    ...input.commercial,
  };
}

export function normalizeRelationship(
  raw: Partial<MentorshipRelationship> & { id?: string },
): MentorshipRelationship {
  const createdAt = raw.createdAt ?? '';
  const status = isRelationshipStatus(raw.status) ? raw.status : RELATIONSHIP_STATUS.active;
  const commercial = normalizeApplicationCommercialFields({
    requestType: raw.requestType,
    commercialMode: raw.commercialMode,
    baseSessionPriceUsd: raw.baseSessionPriceUsd,
    sessionDurationMinutes: raw.sessionDurationMinutes,
  });
  const paymentRequired = raw.paymentRequired ?? commercial.paymentRequired;
  const paymentSatisfied =
    raw.paymentSatisfied ??
    (paymentRequired ? false : true);
  return {
    id: raw.id ?? '',
    learnerId: raw.learnerId ?? '',
    mentorId: raw.mentorId ?? '',
    applicationId: raw.applicationId ?? null,
    status,
    createdAt,
    startedAt: raw.startedAt ?? createdAt,
    updatedAt: raw.updatedAt ?? createdAt,
    endedAt:
      raw.endedAt ??
      (status === RELATIONSHIP_STATUS.ended || status === RELATIONSHIP_STATUS.terminated
        ? (raw.updatedAt ?? createdAt)
        : null),
    requestType: raw.requestType ?? commercial.requestType,
    commercialMode: raw.commercialMode ?? commercial.commercialMode,
    baseSessionPriceUsd: raw.baseSessionPriceUsd ?? commercial.baseSessionPriceUsd,
    sessionDurationMinutes: raw.sessionDurationMinutes ?? commercial.sessionDurationMinutes,
    paymentRequired,
    paymentSatisfied,
  };
}

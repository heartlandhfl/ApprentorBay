import { PAIRING_ID_FIELD, USER_ROLE } from './identities.js';
import { RELATIONSHIP_STATUS, type RelationshipStatus } from './statuses.js';
import type { IsoDateString, User } from './users.js';

/**
 * Mentorship Relationship — persisted as `mentorshipRelationships`.
 * Pairing members are identified by learnerId + mentorId.
 */
export interface MentorshipRelationship {
  id: string;
  learnerId: string;
  mentorId: string;
  status: RelationshipStatus;
  createdAt: IsoDateString;
}

export type PairingMemberIds = Pick<MentorshipRelationship, 'learnerId' | 'mentorId'>;

export function isActiveRelationship(
  relationship: Pick<MentorshipRelationship, 'status'>,
): boolean {
  return relationship.status === RELATIONSHIP_STATUS.active;
}

export function isPairingMember(
  uid: string,
  pairing: PairingMemberIds,
): boolean {
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

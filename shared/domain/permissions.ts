import { APPLICATION_STATUS, RELATIONSHIP_STATUS, VERIFICATION_STATUS } from './statuses.js';
import { USER_ROLE } from './identities.js';
import { isAccountActive, type MentorProfile, type User } from './users.js';
import { isPendingApplication, type MentorshipApplication } from './applications.js';
import {
  isOpenRelationship,
  isPairingMember,
  type MentorshipRelationship,
  type PairingMemberIds,
} from './relationships.js';
import { validateApplicationMessage, validateMessageText } from './validation.js';

export type PermissionActor = Pick<User, 'uid' | 'role' | 'active'>;

export function canAdminister(actor: PermissionActor | null | undefined): boolean {
  return Boolean(actor && actor.role === USER_ROLE.admin && isAccountActive(actor));
}

export function canApplyForMentorship(
  actor: PermissionActor | null | undefined,
  mentor: Pick<MentorProfile, 'userId' | 'verificationStatus'>,
  message: string,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (actor.uid === mentor.userId) return false;
  if (mentor.verificationStatus !== VERIFICATION_STATUS.approved) return false;
  return validateApplicationMessage(message).ok;
}

export function canAcceptApplication(
  actor: PermissionActor | null | undefined,
  application: Pick<MentorshipApplication, 'mentorId' | 'status'>,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role !== USER_ROLE.mentor) return false;
  if (actor.uid !== application.mentorId) return false;
  return isPendingApplication(application);
}

export function canDeclineApplication(
  actor: PermissionActor | null | undefined,
  application: Pick<MentorshipApplication, 'mentorId' | 'status'>,
): boolean {
  return canAcceptApplication(actor, application);
}

export function canReadPairing(
  actor: PermissionActor | null | undefined,
  pairing: PairingMemberIds,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, pairing);
}

export function canSendMessage(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
  text: string,
): boolean {
  if (!canReadPairing(actor, relationship)) return false;
  if (actor?.role === USER_ROLE.admin) return false;
  if (relationship.status !== RELATIONSHIP_STATUS.active) return false;
  return validateMessageText(text).ok;
}

export function canStartLearningJourney(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (relationship.learnerId !== actor.uid) return false;
  return relationship.status === RELATIONSHIP_STATUS.active;
}

export function canPauseRelationship(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (relationship.status !== RELATIONSHIP_STATUS.active) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, relationship);
}

export function canResumeRelationship(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (relationship.status !== RELATIONSHIP_STATUS.paused) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, relationship);
}

export function canEndRelationship(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (!isOpenRelationship(relationship)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, relationship);
}

export function canTerminateRelationship(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!canAdminister(actor)) return false;
  return relationship.status !== RELATIONSHIP_STATUS.terminated;
}

export function canDecideVerification(actor: PermissionActor | null | undefined): boolean {
  return canAdminister(actor);
}

export function canSuspendAccount(
  actor: PermissionActor | null | undefined,
  target: Pick<User, 'uid' | 'role'>,
): boolean {
  if (!canAdminister(actor) || !actor) return false;
  if (actor.uid === target.uid) return false;
  return target.role !== USER_ROLE.admin;
}

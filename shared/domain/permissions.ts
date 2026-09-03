import {
  APPLICATION_STATUS,
  LEARNING_CONTRACT_STATUS,
  RELATIONSHIP_STATUS,
  SESSION_STATUS,
  VERIFICATION_STATUS,
} from './statuses.js';
import { USER_ROLE } from './identities.js';
import { canParticipate } from './administration.js';
import { isAccountActive, type MentorProfile, type User } from './users.js';
import {
  isOpenBookingPaymentStatus,
  isOpenBookingStatus,
  validateBookingRelationship,
  type MentorshipBooking,
} from './bookings.js';
import {
  PAYMENT_STATUS,
  type PaymentIntent,
} from './payments.js';
import { isPendingApplication, type MentorshipApplication } from './applications.js';
import { validateMentorApplicationTarget, canAccessPaidMentorshipServices } from './mentorshipRequest.js';
import {
  isOpenRelationship,
  isPairingMember,
  type MentorshipRelationship,
  type PairingMemberIds,
} from './relationships.js';
import {
  isTerminalSessionStatus,
  sessionJoinWindow,
  sessionPaymentAccessGranted,
  type MentorshipSession,
} from './sessions.js';
import type { LearningContract } from './learningContracts.js';
import { validateApplicationMessage, validateMessageText } from './validation.js';

export type PermissionActor = Pick<User, 'uid' | 'role' | 'active' | 'accountStatus'>;

export function canAdminister(actor: PermissionActor | null | undefined): boolean {
  return Boolean(actor && actor.role === USER_ROLE.admin && isAccountActive(actor));
}

export function canApplyForMentorship(
  actor: PermissionActor | null | undefined,
  mentor: Pick<
    MentorProfile,
    | 'userId'
    | 'verificationStatus'
    | 'public'
    | 'acceptsNewLearners'
    | 'commercialMode'
    | 'baseSessionPriceUsd'
    | 'sessionPriceUsd'
    | 'sessionDurationMinutes'
    | 'mentorType'
    | 'serviceDescription'
    | 'servicesDescription'
    | 'includedMessaging'
    | 'messagingIncluded'
    | 'offersVideoSessions'
  >,
  message: string,
): boolean {
  if (!actor || !canParticipate(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (actor.uid === mentor.userId) return false;
  if (mentor.verificationStatus !== VERIFICATION_STATUS.approved) return false;
  if (mentor.public === false) return false;
  if (mentor.acceptsNewLearners === false) return false;
  if (!validateApplicationMessage(message).ok) return false;
  return validateMentorApplicationTarget(mentor).ok;
}

export function canAcceptApplication(
  actor: PermissionActor | null | undefined,
  application: Pick<MentorshipApplication, 'mentorId' | 'status'>,
): boolean {
  if (!actor || !canParticipate(actor)) return false;
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
  if (!actor || !canParticipate(actor)) return false;
  if (!canReadPairing(actor, relationship)) return false;
  if (actor.role === USER_ROLE.admin) return false;
  if (relationship.status !== RELATIONSHIP_STATUS.active) return false;
  return validateMessageText(text).ok;
}

export function canAccessContractWorkspace(
  actor: PermissionActor | null | undefined,
  contract: Pick<LearningContract, 'learnerId' | 'mentorId'>,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return actor.uid === contract.learnerId || actor.uid === contract.mentorId;
}

export function canReadEvidenceObject(
  actor: PermissionActor | null | undefined,
  contract: Pick<LearningContract, 'learnerId' | 'mentorId'>,
): boolean {
  return canAccessContractWorkspace(actor, contract);
}

export function canPublishContractShowcase(
  actor: PermissionActor | null | undefined,
  contract: Pick<LearningContract, 'learnerId' | 'status'>,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (actor.uid !== contract.learnerId) return false;
  return contract.status === LEARNING_CONTRACT_STATUS.completed;
}

export function canWriteEvidenceObject(
  actor: PermissionActor | null | undefined,
  contract: Pick<LearningContract, 'learnerId' | 'mentorId'>,
  pathUserId: string,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (actor.uid !== contract.learnerId) return false;
  return actor.uid === pathUserId;
}

export function canStartLearningJourney(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!actor || !canParticipate(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (relationship.learnerId !== actor.uid) return false;
  if (relationship.status !== RELATIONSHIP_STATUS.active) return false;
  return canAccessPaidMentorshipServices(relationship);
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
  if (!actor || !canParticipate(actor)) return false;
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

export function canReadPrivateProfile(
  actor: PermissionActor | null | undefined,
  profileUserId: string,
  pairing?: PairingMemberIds | null,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  if (actor.uid === profileUserId) return true;
  return Boolean(pairing && isPairingMember(actor.uid, pairing));
}

export function canEditOwnProfile(
  actor: PermissionActor | null | undefined,
  profileUserId: string,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  return actor.uid === profileUserId && actor.role !== USER_ROLE.admin;
}

export function canSuspendAccount(
  actor: PermissionActor | null | undefined,
  target: Pick<User, 'uid' | 'role'>,
): boolean {
  if (!canAdminister(actor) || !actor) return false;
  if (actor.uid === target.uid) return false;
  return target.role !== USER_ROLE.admin;
}

export function canRestrictAccount(
  actor: PermissionActor | null | undefined,
  target: Pick<User, 'uid' | 'role'>,
): boolean {
  return canSuspendAccount(actor, target);
}

export function canTerminateAccount(
  actor: PermissionActor | null | undefined,
  target: Pick<User, 'uid' | 'role'>,
): boolean {
  return canSuspendAccount(actor, target);
}

export function canChangeOwnRole(_actor: PermissionActor | null | undefined): boolean {
  return false;
}

export function canSelfApprove(_actor: PermissionActor | null | undefined): boolean {
  return false;
}

export function canCreateBooking(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
  existingOpenBookings: readonly Pick<MentorshipBooking, 'paymentStatus' | 'bookingStatus'>[] = [],
): boolean {
  if (!actor || !canParticipate(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (relationship.learnerId !== actor.uid) return false;
  if (!validateBookingRelationship(relationship).ok) return false;
  const hasOpenBooking = existingOpenBookings.some(
    (booking) => isOpenBookingPaymentStatus(booking.paymentStatus) || isOpenBookingStatus(booking.bookingStatus),
  );
  return !hasOpenBooking;
}

export function canReadBooking(
  actor: PermissionActor | null | undefined,
  booking: Pick<MentorshipBooking, 'learnerId' | 'mentorId'>,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, booking);
}

export function canCancelBooking(
  actor: PermissionActor | null | undefined,
  booking: MentorshipBooking,
): boolean {
  if (!canReadBooking(actor, booking)) return false;
  if (!isOpenBookingStatus(booking.bookingStatus)) return false;
  if (!isOpenBookingPaymentStatus(booking.paymentStatus)) return false;
  if (actor?.role === USER_ROLE.admin) return true;
  return isPairingMember(actor?.uid ?? '', booking);
}

export function canStartCheckout(
  actor: PermissionActor | null | undefined,
  booking: MentorshipBooking,
): boolean {
  if (!actor || !canParticipate(actor)) return false;
  if (actor.role !== USER_ROLE.learner) return false;
  if (booking.learnerId !== actor.uid) return false;
  return isOpenBookingPaymentStatus(booking.paymentStatus) && isOpenBookingStatus(booking.bookingStatus);
}

export function canReadPaymentIntent(
  actor: PermissionActor | null | undefined,
  intent: Pick<PaymentIntent, 'learnerId' | 'mentorId'>,
): boolean {
  return canReadBooking(actor, intent);
}

export function canRequestRefund(
  actor: PermissionActor | null | undefined,
  intent: Pick<PaymentIntent, 'learnerId' | 'mentorId' | 'status'>,
): boolean {
  if (!canAdminister(actor)) return false;
  return intent.status === PAYMENT_STATUS.paid || intent.status === PAYMENT_STATUS.partiallyRefunded;
}

export function canReadSession(
  actor: PermissionActor | null | undefined,
  session: Pick<MentorshipSession, 'learnerId' | 'mentorId'>,
): boolean {
  return canReadPairing(actor, session);
}

export function canScheduleSession(
  actor: PermissionActor | null | undefined,
  relationship: MentorshipRelationship,
): boolean {
  if (!actor || !canParticipate(actor)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  if (!isPairingMember(actor.uid, relationship)) return false;
  return relationship.status === RELATIONSHIP_STATUS.active;
}

export function canCancelSession(
  actor: PermissionActor | null | undefined,
  session: MentorshipSession,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (session.status !== SESSION_STATUS.scheduled) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, session);
}

export function canCompleteSession(
  actor: PermissionActor | null | undefined,
  session: MentorshipSession,
): boolean {
  if (!actor || !isAccountActive(actor)) return false;
  if (session.status !== SESSION_STATUS.scheduled) return false;
  if (isTerminalSessionStatus(session.status)) return false;
  if (actor.role === USER_ROLE.admin) return true;
  return isPairingMember(actor.uid, session);
}

export function canJoinSession(
  actor: PermissionActor | null | undefined,
  session: MentorshipSession,
  relationship: MentorshipRelationship,
  booking: Pick<MentorshipBooking, 'id' | 'paymentStatus' | 'bookingStatus' | 'sessionId'> | null | undefined,
  now?: string,
): boolean {
  if (!actor || !canParticipate(actor)) return false;
  if (!canReadSession(actor, session)) return false;
  if (session.relationshipId !== relationship.id) return false;
  if (session.status !== SESSION_STATUS.scheduled) return false;
  if (relationship.status !== RELATIONSHIP_STATUS.active) return false;
  if (actor.role === USER_ROLE.admin) return true;
  if (!isPairingMember(actor.uid, session)) return false;
  if (!sessionPaymentAccessGranted(session, booking, relationship)) return false;
  return sessionJoinWindow(session, now).joinable;
}

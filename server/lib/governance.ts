import {
  ACCOUNT_STATUS,
  AUDIT_EVENT,
  COLLECTIONS,
  USER_ROLE,
  VERIFICATION_CASE_STATUS,
  VERIFICATION_STATUS,
  accountActiveFlag,
  accountStatusOf,
  canChangeAccountStatus,
  canTransitionVerification,
  deriveVerificationCase,
  isAccountStatus,
  validateAdminReason,
  verifiedClaimSet,
  type AccountStatus,
  type MentorProfile,
  type User,
  type VerificationStatus,
} from '@apprentorbay/shared';
import { recordAudit } from './audit.js';
import { adminDb } from './firebase.js';
import { writePublicProfile } from './profiles.js';

function nowIso() {
  return new Date().toISOString();
}

export async function loadUser(userId: string): Promise<User | null> {
  const snap = await adminDb().collection(COLLECTIONS.users).doc(userId).get();
  if (!snap.exists) return null;
  const user = snap.data() as User;
  return { ...user, accountStatus: accountStatusOf(user) };
}

export async function applyAccountStatus(input: {
  admin: User;
  userId: string;
  status: AccountStatus;
  reason?: string;
}): Promise<User> {
  if (!isAccountStatus(input.status)) {
    throw Object.assign(new Error('Invalid account status'), { status: 400 });
  }
  const required = input.status !== ACCOUNT_STATUS.active;
  const reason = validateAdminReason(input.reason, required);
  if (!reason.ok) {
    throw Object.assign(new Error(reason.error), { status: 400 });
  }

  const user = await loadUser(input.userId);
  if (!user) {
    throw Object.assign(new Error('Account not found'), { status: 404 });
  }
  if (input.admin.uid === input.userId) {
    throw Object.assign(new Error('Administrators cannot change their own account'), { status: 403 });
  }
  if (!canChangeAccountStatus(input.admin, user, input.status)) {
    throw Object.assign(new Error('That account status cannot be changed'), { status: 403 });
  }

  const userRef = adminDb().collection(COLLECTIONS.users).doc(input.userId);
  const profileCollection =
    user.role === USER_ROLE.mentor ? COLLECTIONS.mentorProfiles : COLLECTIONS.learnerProfiles;
  const profileRef = adminDb().collection(profileCollection).doc(input.userId);
  const profileSnap = await profileRef.get();
  const participating = input.status === ACCOUNT_STATUS.active;

  const batch = adminDb().batch();
  batch.update(userRef, {
    active: accountActiveFlag(input.status),
    accountStatus: input.status,
  });

  if (profileSnap.exists) {
    const profile = profileSnap.data() as MentorProfile;
    const patch: Record<string, unknown> = {};
    if (!participating) {
      patch.public = false;
    }
    if (user.role === USER_ROLE.mentor) {
      if (input.status === ACCOUNT_STATUS.suspended || input.status === ACCOUNT_STATUS.terminated) {
        patch.previousVerificationStatus = profile.verificationStatus;
        patch.verificationStatus = VERIFICATION_STATUS.suspended;
      } else if (
        profile.verificationStatus === VERIFICATION_STATUS.suspended &&
        participating
      ) {
        patch.verificationStatus = profile.previousVerificationStatus ?? VERIFICATION_STATUS.pending;
      }
    }
    batch.update(profileRef, patch);
  }
  await batch.commit();

  if (profileSnap.exists && (user.role === USER_ROLE.mentor || user.role === USER_ROLE.learner)) {
    await writePublicProfile(input.userId, user.role);
  }

  const action =
    input.status === ACCOUNT_STATUS.restricted
      ? AUDIT_EVENT.accountRestricted
      : input.status === ACCOUNT_STATUS.suspended
        ? AUDIT_EVENT.accountSuspended
        : input.status === ACCOUNT_STATUS.terminated
          ? AUDIT_EVENT.accountTerminated
          : AUDIT_EVENT.accountRestored;

  await recordAudit({
    actorId: input.admin.uid,
    adminId: input.admin.uid,
    action,
    targetUserId: input.userId,
    reason: reason.reason,
    metadata: { accountStatus: input.status, role: user.role },
  });

  return {
    ...user,
    active: accountActiveFlag(input.status),
    accountStatus: input.status,
  };
}

export async function applyMentorApproval(input: {
  admin: User;
  userId: string;
  status: VerificationStatus;
  reason?: string;
}): Promise<MentorProfile> {
  const required = input.status !== VERIFICATION_STATUS.approved;
  const reason = validateAdminReason(input.reason, required);
  if (!reason.ok) {
    throw Object.assign(new Error(reason.error), { status: 400 });
  }

  const ref = adminDb().collection(COLLECTIONS.mentorProfiles).doc(input.userId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('Mentor profile not found'), { status: 404 });
  }
  if (input.admin.uid === input.userId) {
    throw Object.assign(new Error('Administrators cannot approve their own mentor profile'), { status: 403 });
  }
  const profile = snap.data() as MentorProfile;
  if (!canTransitionVerification(profile.verificationStatus, input.status)) {
    throw Object.assign(new Error('That approval status cannot be changed'), { status: 400 });
  }

  await ref.update({
    verificationStatus: input.status,
    previousVerificationStatus: profile.verificationStatus,
    public: input.status === VERIFICATION_STATUS.approved,
  });
  await writePublicProfile(input.userId, USER_ROLE.mentor);

  const action =
    input.status === VERIFICATION_STATUS.approved
      ? AUDIT_EVENT.mentorApproved
      : input.status === VERIFICATION_STATUS.rejected
        ? AUDIT_EVENT.mentorRejected
        : AUDIT_EVENT.mentorSuspended;

  await recordAudit({
    actorId: input.admin.uid,
    adminId: input.admin.uid,
    action,
    targetUserId: input.userId,
    reason: reason.reason,
    metadata: { approvalStatus: input.status },
  });

  return { ...profile, verificationStatus: input.status };
}

export async function applyMentorVerification(input: {
  admin: User;
  userId: string;
  verified: boolean;
  reason?: string;
}): Promise<MentorProfile> {
  const reason = validateAdminReason(input.reason, !input.verified);
  if (!reason.ok) {
    throw Object.assign(new Error(reason.error), { status: 400 });
  }
  const ref = adminDb().collection(COLLECTIONS.mentorProfiles).doc(input.userId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('Mentor profile not found'), { status: 404 });
  }
  if (input.admin.uid === input.userId) {
    throw Object.assign(new Error('Administrators cannot verify their own mentor profile'), { status: 403 });
  }
  const profile = snap.data() as MentorProfile;
  const now = nowIso();
  const claims = verifiedClaimSet(input.verified, now);
  const verificationCaseStatus = deriveVerificationCase(
    claims,
    input.verified ? VERIFICATION_CASE_STATUS.verified : VERIFICATION_CASE_STATUS.notSubmitted,
  );
  await ref.update({ verifiedClaims: claims, verificationCaseStatus });
  await writePublicProfile(input.userId, USER_ROLE.mentor);
  await recordAudit({
    actorId: input.admin.uid,
    adminId: input.admin.uid,
    action: input.verified ? AUDIT_EVENT.mentorVerified : AUDIT_EVENT.verificationRemoved,
    targetUserId: input.userId,
    reason: reason.reason,
    metadata: { verified: String(input.verified) },
  });
  return { ...profile, verifiedClaims: claims, verificationCaseStatus };
}

export async function applyVerificationCase(input: {
  admin: User;
  userId: string;
  status: typeof VERIFICATION_CASE_STATUS.underReview | typeof VERIFICATION_CASE_STATUS.submitted;
  reason?: string;
}): Promise<MentorProfile> {
  const ref = adminDb().collection(COLLECTIONS.mentorProfiles).doc(input.userId);
  const snap = await ref.get();
  if (!snap.exists) {
    throw Object.assign(new Error('Mentor profile not found'), { status: 404 });
  }
  const profile = snap.data() as MentorProfile;
  await ref.update({ verificationCaseStatus: input.status });
  await recordAudit({
    actorId: input.admin.uid,
    adminId: input.admin.uid,
    action: AUDIT_EVENT.verificationReviewed,
    targetUserId: input.userId,
    reason: input.reason?.trim() || null,
    metadata: { verificationCaseStatus: input.status },
  });
  return { ...profile, verificationCaseStatus: input.status };
}

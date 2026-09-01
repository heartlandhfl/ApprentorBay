import { USER_ROLE, type UserRole } from './identities.js';
import {
  ACCOUNT_STATUS,
  SUPPORT_ISSUE_STATUS,
  VERIFICATION_CASE_STATUS,
  VERIFIED_CLAIM_TYPE,
  isAccountStatus,
  type AccountStatus,
  type SupportIssueStatus,
  type VerificationCaseStatus,
  type VerifiedClaim,
  type VerifiedClaimType,
} from './statuses.js';
import type { IsoDateString, User } from './users.js';

export {
  ACCOUNT_STATUS,
  SUPPORT_ISSUE_STATUS,
  VERIFICATION_CASE_STATUS,
} from './statuses.js';
export type { AccountStatus, SupportIssueStatus, VerificationCaseStatus } from './statuses.js';

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  [ACCOUNT_STATUS.active]: 'Active',
  [ACCOUNT_STATUS.restricted]: 'Restricted',
  [ACCOUNT_STATUS.suspended]: 'Suspended',
  [ACCOUNT_STATUS.terminated]: 'Terminated',
};

export const VERIFICATION_CASE_STATUS_LABEL: Record<VerificationCaseStatus, string> = {
  [VERIFICATION_CASE_STATUS.notSubmitted]: 'Not submitted',
  [VERIFICATION_CASE_STATUS.submitted]: 'Submitted',
  [VERIFICATION_CASE_STATUS.underReview]: 'Under review',
  [VERIFICATION_CASE_STATUS.verified]: 'Verified',
  [VERIFICATION_CASE_STATUS.partiallyVerified]: 'Partially verified',
};

export interface SupportIssue {
  id: string;
  reporterId: string;
  reporterRole: UserRole;
  reporterName: string;
  subject: string;
  body: string;
  status: SupportIssueStatus;
  createdAt: IsoDateString;
  resolvedAt: IsoDateString | null;
  resolvedBy: string | null;
}

export const ADMIN_ACTION = {
  approveMentor: 'APPROVE_MENTOR',
  rejectMentor: 'REJECT_MENTOR',
  suspendMentor: 'SUSPEND_MENTOR',
  verifyMentor: 'VERIFY_MENTOR',
  removeVerification: 'REMOVE_VERIFICATION',
  reviewVerification: 'REVIEW_VERIFICATION',
  suspendAccount: 'SUSPEND_ACCOUNT',
  restrictAccount: 'RESTRICT_ACCOUNT',
  terminateAccount: 'TERMINATE_ACCOUNT',
  restoreAccount: 'RESTORE_ACCOUNT',
  resolveSupportIssue: 'RESOLVE_SUPPORT_ISSUE',
} as const;

export type AdminAction = (typeof ADMIN_ACTION)[keyof typeof ADMIN_ACTION];

export const ACCOUNT_STATUS_TRANSITIONS: Record<AccountStatus, readonly AccountStatus[]> = {
  [ACCOUNT_STATUS.active]: [
    ACCOUNT_STATUS.restricted,
    ACCOUNT_STATUS.suspended,
    ACCOUNT_STATUS.terminated,
  ],
  [ACCOUNT_STATUS.restricted]: [
    ACCOUNT_STATUS.active,
    ACCOUNT_STATUS.suspended,
    ACCOUNT_STATUS.terminated,
  ],
  [ACCOUNT_STATUS.suspended]: [
    ACCOUNT_STATUS.active,
    ACCOUNT_STATUS.restricted,
    ACCOUNT_STATUS.terminated,
  ],
  [ACCOUNT_STATUS.terminated]: [],
};

export function accountStatusOf(
  user: Pick<User, 'active'> & { accountStatus?: AccountStatus } | null | undefined,
): AccountStatus {
  if (!user) return ACCOUNT_STATUS.terminated;
  if (isAccountStatus(user.accountStatus)) return user.accountStatus;
  return user.active === false ? ACCOUNT_STATUS.suspended : ACCOUNT_STATUS.active;
}

export function canSignIn(user: Pick<User, 'active'> & { accountStatus?: AccountStatus } | null | undefined): boolean {
  const status = accountStatusOf(user);
  return status === ACCOUNT_STATUS.active || status === ACCOUNT_STATUS.restricted;
}

export function isAccountRestricted(
  user: Pick<User, 'active'> & { accountStatus?: AccountStatus } | null | undefined,
): boolean {
  return accountStatusOf(user) === ACCOUNT_STATUS.restricted;
}

export function canParticipate(
  user: (Pick<User, 'active' | 'role'> & { accountStatus?: AccountStatus }) | null | undefined,
): boolean {
  if (!user || !canSignIn(user)) return false;
  return !isAccountRestricted(user);
}

export function canTransitionAccountStatus(from: AccountStatus, to: AccountStatus): boolean {
  return ACCOUNT_STATUS_TRANSITIONS[from].includes(to);
}

export function accountActiveFlag(status: AccountStatus): boolean {
  return status === ACCOUNT_STATUS.active || status === ACCOUNT_STATUS.restricted;
}

export function reasonRequiredForAccountStatus(status: AccountStatus): boolean {
  return (
    status === ACCOUNT_STATUS.restricted ||
    status === ACCOUNT_STATUS.suspended ||
    status === ACCOUNT_STATUS.terminated
  );
}

export function deriveVerificationCase(
  claims: readonly VerifiedClaim[],
  explicit?: VerificationCaseStatus | null,
): VerificationCaseStatus {
  const verifiedTypes = new Set(claims.filter((item) => item.verified).map((item) => item.type));
  const allTypes = Object.values(VERIFIED_CLAIM_TYPE) as VerifiedClaimType[];
  if (allTypes.every((type) => verifiedTypes.has(type))) {
    return VERIFICATION_CASE_STATUS.verified;
  }
  if (verifiedTypes.size > 0) return VERIFICATION_CASE_STATUS.partiallyVerified;
  if (explicit === VERIFICATION_CASE_STATUS.underReview) return VERIFICATION_CASE_STATUS.underReview;
  if (explicit === VERIFICATION_CASE_STATUS.submitted) return VERIFICATION_CASE_STATUS.submitted;
  return VERIFICATION_CASE_STATUS.notSubmitted;
}

export function isPendingVerificationCase(status: VerificationCaseStatus): boolean {
  return (
    status === VERIFICATION_CASE_STATUS.submitted ||
    status === VERIFICATION_CASE_STATUS.underReview ||
    status === VERIFICATION_CASE_STATUS.partiallyVerified
  );
}

export function allClaimTypesVerified(claims: readonly VerifiedClaim[]): boolean {
  return deriveVerificationCase(claims) === VERIFICATION_CASE_STATUS.verified;
}

export function verifiedClaimSet(verified: boolean, now: IsoDateString): VerifiedClaim[] {
  return (Object.values(VERIFIED_CLAIM_TYPE) as VerifiedClaimType[]).map((type) => ({
    type,
    verified,
    verifiedAt: verified ? now : null,
  }));
}

export type GovernanceActor = Pick<User, 'uid' | 'role' | 'active' | 'accountStatus'>;

export function canGovernAccounts(actor: GovernanceActor | null | undefined): boolean {
  return Boolean(
    actor &&
      actor.role === USER_ROLE.admin &&
      accountStatusOf(actor) === ACCOUNT_STATUS.active,
  );
}

export function canChangeAccountStatus(
  actor: GovernanceActor | null | undefined,
  target: Pick<User, 'uid' | 'role' | 'accountStatus' | 'active'>,
  next: AccountStatus,
): boolean {
  if (!canGovernAccounts(actor) || !actor) return false;
  if (actor.uid === target.uid) return false;
  if (target.role === USER_ROLE.admin) return false;
  return canTransitionAccountStatus(accountStatusOf(target), next);
}

export function canApproveMentor(actor: GovernanceActor | null | undefined): boolean {
  return canGovernAccounts(actor);
}

export function canVerifyMentor(actor: GovernanceActor | null | undefined): boolean {
  return canGovernAccounts(actor);
}

export function validateAdminReason(reason: string | undefined, required: boolean): { ok: true; reason: string | null } | { ok: false; error: string } {
  const trimmed = reason?.trim() ?? '';
  if (required && trimmed.length < 3) {
    return { ok: false, error: 'A reason is required for this action' };
  }
  if (trimmed.length > 1000) {
    return { ok: false, error: 'Reason must be at most 1000 characters' };
  }
  return { ok: true, reason: trimmed || null };
}

export function validateSupportIssue(input: { subject?: string; body?: string }): { ok: true; subject: string; body: string } | { ok: false; error: string } {
  const subject = input.subject?.trim() ?? '';
  const body = input.body?.trim() ?? '';
  if (subject.length < 3) return { ok: false, error: 'Subject must be at least 3 characters' };
  if (subject.length > 120) return { ok: false, error: 'Subject must be at most 120 characters' };
  if (body.length < 8) return { ok: false, error: 'Describe the issue in a little more detail' };
  if (body.length > 4000) return { ok: false, error: 'Description must be at most 4000 characters' };
  return { ok: true, subject, body };
}

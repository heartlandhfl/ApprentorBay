import type {
  AccountRow,
  AccountStatus,
  AdminAuditLog,
  AdminCounts,
  ApiError,
  ClientContractAction,
  LearningContract,
  MentorshipApplication,
  MentorshipRelationship,
  PendingMentorRow,
  RelationshipStatus,
  SupportIssue,
  User,
  VerificationStatus,
} from '@apprentorbay/shared';
import { getFirebaseAuth } from './firebase';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = (await response.json()) as { error?: ApiError };
      if (body.error?.message) message = body.error.message;
    } catch {
      // keep default message
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

async function authHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth()?.currentUser;
  const token = user ? await user.getIdToken() : null;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listPendingMentors(): Promise<PendingMentorRow[]> {
  const response = await fetch('/api/admin/mentors/pending', {
    headers: await authHeaders(),
  });
  const body = await readJson<{ rows: PendingMentorRow[] }>(response);
  return body.rows;
}

export async function listPendingVerification(): Promise<PendingMentorRow[]> {
  const response = await fetch('/api/admin/mentors/verification', {
    headers: await authHeaders(),
  });
  const body = await readJson<{ rows: PendingMentorRow[] }>(response);
  return body.rows;
}

export async function setMentorVerification(
  userId: string,
  status: Exclude<VerificationStatus, 'pending'>,
  reason?: string,
) {
  const response = await fetch(`/api/admin/mentors/${userId}/verification`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ userId, status, reason }),
  });
  return readJson<{ profile: { verificationStatus: VerificationStatus } }>(response);
}

export async function setMentorVerified(userId: string, verified: boolean, reason?: string) {
  const response = await fetch(`/api/admin/mentors/${userId}/verify`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ verified, reason }),
  });
  return readJson<{ profile: unknown }>(response);
}

export async function setVerificationCase(userId: string, status: 'submitted' | 'under_review') {
  const response = await fetch(`/api/admin/mentors/${userId}/verification-case`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });
  return readJson<{ profile: unknown }>(response);
}

export async function listAdminCounts(): Promise<AdminCounts> {
  const response = await fetch('/api/admin/stats', {
    headers: await authHeaders(),
  });
  const body = await readJson<{ counts: AdminCounts }>(response);
  return body.counts;
}

export async function listAccounts(): Promise<AccountRow[]> {
  const response = await fetch('/api/admin/accounts', {
    headers: await authHeaders(),
  });
  const body = await readJson<{ rows: AccountRow[] }>(response);
  return body.rows;
}

export async function setMentorClaim(
  userId: string,
  type: string,
  verified: boolean,
) {
  const response = await fetch(`/api/admin/mentors/${userId}/claims`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ type, verified }),
  });
  return readJson<{ profile: unknown }>(response);
}

export async function setAccountActive(userId: string, active: boolean): Promise<User> {
  const response = await fetch(`/api/admin/accounts/${userId}/active`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ active }),
  });
  const body = await readJson<{ user: User }>(response);
  return body.user;
}

export async function setAccountStatus(userId: string, status: AccountStatus, reason?: string): Promise<User> {
  const response = await fetch(`/api/admin/accounts/${userId}/status`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ status, reason }),
  });
  const body = await readJson<{ user: User }>(response);
  return body.user;
}

export async function listAdminAudit(): Promise<AdminAuditLog[]> {
  const response = await fetch('/api/admin/audit', {
    headers: await authHeaders(),
  });
  const body = await readJson<{ rows: AdminAuditLog[] }>(response);
  return body.rows;
}

export async function listSupportIssues(): Promise<SupportIssue[]> {
  const response = await fetch('/api/admin/support', {
    headers: await authHeaders(),
  });
  const body = await readJson<{ rows: SupportIssue[] }>(response);
  return body.rows;
}

export async function resolveSupportIssue(issueId: string, reason?: string): Promise<SupportIssue> {
  const response = await fetch(`/api/admin/support/${issueId}/resolve`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reason }),
  });
  const body = await readJson<{ issue: SupportIssue }>(response);
  return body.issue;
}

export async function fileSupportIssue(subject: string, body: string): Promise<SupportIssue> {
  const response = await fetch('/api/support', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ subject, body }),
  });
  const result = await readJson<{ issue: SupportIssue }>(response);
  return result.issue;
}

export async function submitMentorVerification() {
  const response = await fetch('/api/profiles/me/verification/submit', {
    method: 'POST',
    headers: await authHeaders(),
  });
  return readJson<{ verificationCaseStatus: string }>(response);
}

export async function acceptMentorshipApplication(
  applicationId: string,
): Promise<MentorshipRelationship> {
  const response = await fetch(`/api/applications/${applicationId}/accept`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const body = await readJson<{ relationship: MentorshipRelationship }>(response);
  return body.relationship;
}

export async function declineMentorshipApplication(
  applicationId: string,
): Promise<MentorshipApplication> {
  const response = await fetch(`/api/applications/${applicationId}/decline`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({}),
  });
  const body = await readJson<{ application: MentorshipApplication }>(response);
  return body.application;
}

export async function setRelationshipStatus(
  relationshipId: string,
  status: RelationshipStatus,
): Promise<MentorshipRelationship> {
  const response = await fetch(`/api/relationships/${relationshipId}/status`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ status }),
  });
  const body = await readJson<{ relationship: MentorshipRelationship }>(response);
  return body.relationship;
}

export async function startLearningJourney(relationshipId: string): Promise<LearningContract> {
  const response = await fetch('/api/contracts', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ relationshipId }),
  });
  const body = await readJson<{ contract: LearningContract }>(response);
  return body.contract;
}

export async function dispatchContractAction(
  contractId: string,
  action: ClientContractAction,
): Promise<LearningContract> {
  const response = await fetch(`/api/contracts/${contractId}/action`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(action),
  });
  const body = await readJson<{ contract: LearningContract }>(response);
  return body.contract;
}

export async function bootstrapProfile() {
  const response = await fetch('/api/profiles/me/bootstrap', {
    method: 'POST',
    headers: await authHeaders(),
  });
  return readJson<{ profile: unknown; slug: string }>(response);
}

export async function establishAccountSession() {
  const response = await fetch('/api/account/session', {
    method: 'POST',
    headers: await authHeaders(),
  });
  return readJson<{ account: User }>(response);
}

export async function recordTermsAcceptance() {
  const response = await fetch('/api/account/terms', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ accepted: true }),
  });
  return readJson<{
    acceptance: { termsAccepted: true; termsVersion: string; termsAcceptedAt: string };
  }>(response);
}

export async function getOwnProfile() {
  const response = await fetch('/api/profiles/me', {
    headers: await authHeaders(),
  });
  return readJson<{ profile: unknown; slug: string | null }>(response);
}

export async function updateOwnProfile(body: Record<string, unknown>) {
  const response = await fetch('/api/profiles/me', {
    method: 'PUT',
    headers: await authHeaders(),
    body: JSON.stringify(body),
  });
  return readJson<{ profile: unknown; publicProfile: unknown }>(response);
}

export async function applyToMentor(mentorSlug: string, message: string) {
  const response = await fetch('/api/applications', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ mentorSlug, message }),
  });
  return readJson<{ application: MentorshipApplication }>(response);
}

export async function resolveMentorApplyTarget(slug: string) {
  const response = await fetch(`/api/profiles/mentors/${slug}/apply-target`, {
    headers: await authHeaders(),
  });
  return readJson<{ mentorId: string; slug: string }>(response);
}

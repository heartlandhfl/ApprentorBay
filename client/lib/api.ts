import type {
  AccountRow,
  AdminCounts,
  ApiError,
  ClientContractAction,
  LearningContract,
  MentorshipApplication,
  MentorshipRelationship,
  PendingMentorRow,
  RelationshipStatus,
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

export async function setMentorVerification(
  userId: string,
  status: Exclude<VerificationStatus, 'pending'>,
) {
  const response = await fetch(`/api/admin/mentors/${userId}/verification`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ userId, status }),
  });
  return readJson<{ profile: { verificationStatus: VerificationStatus } }>(response);
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

export async function setAccountActive(userId: string, active: boolean): Promise<User> {
  const response = await fetch(`/api/admin/accounts/${userId}/active`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ active }),
  });
  const body = await readJson<{ user: User }>(response);
  return body.user;
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

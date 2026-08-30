import type { ApiError, HealthStatus, PendingMentorRow, VerificationStatus } from '@apprentorbay/shared';
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

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch('/api/health');
  return readJson<HealthStatus>(response);
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

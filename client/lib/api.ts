import type { ApiError, HealthStatus } from '@apprentorbay/shared';

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

export async function getHealth(): Promise<HealthStatus> {
  const response = await fetch('/api/health');
  return readJson<HealthStatus>(response);
}

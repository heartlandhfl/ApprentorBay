import type { IsoDateString } from './users.js';
import { APPLICATION_STATUS, type ApplicationStatus } from './statuses.js';
import type { CommercialMode } from './mentorOffering.js';
import type { RequestType } from './mentorshipRequest.js';

/**
 * Mentor Application — persisted as `mentorshipApplications`.
 * Canonical TypeScript name remains MentorshipApplication so existing
 * imports keep working. MentorApplication is an alias.
 */
export interface MentorshipApplication {
  id: string;
  learnerId: string;
  mentorId: string;
  message: string;
  status: ApplicationStatus;
  createdAt: IsoDateString;
  learnerDisplayName?: string;
  mentorDisplayName?: string;
  learnerSlug?: string | null;
  mentorSlug?: string | null;
  /** Server-derived snapshot at apply time. Legacy docs omit this (treated as free). */
  requestType?: RequestType;
  commercialMode?: CommercialMode;
  baseSessionPriceUsd?: number | null;
  sessionDurationMinutes?: number | null;
}

export type MentorApplication = MentorshipApplication;

export const APPLICATION_MESSAGE = {
  minLength: 1,
  maxLength: 1000,
} as const;

export function isPendingApplication(
  application: Pick<MentorshipApplication, 'status'>,
): boolean {
  return application.status === APPLICATION_STATUS.pending;
}

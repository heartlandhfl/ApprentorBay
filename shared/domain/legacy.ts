import type { MentorshipStatus } from './statuses.js';
import type { IsoDateString } from './users.js';

/**
 * @deprecated Abandoned unified pairing document. Never written by the app.
 * Firestore rules still mention `/mentorships/{id}`. Do not populate.
 */
export interface Mentorship {
  id: string;
  learnerId: string;
  mentorId: string;
  status: MentorshipStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

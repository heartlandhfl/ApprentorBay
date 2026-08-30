/**
 * Shared data shapes for ApprentorBay.
 * Client and server must import from here — do not duplicate these types.
 */

export type IsoDateString = string;

export type UserRole = 'apprentice' | 'mentor' | 'admin';

export type MentorshipStatus =
  | 'pending'
  | 'active'
  | 'paused'
  | 'completed'
  | 'declined';

export type LearningContractStatus =
  | 'draft'
  | 'proposed'
  | 'accepted'
  | 'active'
  | 'completed'
  | 'archived';

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Profile {
  id: string;
  userId: string;
  headline: string;
  bio: string;
  craft: string;
  skills: string[];
  offering: string;
  seeking: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Mentorship {
  id: string;
  apprenticeId: string;
  mentorId: string;
  status: MentorshipStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
  done: boolean;
}

export interface LearningContract {
  id: string;
  mentorshipId: string;
  apprenticeId: string;
  mentorId: string;
  status: LearningContractStatus;
  intent: string;
  cadence: string;
  goals: LearningGoal[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface FirebaseClientStatus {
  configured: boolean;
  initialized: boolean;
  projectId: string | null;
}

export interface HealthStatus {
  ok: boolean;
  service: 'apprentorbay-api';
  timestamp: IsoDateString;
  firebase: {
    adminConfigured: boolean;
    adminInitialized: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
}

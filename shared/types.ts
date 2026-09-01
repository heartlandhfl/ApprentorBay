/**
 * Compatibility barrel.
 *
 * Canonical definitions live in `./domain`. Client and server may keep
 * importing from `@apprentorbay/shared` or `./types.js` — shapes and
 * persisted field names are unchanged.
 */

export {
  COLLECTIONS,
  emptyLearnerProfile,
  emptyMentorProfile,
  isAccountActive,
} from './domain/index.js';

export type {
  AccountRow,
  AdminCounts,
  ApplicationStatus,
  CompetencyGoal,
  Deliverable,
  DeliverableRef,
  DeliverableStatus,
  EducationEntry,
  ExperienceEntry,
  Goal,
  IsoDateString,
  LearnerProfile,
  LearningContract,
  LearningContractStatus,
  MentorProfile,
  Mentorship,
  MentorshipApplication,
  MentorshipRelationship,
  MentorshipStatus,
  Message,
  Milestone,
  MilestoneStatus,
  Objective,
  PendingMentorRow,
  RelationshipStatus,
  Review,
  SignupRole,
  StepOwner,
  User,
  UserRole,
  VerificationDecision,
  VerificationStatus,
} from './domain/index.js';

export interface FirebaseClientStatus {
  configured: boolean;
  initialized: boolean;
  projectId: string | null;
  emulator: boolean;
}

export interface HealthStatus {
  ok: boolean;
  service: 'apprentorbay-api';
  timestamp: import('./domain/users.js').IsoDateString;
  firebase: {
    adminConfigured: boolean;
    adminInitialized: boolean;
    emulator: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
}

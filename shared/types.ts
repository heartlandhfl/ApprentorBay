/**
 * Shared data shapes for ApprentorBay.
 * Client and server must import from here — do not duplicate these types.
 */

export type IsoDateString = string;

export type UserRole = 'mentor' | 'learner' | 'admin';

export type SignupRole = Exclude<UserRole, 'admin'>;

export type VerificationStatus = 'pending' | 'approved' | 'rejected';

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

export const COLLECTIONS = {
  users: 'users',
  learnerProfiles: 'learnerProfiles',
  mentorProfiles: 'mentorProfiles',
} as const;

export interface User {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  createdAt: IsoDateString;
}

export interface EducationEntry {
  id: string;
  institution: string;
  credential: string;
  year: string;
}

export interface ExperienceEntry {
  id: string;
  organization: string;
  title: string;
  summary: string;
  year: string;
}

export interface CompetencyGoal {
  id: string;
  title: string;
  description: string;
}

/** Reference to a Deliverable document. Populated by later prompts. */
export interface DeliverableRef {
  id: string;
}

export interface Review {
  id: string;
  authorId: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: IsoDateString;
}

export interface LearnerProfile {
  userId: string;
  displayName: string;
  education: EducationEntry[];
  jobStatus: string;
  careerAspirations: string;
  competencyGoals: CompetencyGoal[];
  deliverables: DeliverableRef[];
  public: boolean;
}

export interface MentorProfile {
  userId: string;
  displayName: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  deliverables: DeliverableRef[];
  reviews: Review[];
  verificationStatus: VerificationStatus;
  public: boolean;
}

export interface Mentorship {
  id: string;
  learnerId: string;
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
  learnerId: string;
  mentorId: string;
  status: LearningContractStatus;
  intent: string;
  cadence: string;
  goals: LearningGoal[];
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface PendingMentorRow {
  user: User;
  profile: MentorProfile;
}

export interface VerificationDecision {
  userId: string;
  status: Exclude<VerificationStatus, 'pending'>;
}

export interface FirebaseClientStatus {
  configured: boolean;
  initialized: boolean;
  projectId: string | null;
  emulator: boolean;
}

export interface HealthStatus {
  ok: boolean;
  service: 'apprentorbay-api';
  timestamp: IsoDateString;
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

export function emptyLearnerProfile(
  userId: string,
  displayName: string,
): LearnerProfile {
  return {
    userId,
    displayName,
    education: [],
    jobStatus: '',
    careerAspirations: '',
    competencyGoals: [],
    deliverables: [],
    public: true,
  };
}

export function emptyMentorProfile(
  userId: string,
  displayName: string,
): MentorProfile {
  return {
    userId,
    displayName,
    education: [],
    experience: [],
    deliverables: [],
    reviews: [],
    verificationStatus: 'pending',
    public: true,
  };
}

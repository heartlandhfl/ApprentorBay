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
  | 'under_mentor_review'
  | 'under_learner_review'
  | 'agreed'
  | 'in_progress'
  | 'completed';

export type StepOwner = 'learner' | 'mentor';

export type MilestoneStatus =
  | 'locked'
  | 'active'
  | 'submitted'
  | 'approved'
  | 'rejected';

export type DeliverableStatus = 'draft' | 'in_progress' | 'completed';

export type ApplicationStatus = 'pending' | 'accepted' | 'declined';

export type RelationshipStatus = 'active' | 'ended';

export const COLLECTIONS = {
  users: 'users',
  learnerProfiles: 'learnerProfiles',
  mentorProfiles: 'mentorProfiles',
  applications: 'mentorshipApplications',
  relationships: 'mentorshipRelationships',
  messages: 'messages',
  contracts: 'learningContracts',
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

/** Written onto both public profiles when a contract completes (server-side). */
export interface DeliverableRef {
  id: string;
  contractId: string;
  title: string;
  description: string;
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

export interface MentorshipApplication {
  id: string;
  learnerId: string;
  mentorId: string;
  message: string;
  status: ApplicationStatus;
  createdAt: IsoDateString;
}

export interface MentorshipRelationship {
  id: string;
  learnerId: string;
  mentorId: string;
  status: RelationshipStatus;
  createdAt: IsoDateString;
}

export interface Message {
  id: string;
  relationshipId: string;
  senderId: string;
  text: string;
  createdAt: IsoDateString;
}

export interface Mentorship {
  id: string;
  learnerId: string;
  mentorId: string;
  status: MentorshipStatus;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface Goal {
  id: string;
  text: string;
  revisionOf: string | null;
}

export interface Objective {
  id: string;
  text: string;
}

export interface Milestone {
  id: string;
  order: number;
  title: string;
  description: string;
  evidenceRequired: string;
  status: MilestoneStatus;
  evidenceText: string;
  evidenceLink: string;
  lastFeedback: string | null;
}

export interface Deliverable {
  id: string;
  title: string;
  description: string;
  finalEvidenceUrl: string;
  status: DeliverableStatus;
}

export interface LearningContract {
  id: string;
  relationshipId: string;
  learnerId: string;
  mentorId: string;
  status: LearningContractStatus;
  currentStepOwner: StepOwner;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  goal: Goal | null;
  goalHistory: Goal[];
  objectives: Objective[];
  milestones: Milestone[];
  deliverable: Deliverable | null;
  changeRequestReason: string | null;
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

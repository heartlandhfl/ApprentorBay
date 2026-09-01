import type { DeliverableRef } from './deliverables.js';
import { USER_ROLE, type SignupRole, type UserRole } from './identities.js';
import { VERIFICATION_STATUS, type VerificationStatus } from './statuses.js';

export type IsoDateString = string;

export interface User {
  uid: string;
  role: UserRole;
  email: string;
  displayName: string;
  active: boolean;
  createdAt: IsoDateString;
  termsAcceptedAt: IsoDateString | null;
  termsVersion: string | null;
}

/** Missing `active` on older docs is treated as true. */
export function isAccountActive(user: Pick<User, 'active'> | null | undefined): boolean {
  return user != null && user.active !== false;
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
  expertise: string;
  education: EducationEntry[];
  experience: ExperienceEntry[];
  deliverables: DeliverableRef[];
  reviews: Review[];
  verificationStatus: VerificationStatus;
  public: boolean;
}

export interface AdminCounts {
  mentors: number;
  learners: number;
  activeRelationships: number;
  contractsInProgress: number;
  completedDeliverables: number;
}

export interface AccountRow {
  user: User;
}

export interface PendingMentorRow {
  user: User;
  profile: MentorProfile;
}

export interface VerificationDecision {
  userId: string;
  status: Exclude<VerificationStatus, typeof VERIFICATION_STATUS.pending>;
}

export function emptyLearnerProfile(userId: string, displayName: string): LearnerProfile {
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

export function emptyMentorProfile(userId: string, displayName: string): MentorProfile {
  return {
    userId,
    displayName,
    education: [],
    experience: [],
    expertise: '',
    deliverables: [],
    reviews: [],
    verificationStatus: VERIFICATION_STATUS.pending,
    public: true,
  };
}

export function profileCollectionForRole(role: SignupRole | UserRole) {
  return role === USER_ROLE.mentor ? 'mentorProfiles' : 'learnerProfiles';
}

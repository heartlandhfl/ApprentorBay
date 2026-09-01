import type { DeliverableRef } from './deliverables.js';
import { USER_ROLE, type SignupRole, type UserRole } from './identities.js';
import {
  VERIFICATION_STATUS,
  VERIFIED_CLAIM_TYPE,
  type VerificationStatus,
  type VerifiedClaim,
} from './statuses.js';

export interface CredentialEntry {
  id: string;
  title: string;
  issuer: string;
  year: string;
}

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
  /** Public URL slug. Null until the server assigns one. Not a Firebase UID. */
  profileSlug: string | null;
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

/**
 * Owner/admin/pairing record. Visitors do not read this collection.
 * Public pages read `publicProfiles/{slug}` instead.
 */
export interface LearnerProfile {
  userId: string;
  slug: string | null;
  displayName: string;
  photoPath: string | null;
  professionalIdentity: string;
  location: string;
  locationPublic: boolean;
  education: EducationEntry[];
  qualifications: CredentialEntry[];
  certifications: CredentialEntry[];
  jobStatus: string;
  careerAspirations: string;
  competencyGoals: CompetencyGoal[];
  skillsDeveloping: string[];
  skillsDemonstrated: string[];
  deliverables: DeliverableRef[];
  public: boolean;
}

export interface MentorProfile {
  userId: string;
  slug: string | null;
  displayName: string;
  photoPath: string | null;
  professionalIdentity: string;
  location: string;
  locationPublic: boolean;
  expertise: string;
  areasOfExpertise: string[];
  education: EducationEntry[];
  qualifications: CredentialEntry[];
  certifications: CredentialEntry[];
  experience: ExperienceEntry[];
  professionalGoals: string;
  mentoringInterests: string;
  deliverables: DeliverableRef[];
  reviews: Review[];
  /** Participation approval. Not a comprehensive background check. */
  verificationStatus: VerificationStatus;
  verifiedClaims: VerifiedClaim[];
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
  publicSlug?: string | null;
  approvalStatus?: VerificationStatus | null;
  verifiedClaims?: VerifiedClaim[];
}

export interface PendingMentorRow {
  user: User;
  profile: MentorProfile;
}

export interface VerificationDecision {
  userId: string;
  status: Exclude<VerificationStatus, typeof VERIFICATION_STATUS.pending>;
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asText(item).trim()).filter(Boolean);
}

function asEducation(value: unknown): EducationEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = item as Partial<EducationEntry>;
      return {
        id: asText(row?.id) || `edu-${index}`,
        institution: asText(row?.institution).trim(),
        credential: asText(row?.credential).trim(),
        year: asText(row?.year).trim(),
      };
    })
    .filter((item) => item.institution || item.credential);
}

function asCredentials(value: unknown): CredentialEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = item as Partial<CredentialEntry>;
      return {
        id: asText(row?.id) || `cred-${index}`,
        title: asText(row?.title).trim(),
        issuer: asText(row?.issuer).trim(),
        year: asText(row?.year).trim(),
      };
    })
    .filter((item) => item.title);
}

function asExperience(value: unknown): ExperienceEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = item as Partial<ExperienceEntry>;
      return {
        id: asText(row?.id) || `exp-${index}`,
        organization: asText(row?.organization).trim(),
        title: asText(row?.title).trim(),
        summary: asText(row?.summary).trim(),
        year: asText(row?.year).trim(),
      };
    })
    .filter((item) => item.title || item.organization);
}

function asGoals(value: unknown): CompetencyGoal[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const row = item as Partial<CompetencyGoal>;
      return {
        id: asText(row?.id) || `goal-${index}`,
        title: asText(row?.title).trim(),
        description: asText(row?.description).trim(),
      };
    })
    .filter((item) => item.title);
}

function asClaims(value: unknown): VerifiedClaim[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      const row = item as Partial<VerifiedClaim>;
      const type = row?.type;
      if (
        type !== VERIFIED_CLAIM_TYPE.identity &&
        type !== VERIFIED_CLAIM_TYPE.education &&
        type !== VERIFIED_CLAIM_TYPE.professionalExperience
      ) {
        return null;
      }
      return {
        type,
        verified: row?.verified === true,
        verifiedAt: row?.verifiedAt ?? null,
      };
    })
    .filter((item): item is VerifiedClaim => item != null);
}

export function emptyLearnerProfile(userId: string, displayName: string): LearnerProfile {
  return {
    userId,
    slug: null,
    displayName,
    photoPath: null,
    professionalIdentity: '',
    location: '',
    locationPublic: false,
    education: [],
    qualifications: [],
    certifications: [],
    jobStatus: '',
    careerAspirations: '',
    competencyGoals: [],
    skillsDeveloping: [],
    skillsDemonstrated: [],
    deliverables: [],
    public: true,
  };
}

export function emptyMentorProfile(userId: string, displayName: string): MentorProfile {
  return {
    userId,
    slug: null,
    displayName,
    photoPath: null,
    professionalIdentity: '',
    location: '',
    locationPublic: false,
    education: [],
    qualifications: [],
    certifications: [],
    experience: [],
    expertise: '',
    areasOfExpertise: [],
    professionalGoals: '',
    mentoringInterests: '',
    deliverables: [],
    reviews: [],
    verificationStatus: VERIFICATION_STATUS.pending,
    verifiedClaims: [],
    public: true,
  };
}

export function normalizeLearnerProfile(
  input: Partial<LearnerProfile> & { userId: string },
): LearnerProfile {
  const empty = emptyLearnerProfile(input.userId, asText(input.displayName));
  return {
    ...empty,
    ...input,
    slug: input.slug ?? null,
    photoPath: input.photoPath ?? null,
    professionalIdentity: asText(input.professionalIdentity).trim(),
    location: asText(input.location).trim(),
    locationPublic: input.locationPublic === true,
    education: asEducation(input.education),
    qualifications: asCredentials(input.qualifications),
    certifications: asCredentials(input.certifications),
    jobStatus: asText(input.jobStatus),
    careerAspirations: asText(input.careerAspirations),
    competencyGoals: asGoals(input.competencyGoals),
    skillsDeveloping: asStringList(input.skillsDeveloping),
    skillsDemonstrated: asStringList(input.skillsDemonstrated),
    deliverables: Array.isArray(input.deliverables) ? input.deliverables : [],
    public: input.public !== false,
    displayName: asText(input.displayName).trim() || empty.displayName,
    userId: input.userId,
  };
}

export function normalizeMentorProfile(
  input: Partial<MentorProfile> & { userId: string },
): MentorProfile {
  const empty = emptyMentorProfile(input.userId, asText(input.displayName));
  const status = Object.values(VERIFICATION_STATUS).includes(input.verificationStatus as VerificationStatus)
    ? (input.verificationStatus as VerificationStatus)
    : empty.verificationStatus;
  return {
    ...empty,
    ...input,
    slug: input.slug ?? null,
    photoPath: input.photoPath ?? null,
    professionalIdentity: asText(input.professionalIdentity).trim(),
    location: asText(input.location).trim(),
    locationPublic: input.locationPublic === true,
    education: asEducation(input.education),
    qualifications: asCredentials(input.qualifications),
    certifications: asCredentials(input.certifications),
    experience: asExperience(input.experience),
    expertise: asText(input.expertise).trim(),
    areasOfExpertise: asStringList(input.areasOfExpertise),
    professionalGoals: asText(input.professionalGoals),
    mentoringInterests: asText(input.mentoringInterests),
    deliverables: Array.isArray(input.deliverables) ? input.deliverables : [],
    reviews: Array.isArray(input.reviews) ? input.reviews : [],
    verificationStatus: status,
    verifiedClaims: asClaims(input.verifiedClaims),
    public: input.public !== false,
    displayName: asText(input.displayName).trim() || empty.displayName,
    userId: input.userId,
  };
}

export function profileCollectionForRole(role: SignupRole | UserRole) {
  return role === USER_ROLE.mentor ? 'mentorProfiles' : 'learnerProfiles';
}

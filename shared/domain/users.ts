import type { DeliverableRef } from './deliverables.js';
import {
  normalizeMentorOfferingFields,
  type CommercialMode,
  type MentorType,
} from './mentorOffering.js';
import { USER_ROLE, type SignupRole, type UserRole } from './identities.js';
import {
  ACCOUNT_STATUS,
  VERIFICATION_CASE_STATUS,
  VERIFICATION_STATUS,
  VERIFIED_CLAIM_TYPE,
  type AccountStatus,
  type VerificationCaseStatus,
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
  accountStatus?: AccountStatus;
  createdAt: IsoDateString;
  /** Explicit signup / re-acceptance confirmation. Missing on older documents. */
  termsAccepted?: boolean;
  termsAcceptedAt: IsoDateString | null;
  termsVersion: string | null;
  /** Public URL slug. Null until the server assigns one. Not a Firebase UID. */
  profileSlug: string | null;
}

function accountStatusFrom(user: Pick<User, 'active'> & { accountStatus?: AccountStatus }): AccountStatus {
  if (user.accountStatus && Object.values(ACCOUNT_STATUS).includes(user.accountStatus)) {
    return user.accountStatus;
  }
  return user.active === false ? ACCOUNT_STATUS.suspended : ACCOUNT_STATUS.active;
}

/** Missing `active` on older docs is treated as true. Restricted accounts may still sign in. */
export function isAccountActive(
  user: Pick<User, 'active'> & { accountStatus?: AccountStatus } | null | undefined,
): boolean {
  if (user == null) return false;
  const status = accountStatusFrom(user);
  return status === ACCOUNT_STATUS.active || status === ACCOUNT_STATUS.restricted;
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
  previousVerificationStatus: VerificationStatus | null;
  verificationCaseStatus: VerificationCaseStatus;
  verifiedClaims: VerifiedClaim[];
  public: boolean;
  /** Primary mentor classification. Optional on older documents. */
  mentorType?: MentorType;
  /** Commercial tier separate from mentor type. Optional on older documents. */
  commercialMode?: CommercialMode;
  /** Short plain-text description of what the mentor offers. */
  serviceDescription?: string;
  /** Base session price in integer USD cents. Null for free (giving back) mentors. */
  baseSessionPriceUsd?: number | null;
  /** Optional session length in minutes. */
  sessionDurationMinutes?: number | null;
  offersVideoSessions?: boolean;
  includedMessaging?: boolean;
  /** Whether the mentor is open to new learner applications. */
  acceptsNewLearners?: boolean;
  /** @deprecated Legacy field. Use serviceDescription. */
  servicesDescription?: string;
  /** @deprecated Legacy whole-dollar field. Use baseSessionPriceUsd (cents). */
  sessionPriceUsd?: number | null;
  /** @deprecated Legacy field. Use includedMessaging. */
  messagingIncluded?: boolean;
}

export interface AdminCounts {
  totalUsers: number;
  learners: number;
  mentors: number;
  pendingMentorApprovals: number;
  pendingVerification: number;
  activeRelationships: number;
  activeLearningContracts: number;
  completedDeliverables: number;
  supportIssues: number;
}

export interface AccountRow {
  user: User;
  publicSlug?: string | null;
  approvalStatus?: VerificationStatus | null;
  verificationCaseStatus?: VerificationCaseStatus | null;
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
    previousVerificationStatus: null,
    verificationCaseStatus: VERIFICATION_CASE_STATUS.notSubmitted,
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
  const offering = normalizeMentorOfferingFields({
    mentorType: input.mentorType,
    commercialMode: input.commercialMode,
    serviceDescription: input.serviceDescription ?? input.servicesDescription,
    baseSessionPriceUsd: input.baseSessionPriceUsd,
    sessionPriceUsd: input.sessionPriceUsd,
    sessionDurationMinutes: input.sessionDurationMinutes,
    offersVideoSessions: input.offersVideoSessions,
    includedMessaging: input.includedMessaging ?? input.messagingIncluded,
    acceptsNewLearners: input.acceptsNewLearners,
    public: input.public,
    verificationStatus: status,
  });
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
    previousVerificationStatus: input.previousVerificationStatus ?? null,
    verificationCaseStatus: Object.values(VERIFICATION_CASE_STATUS).includes(
      input.verificationCaseStatus as VerificationCaseStatus,
    )
      ? (input.verificationCaseStatus as VerificationCaseStatus)
      : empty.verificationCaseStatus,
    verifiedClaims: asClaims(input.verifiedClaims),
    public: input.public !== false,
    mentorType: offering.mentorType,
    commercialMode: offering.commercialMode,
    serviceDescription: offering.serviceDescription,
    baseSessionPriceUsd: offering.baseSessionPriceUsd,
    sessionDurationMinutes: offering.sessionDurationMinutes,
    offersVideoSessions: offering.offersVideoSessions,
    includedMessaging: offering.includedMessaging,
    acceptsNewLearners: offering.acceptsNewLearners,
    displayName: asText(input.displayName).trim() || empty.displayName,
    userId: input.userId,
  };
}

export function profileCollectionForRole(role: SignupRole | UserRole) {
  return role === USER_ROLE.mentor ? 'mentorProfiles' : 'learnerProfiles';
}

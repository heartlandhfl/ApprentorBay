import { USER_ROLE, type UserRole } from './identities.js';
import type { Showcase, ShowcaseEvidence } from './showcases.js';
import {
  VERIFICATION_STATUS,
  VERIFIED_CLAIM_TYPE,
  type VerificationStatus,
  type VerifiedClaim,
  type VerifiedClaimType,
} from './statuses.js';
import type {
  CompetencyGoal,
  CredentialEntry,
  EducationEntry,
  ExperienceEntry,
  LearnerProfile,
  MentorProfile,
  Review,
} from './users.js';

export { VERIFIED_CLAIM_TYPE } from './statuses.js';
export type { VerifiedClaim, VerifiedClaimType } from './statuses.js';
export type { CredentialEntry } from './users.js';

/** Participation approval. Persisted as mentor `verificationStatus`. */
export const APPROVAL_STATUS = VERIFICATION_STATUS;

export type ApprovalStatus = VerificationStatus;

export const APPROVAL_STATUS_LABEL: Record<ApprovalStatus, string> = {
  [APPROVAL_STATUS.pending]: 'Pending',
  [APPROVAL_STATUS.approved]: 'Approved',
  [APPROVAL_STATUS.rejected]: 'Rejected',
  [APPROVAL_STATUS.suspended]: 'Suspended',
};

export const APPROVAL_DISCLAIMER =
  'Approval means this person may participate on ApprentorBay. It is not a comprehensive background check.';

export const VERIFIED_CLAIM_LABEL: Record<VerifiedClaimType, string> = {
  [VERIFIED_CLAIM_TYPE.identity]: 'Identity verified',
  [VERIFIED_CLAIM_TYPE.education]: 'Education verified',
  [VERIFIED_CLAIM_TYPE.professionalExperience]: 'Professional experience verified',
};

export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  body: string;
  createdAt: string;
}

export interface PublicPortfolioItem {
  id: string;
  title: string;
  description: string;
  skillsDemonstrated: string[];
  links: string[];
  publicEvidence: ShowcaseEvidence[];
  completedAt: string;
  learnerDisplayName: string;
  mentorDisplayName: string;
  mentorContribution: string;
}

export interface PublicProfile {
  slug: string;
  role: typeof USER_ROLE.learner | typeof USER_ROLE.mentor;
  published: boolean;
  listed: boolean;
  displayName: string;
  photoPath: string | null;
  professionalIdentity: string;
  location: string | null;
  education: EducationEntry[];
  qualifications: CredentialEntry[];
  certifications: CredentialEntry[];
  careerStatus: string;
  careerAspirations: string;
  skillsDeveloping: string[];
  skillsDemonstrated: string[];
  portfolio: PublicPortfolioItem[];
  experience: ExperienceEntry[];
  areasOfExpertise: string[];
  professionalGoals: string;
  mentoringInterests: string;
  mentoredDeliverables: PublicPortfolioItem[];
  reviews: PublicReview[];
  approvalStatus: ApprovalStatus;
  verifiedClaims: VerifiedClaim[];
  updatedAt: string;
}

export interface ProfileSlugRecord {
  slug: string;
  userId: string;
  role: UserRole;
  createdAt: string;
}

export const PRIVATE_PROFILE_FIELDS = [
  'userId',
  'email',
  'deliverables',
  'verificationStatus',
  'locationPublic',
  'authorId',
] as const;

/** Photos live under the slug, not the Firebase UID. */
export function profilePhotoStoragePath(slug: string, fileId: string): string {
  return `profile-photos/${slug}/${fileId}`;
}

export function isPublicPhotoPath(path: string, slug: string): boolean {
  return Boolean(slug) && path.startsWith(`profile-photos/${slug}/`);
}

export function toStoredPublicProfile(profile: PublicProfile): PublicProfile {
  return {
    slug: profile.slug,
    role: profile.role,
    published: profile.published,
    listed: profile.listed,
    displayName: profile.displayName,
    photoPath: profile.slug && isPublicPhotoPath(profile.photoPath ?? '', profile.slug) ? profile.photoPath : null,
    professionalIdentity: profile.professionalIdentity,
    location: profile.location,
    education: profile.education,
    qualifications: profile.qualifications,
    certifications: profile.certifications,
    careerStatus: profile.careerStatus,
    careerAspirations: profile.careerAspirations,
    skillsDeveloping: profile.skillsDeveloping,
    skillsDemonstrated: profile.skillsDemonstrated,
    portfolio: profile.portfolio,
    experience: profile.experience,
    areasOfExpertise: profile.areasOfExpertise,
    professionalGoals: profile.professionalGoals,
    mentoringInterests: profile.mentoringInterests,
    mentoredDeliverables: profile.mentoredDeliverables,
    reviews: profile.reviews,
    approvalStatus: profile.approvalStatus,
    verifiedClaims: profile.verifiedClaims,
    updatedAt: profile.updatedAt,
  };
}

export function ownPublicProfilePath(
  role: typeof USER_ROLE.learner | typeof USER_ROLE.mentor,
  slug: string | null | undefined,
): string {
  if (role === USER_ROLE.mentor) return slug ? `/mentors/${slug}` : '/mentors/me';
  return slug ? `/learners/${slug}` : '/learners/me';
}

export function publicReviewsFrom(reviews: readonly Review[]): PublicReview[] {
  return reviews.map((item) => ({
    id: item.id,
    authorName: item.authorName,
    rating: item.rating,
    body: item.body,
    createdAt: item.createdAt,
  }));
}

export function portfolioItemFromShowcase(showcase: Pick<
  Showcase,
  | 'id'
  | 'title'
  | 'description'
  | 'skillsDemonstrated'
  | 'links'
  | 'publicEvidence'
  | 'completedAt'
  | 'learnerDisplayName'
  | 'mentorDisplayName'
  | 'mentorContribution'
>): PublicPortfolioItem {
  return {
    id: showcase.id,
    title: showcase.title,
    description: showcase.description,
    skillsDemonstrated: showcase.skillsDemonstrated,
    links: showcase.links,
    publicEvidence: showcase.publicEvidence,
    completedAt: showcase.completedAt,
    learnerDisplayName: showcase.learnerDisplayName,
    mentorDisplayName: showcase.mentorDisplayName,
    mentorContribution: showcase.mentorContribution,
  };
}

export function verifiedClaimsPublic(claims: readonly VerifiedClaim[]): VerifiedClaim[] {
  return claims.filter((item) => item.verified);
}

function skillsFromGoals(goals: readonly CompetencyGoal[]): string[] {
  return goals.map((item) => item.title.trim()).filter(Boolean);
}

function uniqueSkills(...groups: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const item of group) {
      const value = item.trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

export function canListPublicMentor(profile: Pick<PublicProfile, 'role' | 'published' | 'approvalStatus'>): boolean {
  return (
    profile.role === USER_ROLE.mentor &&
    profile.published &&
    profile.approvalStatus === APPROVAL_STATUS.approved
  );
}

export function buildPublicLearnerProfile(input: {
  profile: LearnerProfile;
  portfolio: PublicPortfolioItem[];
  now: string;
}): PublicProfile {
  const { profile, portfolio, now } = input;
  const skillsFromWork = portfolio.flatMap((item) => item.skillsDemonstrated);
  return {
    slug: profile.slug ?? '',
    role: USER_ROLE.learner,
    published: profile.public,
    listed: false,
    displayName: profile.displayName,
    photoPath: profile.slug && isPublicPhotoPath(profile.photoPath ?? '', profile.slug) ? profile.photoPath : null,
    professionalIdentity: profile.professionalIdentity,
    location: profile.locationPublic ? profile.location.trim() || null : null,
    education: profile.education,
    qualifications: profile.qualifications,
    certifications: profile.certifications,
    careerStatus: profile.jobStatus,
    careerAspirations: profile.careerAspirations,
    skillsDeveloping: uniqueSkills(profile.skillsDeveloping, skillsFromGoals(profile.competencyGoals)),
    skillsDemonstrated: uniqueSkills(profile.skillsDemonstrated, skillsFromWork),
    portfolio,
    experience: [],
    areasOfExpertise: [],
    professionalGoals: '',
    mentoringInterests: '',
    mentoredDeliverables: [],
    reviews: [],
    approvalStatus: APPROVAL_STATUS.approved,
    verifiedClaims: [],
    updatedAt: now,
  };
}

export function buildPublicMentorProfile(input: {
  profile: MentorProfile;
  mentoredDeliverables: PublicPortfolioItem[];
  now: string;
}): PublicProfile {
  const { profile, mentoredDeliverables, now } = input;
  const published =
    profile.public && profile.verificationStatus === APPROVAL_STATUS.approved;
  const areas = uniqueSkills(
    profile.areasOfExpertise,
    profile.expertise ? [profile.expertise] : [],
  );
  return {
    slug: profile.slug ?? '',
    role: USER_ROLE.mentor,
    published,
    listed: published,
    displayName: profile.displayName,
    photoPath: profile.slug && isPublicPhotoPath(profile.photoPath ?? '', profile.slug) ? profile.photoPath : null,
    professionalIdentity: profile.professionalIdentity || profile.expertise,
    location: profile.locationPublic ? profile.location.trim() || null : null,
    education: profile.education,
    qualifications: profile.qualifications,
    certifications: profile.certifications,
    careerStatus: '',
    careerAspirations: '',
    skillsDeveloping: [],
    skillsDemonstrated: [],
    portfolio: [],
    experience: profile.experience,
    areasOfExpertise: areas,
    professionalGoals: profile.professionalGoals,
    mentoringInterests: profile.mentoringInterests,
    mentoredDeliverables,
    reviews: publicReviewsFrom(profile.reviews),
    approvalStatus: profile.verificationStatus,
    verifiedClaims: verifiedClaimsPublic(profile.verifiedClaims),
    updatedAt: now,
  };
}

export function publicProfileOmitsPrivateFields(doc: Record<string, unknown>): string[] {
  return PRIVATE_PROFILE_FIELDS.filter((field) => field in doc);
}

export function publicProfilePath(role: typeof USER_ROLE.learner | typeof USER_ROLE.mentor, slug: string): string {
  return role === USER_ROLE.mentor ? `/mentors/${slug}` : `/learners/${slug}`;
}

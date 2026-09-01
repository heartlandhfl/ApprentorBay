import {
  COLLECTIONS,
  USER_ROLE,
  canParticipate,
  buildPublicLearnerProfile,
  buildPublicMentorProfile,
  isPublicPhotoPath,
  looksLikeFirebaseUid,
  nextSlugCandidate,
  normalizeLearnerProfile,
  normalizeMentorProfile,
  portfolioItemFromShowcase,
  publicProfileOmitsPrivateFields,
  suggestSlug,
  validateProfileSlug,
  toStoredPublicProfile,
  type CredentialEntry,
  type EducationEntry,
  type ExperienceEntry,
  type CompetencyGoal,
  type LearnerProfile,
  type MentorProfile,
  type PublicPortfolioItem,
  type PublicProfile,
  type Showcase,
  type User,
  type UserRole,
} from '@apprentorbay/shared';
import { adminDb } from './firebase.js';

export type ProfileUpdateBody = {
  displayName?: string;
  professionalIdentity?: string;
  location?: string;
  locationPublic?: boolean;
  education?: EducationEntry[];
  qualifications?: CredentialEntry[];
  certifications?: CredentialEntry[];
  jobStatus?: string;
  careerAspirations?: string;
  competencyGoals?: CompetencyGoal[];
  skillsDeveloping?: string[];
  skillsDemonstrated?: string[];
  experience?: ExperienceEntry[];
  expertise?: string;
  areasOfExpertise?: string[];
  professionalGoals?: string;
  mentoringInterests?: string;
  public?: boolean;
  slug?: string;
  photoPath?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

export async function loadPrivateProfile(userId: string, role: UserRole) {
  if (role === USER_ROLE.mentor) {
    const snap = await adminDb().collection(COLLECTIONS.mentorProfiles).doc(userId).get();
    if (!snap.exists) return null;
    return {
      role: 'mentor' as const,
      profile: normalizeMentorProfile({ ...(snap.data() as MentorProfile), userId }),
    };
  }
  const snap = await adminDb().collection(COLLECTIONS.learnerProfiles).doc(userId).get();
  if (!snap.exists) return null;
  return {
    role: 'learner' as const,
    profile: normalizeLearnerProfile({ ...(snap.data() as LearnerProfile), userId }),
  };
}

async function publishedPortfolio(
  field: 'learnerId' | 'mentorId',
  userId: string,
): Promise<PublicPortfolioItem[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.showcases)
    .where(field, '==', userId)
    .where('published', '==', true)
    .get();
  return snap.docs
    .map((doc) => portfolioItemFromShowcase(doc.data() as Showcase))
    .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

export async function buildPublicProjection(
  userId: string,
  role: UserRole,
): Promise<PublicProfile | null> {
  const loaded = await loadPrivateProfile(userId, role);
  if (!loaded || !loaded.profile.slug) return null;
  const timestamp = nowIso();
  if (loaded.role === USER_ROLE.mentor) {
    const mentoredDeliverables = await publishedPortfolio('mentorId', userId);
    return buildPublicMentorProfile({
      profile: loaded.profile,
      mentoredDeliverables,
      now: timestamp,
    });
  }
  const portfolio = await publishedPortfolio('learnerId', userId);
  return buildPublicLearnerProfile({
    profile: loaded.profile,
    portfolio,
    now: timestamp,
  });
}

export async function writePublicProfile(userId: string, role: UserRole) {
  const publicProfile = await buildPublicProjection(userId, role);
  const loaded = await loadPrivateProfile(userId, role);
  const slug = loaded?.profile.slug;
  if (!slug || !publicProfile) return null;

  const userSnap = await adminDb().collection(COLLECTIONS.users).doc(userId).get();
  const account = userSnap.data() as User | undefined;
  const listedAllowed = Boolean(account && canParticipate(account));
  const projected = listedAllowed
    ? publicProfile
    : { ...publicProfile, published: false, listed: false };

  const ref = adminDb().collection(COLLECTIONS.publicProfiles).doc(slug);
  const stored = toStoredPublicProfile(projected);
  if (publicProfileOmitsPrivateFields(stored as unknown as Record<string, unknown>).length > 0) {
    throw new Error('Refusing to write private fields to a public profile');
  }
  await ref.set(stored);
  return stored;
}

export async function assignSlug(input: {
  userId: string;
  role: UserRole;
  displayName: string;
  requested?: string;
}): Promise<string> {
  const requested = input.requested?.trim();
  let preferred: string;
  if (requested) {
    const valid = validateProfileSlug(requested);
    if (!valid.ok) {
      throw Object.assign(new Error(valid.error), { status: 400 });
    }
    preferred = valid.slug;
  } else {
    preferred = suggestSlug(input.displayName);
  }

  const userRef = adminDb().collection(COLLECTIONS.users).doc(input.userId);
  const profileCollection =
    input.role === USER_ROLE.mentor ? COLLECTIONS.mentorProfiles : COLLECTIONS.learnerProfiles;
  const profileRef = adminDb().collection(profileCollection).doc(input.userId);

  for (let attempt = 1; attempt <= 30; attempt += 1) {
    const candidate = nextSlugCandidate(preferred, attempt);
    const check = validateProfileSlug(candidate);
    if (!check.ok) continue;

    try {
      await adminDb().runTransaction(async (tx) => {
        const slugRef = adminDb().collection(COLLECTIONS.profileSlugs).doc(check.slug);
        const taken = await tx.get(slugRef);
        const userSnap = await tx.get(userRef);
        const user = userSnap.data() as User | undefined;
        const currentSlug = user?.profileSlug ?? null;

        if (taken.exists) {
          const owner = taken.data() as { userId?: string };
          if (owner.userId !== input.userId) {
            throw Object.assign(new Error('taken'), { code: 'taken' });
          }
        }

        if (currentSlug && currentSlug !== check.slug) {
          tx.delete(adminDb().collection(COLLECTIONS.profileSlugs).doc(currentSlug));
          tx.delete(adminDb().collection(COLLECTIONS.publicProfiles).doc(currentSlug));
        }

        tx.set(slugRef, {
          slug: check.slug,
          userId: input.userId,
          role: input.role,
          createdAt: nowIso(),
        });
        tx.set(userRef, { profileSlug: check.slug }, { merge: true });
        tx.set(profileRef, { slug: check.slug }, { merge: true });
      });
      return check.slug;
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'taken') {
        if (input.requested && attempt === 1) {
          throw Object.assign(new Error('That public URL is already taken'), { status: 409 });
        }
        continue;
      }
      throw error;
    }
  }

  throw Object.assign(new Error('Could not allocate a public URL'), { status: 409 });
}

export async function bootstrapProfile(account: User) {
  const loaded = await loadPrivateProfile(account.uid, account.role);
  if (!loaded) {
    throw Object.assign(new Error('Profile not found'), { status: 404 });
  }
  const slug =
    loaded.profile.slug ||
    account.profileSlug ||
    (await assignSlug({
      userId: account.uid,
      role: account.role,
      displayName: loaded.profile.displayName || account.displayName,
    }));
  const publicProfile = await writePublicProfile(account.uid, account.role);
  const next = await loadPrivateProfile(account.uid, account.role);
  return { profile: next?.profile ?? loaded.profile, publicProfile, slug };
}

export async function applyProfileUpdate(account: User, body: ProfileUpdateBody) {
  const loaded = await loadPrivateProfile(account.uid, account.role);
  if (!loaded) {
    throw Object.assign(new Error('Profile not found'), { status: 404 });
  }

  if (body.slug && body.slug !== loaded.profile.slug) {
    const valid = validateProfileSlug(body.slug);
    if (!valid.ok) {
      throw Object.assign(new Error(valid.error), { status: 400 });
    }
    await assignSlug({
      userId: account.uid,
      role: account.role,
      displayName: body.displayName || loaded.profile.displayName,
      requested: valid.slug,
    });
  } else if (!loaded.profile.slug) {
    await assignSlug({
      userId: account.uid,
      role: account.role,
      displayName: body.displayName || loaded.profile.displayName,
    });
  }

  if (body.photoPath) {
    const slugForPhoto = (body.slug && body.slug !== loaded.profile.slug
      ? body.slug
      : loaded.profile.slug) ?? loaded.profile.slug;
    const allowedSlugs = [loaded.profile.slug, slugForPhoto, body.slug].filter(
      (value): value is string => Boolean(value),
    );
    if (!allowedSlugs.some((slug) => isPublicPhotoPath(body.photoPath as string, slug))) {
      throw Object.assign(new Error('Photo must use the public profile-photos path for this URL'), { status: 400 });
    }
  }

  const profileCollection =
    account.role === USER_ROLE.mentor ? COLLECTIONS.mentorProfiles : COLLECTIONS.learnerProfiles;
  const patch: Record<string, unknown> = {};
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) patch[key] = value;
  };

  assign('displayName', typeof body.displayName === 'string' ? body.displayName.trim() : undefined);
  assign('professionalIdentity', body.professionalIdentity);
  assign('location', body.location);
  assign('locationPublic', body.locationPublic);
  assign('education', body.education);
  assign('qualifications', body.qualifications);
  assign('certifications', body.certifications);
  assign('jobStatus', body.jobStatus);
  assign('careerAspirations', body.careerAspirations);
  assign('competencyGoals', body.competencyGoals);
  assign('skillsDeveloping', body.skillsDeveloping);
  assign('skillsDemonstrated', body.skillsDemonstrated);
  assign('experience', body.experience);
  assign('expertise', body.expertise);
  assign('areasOfExpertise', body.areasOfExpertise);
  assign('professionalGoals', body.professionalGoals);
  assign('mentoringInterests', body.mentoringInterests);
  assign('public', body.public);
  assign('photoPath', body.photoPath);

  if (typeof patch.displayName === 'string' && patch.displayName.length > 0) {
    await adminDb().collection(COLLECTIONS.users).doc(account.uid).set(
      { displayName: patch.displayName },
      { merge: true },
    );
  }

  if (Object.keys(patch).length > 0) {
    await adminDb().collection(profileCollection).doc(account.uid).set(patch, { merge: true });
  }

  const publicProfile = await writePublicProfile(account.uid, account.role);
  const next = await loadPrivateProfile(account.uid, account.role);
  return { profile: next?.profile, publicProfile };
}

export async function resolveSlug(slug: string) {
  const snap = await adminDb().collection(COLLECTIONS.profileSlugs).doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as { slug: string; userId: string; role: UserRole };
}

export function isUidParam(value: string): boolean {
  return looksLikeFirebaseUid(value);
}

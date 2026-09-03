import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  emptyMentorProfile,
  readSessionPriceCents,
  type LearnerProfile,
  type MentorProfile,
  type PublicProfile,
} from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';
import { firestoreDenied } from '../mentorship';

export function watchPublicProfile(
  slug: string,
  onNext: (profile: PublicProfile | null) => void,
  onError?: (error: Error) => void,
  options?: { includeUnpublished?: boolean },
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    doc(db, COLLECTIONS.publicProfiles, slug),
    (snap) => {
      if (!snap.exists()) {
        onNext(null);
        return;
      }
      const data = snap.data() as PublicProfile;
      onNext(data.published || options?.includeUnpublished ? data : null);
    },
    (error) => {
      if (firestoreDenied(error)) onNext(null);
      else onError?.(error);
    },
  );
}

export function watchListedMentors(
  onNext: (mentors: PublicProfile[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, COLLECTIONS.publicProfiles),
      where('listed', '==', true),
      where('published', '==', true),
    ),
    (snap) => {
      const rows = snap.docs
        .map((item) => item.data() as PublicProfile)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      onNext(rows);
    },
    (error) => onError?.(error),
  );
}

export function watchLearnerProfile(
  userId: string,
  onNext: (profile: LearnerProfile | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    doc(db, COLLECTIONS.learnerProfiles, userId),
    (snap) => onNext(snap.exists() ? (snap.data() as LearnerProfile) : null),
    (error) => {
      if (firestoreDenied(error)) onNext(null);
      else onError?.(error);
    },
  );
}

export function watchMentorProfile(
  userId: string,
  onNext: (profile: MentorProfile | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    doc(db, COLLECTIONS.mentorProfiles, userId),
    (snap) => onNext(snap.exists() ? (snap.data() as MentorProfile) : null),
    (error) => {
      if (firestoreDenied(error)) onNext(null);
      else onError?.(error);
    },
  );
}

export async function getPublicDisplayName(userId: string): Promise<string> {
  const db = getFirebaseDb();
  if (!db) return 'Member';

  try {
    const learner = await getDoc(doc(db, COLLECTIONS.learnerProfiles, userId));
    if (learner.exists()) {
      return (learner.data() as LearnerProfile).displayName || 'Learner';
    }
  } catch (error) {
    if (!firestoreDenied(error)) throw error;
  }

  try {
    const mentor = await getDoc(doc(db, COLLECTIONS.mentorProfiles, userId));
    if (mentor.exists()) {
      return (mentor.data() as MentorProfile).displayName || 'Mentor';
    }
  } catch (error) {
    if (!firestoreDenied(error)) throw error;
  }

  return 'Member';
}

/** @deprecated Use watchListedMentors. Kept for pairing workspace private reads. */
export function watchApprovedMentors(
  onNext: (mentors: MentorProfile[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return watchListedMentors((rows) => {
    onNext(
      rows.map((row) => ({
        ...emptyMentorProfile('', row.displayName),
        slug: row.slug,
        photoPath: row.photoPath,
        professionalIdentity: row.professionalIdentity,
        location: row.location ?? '',
        locationPublic: Boolean(row.location),
        expertise: row.areasOfExpertise[0] ?? '',
        areasOfExpertise: row.areasOfExpertise,
        education: row.education,
        qualifications: row.qualifications,
        certifications: row.certifications,
        experience: row.experience,
        professionalGoals: row.professionalGoals,
        mentoringInterests: row.mentoringInterests,
        mentorType: row.mentorType,
        commercialMode: row.commercialMode,
        serviceDescription: row.serviceDescription ?? row.servicesDescription,
        baseSessionPriceUsd:
          readSessionPriceCents({
            baseSessionPriceUsd: row.baseSessionPriceUsd,
            sessionPriceUsd: row.sessionPriceUsd,
          }) ?? null,
        sessionDurationMinutes: row.sessionDurationMinutes,
        offersVideoSessions: row.offersVideoSessions,
        includedMessaging: row.includedMessaging ?? row.messagingIncluded !== false,
        acceptsNewLearners: row.acceptsNewLearners,
        verificationStatus: row.approvalStatus,
        verifiedClaims: row.verifiedClaims,
        public: row.published,
      })),
    );
  }, onError);
}

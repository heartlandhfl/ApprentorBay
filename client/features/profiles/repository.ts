import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import {
  COLLECTIONS,
  VERIFICATION_STATUS,
  type LearnerProfile,
  type MentorProfile,
} from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';
import { firestoreDenied } from '../mentorship';

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

  const learner = await getDoc(doc(db, COLLECTIONS.learnerProfiles, userId));
  if (learner.exists()) {
    return (learner.data() as LearnerProfile).displayName || 'Learner';
  }

  const mentor = await getDoc(doc(db, COLLECTIONS.mentorProfiles, userId));
  if (mentor.exists()) {
    return (mentor.data() as MentorProfile).displayName || 'Mentor';
  }

  return 'Member';
}

export function watchApprovedMentors(
  onNext: (mentors: MentorProfile[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, COLLECTIONS.mentorProfiles),
      where('verificationStatus', '==', VERIFICATION_STATUS.approved),
      where('public', '==', true),
    ),
    (snap) => {
      const rows = snap.docs
        .map((item) => item.data() as MentorProfile)
        .sort((a, b) => a.displayName.localeCompare(b.displayName));
      onNext(rows);
    },
    (error) => onError?.(error),
  );
}

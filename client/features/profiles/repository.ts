import { doc, onSnapshot } from 'firebase/firestore';
import {
  COLLECTIONS,
  type LearnerProfile,
  type MentorProfile,
} from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';

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
    (error) => onError?.(error),
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
    (error) => onError?.(error),
  );
}

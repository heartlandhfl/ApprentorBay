import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, type Showcase } from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';
import { firestoreDenied } from '../mentorship';

function watchShowcases(
  field: 'learnerId' | 'mentorId',
  userId: string,
  onNext: (rows: Showcase[]) => void,
  onError?: (error: Error) => void,
  options?: { publishedOnly?: boolean },
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  const filters = [where(field, '==', userId)];
  if (options?.publishedOnly) {
    filters.push(where('published', '==', true));
  }

  return onSnapshot(
    query(collection(db, COLLECTIONS.showcases), ...filters),
    (snap) => {
      const rows = snap.docs
        .map((item) => item.data() as Showcase)
        .sort((a, b) => b.completedAt.localeCompare(a.completedAt));
      onNext(rows);
    },
    (error) => {
      if (firestoreDenied(error)) onNext([]);
      else onError?.(error);
    },
  );
}

export function watchLearnerShowcases(
  learnerId: string,
  onNext: (rows: Showcase[]) => void,
  onError?: (error: Error) => void,
  options?: { publishedOnly?: boolean },
): () => void {
  return watchShowcases('learnerId', learnerId, onNext, onError, options);
}

export function watchMentorShowcases(
  mentorId: string,
  onNext: (rows: Showcase[]) => void,
  onError?: (error: Error) => void,
  options?: { publishedOnly?: boolean },
): () => void {
  return watchShowcases('mentorId', mentorId, onNext, onError, options);
}

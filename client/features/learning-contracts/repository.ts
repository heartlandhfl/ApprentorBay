import { collection, limit, onSnapshot, query, where } from 'firebase/firestore';
import { COLLECTIONS, normalizeContract, type LearningContract } from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';

export function watchContractsForRelationships(
  relationshipIds: string[],
  onNext: (contracts: LearningContract[]) => void,
  onError?: (error: Error) => void,
): () => void {
  if (relationshipIds.length === 0) {
    onNext([]);
    return () => undefined;
  }

  const byRelationship = new Map<string, LearningContract | null>();
  const unsubs = relationshipIds.map((relationshipId) =>
    watchContractForRelationship(
      relationshipId,
      (contract) => {
        byRelationship.set(relationshipId, contract);
        onNext(
          relationshipIds
            .map((id) => byRelationship.get(id))
            .filter((item): item is LearningContract => Boolean(item)),
        );
      },
      onError,
    ),
  );
  return () => unsubs.forEach((unsub) => unsub());
}

export function watchContractForRelationship(
  relationshipId: string,
  onNext: (contract: LearningContract | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, COLLECTIONS.contracts),
      where('relationshipId', '==', relationshipId),
      limit(1),
    ),
    (snap) => {
      const doc = snap.docs[0];
      onNext(doc ? normalizeContract(doc.data() as LearningContract) : null);
    },
    (error) => onError?.(error),
  );
}

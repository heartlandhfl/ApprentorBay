import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import {
  APPLICATION_STATUS,
  COLLECTIONS,
  RELATIONSHIP_STATUS,
  isOpenRelationship,
  normalizeRelationship,
  pairingIdFieldForRole,
  type MentorshipApplication,
  type MentorshipRelationship,
  type Message,
} from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';
import {
  acceptMentorshipApplication,
  declineMentorshipApplication,
} from '../../lib/api';

function dbOrThrow() {
  const db = getFirebaseDb();
  if (!db) throw new Error('Firebase is not initialized');
  return db;
}

function isDenied(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    String(error.code) === 'permission-denied'
  );
}

export function firestoreDenied(error: unknown): boolean {
  return isDenied(error);
}

function asRelationship(data: MentorshipRelationship | undefined, id: string): MentorshipRelationship | null {
  if (!data) return null;
  return normalizeRelationship({ ...data, id: data.id || id });
}

export async function createApplication(input: {
  learnerId: string;
  mentorId: string;
  message: string;
}): Promise<MentorshipApplication> {
  const db = dbOrThrow();

  const pending = await getDocs(
    query(
      collection(db, COLLECTIONS.applications),
      where('learnerId', '==', input.learnerId),
      where('mentorId', '==', input.mentorId),
    ),
  );
  if (pending.docs.some((item) => (item.data() as MentorshipApplication).status === APPLICATION_STATUS.pending)) {
    throw new Error('You already have a pending application with this mentor');
  }

  const open = await getDocs(
    query(
      collection(db, COLLECTIONS.relationships),
      where('learnerId', '==', input.learnerId),
      where('mentorId', '==', input.mentorId),
    ),
  );
  if (
    open.docs.some((item) =>
      isOpenRelationship(normalizeRelationship({ ...(item.data() as MentorshipRelationship), id: item.id })),
    )
  ) {
    throw new Error('You already have an active mentorship with this mentor');
  }

  const ref = doc(collection(db, COLLECTIONS.applications));
  const application: MentorshipApplication = {
    id: ref.id,
    learnerId: input.learnerId,
    mentorId: input.mentorId,
    message: input.message.trim(),
    status: APPLICATION_STATUS.pending,
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, application);
  return application;
}

export function watchPairing(
  learnerId: string,
  mentorId: string,
  onNext: (state: {
    application: MentorshipApplication | null;
    relationship: MentorshipRelationship | null;
  }) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  let application: MentorshipApplication | null = null;
  let relationship: MentorshipRelationship | null = null;

  const emit = () => onNext({ application, relationship });

  const unsubApps = onSnapshot(
    query(
      collection(db, COLLECTIONS.applications),
      where('learnerId', '==', learnerId),
      where('mentorId', '==', mentorId),
    ),
    (snap) => {
      const rows = snap.docs.map((item) => item.data() as MentorshipApplication);
      application =
        rows.find((row) => row.status === APPLICATION_STATUS.pending) ??
        rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ??
        null;
      emit();
    },
    (error) => onError?.(error),
  );

  const unsubRels = onSnapshot(
    query(
      collection(db, COLLECTIONS.relationships),
      where('learnerId', '==', learnerId),
      where('mentorId', '==', mentorId),
      limit(8),
    ),
    (snap) => {
      const rows = snap.docs
        .map((item) => asRelationship(item.data() as MentorshipRelationship, item.id))
        .filter((row): row is MentorshipRelationship => row !== null);
      relationship = rows.find((row) => isOpenRelationship(row)) ?? rows[0] ?? null;
      emit();
    },
    (error) => onError?.(error),
  );

  return () => {
    unsubApps();
    unsubRels();
  };
}

export function watchPendingApplications(
  mentorId: string,
  onNext: (rows: MentorshipApplication[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, COLLECTIONS.applications),
      where('mentorId', '==', mentorId),
      where('status', '==', APPLICATION_STATUS.pending),
    ),
    (snap) => onNext(snap.docs.map((item) => item.data() as MentorshipApplication)),
    (error) => onError?.(error),
  );
}

export function watchActiveRelationships(
  account: { uid: string; role: string },
  onNext: (rows: MentorshipRelationship[]) => void,
  onError?: (error: Error) => void,
): () => void {
  return watchAccountRelationships(account, (rows) => {
    onNext(rows.filter((row) => row.status === RELATIONSHIP_STATUS.active));
  }, onError);
}

export function watchAccountRelationships(
  account: { uid: string; role: string },
  onNext: (rows: MentorshipRelationship[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  const field = pairingIdFieldForRole(account.role);

  return onSnapshot(
    query(collection(db, COLLECTIONS.relationships), where(field, '==', account.uid)),
    (snap) => {
      const rows = snap.docs
        .map((item) => asRelationship(item.data() as MentorshipRelationship, item.id))
        .filter((row): row is MentorshipRelationship => row !== null)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      onNext(rows);
    },
    (error) => onError?.(error),
  );
}

export function watchRelationship(
  relationshipId: string,
  onNext: (relationship: MentorshipRelationship | null) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    doc(db, COLLECTIONS.relationships, relationshipId),
    (snap) =>
      onNext(
        snap.exists() ? asRelationship(snap.data() as MentorshipRelationship, snap.id) : null,
      ),
    (error) => onError?.(error),
  );
}

export function watchMessages(
  relationshipId: string,
  onNext: (rows: Message[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  return onSnapshot(
    query(
      collection(db, COLLECTIONS.messages),
      where('relationshipId', '==', relationshipId),
      orderBy('createdAt', 'asc'),
    ),
    (snap) => onNext(snap.docs.map((item) => item.data() as Message)),
    (error) => onError?.(error),
  );
}

export async function declineApplication(applicationId: string): Promise<void> {
  await declineMentorshipApplication(applicationId);
}

export async function acceptApplication(
  application: MentorshipApplication,
): Promise<string> {
  const relationship = await acceptMentorshipApplication(application.id);
  return relationship.id;
}

export async function sendMessage(input: {
  relationshipId: string;
  senderId: string;
  text: string;
}): Promise<void> {
  const db = dbOrThrow();
  const ref = doc(collection(db, COLLECTIONS.messages));
  const message: Message = {
    id: ref.id,
    relationshipId: input.relationshipId,
    senderId: input.senderId,
    text: input.text.trim(),
    createdAt: new Date().toISOString(),
  };
  await setDoc(ref, message);
}

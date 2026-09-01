import {
  collection,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  APPLICATION_STATUS,
  COLLECTIONS,
  RELATIONSHIP_STATUS,
  pairingIdFieldForRole,
  type MentorshipApplication,
  type MentorshipRelationship,
  type Message,
} from '@apprentorbay/shared';
import { getFirebaseDb } from '../../lib/firebase';

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

export async function createApplication(input: {
  learnerId: string;
  mentorId: string;
  message: string;
}): Promise<MentorshipApplication> {
  const db = dbOrThrow();
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
      where('status', '==', RELATIONSHIP_STATUS.active),
      limit(1),
    ),
    (snap) => {
      relationship = snap.docs[0]?.data() as MentorshipRelationship | undefined ?? null;
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
  const db = getFirebaseDb();
  if (!db) {
    onError?.(new Error('Firebase is not initialized'));
    return () => undefined;
  }

  const field = pairingIdFieldForRole(account.role);

  return onSnapshot(
    query(
      collection(db, COLLECTIONS.relationships),
      where(field, '==', account.uid),
      where('status', '==', RELATIONSHIP_STATUS.active),
    ),
    (snap) => onNext(snap.docs.map((item) => item.data() as MentorshipRelationship)),
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
    (snap) => onNext(snap.exists() ? (snap.data() as MentorshipRelationship) : null),
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
  const db = dbOrThrow();
  await updateDoc(doc(db, COLLECTIONS.applications, applicationId), {
    status: APPLICATION_STATUS.declined,
  });
}

export async function acceptApplication(
  application: MentorshipApplication,
): Promise<string> {
  const db = dbOrThrow();

  const existing = await getDocs(
    query(
      collection(db, COLLECTIONS.relationships),
      where('learnerId', '==', application.learnerId),
      where('mentorId', '==', application.mentorId),
      where('status', '==', RELATIONSHIP_STATUS.active),
      limit(1),
    ),
  );
  if (!existing.empty) {
    await updateDoc(doc(db, COLLECTIONS.applications, application.id), {
      status: APPLICATION_STATUS.accepted,
    });
    return existing.docs[0].id;
  }

  const relRef = doc(collection(db, COLLECTIONS.relationships));
  await runTransaction(db, async (tx) => {
    const appRef = doc(db, COLLECTIONS.applications, application.id);
    const appSnap = await tx.get(appRef);
    if (!appSnap.exists()) throw new Error('Application is gone');
    const current = appSnap.data() as MentorshipApplication;
    if (current.status !== APPLICATION_STATUS.pending) {
      throw new Error('This application is no longer pending');
    }

    tx.update(appRef, { status: APPLICATION_STATUS.accepted });
    const relationship: MentorshipRelationship = {
      id: relRef.id,
      learnerId: current.learnerId,
      mentorId: current.mentorId,
      status: RELATIONSHIP_STATUS.active,
      createdAt: new Date().toISOString(),
    };
    tx.set(relRef, relationship);
  });

  return relRef.id;
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

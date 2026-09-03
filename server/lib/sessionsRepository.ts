import {
  COLLECTIONS,
  normalizeMentorshipBooking,
  normalizeRelationship,
  normalizeSession,
  type MentorshipBooking,
  type MentorshipRelationship,
  type MentorshipSession,
} from '@apprentorbay/shared';
import { adminDb } from './firebase.js';

export async function getRelationshipById(
  relationshipId: string,
): Promise<MentorshipRelationship | null> {
  const snap = await adminDb().collection(COLLECTIONS.relationships).doc(relationshipId).get();
  if (!snap.exists) return null;
  return normalizeRelationship({
    ...(snap.data() as MentorshipRelationship),
    id: snap.id,
  });
}

export async function getSessionById(sessionId: string): Promise<MentorshipSession | null> {
  const snap = await adminDb().collection(COLLECTIONS.sessions).doc(sessionId).get();
  if (!snap.exists) return null;
  return normalizeSession({
    ...(snap.data() as MentorshipSession),
    id: snap.id,
  });
}

export async function saveSession(session: MentorshipSession): Promise<void> {
  await adminDb().collection(COLLECTIONS.sessions).doc(session.id).set(session);
}

export async function listSessionsForRelationship(
  relationshipId: string,
): Promise<MentorshipSession[]> {
  const snap = await adminDb()
    .collection(COLLECTIONS.sessions)
    .where('relationshipId', '==', relationshipId)
    .orderBy('scheduledStart', 'asc')
    .get();

  return snap.docs.map((doc) =>
    normalizeSession({
      ...(doc.data() as MentorshipSession),
      id: doc.id,
    }),
  );
}

export async function getBookingForSession(
  sessionId: string,
): Promise<Pick<MentorshipBooking, 'id' | 'paymentStatus' | 'bookingStatus' | 'sessionId'> | null> {
  const snap = await adminDb()
    .collection(COLLECTIONS.bookings)
    .where('sessionId', '==', sessionId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const booking = normalizeMentorshipBooking({
    ...(snap.docs[0].data() as MentorshipBooking),
    id: snap.docs[0].id,
  });
  return {
    id: booking.id,
    paymentStatus: booking.paymentStatus,
    bookingStatus: booking.bookingStatus,
    sessionId: booking.sessionId,
  };
}

export function newSessionRef() {
  return adminDb().collection(COLLECTIONS.sessions).doc();
}

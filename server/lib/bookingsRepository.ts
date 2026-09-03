import type { Transaction } from 'firebase-admin/firestore';
import {
  BOOKING_STATUS,
  COLLECTIONS,
  buildMentorshipBooking,
  isOpenBookingPaymentStatus,
  isOpenBookingStatus,
  normalizeMentorshipBooking,
  type BookingFinancialSnapshot,
  type MentorshipBooking,
  type MentorshipRelationship,
  type MentorshipSession,
} from '@apprentorbay/shared';
import { adminDb } from './firebase.js';

export type BookingPendingLock = {
  bookingId: string;
  relationshipId: string;
  createdAt: string;
};

function pendingLockRef(relationshipId: string) {
  return adminDb().collection(COLLECTIONS.bookingPendingLocks).doc(relationshipId);
}

function openBookingsQuery(relationshipId: string) {
  return adminDb()
    .collection(COLLECTIONS.bookings)
    .where('relationshipId', '==', relationshipId)
    .where('bookingStatus', '==', BOOKING_STATUS.pendingPayment)
    .limit(8);
}

async function findOpenBookingsInTransaction(
  tx: Transaction,
  relationshipId: string,
): Promise<MentorshipBooking[]> {
  const snap = await tx.get(openBookingsQuery(relationshipId));
  return snap.docs.map((doc) =>
    normalizeMentorshipBooking({ ...(doc.data() as MentorshipBooking), id: doc.id }),
  );
}

function isOpenBooking(booking: Pick<MentorshipBooking, 'paymentStatus' | 'bookingStatus'>): boolean {
  return isOpenBookingPaymentStatus(booking.paymentStatus) || isOpenBookingStatus(booking.bookingStatus);
}

export async function releaseBookingPendingLock(
  relationshipId: string,
  bookingId: string,
): Promise<void> {
  const ref = pendingLockRef(relationshipId);
  await adminDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    const lock = snap.data() as BookingPendingLock;
    if (lock.bookingId === bookingId) {
      tx.delete(ref);
    }
  });
}

export async function createMentorshipBookingAtomically(input: {
  relationship: MentorshipRelationship;
  snapshot: BookingFinancialSnapshot;
  now: string;
  sessionId?: string | null;
  linkedSession?: MentorshipSession | null;
  idempotencyKey?: string | null;
}): Promise<{ booking: MentorshipBooking; created: boolean }> {
  const bookingRef = adminDb().collection(COLLECTIONS.bookings).doc();
  const lockRef = pendingLockRef(input.relationship.id);

  return adminDb().runTransaction(async (tx) => {
    if (input.idempotencyKey) {
      const idemSnap = await tx.get(
        adminDb()
          .collection(COLLECTIONS.bookings)
          .where('idempotencyKey', '==', input.idempotencyKey)
          .limit(1),
      );
      if (!idemSnap.empty) {
        const existing = normalizeMentorshipBooking({
          ...(idemSnap.docs[0].data() as MentorshipBooking),
          id: idemSnap.docs[0].id,
        });
        return { booking: existing, created: false };
      }
    }

    const lockSnap = await tx.get(lockRef);
    if (lockSnap.exists) {
      const lock = lockSnap.data() as BookingPendingLock;
      const existingRef = adminDb().collection(COLLECTIONS.bookings).doc(lock.bookingId);
      const existingSnap = await tx.get(existingRef);
      if (existingSnap.exists) {
        const existing = normalizeMentorshipBooking({
          ...(existingSnap.data() as MentorshipBooking),
          id: existingSnap.id,
        });
        if (isOpenBooking(existing)) {
          return { booking: existing, created: false };
        }
      }
      tx.delete(lockRef);
    }

    const openBookings = await findOpenBookingsInTransaction(tx, input.relationship.id);
    const openBooking = openBookings.find(isOpenBooking);
    if (openBooking) {
      tx.set(lockRef, {
        bookingId: openBooking.id,
        relationshipId: input.relationship.id,
        createdAt: openBooking.createdAt,
      } satisfies BookingPendingLock);
      return { booking: openBooking, created: false };
    }

    if (input.linkedSession) {
      const sessionRef = adminDb().collection(COLLECTIONS.sessions).doc(input.linkedSession.id);
      const sessionSnap = await tx.get(sessionRef);
      if (!sessionSnap.exists) {
        throw Object.assign(new Error('Session not found for this relationship'), { status: 400 });
      }
      const session = sessionSnap.data() as MentorshipSession;
      if (session.relationshipId !== input.relationship.id) {
        throw Object.assign(new Error('Session not found for this relationship'), { status: 400 });
      }
      if (session.bookingId) {
        throw Object.assign(new Error('This session already has a booking'), { status: 409 });
      }
    }

    const booking = buildMentorshipBooking({
      id: bookingRef.id,
      relationship: input.relationship,
      snapshot: input.snapshot,
      now: input.now,
      sessionId: input.sessionId ?? null,
    });
    const bookingToWrite =
      input.idempotencyKey && input.idempotencyKey.length > 0
        ? { ...booking, idempotencyKey: input.idempotencyKey }
        : booking;

    tx.set(bookingRef, bookingToWrite);
    tx.set(lockRef, {
      bookingId: booking.id,
      relationshipId: input.relationship.id,
      createdAt: input.now,
    } satisfies BookingPendingLock);

    if (input.linkedSession) {
      const sessionRef = adminDb().collection(COLLECTIONS.sessions).doc(input.linkedSession.id);
      tx.set(
        sessionRef,
        {
          ...input.linkedSession,
          bookingId: booking.id,
          updatedAt: input.now,
        },
        { merge: true },
      );
    }

    return { booking, created: true };
  });
}

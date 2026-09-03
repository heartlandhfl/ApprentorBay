import { Router } from 'express';
import {
  AUDIT_EVENT,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  COLLECTIONS,
  USER_ROLE,
  buildBookingFinancialSnapshot,
  buildMentorshipBooking,
  canCancelBooking,
  canCreateBooking,
  canReadBooking,
  cancelMentorshipBooking,
  normalizeMentorshipBooking,
  normalizeRelationship,
  validateCreateBookingBody,
  type MentorshipBooking,
  type MentorshipRelationship,
} from '@apprentorbay/shared';
import { platformFeeBpsFromEnv } from '../lib/bookingConfig.js';
import { recordAudit } from '../lib/audit.js';
import { adminDb } from '../lib/firebase.js';
import { loadPrivateProfile } from '../lib/profiles.js';
import { requireAccount, sendApiError, type AccountRequest } from '../middleware/requireAccount.js';

export const bookingsRouter = Router();

bookingsRouter.use(requireAccount);

async function loadRelationship(relationshipId: string) {
  const snap = await adminDb().collection(COLLECTIONS.relationships).doc(relationshipId).get();
  if (!snap.exists) return null;
  return normalizeRelationship({
    ...(snap.data() as MentorshipRelationship),
    id: snap.id,
  });
}

async function loadBooking(bookingId: string) {
  const snap = await adminDb().collection(COLLECTIONS.bookings).doc(bookingId).get();
  if (!snap.exists) return null;
  return normalizeMentorshipBooking({
    ...(snap.data() as MentorshipBooking),
    id: snap.id,
  });
}

async function listOpenBookingsForRelationship(relationshipId: string) {
  const snap = await adminDb()
    .collection(COLLECTIONS.bookings)
    .where('relationshipId', '==', relationshipId)
    .where('bookingStatus', '==', BOOKING_STATUS.pendingPayment)
    .limit(8)
    .get();
  return snap.docs.map((doc) =>
    normalizeMentorshipBooking({ ...(doc.data() as MentorshipBooking), id: doc.id }),
  );
}

bookingsRouter.post('/', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const parsed = validateCreateBookingBody(req.body);
    if (!parsed.ok) {
      sendApiError(res, 400, 'invalid', parsed.error);
      return;
    }

    const relationship = await loadRelationship(parsed.relationshipId!);
    if (!relationship) {
      sendApiError(res, 404, 'not_found', 'Relationship not found');
      return;
    }

    const openBookings = await listOpenBookingsForRelationship(relationship.id);
    if (!canCreateBooking(account, relationship, openBookings)) {
      sendApiError(res, 403, 'forbidden', 'You cannot create a booking for this relationship');
      return;
    }

    const mentorLoaded = await loadPrivateProfile(relationship.mentorId, USER_ROLE.mentor);
    if (!mentorLoaded || mentorLoaded.role !== USER_ROLE.mentor) {
      sendApiError(res, 404, 'not_found', 'Mentor profile not found');
      return;
    }

    const snapshotResult = buildBookingFinancialSnapshot(
      mentorLoaded.profile,
      platformFeeBpsFromEnv(),
    );
    if (!snapshotResult.ok) {
      sendApiError(res, 400, 'invalid', snapshotResult.error);
      return;
    }

    const now = new Date().toISOString();
    const ref = adminDb().collection(COLLECTIONS.bookings).doc();
    const booking = buildMentorshipBooking({
      id: ref.id,
      relationship,
      snapshot: snapshotResult.snapshot!,
      now,
    });

    await ref.set(booking);
    await recordAudit({
      actorId: account.uid,
      action: AUDIT_EVENT.bookingCreated,
      targetUserId: relationship.mentorId,
      metadata: {
        bookingId: booking.id,
        relationshipId: relationship.id,
        unitPriceCents: String(booking.unitPriceCents),
        currency: booking.currency,
      },
    });

    res.status(201).json({ booking });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.get('/:id', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const booking = await loadBooking(String(req.params.id ?? ''));
    if (!booking) {
      sendApiError(res, 404, 'not_found', 'Booking not found');
      return;
    }

    if (!canReadBooking(account, booking)) {
      sendApiError(res, 403, 'forbidden', 'You cannot view this booking');
      return;
    }

    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.get('/relationship/:relationshipId', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const relationshipId = String(req.params.relationshipId ?? '');
    const relationship = await loadRelationship(relationshipId);
    if (!relationship) {
      sendApiError(res, 404, 'not_found', 'Relationship not found');
      return;
    }

    if (!canReadBooking(account, relationship)) {
      sendApiError(res, 403, 'forbidden', 'You cannot view bookings for this relationship');
      return;
    }

    const snap = await adminDb()
      .collection(COLLECTIONS.bookings)
      .where('relationshipId', '==', relationshipId)
      .orderBy('createdAt', 'desc')
      .limit(24)
      .get();

    const bookings = snap.docs.map((doc) =>
      normalizeMentorshipBooking({ ...(doc.data() as MentorshipBooking), id: doc.id }),
    );
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

bookingsRouter.post('/:id/cancel', async (req: AccountRequest, res, next) => {
  try {
    const account = req.account;
    if (!account) {
      sendApiError(res, 401, 'unauthenticated', 'Sign in required');
      return;
    }

    const bookingId = String(req.params.id ?? '');
    const current = await loadBooking(bookingId);
    if (!current) {
      sendApiError(res, 404, 'not_found', 'Booking not found');
      return;
    }

    if (!canCancelBooking(account, current)) {
      sendApiError(res, 403, 'forbidden', 'You cannot cancel this booking');
      return;
    }

    if (
      current.bookingStatus === BOOKING_STATUS.cancelled &&
      current.paymentStatus === BOOKING_PAYMENT_STATUS.cancelled
    ) {
      res.json({ booking: current });
      return;
    }

    const now = new Date().toISOString();
    const booking = cancelMentorshipBooking(current, now);
    await adminDb().collection(COLLECTIONS.bookings).doc(booking.id).set(booking);
    await recordAudit({
      actorId: account.uid,
      action: AUDIT_EVENT.bookingCancelled,
      targetUserId: account.uid === booking.learnerId ? booking.mentorId : booking.learnerId,
      metadata: {
        bookingId: booking.id,
        relationshipId: booking.relationshipId,
      },
    });

    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

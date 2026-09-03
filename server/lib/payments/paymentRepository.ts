import type { Transaction } from 'firebase-admin/firestore';
import {
  COLLECTIONS,
  PAYMENT_EVENT_ENTITY,
  buildPaymentEvent,
  normalizeCheckoutSession,
  normalizeMentorshipBooking,
  normalizePaymentIntent,
  normalizeRelationship,
  type CheckoutSession,
  type MentorshipBooking,
  type MentorshipRelationship,
  type PaymentIntent,
} from '@apprentorbay/shared';
import { adminDb } from '../firebase.js';

export type CheckoutBundle = {
  paymentIntent: PaymentIntent;
  checkoutSession: CheckoutSession;
  checkoutUrl: string;
};

export interface PaymentRepository {
  findCheckoutByIdempotencyKey(idempotencyKey: string): Promise<CheckoutBundle | null>;
  listCheckoutSessionsForBooking(bookingId: string): Promise<CheckoutSession[]>;
  loadCheckoutBundle(checkoutSession: CheckoutSession): Promise<CheckoutBundle | null>;
  persistNewCheckout(input: {
    paymentIntent: PaymentIntent;
    checkoutSession: CheckoutSession;
    learnerId: string;
    idempotencyKey: string;
    now: string;
    fromStatus: string;
    providerCheckoutSessionId: string;
  }): Promise<void>;
  isWebhookEventProcessed(providerEventId: string): Promise<boolean>;
  claimWebhookEvent(providerEventId: string, now: string, tx?: Transaction): Promise<boolean>;
  markWebhookEventProcessed(providerEventId: string, now: string): Promise<void>;
  loadIntentByProviderId(
    providerPaymentIntentId: string,
    tx?: Transaction,
  ): Promise<PaymentIntent | null>;
  loadBooking(bookingId: string, tx?: Transaction): Promise<MentorshipBooking | null>;
  loadRelationship(relationshipId: string, tx?: Transaction): Promise<MentorshipRelationship | null>;
  saveIntent(intent: PaymentIntent, tx?: Transaction): Promise<void>;
  saveBooking(booking: MentorshipBooking, tx?: Transaction): Promise<void>;
  saveRelationship(relationship: MentorshipRelationship, tx?: Transaction): Promise<void>;
  appendPaymentEvent(input: {
    entityType: (typeof PAYMENT_EVENT_ENTITY)[keyof typeof PAYMENT_EVENT_ENTITY];
    entityId: string;
    eventType: string;
    fromStatus: string | null;
    toStatus: string | null;
    actorId?: string | null;
    idempotencyKey?: string | null;
    providerEventId?: string | null;
    payload?: Record<string, string>;
    now: string;
  }, tx?: Transaction): Promise<void>;
  runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T>;
}

async function bundleFromCheckoutSession(
  checkoutSession: CheckoutSession,
): Promise<CheckoutBundle | null> {
  const intentSnap = await adminDb()
    .collection(COLLECTIONS.paymentIntents)
    .doc(checkoutSession.paymentIntentId)
    .get();
  if (!intentSnap.exists) return null;
  const paymentIntent = normalizePaymentIntent({
    ...(intentSnap.data() as PaymentIntent),
    id: intentSnap.id,
  });
  return {
    paymentIntent,
    checkoutSession,
    checkoutUrl: checkoutSession.checkoutUrl ?? '',
  };
}

export const firestorePaymentRepository: PaymentRepository = {
  async findCheckoutByIdempotencyKey(idempotencyKey) {
    const snap = await adminDb()
      .collection(COLLECTIONS.checkoutSessions)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    if (snap.empty) return null;
    const checkoutSession = normalizeCheckoutSession({
      ...(snap.docs[0].data() as CheckoutSession),
      id: snap.docs[0].id,
    });
    return bundleFromCheckoutSession(checkoutSession);
  },

  async listCheckoutSessionsForBooking(bookingId) {
    const snap = await adminDb()
      .collection(COLLECTIONS.checkoutSessions)
      .where('bookingId', '==', bookingId)
      .orderBy('createdAt', 'desc')
      .limit(8)
      .get();
    return snap.docs.map((doc) =>
      normalizeCheckoutSession({
        ...(doc.data() as CheckoutSession),
        id: doc.id,
      }),
    );
  },

  async loadCheckoutBundle(checkoutSession) {
    return bundleFromCheckoutSession(checkoutSession);
  },

  async persistNewCheckout(input) {
    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc(input.paymentIntent.id);
    const sessionRef = adminDb()
      .collection(COLLECTIONS.checkoutSessions)
      .doc(input.checkoutSession.id);
    await adminDb().runTransaction(async (tx) => {
      tx.set(intentRef, input.paymentIntent);
      tx.set(sessionRef, input.checkoutSession);
      const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
      tx.set(
        eventRef,
        buildPaymentEvent({
          id: eventRef.id,
          entityType: PAYMENT_EVENT_ENTITY.paymentIntent,
          entityId: input.paymentIntent.id,
          eventType: 'payment_intent.checkout_created',
          fromStatus: input.fromStatus,
          toStatus: input.paymentIntent.status,
          actorId: input.learnerId,
          idempotencyKey: input.idempotencyKey,
          payload: {
            bookingId: input.checkoutSession.bookingId,
            providerCheckoutSessionId: input.providerCheckoutSessionId,
          },
          now: input.now,
        }),
      );
    });
  },

  async isWebhookEventProcessed(providerEventId) {
    const dedupRef = adminDb().collection(COLLECTIONS.paymentWebhookDedup).doc(providerEventId);
    const dedupSnap = await dedupRef.get();
    return dedupSnap.exists;
  },

  async claimWebhookEvent(providerEventId, now, tx) {
    const dedupRef = adminDb().collection(COLLECTIONS.paymentWebhookDedup).doc(providerEventId);
    const dedupSnap = tx ? await tx.get(dedupRef) : await dedupRef.get();
    if (dedupSnap.exists) return false;
    const payload = {
      providerEventId,
      processedAt: now,
    };
    if (tx) {
      tx.set(dedupRef, payload);
    } else {
      await dedupRef.set(payload);
    }
    return true;
  },

  async markWebhookEventProcessed(providerEventId, now) {
    await this.claimWebhookEvent(providerEventId, now);
  },

  async loadIntentByProviderId(providerPaymentIntentId, tx) {
    const query = adminDb()
      .collection(COLLECTIONS.paymentIntents)
      .where('providerPaymentIntentId', '==', providerPaymentIntentId)
      .limit(1);
    const snap = tx ? await tx.get(query) : await query.get();
    if (snap.empty) return null;
    return normalizePaymentIntent({
      ...(snap.docs[0].data() as PaymentIntent),
      id: snap.docs[0].id,
    });
  },

  async loadBooking(bookingId, tx) {
    const ref = adminDb().collection(COLLECTIONS.bookings).doc(bookingId);
    const snap = tx ? await tx.get(ref) : await ref.get();
    if (!snap.exists) return null;
    return normalizeMentorshipBooking({
      ...(snap.data() as MentorshipBooking),
      id: snap.id,
    });
  },

  async loadRelationship(relationshipId, tx) {
    const ref = adminDb().collection(COLLECTIONS.relationships).doc(relationshipId);
    const snap = tx ? await tx.get(ref) : await ref.get();
    if (!snap.exists) return null;
    return normalizeRelationship({
      ...(snap.data() as MentorshipRelationship),
      id: snap.id,
    });
  },

  async saveIntent(intent, tx) {
    const ref = adminDb().collection(COLLECTIONS.paymentIntents).doc(intent.id);
    if (tx) {
      tx.set(ref, intent);
      return;
    }
    await ref.set(intent);
  },

  async saveBooking(booking, tx) {
    const ref = adminDb().collection(COLLECTIONS.bookings).doc(booking.id);
    if (tx) {
      tx.set(ref, booking);
      return;
    }
    await ref.set(booking);
  },

  async saveRelationship(relationship, tx) {
    const ref = adminDb().collection(COLLECTIONS.relationships).doc(relationship.id);
    if (tx) {
      tx.set(ref, relationship);
      return;
    }
    await ref.set(relationship);
  },

  async appendPaymentEvent(input, tx) {
    const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
    const event = buildPaymentEvent({
      id: eventRef.id,
      entityType: input.entityType,
      entityId: input.entityId,
      eventType: input.eventType,
      fromStatus: input.fromStatus,
      toStatus: input.toStatus,
      actorId: input.actorId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      providerEventId: input.providerEventId ?? null,
      payload: input.payload,
      now: input.now,
    });
    if (tx) {
      tx.set(eventRef, event);
      return;
    }
    await eventRef.set(event);
  },

  async runTransaction(fn) {
    return adminDb().runTransaction(fn);
  },
};

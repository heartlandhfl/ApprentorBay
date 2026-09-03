import type { Transaction } from 'firebase-admin/firestore';
import {
  AUDIT_EVENT,
  BOOKING_PAYMENT_STATUS,
  BOOKING_STATUS,
  CHECKOUT_SESSION_STATUS,
  COLLECTIONS,
  PAYMENT_EVENT_ENTITY,
  PAYMENT_STATUS,
  REFUND_REASON,
  REFUND_STATUS,
  buildPaymentEvent,
  buildPaymentIntentFromBooking,
  markMentorshipBookingPaid,
  normalizeCheckoutSession,
  normalizeMentorshipBooking,
  normalizePaymentIntent,
  normalizePaymentRefund,
  normalizeRelationship,
  reduceCheckoutSession,
  reducePaymentIntent,
  reducePaymentRefund,
  validatePaymentMatchesBooking,
  type CheckoutSession,
  type MentorshipBooking,
  type MentorshipRelationship,
  type PaymentIntent,
  type PaymentRefund,
} from '@apprentorbay/shared';
import { recordAudit } from '../audit.js';
import { releaseBookingPendingLock } from '../bookingsRepository.js';
import { adminDb } from '../firebase.js';
import { paymentCheckoutCancelUrl, paymentCheckoutSuccessUrl } from './paymentConfig.js';
import { getPaymentProvider } from './registry.js';
import type { PaymentProvider, ProviderWebhookEvent } from './types.js';

export class PaymentService {
  constructor(private readonly provider: PaymentProvider = getPaymentProvider()) {}

  async createCheckout(input: {
    booking: MentorshipBooking;
    learnerId: string;
    idempotencyKey: string;
    now?: string;
  }): Promise<{ paymentIntent: PaymentIntent; checkoutSession: CheckoutSession; checkoutUrl: string }> {
    const now = input.now ?? new Date().toISOString();
    const existing = await this.findCheckoutByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc();
    const sessionRef = adminDb().collection(COLLECTIONS.checkoutSessions).doc();
    const intent = buildPaymentIntentFromBooking({
      id: intentRef.id,
      booking: input.booking,
      provider: this.provider.id,
      idempotencyKey: input.idempotencyKey,
      now,
    });
    const match = validatePaymentMatchesBooking(intent, input.booking);
    if (!match.ok) {
      throw Object.assign(new Error(match.error), { status: 400 });
    }

    const providerResult = await this.provider.createCheckoutSession({
      paymentIntentId: intent.id,
      bookingId: input.booking.id,
      amountCents: input.booking.unitPriceCents,
      currency: 'USD',
      title: input.booking.title,
      learnerId: input.learnerId,
      successUrl: paymentCheckoutSuccessUrl(input.booking.id),
      cancelUrl: paymentCheckoutCancelUrl(input.booking.id),
      idempotencyKey: input.idempotencyKey,
      metadata: {
        apprentorbay_payment_intent_id: intent.id,
        apprentorbay_booking_id: input.booking.id,
        apprentorbay_relationship_id: input.booking.relationshipId,
      },
    });

    let nextIntent = reducePaymentIntent(
      intent,
      {
        type: 'CHECKOUT_CREATED',
        checkoutSessionId: sessionRef.id,
        providerPaymentIntentId: providerResult.providerPaymentIntentId,
      },
      now,
    );

    const checkoutSession: CheckoutSession = {
      id: sessionRef.id,
      paymentIntentId: intent.id,
      bookingId: input.booking.id,
      learnerId: input.learnerId,
      status: CHECKOUT_SESSION_STATUS.open,
      provider: this.provider.id,
      providerCheckoutSessionId: providerResult.providerCheckoutSessionId,
      checkoutUrl: providerResult.checkoutUrl,
      expiresAt: providerResult.expiresAt,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };

    await adminDb().runTransaction(async (tx) => {
      tx.set(intentRef, nextIntent);
      tx.set(sessionRef, checkoutSession);
      const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
      tx.set(
        eventRef,
        buildPaymentEvent({
          id: eventRef.id,
          entityType: PAYMENT_EVENT_ENTITY.paymentIntent,
          entityId: nextIntent.id,
          eventType: 'payment_intent.checkout_created',
          fromStatus: intent.status,
          toStatus: nextIntent.status,
          actorId: input.learnerId,
          idempotencyKey: input.idempotencyKey,
          payload: {
            bookingId: input.booking.id,
            providerCheckoutSessionId: providerResult.providerCheckoutSessionId,
          },
          now,
        }),
      );
    });

    await recordAudit({
      actorId: input.learnerId,
      action: AUDIT_EVENT.paymentCheckoutCreated,
      targetUserId: input.booking.mentorId,
      metadata: {
        bookingId: input.booking.id,
        paymentIntentId: nextIntent.id,
        checkoutSessionId: checkoutSession.id,
      },
    });

    return {
      paymentIntent: nextIntent,
      checkoutSession,
      checkoutUrl: providerResult.checkoutUrl,
    };
  }

  async handleWebhookEvents(events: ProviderWebhookEvent[]): Promise<void> {
    for (const event of events) {
      const dedupId = `${this.provider.id}_${event.providerEventId}`;
      const dedupRef = adminDb().collection(COLLECTIONS.paymentWebhookDedup).doc(dedupId);
      const dedupSnap = await dedupRef.get();
      if (dedupSnap.exists) continue;

      const now = new Date().toISOString();
      await adminDb().runTransaction(async (tx) => {
        const freshDedup = await tx.get(dedupRef);
        if (freshDedup.exists) return;

        switch (event.type) {
          case 'checkout_completed':
            await this.applyCheckoutCompleted(tx, event, now);
            break;
          case 'checkout_expired':
            await this.applyCheckoutExpired(tx, event, now);
            break;
          case 'payment_processing':
            await this.applyPaymentProcessing(tx, event, now);
            break;
          case 'payment_succeeded':
            await this.applyPaymentSucceeded(tx, event, now, 'webhook');
            break;
          case 'payment_failed':
            await this.applyPaymentFailed(tx, event, now);
            break;
          case 'payment_cancelled':
            await this.applyPaymentCancelled(tx, event, now);
            break;
          case 'refund_succeeded':
            await this.applyRefundSucceeded(tx, event, now);
            break;
          case 'refund_failed':
            await this.applyRefundFailed(tx, event, now);
            break;
          default:
            break;
        }

        tx.set(dedupRef, {
          provider: this.provider.id,
          providerEventId: event.providerEventId,
          processedAt: now,
        });
      });
    }
  }

  async reconcileStuckPayments(now = new Date().toISOString()): Promise<number> {
    const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const snap = await adminDb()
      .collection(COLLECTIONS.paymentIntents)
      .where('status', 'in', [PAYMENT_STATUS.processing, PAYMENT_STATUS.requiresPaymentMethod])
      .where('updatedAt', '<', cutoff)
      .limit(25)
      .get();

    let adjusted = 0;
    for (const doc of snap.docs) {
      const intent = normalizePaymentIntent({ ...(doc.data() as PaymentIntent), id: doc.id });
      if (!intent.providerPaymentIntentId) continue;
      const providerStatus = await this.provider.getPaymentStatus(intent.providerPaymentIntentId);
      if (providerStatus === 'paid' && intent.status !== PAYMENT_STATUS.paid) {
        await adminDb().runTransaction(async (tx) => {
          await this.applyPaymentSucceeded(
            tx,
            {
              type: 'payment_succeeded',
              providerPaymentIntentId: intent.providerPaymentIntentId!,
              paidAt: now,
              providerEventId: `reconcile_${intent.id}_${now}`,
            },
            now,
            'reconciliation',
          );
        });
        adjusted += 1;
      }
    }
    return adjusted;
  }

  async createRefund(input: {
    paymentIntentId: string;
    requestedBy: string;
    reason: (typeof REFUND_REASON)[keyof typeof REFUND_REASON];
    idempotencyKey: string;
    now?: string;
  }): Promise<PaymentRefund> {
    const now = input.now ?? new Date().toISOString();
    const intentSnap = await adminDb()
      .collection(COLLECTIONS.paymentIntents)
      .doc(input.paymentIntentId)
      .get();
    if (!intentSnap.exists) {
      throw Object.assign(new Error('Payment intent not found'), { status: 404 });
    }
    const intent = normalizePaymentIntent({
      ...(intentSnap.data() as PaymentIntent),
      id: intentSnap.id,
    });
    if (intent.status !== PAYMENT_STATUS.paid && intent.status !== PAYMENT_STATUS.partiallyRefunded) {
      throw Object.assign(new Error('Only paid payments can be refunded'), { status: 400 });
    }
    if (!intent.providerPaymentIntentId) {
      throw Object.assign(new Error('Payment intent has no provider reference'), { status: 400 });
    }

    const existing = await this.findRefundByIdempotencyKey(input.idempotencyKey);
    if (existing) return existing;

    const refundRef = adminDb().collection(COLLECTIONS.paymentRefunds).doc();
    let refund: PaymentRefund = {
      id: refundRef.id,
      paymentIntentId: intent.id,
      bookingId: intent.bookingId,
      status: REFUND_STATUS.pending,
      amountCents: intent.amount.amountCents,
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      provider: this.provider.id,
      providerRefundId: null,
      requestedBy: input.requestedBy,
      createdAt: now,
      updatedAt: now,
      succeededAt: null,
    };

    const providerRefund = await this.provider.createRefund({
      providerPaymentIntentId: intent.providerPaymentIntentId,
      amountCents: intent.amount.amountCents,
      idempotencyKey: input.idempotencyKey,
    });

    refund = reducePaymentRefund(
      refund,
      { type: 'REFUND_SUBMITTED', providerRefundId: providerRefund.providerRefundId },
      now,
    );

    await adminDb().runTransaction(async (tx) => {
      tx.set(refundRef, refund);
      const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
      tx.set(
        eventRef,
        buildPaymentEvent({
          id: eventRef.id,
          entityType: PAYMENT_EVENT_ENTITY.refund,
          entityId: refund.id,
          eventType: 'refund.submitted',
          fromStatus: REFUND_STATUS.pending,
          toStatus: REFUND_STATUS.pending,
          actorId: input.requestedBy,
          idempotencyKey: input.idempotencyKey,
          payload: {
            paymentIntentId: intent.id,
            bookingId: intent.bookingId,
            providerRefundId: providerRefund.providerRefundId,
          },
          now,
        }),
      );
    });

    return refund;
  }

  private async findCheckoutByIdempotencyKey(idempotencyKey: string) {
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

  private async findRefundByIdempotencyKey(idempotencyKey: string) {
    const snap = await adminDb()
      .collection(COLLECTIONS.paymentRefunds)
      .where('idempotencyKey', '==', idempotencyKey)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return normalizePaymentRefund({
      ...(snap.docs[0].data() as PaymentRefund),
      id: snap.docs[0].id,
    });
  }

  private async loadRefundByProviderId(providerRefundId: string, tx?: Transaction) {
    const query = adminDb()
      .collection(COLLECTIONS.paymentRefunds)
      .where('providerRefundId', '==', providerRefundId)
      .limit(1);
    const snap = tx ? await tx.get(query) : await query.get();
    if (snap.empty) return null;
    return normalizePaymentRefund({
      ...(snap.docs[0].data() as PaymentRefund),
      id: snap.docs[0].id,
    });
  }

  private async loadIntentByProviderId(
    providerPaymentIntentId: string,
    tx?: Transaction,
  ): Promise<PaymentIntent | null> {
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
  }

  private async loadCheckoutByProviderId(providerCheckoutSessionId: string) {
    const snap = await adminDb()
      .collection(COLLECTIONS.checkoutSessions)
      .where('providerCheckoutSessionId', '==', providerCheckoutSessionId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return normalizeCheckoutSession({
      ...(snap.docs[0].data() as CheckoutSession),
      id: snap.docs[0].id,
    });
  }

  private async applyCheckoutCompleted(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'checkout_completed' }>,
    now: string,
  ) {
    const checkout = await this.loadCheckoutByProviderId(event.providerCheckoutSessionId);
    if (!checkout) return;
    const checkoutRef = adminDb().collection(COLLECTIONS.checkoutSessions).doc(checkout.id);
    const nextCheckout = reduceCheckoutSession(checkout, { type: 'CHECKOUT_COMPLETED' }, now);
    tx.set(checkoutRef, nextCheckout);
    const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
    tx.set(
      eventRef,
      buildPaymentEvent({
        id: eventRef.id,
        entityType: PAYMENT_EVENT_ENTITY.checkoutSession,
        entityId: checkout.id,
        eventType: 'checkout.completed',
        fromStatus: checkout.status,
        toStatus: nextCheckout.status,
        providerEventId: event.providerEventId,
        payload: { note: 'non_authoritative' },
        now,
      }),
    );
  }

  private async applyCheckoutExpired(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'checkout_expired' }>,
    now: string,
  ) {
    const checkout = await this.loadCheckoutByProviderId(event.providerCheckoutSessionId);
    if (!checkout) return;
    const checkoutRef = adminDb().collection(COLLECTIONS.checkoutSessions).doc(checkout.id);
    const nextCheckout = reduceCheckoutSession(checkout, { type: 'CHECKOUT_EXPIRED' }, now);
    tx.set(checkoutRef, nextCheckout);
  }

  private async applyPaymentProcessing(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'payment_processing' }>,
    now: string,
  ) {
    const intent = await this.loadIntentByProviderId(event.providerPaymentIntentId, tx);
    if (!intent) return;
    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc(intent.id);
    const nextIntent = reducePaymentIntent(intent, { type: 'PROVIDER_PROCESSING' }, now);
    tx.set(intentRef, nextIntent);
  }

  private async applyPaymentSucceeded(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'payment_succeeded' }>,
    now: string,
    source: 'webhook' | 'reconciliation',
  ) {
    const intent = await this.loadIntentByProviderId(event.providerPaymentIntentId, tx);
    if (!intent) return;
    if (intent.status === PAYMENT_STATUS.paid) return;

    const bookingRef = adminDb().collection(COLLECTIONS.bookings).doc(intent.bookingId);
    const relationshipRef = adminDb()
      .collection(COLLECTIONS.relationships)
      .doc(intent.relationshipId);
    const bookingDoc = await tx.get(bookingRef);
    const relationshipDoc = await tx.get(relationshipRef);
    if (!bookingDoc.exists || !relationshipDoc.exists) {
      throw Object.assign(new Error('Booking/payment mismatch'), { status: 409 });
    }

    const booking = normalizeMentorshipBooking({
      ...(bookingDoc.data() as MentorshipBooking),
      id: bookingDoc.id,
    });
    const match = validatePaymentMatchesBooking(intent, booking);
    if (!match.ok) {
      throw Object.assign(new Error(match.error), { status: 409 });
    }

    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc(intent.id);
    const nextIntent = reducePaymentIntent(
      intent,
      source === 'webhook'
        ? { type: 'WEBHOOK_PAYMENT_SUCCEEDED', paidAt: event.paidAt }
        : { type: 'RECONCILIATION_SUCCEEDED', paidAt: event.paidAt },
      now,
    );
    const nextBooking = markMentorshipBookingPaid(booking, now);
    const relationship = normalizeRelationship({
      ...(relationshipDoc.data() as MentorshipRelationship),
      id: relationshipDoc.id,
    });
    const nextRelationship: MentorshipRelationship = {
      ...relationship,
      paymentSatisfied: true,
      updatedAt: now,
    };

    tx.set(intentRef, nextIntent);
    tx.set(bookingRef, nextBooking);
    tx.set(relationshipRef, nextRelationship);
    tx.delete(adminDb().collection(COLLECTIONS.bookingPendingLocks).doc(relationship.id));

    const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
    tx.set(
      eventRef,
      buildPaymentEvent({
        id: eventRef.id,
        entityType: PAYMENT_EVENT_ENTITY.paymentIntent,
        entityId: intent.id,
        eventType: source === 'webhook' ? 'payment_intent.paid' : 'payment_intent.reconciled',
        fromStatus: intent.status,
        toStatus: nextIntent.status,
        providerEventId: event.providerEventId,
        payload: { bookingId: booking.id, relationshipId: relationship.id },
        now,
      }),
    );
  }

  private async applyPaymentFailed(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'payment_failed' }>,
    now: string,
  ) {
    const intent = await this.loadIntentByProviderId(event.providerPaymentIntentId, tx);
    if (!intent) return;
    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc(intent.id);
    const bookingRef = adminDb().collection(COLLECTIONS.bookings).doc(intent.bookingId);
    const nextIntent = reducePaymentIntent(
      intent,
      {
        type: 'WEBHOOK_PAYMENT_FAILED',
        failureCode: event.failureCode,
        failureMessage: event.failureMessage,
      },
      now,
    );
    const bookingDoc = await tx.get(bookingRef);
    tx.set(intentRef, nextIntent);
    if (bookingDoc.exists) {
      const booking = normalizeMentorshipBooking({
        ...(bookingDoc.data() as MentorshipBooking),
        id: bookingDoc.id,
      });
      tx.set(bookingRef, {
        ...booking,
        paymentStatus: BOOKING_PAYMENT_STATUS.failed,
        bookingStatus: BOOKING_STATUS.failed,
        updatedAt: now,
      });
    }
  }

  private async applyPaymentCancelled(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'payment_cancelled' }>,
    now: string,
  ) {
    const intent = await this.loadIntentByProviderId(event.providerPaymentIntentId, tx);
    if (!intent) return;
    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc(intent.id);
    const bookingRef = adminDb().collection(COLLECTIONS.bookings).doc(intent.bookingId);
    const nextIntent = reducePaymentIntent(intent, { type: 'WEBHOOK_PAYMENT_CANCELLED' }, now);
    const bookingDoc = await tx.get(bookingRef);
    tx.set(intentRef, nextIntent);
    if (bookingDoc.exists) {
      const booking = normalizeMentorshipBooking({
        ...(bookingDoc.data() as MentorshipBooking),
        id: bookingDoc.id,
      });
      tx.set(bookingRef, {
        ...booking,
        paymentStatus: BOOKING_PAYMENT_STATUS.cancelled,
        bookingStatus: BOOKING_STATUS.cancelled,
        updatedAt: now,
      });
    }
  }

  private async applyRefundSucceeded(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'refund_succeeded' }>,
    now: string,
  ) {
    const intent = await this.loadIntentByProviderId(event.providerPaymentIntentId, tx);
    if (!intent || intent.status === PAYMENT_STATUS.refunded) return;

    const refund = await this.loadRefundByProviderId(event.providerRefundId, tx);
    const intentRef = adminDb().collection(COLLECTIONS.paymentIntents).doc(intent.id);
    const bookingRef = adminDb().collection(COLLECTIONS.bookings).doc(intent.bookingId);
    const relationshipRef = adminDb()
      .collection(COLLECTIONS.relationships)
      .doc(intent.relationshipId);
    const nextIntent = reducePaymentIntent(intent, { type: 'REFUND_SUCCEEDED' }, now);
    const bookingDoc = await tx.get(bookingRef);
    const relationshipDoc = await tx.get(relationshipRef);

    tx.set(intentRef, nextIntent);

    if (bookingDoc.exists) {
      const booking = normalizeMentorshipBooking({
        ...(bookingDoc.data() as MentorshipBooking),
        id: bookingDoc.id,
      });
      tx.set(bookingRef, {
        ...booking,
        paymentStatus: BOOKING_PAYMENT_STATUS.refunded,
        bookingStatus: BOOKING_STATUS.refunded,
        updatedAt: now,
      });
    }

    if (relationshipDoc.exists) {
      const relationship = normalizeRelationship({
        ...(relationshipDoc.data() as MentorshipRelationship),
        id: relationshipDoc.id,
      });
      tx.set(relationshipRef, {
        ...relationship,
        paymentSatisfied: false,
        updatedAt: now,
      });
    }

    if (refund && refund.status === REFUND_STATUS.pending) {
      const refundRef = adminDb().collection(COLLECTIONS.paymentRefunds).doc(refund.id);
      const nextRefund = reducePaymentRefund(
        refund,
        { type: 'REFUND_SUCCEEDED', succeededAt: now },
        now,
      );
      tx.set(refundRef, nextRefund);
      const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
      tx.set(
        eventRef,
        buildPaymentEvent({
          id: eventRef.id,
          entityType: PAYMENT_EVENT_ENTITY.refund,
          entityId: refund.id,
          eventType: 'refund.succeeded',
          fromStatus: refund.status,
          toStatus: nextRefund.status,
          providerEventId: event.providerEventId,
          payload: {
            paymentIntentId: intent.id,
            bookingId: intent.bookingId,
            relationshipId: intent.relationshipId,
          },
          now,
        }),
      );
    }
  }

  private async applyRefundFailed(
    tx: Transaction,
    event: Extract<ProviderWebhookEvent, { type: 'refund_failed' }>,
    now: string,
  ) {
    const refund = await this.loadRefundByProviderId(event.providerRefundId, tx);
    if (!refund || refund.status !== REFUND_STATUS.pending) return;
    const refundRef = adminDb().collection(COLLECTIONS.paymentRefunds).doc(refund.id);
    const nextRefund = reducePaymentRefund(refund, { type: 'REFUND_FAILED' }, now);
    tx.set(refundRef, nextRefund);
    const eventRef = adminDb().collection(COLLECTIONS.paymentEvents).doc();
    tx.set(
      eventRef,
      buildPaymentEvent({
        id: eventRef.id,
        entityType: PAYMENT_EVENT_ENTITY.refund,
        entityId: refund.id,
        eventType: 'refund.failed',
        fromStatus: refund.status,
        toStatus: nextRefund.status,
        providerEventId: event.providerEventId,
        payload: { paymentIntentId: refund.paymentIntentId, bookingId: refund.bookingId },
        now,
      }),
    );
  }
}

export const paymentService = new PaymentService();

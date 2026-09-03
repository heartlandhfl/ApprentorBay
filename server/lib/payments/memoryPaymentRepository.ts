import type { Transaction } from 'firebase-admin/firestore';
import {
  PAYMENT_EVENT_ENTITY,
  buildPaymentEvent,
  type CheckoutSession,
  type MentorshipBooking,
  type MentorshipRelationship,
  type PaymentIntent,
} from '@apprentorbay/shared';
import type { CheckoutBundle, PaymentRepository } from './paymentRepository.js';

export class MemoryPaymentRepository implements PaymentRepository {
  checkoutSessions = new Map<string, CheckoutSession>();
  paymentIntents = new Map<string, PaymentIntent>();
  bookings = new Map<string, MentorshipBooking>();
  relationships = new Map<string, MentorshipRelationship>();
  webhookDedup = new Set<string>();

  async findCheckoutByIdempotencyKey(idempotencyKey: string): Promise<CheckoutBundle | null> {
    const session = [...this.checkoutSessions.values()].find(
      (row) => row.idempotencyKey === idempotencyKey,
    );
    return session ? this.loadCheckoutBundle(session) : null;
  }

  async listCheckoutSessionsForBooking(bookingId: string): Promise<CheckoutSession[]> {
    return [...this.checkoutSessions.values()]
      .filter((session) => session.bookingId === bookingId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async loadCheckoutBundle(checkoutSession: CheckoutSession): Promise<CheckoutBundle | null> {
    const paymentIntent = this.paymentIntents.get(checkoutSession.paymentIntentId);
    if (!paymentIntent) return null;
    return {
      paymentIntent,
      checkoutSession,
      checkoutUrl: checkoutSession.checkoutUrl ?? '',
    };
  }

  async persistNewCheckout(input: {
    paymentIntent: PaymentIntent;
    checkoutSession: CheckoutSession;
    learnerId: string;
    idempotencyKey: string;
    now: string;
    fromStatus: string;
    providerCheckoutSessionId: string;
  }): Promise<void> {
    this.paymentIntents.set(input.paymentIntent.id, input.paymentIntent);
    this.checkoutSessions.set(input.checkoutSession.id, input.checkoutSession);
  }

  async isWebhookEventProcessed(providerEventId: string): Promise<boolean> {
    return this.webhookDedup.has(providerEventId);
  }

  async claimWebhookEvent(
    providerEventId: string,
    _now: string,
    _tx?: Transaction,
  ): Promise<boolean> {
    if (this.webhookDedup.has(providerEventId)) {
      return false;
    }
    this.webhookDedup.add(providerEventId);
    return true;
  }

  async markWebhookEventProcessed(providerEventId: string, _now: string): Promise<void> {
    this.webhookDedup.add(providerEventId);
  }

  async loadIntentByProviderId(
    providerPaymentIntentId: string,
    _tx?: Transaction,
  ): Promise<PaymentIntent | null> {
    return (
      [...this.paymentIntents.values()].find(
        (intent) => intent.providerPaymentIntentId === providerPaymentIntentId,
      ) ?? null
    );
  }

  async loadBooking(bookingId: string, _tx?: Transaction): Promise<MentorshipBooking | null> {
    return this.bookings.get(bookingId) ?? null;
  }

  async loadRelationship(
    relationshipId: string,
    _tx?: Transaction,
  ): Promise<MentorshipRelationship | null> {
    return this.relationships.get(relationshipId) ?? null;
  }

  async saveIntent(intent: PaymentIntent, _tx?: Transaction): Promise<void> {
    this.paymentIntents.set(intent.id, intent);
  }

  async saveBooking(booking: MentorshipBooking, _tx?: Transaction): Promise<void> {
    this.bookings.set(booking.id, booking);
  }

  async saveRelationship(
    relationship: MentorshipRelationship,
    _tx?: Transaction,
  ): Promise<void> {
    this.relationships.set(relationship.id, relationship);
  }

  async appendPaymentEvent(
    input: {
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
    },
    _tx?: Transaction,
  ): Promise<void> {
    void buildPaymentEvent({
      id: `evt_${this.webhookDedup.size + 1}`,
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
  }

  async runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return fn({} as Transaction);
  }
}

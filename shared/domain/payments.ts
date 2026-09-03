import { BOOKING_CURRENCY, type BookingCurrency, type MentorshipBooking } from './bookings.js';
import { isValidPriceCents } from './money.js';
import type { IsoDateString } from './users.js';
import type { ValidationResult } from './validation.js';

export const PAYMENT_PROVIDER_ID = {
  stripe: 'stripe',
  mock: 'mock',
} as const;

export type PaymentProviderId = (typeof PAYMENT_PROVIDER_ID)[keyof typeof PAYMENT_PROVIDER_ID];

export const PAYMENT_STATUS = {
  draft: 'draft',
  requiresPaymentMethod: 'requires_payment_method',
  processing: 'processing',
  paid: 'paid',
  failed: 'failed',
  cancelled: 'cancelled',
  partiallyRefunded: 'partially_refunded',
  refunded: 'refunded',
} as const;

export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const CHECKOUT_SESSION_STATUS = {
  open: 'open',
  complete: 'complete',
  expired: 'expired',
} as const;

export type CheckoutSessionStatus =
  (typeof CHECKOUT_SESSION_STATUS)[keyof typeof CHECKOUT_SESSION_STATUS];

export const REFUND_STATUS = {
  pending: 'pending',
  succeeded: 'succeeded',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export type RefundStatus = (typeof REFUND_STATUS)[keyof typeof REFUND_STATUS];

export const REFUND_REASON = {
  requestedByLearner: 'requested_by_learner',
  bookingCancelled: 'booking_cancelled',
  dispute: 'dispute',
  admin: 'admin',
  other: 'other',
} as const;

export type RefundReason = (typeof REFUND_REASON)[keyof typeof REFUND_REASON];

export const PAYMENT_EVENT_ENTITY = {
  paymentIntent: 'payment_intent',
  checkoutSession: 'checkout_session',
  refund: 'refund',
  booking: 'booking',
} as const;

export type PaymentEventEntity =
  (typeof PAYMENT_EVENT_ENTITY)[keyof typeof PAYMENT_EVENT_ENTITY];

/** Only `bookingId` may be supplied by the client when starting checkout. */
export const CLIENT_CHECKOUT_CREATE_FIELDS = ['bookingId'] as const;

export const FORBIDDEN_CLIENT_CHECKOUT_FIELDS = [
  'amountCents',
  'currency',
  'unitPriceCents',
  'platformFeeCents',
  'mentorAmountCents',
  'mentorId',
  'learnerId',
  'paymentStatus',
  'status',
  'provider',
  'providerPaymentIntentId',
  'providerCheckoutSessionId',
  'idempotencyKey',
  'split',
  'id',
  'createdAt',
  'updatedAt',
] as const;

export interface MoneyAmount {
  currency: BookingCurrency;
  amountCents: number;
}

export interface MarketplaceSplit {
  grossAmountCents: number;
  platformFeeCents: number;
  mentorNetCents: number;
  platformFeeBps: number;
}

export interface PaymentIntent {
  id: string;
  bookingId: string;
  relationshipId: string;
  learnerId: string;
  mentorId: string;
  status: PaymentStatus;
  amount: MoneyAmount;
  split: MarketplaceSplit;
  provider: PaymentProviderId;
  providerPaymentIntentId: string | null;
  providerCustomerId: string | null;
  idempotencyKey: string;
  latestCheckoutSessionId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidAt: IsoDateString | null;
  cancelledAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface CheckoutSession {
  id: string;
  paymentIntentId: string;
  bookingId: string;
  learnerId: string;
  status: CheckoutSessionStatus;
  provider: PaymentProviderId;
  providerCheckoutSessionId: string | null;
  checkoutUrl: string | null;
  expiresAt: IsoDateString;
  idempotencyKey: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface PaymentRefund {
  id: string;
  paymentIntentId: string;
  bookingId: string;
  status: RefundStatus;
  amountCents: number;
  reason: RefundReason;
  idempotencyKey: string;
  provider: PaymentProviderId;
  providerRefundId: string | null;
  requestedBy: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
  succeededAt: IsoDateString | null;
}

export interface PaymentEvent {
  id: string;
  entityType: PaymentEventEntity;
  entityId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId: string | null;
  idempotencyKey: string | null;
  providerEventId: string | null;
  payload: Record<string, string>;
  createdAt: IsoDateString;
}

const PAYMENT_STATUS_VALUES = new Set<string>(Object.values(PAYMENT_STATUS));
const CHECKOUT_SESSION_STATUS_VALUES = new Set<string>(Object.values(CHECKOUT_SESSION_STATUS));
const REFUND_STATUS_VALUES = new Set<string>(Object.values(REFUND_STATUS));

export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return typeof value === 'string' && PAYMENT_STATUS_VALUES.has(value);
}

export function isCheckoutSessionStatus(value: unknown): value is CheckoutSessionStatus {
  return typeof value === 'string' && CHECKOUT_SESSION_STATUS_VALUES.has(value);
}

export function isRefundStatus(value: unknown): value is RefundStatus {
  return typeof value === 'string' && REFUND_STATUS_VALUES.has(value);
}

export function isTerminalPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PAYMENT_STATUS.paid ||
    status === PAYMENT_STATUS.failed ||
    status === PAYMENT_STATUS.cancelled ||
    status === PAYMENT_STATUS.refunded
  );
}

export function isOpenPaymentStatus(status: PaymentStatus): boolean {
  return (
    status === PAYMENT_STATUS.draft ||
    status === PAYMENT_STATUS.requiresPaymentMethod ||
    status === PAYMENT_STATUS.processing
  );
}

export function marketplaceSplitFromBooking(booking: MentorshipBooking): MarketplaceSplit {
  return {
    grossAmountCents: booking.unitPriceCents,
    platformFeeCents: booking.platformFeeCents,
    mentorNetCents: booking.mentorAmountCents,
    platformFeeBps: booking.platformFeeBps,
  };
}

export function validatePaymentMatchesBooking(
  intent: Pick<PaymentIntent, 'amount' | 'split' | 'bookingId'>,
  booking: MentorshipBooking,
): ValidationResult {
  if (intent.bookingId !== booking.id) {
    return { ok: false, error: 'Payment intent does not match booking' };
  }
  if (intent.amount.currency !== booking.currency) {
    return { ok: false, error: 'Payment currency does not match booking' };
  }
  if (intent.amount.amountCents !== booking.unitPriceCents) {
    return { ok: false, error: 'Payment amount does not match booking' };
  }
  if (intent.split.platformFeeCents !== booking.platformFeeCents) {
    return { ok: false, error: 'Platform fee does not match booking' };
  }
  if (intent.split.mentorNetCents !== booking.mentorAmountCents) {
    return { ok: false, error: 'Mentor amount does not match booking' };
  }
  if (intent.split.platformFeeBps !== booking.platformFeeBps) {
    return { ok: false, error: 'Platform fee basis points do not match booking' };
  }
  return { ok: true };
}

export function validateCreateCheckoutBody(
  body: unknown,
): ValidationResult & { bookingId?: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }
  const record = body as Record<string, unknown>;
  const unexpected = Object.keys(record).filter(
    (key) => !CLIENT_CHECKOUT_CREATE_FIELDS.includes(key as (typeof CLIENT_CHECKOUT_CREATE_FIELDS)[number]),
  );
  if (unexpected.length > 0) {
    return {
      ok: false,
      error: `Unexpected fields are not allowed: ${unexpected.sort().join(', ')}`,
    };
  }
  const bookingId = typeof record.bookingId === 'string' ? record.bookingId.trim() : '';
  if (!bookingId) {
    return { ok: false, error: 'bookingId is required' };
  }
  return { ok: true, bookingId };
}

export function buildPaymentIntentFromBooking(input: {
  id: string;
  booking: MentorshipBooking;
  provider: PaymentProviderId;
  idempotencyKey: string;
  now: IsoDateString;
}): PaymentIntent {
  const { booking } = input;
  if (!isValidPriceCents(booking.unitPriceCents) || booking.unitPriceCents <= 0) {
    throw new Error('Booking unit price must be a positive integer');
  }
  if (booking.currency !== BOOKING_CURRENCY.usd) {
    throw new Error('Only USD bookings are supported');
  }
  return {
    id: input.id,
    bookingId: booking.id,
    relationshipId: booking.relationshipId,
    learnerId: booking.learnerId,
    mentorId: booking.mentorId,
    status: PAYMENT_STATUS.draft,
    amount: {
      currency: booking.currency,
      amountCents: booking.unitPriceCents,
    },
    split: marketplaceSplitFromBooking(booking),
    provider: input.provider,
    providerPaymentIntentId: null,
    providerCustomerId: null,
    idempotencyKey: input.idempotencyKey,
    latestCheckoutSessionId: null,
    failureCode: null,
    failureMessage: null,
    paidAt: null,
    cancelledAt: null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function normalizePaymentIntent(
  raw: Partial<PaymentIntent> & { id?: string },
): PaymentIntent {
  return {
    id: raw.id ?? '',
    bookingId: raw.bookingId ?? '',
    relationshipId: raw.relationshipId ?? '',
    learnerId: raw.learnerId ?? '',
    mentorId: raw.mentorId ?? '',
    status: isPaymentStatus(raw.status) ? raw.status : PAYMENT_STATUS.draft,
    amount: {
      currency:
        raw.amount?.currency === BOOKING_CURRENCY.usd ? BOOKING_CURRENCY.usd : BOOKING_CURRENCY.usd,
      amountCents:
        typeof raw.amount?.amountCents === 'number' ? raw.amount.amountCents : 0,
    },
    split: {
      grossAmountCents: raw.split?.grossAmountCents ?? raw.amount?.amountCents ?? 0,
      platformFeeCents: raw.split?.platformFeeCents ?? 0,
      mentorNetCents: raw.split?.mentorNetCents ?? 0,
      platformFeeBps: raw.split?.platformFeeBps ?? 0,
    },
    provider:
      raw.provider === PAYMENT_PROVIDER_ID.stripe || raw.provider === PAYMENT_PROVIDER_ID.mock
        ? raw.provider
        : PAYMENT_PROVIDER_ID.stripe,
    providerPaymentIntentId:
      typeof raw.providerPaymentIntentId === 'string' ? raw.providerPaymentIntentId : null,
    providerCustomerId: typeof raw.providerCustomerId === 'string' ? raw.providerCustomerId : null,
    idempotencyKey: typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : '',
    latestCheckoutSessionId:
      typeof raw.latestCheckoutSessionId === 'string' ? raw.latestCheckoutSessionId : null,
    failureCode: typeof raw.failureCode === 'string' ? raw.failureCode : null,
    failureMessage: typeof raw.failureMessage === 'string' ? raw.failureMessage : null,
    paidAt: typeof raw.paidAt === 'string' ? raw.paidAt : null,
    cancelledAt: typeof raw.cancelledAt === 'string' ? raw.cancelledAt : null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
  };
}

export function normalizeCheckoutSession(
  raw: Partial<CheckoutSession> & { id?: string },
): CheckoutSession {
  return {
    id: raw.id ?? '',
    paymentIntentId: raw.paymentIntentId ?? '',
    bookingId: raw.bookingId ?? '',
    learnerId: raw.learnerId ?? '',
    status: isCheckoutSessionStatus(raw.status)
      ? raw.status
      : CHECKOUT_SESSION_STATUS.open,
    provider:
      raw.provider === PAYMENT_PROVIDER_ID.stripe || raw.provider === PAYMENT_PROVIDER_ID.mock
        ? raw.provider
        : PAYMENT_PROVIDER_ID.stripe,
    providerCheckoutSessionId:
      typeof raw.providerCheckoutSessionId === 'string' ? raw.providerCheckoutSessionId : null,
    checkoutUrl: typeof raw.checkoutUrl === 'string' ? raw.checkoutUrl : null,
    expiresAt: raw.expiresAt ?? '',
    idempotencyKey: typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : '',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
  };
}

export function normalizePaymentRefund(
  raw: Partial<PaymentRefund> & { id?: string },
): PaymentRefund {
  return {
    id: raw.id ?? '',
    paymentIntentId: raw.paymentIntentId ?? '',
    bookingId: raw.bookingId ?? '',
    status: isRefundStatus(raw.status) ? raw.status : REFUND_STATUS.pending,
    amountCents: typeof raw.amountCents === 'number' ? raw.amountCents : 0,
    reason:
      raw.reason === REFUND_REASON.bookingCancelled ||
      raw.reason === REFUND_REASON.requestedByLearner ||
      raw.reason === REFUND_REASON.dispute ||
      raw.reason === REFUND_REASON.admin
        ? raw.reason
        : REFUND_REASON.other,
    idempotencyKey: typeof raw.idempotencyKey === 'string' ? raw.idempotencyKey : '',
    provider:
      raw.provider === PAYMENT_PROVIDER_ID.stripe || raw.provider === PAYMENT_PROVIDER_ID.mock
        ? raw.provider
        : PAYMENT_PROVIDER_ID.stripe,
    providerRefundId: typeof raw.providerRefundId === 'string' ? raw.providerRefundId : null,
    requestedBy: typeof raw.requestedBy === 'string' ? raw.requestedBy : '',
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
    succeededAt: typeof raw.succeededAt === 'string' ? raw.succeededAt : null,
  };
}

export function buildPaymentEvent(input: {
  id: string;
  entityType: PaymentEventEntity;
  entityId: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  actorId?: string | null;
  idempotencyKey?: string | null;
  providerEventId?: string | null;
  payload?: Record<string, string>;
  now: IsoDateString;
}): PaymentEvent {
  return {
    id: input.id,
    entityType: input.entityType,
    entityId: input.entityId,
    eventType: input.eventType,
    fromStatus: input.fromStatus,
    toStatus: input.toStatus,
    actorId: input.actorId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    providerEventId: input.providerEventId ?? null,
    payload: input.payload ?? {},
    createdAt: input.now,
  };
}

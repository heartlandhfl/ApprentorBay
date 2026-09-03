import {
  COMMERCIAL_MODE_LABEL,
  resolveMentorOffering,
  type CommercialMode,
  type MentorOfferingFields,
  type MentorType,
  type ResolvedMentorOffering,
} from './mentorOffering.js';
import { isPaidCommercialMode } from './mentorPresentation.js';
import { isValidPriceCents } from './money.js';
import { REQUEST_TYPE } from './mentorshipRequest.js';
import type { MentorshipRelationship } from './relationships.js';
import { isActiveRelationship } from './relationships.js';
import type { IsoDateString } from './users.js';
import type { ValidationResult } from './validation.js';

/** ApprentorBay supports USD only. */
export const BOOKING_CURRENCY = {
  usd: 'USD',
} as const;

export type BookingCurrency = (typeof BOOKING_CURRENCY)[keyof typeof BOOKING_CURRENCY];

export const BOOKING_SERVICE_TYPE = {
  mentorshipSession: 'mentorship_session',
} as const;

export type BookingServiceType = (typeof BOOKING_SERVICE_TYPE)[keyof typeof BOOKING_SERVICE_TYPE];

export const BOOKING_PAYMENT_STATUS = {
  pendingPayment: 'pending_payment',
  paid: 'paid',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'failed',
} as const;

export type BookingPaymentStatus =
  (typeof BOOKING_PAYMENT_STATUS)[keyof typeof BOOKING_PAYMENT_STATUS];

export const BOOKING_STATUS = {
  pendingPayment: 'pending_payment',
  paid: 'paid',
  cancelled: 'cancelled',
  refunded: 'refunded',
  failed: 'failed',
} as const;

export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

/** Default marketplace commission: 15.00%. Overridable via server env at booking creation. */
export const DEFAULT_PLATFORM_FEE_BPS = 1500;

const BOOKING_PAYMENT_STATUS_VALUES = new Set<string>(Object.values(BOOKING_PAYMENT_STATUS));
const BOOKING_STATUS_VALUES = new Set<string>(Object.values(BOOKING_STATUS));
const BOOKING_SERVICE_TYPE_VALUES = new Set<string>(Object.values(BOOKING_SERVICE_TYPE));
const BOOKING_CURRENCY_VALUES = new Set<string>(Object.values(BOOKING_CURRENCY));

/** Only `relationshipId` and optional `sessionId` may be supplied by the client when creating a booking. */
export const CLIENT_BOOKING_CREATE_FIELDS = ['relationshipId', 'sessionId'] as const;

/** Fields the server derives — rejected if present on create requests. */
export const FORBIDDEN_CLIENT_BOOKING_FIELDS = [
  'learnerId',
  'mentorId',
  'unitPriceCents',
  'platformFeeCents',
  'mentorAmountCents',
  'currency',
  'paymentStatus',
  'bookingStatus',
  'title',
  'sessionDurationMinutes',
  'serviceType',
  'sessionId',
  'platformFeeBps',
  'commercialMode',
  'mentorType',
  'baseSessionPriceUsd',
  'sessionPriceUsd',
  'split',
  'id',
  'createdAt',
  'updatedAt',
] as const;

export interface BookingFinancialSnapshot {
  unitPriceCents: number;
  currency: BookingCurrency;
  platformFeeCents: number;
  mentorAmountCents: number;
  platformFeeBps: number;
  commercialMode: CommercialMode;
  mentorType: MentorType;
  sessionDurationMinutes: number | null;
  serviceType: BookingServiceType;
  title: string;
}

export interface MentorshipBooking {
  id: string;
  learnerId: string;
  mentorId: string;
  relationshipId: string;
  serviceType: BookingServiceType;
  title: string;
  sessionDurationMinutes: number | null;
  unitPriceCents: number;
  currency: BookingCurrency;
  platformFeeCents: number;
  mentorAmountCents: number;
  platformFeeBps: number;
  paymentStatus: BookingPaymentStatus;
  bookingStatus: BookingStatus;
  sessionId: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export function isBookingPaymentStatus(value: unknown): value is BookingPaymentStatus {
  return typeof value === 'string' && BOOKING_PAYMENT_STATUS_VALUES.has(value);
}

export function isBookingStatus(value: unknown): value is BookingStatus {
  return typeof value === 'string' && BOOKING_STATUS_VALUES.has(value);
}

export function isBookingServiceType(value: unknown): value is BookingServiceType {
  return typeof value === 'string' && BOOKING_SERVICE_TYPE_VALUES.has(value);
}

export function isBookingCurrency(value: unknown): value is BookingCurrency {
  return typeof value === 'string' && BOOKING_CURRENCY_VALUES.has(value);
}

export function isOpenBookingPaymentStatus(status: BookingPaymentStatus): boolean {
  return status === BOOKING_PAYMENT_STATUS.pendingPayment;
}

export function isOpenBookingStatus(status: BookingStatus): boolean {
  return status === BOOKING_STATUS.pendingPayment;
}

/**
 * Compute platform fee using integer arithmetic only.
 * `platformFeeBps` is basis points (1500 = 15.00%).
 */
export function computePlatformFeeCents(grossCents: number, platformFeeBps: number): number {
  if (!isValidPriceCents(grossCents) || grossCents <= 0) {
    throw new Error('grossCents must be a positive integer');
  }
  if (!Number.isInteger(platformFeeBps) || platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error('platformFeeBps must be an integer from 0 to 10000');
  }
  return Math.floor((grossCents * platformFeeBps) / 10_000);
}

export function computeMentorAmountCents(grossCents: number, platformFeeCents: number): number {
  if (!isValidPriceCents(grossCents) || grossCents <= 0) {
    throw new Error('grossCents must be a positive integer');
  }
  if (!Number.isInteger(platformFeeCents) || platformFeeCents < 0 || platformFeeCents > grossCents) {
    throw new Error('platformFeeCents must be a non-negative integer not exceeding grossCents');
  }
  return grossCents - platformFeeCents;
}

export function bookingTitleFromOffering(offering: ResolvedMentorOffering): string {
  const trimmed = offering.serviceDescription.trim();
  if (trimmed) return trimmed.slice(0, 500);
  return `${COMMERCIAL_MODE_LABEL[offering.commercialMode]} mentorship session`;
}

export function buildBookingFinancialSnapshot(
  mentor: MentorOfferingFields & { public?: boolean; verificationStatus?: string },
  platformFeeBps: number = DEFAULT_PLATFORM_FEE_BPS,
): ValidationResult & { snapshot?: BookingFinancialSnapshot } {
  const offering = resolveMentorOffering(mentor);
  if (!isPaidCommercialMode(offering.commercialMode)) {
    return { ok: false, error: 'Mentor does not offer paid mentorship' };
  }
  if (
    offering.baseSessionPriceUsd == null ||
    !isValidPriceCents(offering.baseSessionPriceUsd) ||
    offering.baseSessionPriceUsd <= 0
  ) {
    return { ok: false, error: 'Mentor has not published a valid paid session price' };
  }

  const unitPriceCents = offering.baseSessionPriceUsd;
  const platformFeeCents = computePlatformFeeCents(unitPriceCents, platformFeeBps);
  const mentorAmountCents = computeMentorAmountCents(unitPriceCents, platformFeeCents);

  return {
    ok: true,
    snapshot: {
      unitPriceCents,
      currency: BOOKING_CURRENCY.usd,
      platformFeeCents,
      mentorAmountCents,
      platformFeeBps,
      commercialMode: offering.commercialMode,
      mentorType: offering.mentorType,
      sessionDurationMinutes: offering.sessionDurationMinutes,
      serviceType: BOOKING_SERVICE_TYPE.mentorshipSession,
      title: bookingTitleFromOffering(offering),
    },
  };
}

export function validateBookingRelationship(
  relationship: Pick<
    MentorshipRelationship,
    'status' | 'paymentRequired' | 'requestType' | 'paymentSatisfied'
  >,
): ValidationResult {
  if (!isActiveRelationship(relationship)) {
    return { ok: false, error: 'Relationship must be active' };
  }
  const paymentRequired =
    relationship.paymentRequired === true || relationship.requestType === REQUEST_TYPE.paidRequest;
  if (!paymentRequired) {
    return { ok: false, error: 'This relationship does not require a paid booking' };
  }
  if (relationship.paymentSatisfied === true) {
    return { ok: false, error: 'Payment has already been satisfied for this relationship' };
  }
  return { ok: true };
}

export function validateCreateBookingBody(
  body: unknown,
): ValidationResult & { relationshipId?: string; sessionId?: string | null } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid request body' };
  }

  const record = body as Record<string, unknown>;
  const unexpected = Object.keys(record).filter(
    (key) => !CLIENT_BOOKING_CREATE_FIELDS.includes(key as (typeof CLIENT_BOOKING_CREATE_FIELDS)[number]),
  );
  if (unexpected.length > 0) {
    return {
      ok: false,
      error: `Unexpected fields are not allowed: ${unexpected.sort().join(', ')}`,
    };
  }

  const relationshipId = typeof record.relationshipId === 'string' ? record.relationshipId.trim() : '';
  if (!relationshipId) {
    return { ok: false, error: 'relationshipId is required' };
  }

  const sessionId =
    record.sessionId === undefined
      ? null
      : typeof record.sessionId === 'string'
        ? record.sessionId.trim() || null
        : null;
  if (record.sessionId !== undefined && record.sessionId !== null && !sessionId) {
    return { ok: false, error: 'sessionId must be a non-empty string when provided' };
  }

  return { ok: true, relationshipId, sessionId };
}

export function detectClientBookingFieldTampering(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  const record = body as Record<string, unknown>;
  return FORBIDDEN_CLIENT_BOOKING_FIELDS.filter((field) => field in record);
}

export function buildMentorshipBooking(input: {
  id: string;
  relationship: Pick<MentorshipRelationship, 'id' | 'learnerId' | 'mentorId'>;
  snapshot: BookingFinancialSnapshot;
  now: IsoDateString;
  sessionId?: string | null;
}): MentorshipBooking {
  const { snapshot } = input;
  return {
    id: input.id,
    learnerId: input.relationship.learnerId,
    mentorId: input.relationship.mentorId,
    relationshipId: input.relationship.id,
    serviceType: snapshot.serviceType,
    title: snapshot.title,
    sessionDurationMinutes: snapshot.sessionDurationMinutes,
    unitPriceCents: snapshot.unitPriceCents,
    currency: snapshot.currency,
    platformFeeCents: snapshot.platformFeeCents,
    mentorAmountCents: snapshot.mentorAmountCents,
    platformFeeBps: snapshot.platformFeeBps,
    paymentStatus: BOOKING_PAYMENT_STATUS.pendingPayment,
    bookingStatus: BOOKING_STATUS.pendingPayment,
    sessionId: input.sessionId ?? null,
    createdAt: input.now,
    updatedAt: input.now,
  };
}

export function normalizeMentorshipBooking(
  raw: Partial<MentorshipBooking> & { id?: string },
): MentorshipBooking {
  const paymentStatus = isBookingPaymentStatus(raw.paymentStatus)
    ? raw.paymentStatus
    : BOOKING_PAYMENT_STATUS.pendingPayment;
  const bookingStatus = isBookingStatus(raw.bookingStatus)
    ? raw.bookingStatus
    : BOOKING_STATUS.pendingPayment;

  return {
    id: raw.id ?? '',
    learnerId: raw.learnerId ?? '',
    mentorId: raw.mentorId ?? '',
    relationshipId: raw.relationshipId ?? '',
    serviceType: isBookingServiceType(raw.serviceType)
      ? raw.serviceType
      : BOOKING_SERVICE_TYPE.mentorshipSession,
    title: typeof raw.title === 'string' ? raw.title : '',
    sessionDurationMinutes:
      raw.sessionDurationMinutes === null || raw.sessionDurationMinutes === undefined
        ? null
        : typeof raw.sessionDurationMinutes === 'number' &&
            Number.isInteger(raw.sessionDurationMinutes)
          ? raw.sessionDurationMinutes
          : null,
    unitPriceCents: typeof raw.unitPriceCents === 'number' ? raw.unitPriceCents : 0,
    currency: isBookingCurrency(raw.currency) ? raw.currency : BOOKING_CURRENCY.usd,
    platformFeeCents: typeof raw.platformFeeCents === 'number' ? raw.platformFeeCents : 0,
    mentorAmountCents: typeof raw.mentorAmountCents === 'number' ? raw.mentorAmountCents : 0,
    platformFeeBps:
      typeof raw.platformFeeBps === 'number' && Number.isInteger(raw.platformFeeBps)
        ? raw.platformFeeBps
        : DEFAULT_PLATFORM_FEE_BPS,
    paymentStatus,
    bookingStatus,
    sessionId: typeof raw.sessionId === 'string' ? raw.sessionId : null,
    createdAt: raw.createdAt ?? '',
    updatedAt: raw.updatedAt ?? raw.createdAt ?? '',
  };
}

export function cancelMentorshipBooking(
  booking: MentorshipBooking,
  now: IsoDateString,
): MentorshipBooking {
  return {
    ...booking,
    paymentStatus: BOOKING_PAYMENT_STATUS.cancelled,
    bookingStatus: BOOKING_STATUS.cancelled,
    updatedAt: now,
  };
}

/**
 * Mark a booking paid after verified payment confirmation (future payment service).
 * Does not persist — callers update Firestore and relationship.paymentSatisfied.
 */
export function markMentorshipBookingPaid(
  booking: MentorshipBooking,
  now: IsoDateString,
): MentorshipBooking {
  return {
    ...booking,
    paymentStatus: BOOKING_PAYMENT_STATUS.paid,
    bookingStatus: BOOKING_STATUS.paid,
    updatedAt: now,
  };
}

import {
  BOOKING_PAYMENT_STATUS,
  CHECKOUT_SESSION_STATUS,
  type CheckoutSession,
  type MentorshipBooking,
} from '@apprentorbay/shared';

export function isReusableCheckoutSession(
  session: Pick<CheckoutSession, 'status' | 'expiresAt'>,
  now: string,
): boolean {
  if (session.status !== CHECKOUT_SESSION_STATUS.open) {
    return false;
  }
  const expiresMs = Date.parse(session.expiresAt);
  const nowMs = Date.parse(now);
  return Number.isFinite(expiresMs) && Number.isFinite(nowMs) && expiresMs > nowMs;
}

export function bookingAcceptsIncomingPayment(
  booking: Pick<MentorshipBooking, 'paymentStatus'>,
): boolean {
  return booking.paymentStatus === BOOKING_PAYMENT_STATUS.pendingPayment;
}

export function selectCheckoutForBooking(
  sessions: CheckoutSession[],
  bookingId: string,
  idempotencyKey: string,
  now: string,
): CheckoutSession | null {
  const byKey = sessions.find((session) => session.idempotencyKey === idempotencyKey);
  if (byKey) {
    return byKey;
  }
  return (
    sessions.find(
      (session) => session.bookingId === bookingId && isReusableCheckoutSession(session, now),
    ) ?? null
  );
}

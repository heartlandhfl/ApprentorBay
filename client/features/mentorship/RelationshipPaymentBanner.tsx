import { useEffect, useMemo, useState } from 'react';
import {
  BOOKING_PAYMENT_STATUS,
  USER_ROLE,
  paidMentorshipServicesBlocked,
  type MentorshipBooking,
  type MentorshipRelationship,
  type User,
} from '@apprentorbay/shared';
import { Badge, Button, Cluster, Stack, Text } from '../../components';
import { listMentorshipBookings } from '../../lib/api';
import { findOpenPendingBooking, startMentorshipPaymentCheckout } from './mentorshipCheckout';

type RelationshipPaymentBannerProps = {
  relationship: MentorshipRelationship;
  account: User;
};

function formatUsd(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function bookingPaymentStatusLabel(booking: MentorshipBooking): string {
  switch (booking.paymentStatus) {
    case BOOKING_PAYMENT_STATUS.pendingPayment:
      return 'Payment pending';
    case BOOKING_PAYMENT_STATUS.failed:
      return 'Payment failed';
    case BOOKING_PAYMENT_STATUS.cancelled:
      return 'Payment cancelled';
    default:
      return 'Payment required';
  }
}

export function RelationshipPaymentBanner({
  relationship,
  account,
}: RelationshipPaymentBannerProps) {
  const [bookings, setBookings] = useState<MentorshipBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showBanner =
    account.role === USER_ROLE.learner &&
    account.uid === relationship.learnerId &&
    paidMentorshipServicesBlocked(relationship);

  useEffect(() => {
    if (!showBanner) {
      setBookings([]);
      setLoadingBookings(false);
      return;
    }

    let cancelled = false;
    setLoadingBookings(true);
    void listMentorshipBookings(relationship.id)
      .then((result) => {
        if (!cancelled) setBookings(result.bookings);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load booking status');
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingBookings(false);
      });

    return () => {
      cancelled = true;
    };
  }, [relationship.id, showBanner]);

  const openBooking = useMemo(() => findOpenPendingBooking(bookings), [bookings]);

  if (!showBanner) return null;

  async function onCompletePayment() {
    setBusy(true);
    setError(null);
    try {
      await startMentorshipPaymentCheckout(relationship.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout');
      setBusy(false);
    }
  }

  const statusLabel = openBooking ? bookingPaymentStatusLabel(openBooking) : null;
  const priceLabel =
    openBooking && openBooking.unitPriceCents > 0
      ? formatUsd(openBooking.unitPriceCents)
      : relationship.baseSessionPriceUsd
        ? formatUsd(relationship.baseSessionPriceUsd)
        : null;

  return (
    <section className="rounded-sm border border-accent-subtle bg-accent-subtle p-8">
      <Stack gap={12}>
        <Cluster gap={12}>
          <Stack gap={4}>
            <Text variant="h2">Complete payment to continue</Text>
            <Text variant="muted">
              Your mentorship is active, but paid sessions and messaging stay locked until checkout
              is complete.
            </Text>
          </Stack>
          {statusLabel ? <Badge tone="accent">{statusLabel}</Badge> : null}
        </Cluster>
        {priceLabel ? (
          <Text variant="small">
            Session price: <strong>{priceLabel}</strong>
          </Text>
        ) : null}
        {error ? <Text variant="danger">{error}</Text> : null}
        <Cluster gap={8}>
          <Button loading={busy} disabled={loadingBookings} onClick={() => void onCompletePayment()}>
            {openBooking ? 'Complete payment' : 'Book and pay'}
          </Button>
        </Cluster>
      </Stack>
    </section>
  );
}

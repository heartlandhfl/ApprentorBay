import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { BOOKING_STATUS, PAYMENT_STATUS } from '@apprentorbay/shared';
import { Button, Card, EmptyState, Page, Stack, Text } from '../components';
import { getMentorshipBooking, getPaymentIntent } from '../lib/api';
import { getFirebaseAuth } from '../lib/firebase';

async function authHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth()?.currentUser;
  const token = user ? await user.getIdToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function BookingPaymentReturnPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'paid' | 'pending' | 'error'>('loading');
  const [relationshipId, setRelationshipId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) {
      setStatus('error');
      setError('Booking not found');
      return;
    }

    let cancelled = false;
    const sessionId = searchParams.get('session_id');

    async function verify() {
      try {
        const booking = await getMentorshipBooking(bookingId!);
        if (cancelled) return;
        setRelationshipId(booking.relationshipId);
        if (booking.bookingStatus === BOOKING_STATUS.paid) {
          setStatus('paid');
          return;
        }
        if (sessionId) {
          const response = await fetch(
            `/api/payments/return?session_id=${encodeURIComponent(sessionId)}`,
            { headers: await authHeaders() },
          );
          if (response.ok) {
            const body = (await response.json()) as { paymentIntent?: { id: string } };
            if (body.paymentIntent?.id) {
              const intent = await getPaymentIntent(body.paymentIntent.id);
              if (!cancelled && intent.status === PAYMENT_STATUS.paid) {
                setStatus('paid');
                return;
              }
            }
          }
        }
        if (!cancelled) setStatus('pending');
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'Could not verify payment');
        }
      }
    }

    void verify();
    return () => {
      cancelled = true;
    };
  }, [bookingId, searchParams]);

  if (!bookingId) {
    return (
      <Page>
        <EmptyState title="Booking not found" />
      </Page>
    );
  }

  return (
    <Page>
      <Card padding="lg">
        <Stack gap={16}>
          {status === 'loading' ? <Text variant="muted">Confirming your payment…</Text> : null}
          {status === 'paid' ? (
            <>
              <Text variant="h1">Payment confirmed</Text>
              <Text variant="muted">
                Your mentorship session is booked. You can now schedule your session in the
                mentorship workspace.
              </Text>
              {relationshipId ? (
                <Button to={`/dashboard/mentorships/${relationshipId}`}>Open mentorship workspace</Button>
              ) : null}
            </>
          ) : null}
          {status === 'pending' ? (
            <>
              <Text variant="h1">Payment processing</Text>
              <Text variant="muted">
                We are still confirming your payment. Refresh this page in a moment or open your
                mentorship workspace to check the latest status.
              </Text>
              {relationshipId ? (
                <Button to={`/dashboard/mentorships/${relationshipId}`}>Open mentorship workspace</Button>
              ) : null}
            </>
          ) : null}
          {status === 'error' ? (
            <EmptyState
              title="Could not confirm payment"
              description={error ?? 'Please try again from your mentorship workspace.'}
            />
          ) : null}
        </Stack>
      </Card>
    </Page>
  );
}

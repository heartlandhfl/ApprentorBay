import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Page, Stack, Text } from '../components';
import { getMentorshipBooking } from '../lib/api';

export function BookingPaymentCancelPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const [relationshipId, setRelationshipId] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;
    void getMentorshipBooking(bookingId)
      .then((booking) => setRelationshipId(booking.relationshipId))
      .catch(() => setRelationshipId(null));
  }, [bookingId]);

  return (
    <Page>
      <Card padding="lg">
        <Stack gap={16}>
          <Text variant="h1">Checkout cancelled</Text>
          <Text variant="muted">
            No payment was taken. You can return to the mentor profile or mentorship workspace to
            try again when you are ready.
          </Text>
          {relationshipId ? (
            <Button to={`/dashboard/mentorships/${relationshipId}`}>Return to mentorship workspace</Button>
          ) : (
            <Button to="/mentors">Browse mentors</Button>
          )}
        </Stack>
      </Card>
    </Page>
  );
}

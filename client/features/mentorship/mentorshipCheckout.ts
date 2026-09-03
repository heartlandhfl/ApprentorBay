import {
  isOpenBookingPaymentStatus,
  isOpenBookingStatus,
  type MentorshipBooking,
} from '@apprentorbay/shared';
import {
  createMentorshipBooking,
  listMentorshipBookings,
  startPaymentCheckout,
} from '../../lib/api';

export function findOpenPendingBooking(
  bookings: readonly MentorshipBooking[],
): MentorshipBooking | null {
  return (
    bookings.find(
      (booking) =>
        isOpenBookingPaymentStatus(booking.paymentStatus) &&
        isOpenBookingStatus(booking.bookingStatus),
    ) ?? null
  );
}

/** Create or resume checkout for an unpaid mentorship relationship. */
export async function startMentorshipPaymentCheckout(relationshipId: string): Promise<void> {
  const { bookings } = await listMentorshipBookings(relationshipId);
  const openBooking = findOpenPendingBooking(bookings);
  const booking =
    openBooking ?? (await createMentorshipBooking({ relationshipId })).booking;
  const checkout = await startPaymentCheckout(booking.id);
  window.location.assign(checkout.checkoutUrl);
}

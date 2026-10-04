import { Booking } from '../../types/booking'

/** What the desk does next on a booking — the one step the panel puts in front of them. */
export type BookingStep = 'payment' | 'checkIn' | 'checkOut' | 'done'

/**
 * The single next step for a stay.
 *
 * Money comes first whenever the guest owes it: check-in and check-out are both refused
 * while money is owed (`docs/why/booking.md`). A stay billed to an agency is the
 * exception — the agency pays months later, so the door is not held shut on it.
 */
export function nextStep(booking: Booking, owes: boolean, billedToAgency: boolean): BookingStep {
  const mustPayFirst = owes && !billedToAgency
  if (!booking.actual_check_in) return mustPayFirst ? 'payment' : 'checkIn'
  if (!booking.actual_check_out) return mustPayFirst ? 'payment' : 'checkOut'
  return owes ? 'payment' : 'done'
}

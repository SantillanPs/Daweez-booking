import { Booking } from '../../types/booking'

/** What the desk does next on a booking — the one step the panel puts in front of them. */
export type BookingStep = 'payment' | 'done'

/**
 * The single next step for a stay: taking the money while the guest owes it. There is no
 * check-in or check-out step any more (Sebastian, 2026-10-20) — the desk only records the
 * booking, the guest and the money, as on paper. A stay billed to an agency is not chased:
 * the agency pays later, so its Receive waits behind a quiet link.
 */
export function nextStep(_booking: Booking, owes: boolean, billedToAgency: boolean): BookingStep {
  return owes && !billedToAgency ? 'payment' : 'done'
}

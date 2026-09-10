import { BookingStatus } from '../types/booking'

// Recording money confirms the booking. A walk-in that has not paid anything
// yet sits in the 'pending' state (shown to staff as "Unpaid"); the moment any
// payment lands — a 50% deposit or the full amount — the booking is confirmed.
export function statusAfterPayment(current: BookingStatus | undefined): BookingStatus {
  return !current || current === 'pending' ? 'confirmed' : current
}

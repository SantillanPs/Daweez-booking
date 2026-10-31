import { Booking } from '../types/booking'
import { normalizeVenueId } from './helpers'
import { bookingHalves, clashIn } from './halfDays'

/** What makes a booking being checked a short stay: its hours and the half it is booked for. */
export type ShortFacts = Pick<Booking, 'stay_hours' | 'stay_half' | 'actual_check_in' | 'late_check_out_hours' | 'actual_check_out'>

// Kept apart by HALF-DAYS (`utils/halfDays.ts`, 2026-10-25), as the database does: a short stay
// leaves the other half of its day free. Pass `short` when the booking being checked is one, and
// its `actual_check_out` when its guest may have left early: the nights they left are someone else's.
const spanOf = (checkInStr: string, checkOutStr: string, short?: ShortFacts) =>
  bookingHalves({ check_in: checkInStr, check_out: checkOutStr, actual_check_out: short?.actual_check_out, ...(short?.stay_hours ? short : { stay_hours: undefined }) })

export function isRoomAvailable(roomId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string, short?: ShortFacts): boolean {
  if (checkInStr >= checkOutStr) return false
  const [from, to] = spanOf(checkInStr, checkOutStr, short)
  return !clashIn(b => b.room_id, roomId, from, to, bookingsList, skipBookingId)
}

export function isVenueAvailable(venueId: string, eventDateStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  return !bookingsList.some(booking => {
    if (booking.venue_id !== venueId) return false
    if (booking.id === skipBookingId) return false
    if (booking.status === 'cancelled') return false
    return booking.check_in === eventDateStr
  })
}

export function isVenueRangeAvailable(venueId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string, short?: ShortFacts): boolean {
  if (checkInStr >= checkOutStr) return false
  const [from, to] = spanOf(checkInStr, checkOutStr, short)
  return !clashIn(b => normalizeVenueId(b.venue_id), normalizeVenueId(venueId) || '', from, to, bookingsList, skipBookingId)
}

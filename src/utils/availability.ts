import { Booking } from '../types/booking'
import { normalizeVenueId } from './helpers'
import { bookingHalves, clashIn } from './halfDays'

/** What makes a booking being checked a short stay: its hours and the half it is booked for. */
export type ShortFacts = Pick<Booking, 'stay_hours' | 'stay_half' | 'actual_check_in' | 'late_check_out_hours' | 'actual_check_out'>

/** **Pension House Exclusive is the whole house** (Sebastian, 2026-11-07: "everything will be
 *  reserved and occupied. as in EVERYTHING. all rooms and venues"). On its days no room or venue
 *  is sold, and it cannot be booked over anything already there — `no_overlap_exclusive` in the
 *  database is the backstop. */
export const EXCLUSIVE_ID = 'venue-exclusive'
export const isExclusive = (b: Pick<Booking, 'venue_id'>): boolean => normalizeVenueId(b.venue_id) === EXCLUSIVE_ID

// Kept apart by HALF-DAYS (`utils/halfDays.ts`, 2026-10-25), as the database does: a short stay
// leaves the other half of its day free. Pass `short` when the booking being checked is one, and
// its `actual_check_out` when its guest may have left early: the nights they left are someone else's.
const spanOf = (checkInStr: string, checkOutStr: string, short?: ShortFacts) =>
  bookingHalves({ check_in: checkInStr, check_out: checkOutStr, actual_check_out: short?.actual_check_out, ...(short?.stay_hours ? short : { stay_hours: undefined }) })

/** What stands under (or over) the roof on those half-days: for the Exclusive, any booking at
 *  all; for a room or another venue, an Exclusive. */
export function roofClashes(exclusive: boolean, from: number, to: number, list: Booking[], skipId?: string): Booking[] {
  return list.filter(b => {
    if (b.id === skipId || b.status === 'cancelled' || isExclusive(b) === exclusive) return false
    const [s, e] = bookingHalves(b)
    return from < e && to > s
  })
}

export function isRoomAvailable(roomId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string, short?: ShortFacts): boolean {
  if (checkInStr >= checkOutStr) return false
  const [from, to] = spanOf(checkInStr, checkOutStr, short)
  return !clashIn(b => b.room_id, roomId, from, to, bookingsList, skipBookingId)
    && !roofClashes(false, from, to, bookingsList, skipBookingId).length
}

export function isVenueRangeAvailable(venueId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string, short?: ShortFacts): boolean {
  if (checkInStr >= checkOutStr) return false
  const [from, to] = spanOf(checkInStr, checkOutStr, short)
  const id = normalizeVenueId(venueId) || ''
  return !clashIn(b => normalizeVenueId(b.venue_id), id, from, to, bookingsList, skipBookingId)
    && !roofClashes(id === EXCLUSIVE_ID, from, to, bookingsList, skipBookingId).length
}

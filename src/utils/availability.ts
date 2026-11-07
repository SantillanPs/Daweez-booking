import { Booking, ExclusiveLess, Room, Venue } from '../types/booking'
export type { ExclusiveLess }
import { addDays, normalizeVenueId } from './helpers'
import { getEffectiveNightlyPrice } from './promoMode'
import { bookingHalves, clashIn } from './halfDays'

/** What makes a booking being checked a short stay: its hours and the half it is booked for. */
export type ShortFacts = Pick<Booking, 'stay_hours' | 'stay_half' | 'actual_check_in' | 'late_check_out_hours' | 'actual_check_out'>

/** **Pension House Exclusive is the whole house** (Sebastian, 2026-11-07): the rooms and the Gazebo,
 *  and the Vacation House and the Garden too when the desk picks its kind "Vacation House & Garden"
 *  (`GROUNDS`, ₱35,000 a day: "adds 15k"). A guest already in a room it covers stays, side by side,
 *  and that room comes off its price (`exclusiveLess`); once it is booked, nothing it covers is sold
 *  on its days. The trigger `refuse_under_exclusive` is the backstop (`exclusive_covers` mirrors
 *  `exclusiveCovers`). */
export const EXCLUSIVE_ID = 'venue-exclusive'
export const GROUNDS = 'grounds'
export const isExclusive = (b: Pick<Booking, 'venue_id'>): boolean => normalizeVenueId(b.venue_id) === EXCLUSIVE_ID

/** Whether an Exclusive of this kind takes that room or venue. */
export function exclusiveCovers(ex: Pick<Booking, 'event_addons'>, b: Pick<Booking, 'room_id' | 'venue_id'>): boolean {
  if (b.room_id) return true
  const v = normalizeVenueId(b.venue_id)
  return v === 'venue-gazebo' || (ex.event_addons?.venue_type === GROUNDS && (v === 'venue-vacation' || v === 'venue-garden'))
}

const live = (b: Booking, skipId?: string) => b.id !== skipId && b.status !== 'cancelled'
const meets = (b: Booking, from: number, to: number) => { const [s, e] = bookingHalves(b); return from < e && to > s }

/** What already stays under an Exclusive of this kind on those half-days. It stays, and comes off the price. */
export function underRoof(ex: Pick<Booking, 'event_addons'>, from: number, to: number, list: Booking[], skipId?: string): Booking[] {
  return list.filter(b => live(b, skipId) && !isExclusive(b) && exclusiveCovers(ex, b) && meets(b, from, to))
}

/** The Exclusive that has this room or venue on those half-days. A booking that was there before it
 *  (`skipId`, on the same unit, reaching no further) keeps its place, as the database lets it. */
function roofOver(unit: Pick<Booking, 'room_id' | 'venue_id'>, from: number, to: number, list: Booking[], skipId?: string): boolean {
  const old = skipId ? list.find(b => b.id === skipId) : undefined
  if (old && old.status !== 'cancelled' && (old.room_id || undefined) === (unit.room_id || undefined)
    && normalizeVenueId(old.venue_id) === normalizeVenueId(unit.venue_id)) {
    const [s, e] = bookingHalves(old)
    if (from >= s && to <= e) return false
  }
  return list.some(b => live(b, skipId) && isExclusive(b) && exclusiveCovers(b, unit) && meets(b, from, to))
}

/** What comes off an Exclusive for what stays under it: each room at its own price a night, each
 *  venue at its price a day, for the days the two share (a short stay is one). Worked out on the
 *  bill and kept on the booking (`event_addons.exclusive_less`), so a guest leaving later does not
 *  change a bill by itself. */
export function exclusiveLess(ex: Pick<Booking, 'id' | 'check_in' | 'check_out' | 'event_addons'>, list: Booking[], rooms: Room[], venues: Venue[]): ExclusiveLess[] {
  const [from, to] = bookingHalves({ check_in: ex.check_in, check_out: ex.check_out })
  const out = new Map<string, ExclusiveLess>()
  for (const b of underRoof(ex, from, to, list, ex.id)) {
    let nights = 0
    if (b.stay_hours) nights = 1
    else for (let d = ex.check_in; d < ex.check_out; d = addDays(d, 1)) if (d >= b.check_in && d < b.check_out) nights++
    if (nights === 0) continue
    const room = b.room_id ? rooms.find(r => r.id === b.room_id) : undefined
    const venue = room ? undefined : venues.find(v => v.id === normalizeVenueId(b.venue_id))
    const unit = room?.id || venue?.id
    if (!unit) continue
    const price = room ? getEffectiveNightlyPrice(room.base_price, room.promo_price) : getEffectiveNightlyPrice(venue!.base_price, venue!.promo_price)
    const name = room ? 'Room ' + room.room_number : venue!.name
    const had = out.get(unit)
    out.set(unit, { unit, name, price, nights: (had?.nights || 0) + nights })
  }
  return [...out.values()]
}

// Kept apart by HALF-DAYS (`utils/halfDays.ts`, 2026-10-25), as the database does: a short stay
// leaves the other half of its day free. Pass `short` when the booking being checked is one, and
// its `actual_check_out` when its guest may have left early: the nights they left are someone else's.
const spanOf = (checkInStr: string, checkOutStr: string, short?: ShortFacts) =>
  bookingHalves({ check_in: checkInStr, check_out: checkOutStr, actual_check_out: short?.actual_check_out, ...(short?.stay_hours ? short : { stay_hours: undefined }) })

export function isRoomAvailable(roomId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string, short?: ShortFacts): boolean {
  if (checkInStr >= checkOutStr) return false
  const [from, to] = spanOf(checkInStr, checkOutStr, short)
  return !clashIn(b => b.room_id, roomId, from, to, bookingsList, skipBookingId)
    && !roofOver({ room_id: roomId }, from, to, bookingsList, skipBookingId)
}

export function isVenueRangeAvailable(venueId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string, short?: ShortFacts): boolean {
  if (checkInStr >= checkOutStr) return false
  const [from, to] = spanOf(checkInStr, checkOutStr, short)
  const id = normalizeVenueId(venueId) || ''
  return !clashIn(b => normalizeVenueId(b.venue_id), id, from, to, bookingsList, skipBookingId)
    && (id === EXCLUSIVE_ID || !roofOver({ venue_id: id }, from, to, bookingsList, skipBookingId))
}

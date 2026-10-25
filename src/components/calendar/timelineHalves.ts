import { Booking } from '../../types/booking'
import { normalizeVenueId } from '../../utils/helpers'
import { TimelineDayInfo } from './timelineDays'
import { bookingHalves, dayHalf } from '../../utils/halfDays'

// HALF A DAY EACH WAY (Sebastian, 2026-10-06). A guest is out by 12 PM and the next is in
// from 2 PM, so the room has two hours to be cleaned and the same day can end one stay and
// begin the next. The grid used to give a stay every day from check-in to the day BEFORE
// check-out, so the day a guest arrived was a whole box and nobody could pick it as the
// day another stay ended. Each day is now two halves — the morning (left) and the afternoon
// (right) — and a stay fills from the afternoon of its first day to the morning of its last.
//
// The halves of a row are numbered from the first day on screen: day `d` is halves `2d`
// (morning) and `2d + 1` (afternoon).

/**
 * Who fills each half of each room's and venue's row, keyed by the unit's id. A half with
 * nobody in it is `null`; a unit nobody is booked into has no row at all.
 *
 * A SHORT STAY is the one exception: it is HALF A DAY (Sebastian, 2026-10-25, the pill states
 * mock: "since a short stay just requires half a pill, shouldn't the pill also be half?"), the
 * half it was booked for — and since the free-half mock the other half can be sold. 12 hours
 * fill two halves, and a late check-in reaches as far as the guest's hours do. Which halves a
 * booking holds is `bookingHalves`, the rule the database keeps bookings apart by.
 */
export function halvesByUnit(bookings: Booking[], days: TimelineDayInfo[]): Record<string, (Booking | null)[]> {
  const rows: Record<string, (Booking | null)[]> = {}
  if (days.length === 0) return rows
  const width = days.length * 2
  const first = dayHalf(days[0].isoStr)

  bookings.forEach(b => {
    const unit = b.room_id || normalizeVenueId(b.venue_id)
    if (!unit) return
    const [start, end] = bookingHalves(b).map(k => k - first)
    // Only the days on screen are filled: a block with no end date runs to a far-off year.
    const from = Math.max(start, 0)
    const to = Math.min(end, width)
    if (from >= to) return
    const row = rows[unit] || (rows[unit] = new Array<Booking | null>(width).fill(null))
    for (let k = from; k < to; k++) if (!row[k]) row[k] = b
  })
  return rows
}

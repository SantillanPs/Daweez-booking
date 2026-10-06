import { Booking } from '../../types/booking'
import { normalizeVenueId } from '../../utils/helpers'
import { TimelineDayInfo } from './timelineDays'

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
 * A SHORT STAY is the one exception: it takes the whole day it is on (its stored check-out
 * is only the next day because the room is taken for that whole day — housekeeping cleans
 * it afterwards), so it fills both halves of its day and nothing of the next. Ordinary
 * stays are placed first, so when a short stay is on the day a guest leaves, the guest keeps
 * the morning and the short stay shows the afternoon only.
 */
export function halvesByUnit(bookings: Booking[], days: TimelineDayInfo[]): Record<string, (Booking | null)[]> {
  const rows: Record<string, (Booking | null)[]> = {}
  if (days.length === 0) return rows
  const width = days.length * 2
  // Whole days counted in UTC, so a daylight-saving shift can never move a stay by a day.
  const dayUTC = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  const firstDay = dayUTC(days[0].isoStr)
  const dayIndex = (iso: string) => Math.round((dayUTC(iso) - firstDay) / 86400000)

  const ordered = [...bookings].sort((a, b) => Number(!!a.stay_hours) - Number(!!b.stay_hours))
  ordered.forEach(b => {
    const unit = b.room_id || normalizeVenueId(b.venue_id)
    if (!unit) return
    const arrives = dayIndex(b.check_in)
    const start = b.stay_hours ? arrives * 2 : arrives * 2 + 1
    const end = b.stay_hours ? arrives * 2 + 2 : dayIndex(b.check_out) * 2 + 1
    // Only the days on screen are filled: a block with no end date runs to a far-off year.
    const from = Math.max(start, 0)
    const to = Math.min(end, width)
    if (from >= to) return
    const row = rows[unit] || (rows[unit] = new Array<Booking | null>(width).fill(null))
    for (let k = from; k < to; k++) if (!row[k]) row[k] = b
  })
  return rows
}

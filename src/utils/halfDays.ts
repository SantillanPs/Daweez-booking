import { Booking } from '../types/booking'
import { dateToString } from './helpers'

// HALF-DAYS (Sebastian, 2026-10-25, the free-half mock): a short stay takes half a day, so the
// other half can be sold. Day d is halves 2d (morning) and 2d + 1 (afternoon), counted from
// 2000-01-01. The database keeps bookings apart with the same rule (`booking_halves` in
// supabase/migrations/20261025120000_short_stay_halves.sql) — change both together.

const EPOCH = Date.UTC(2000, 0, 1)

/** The morning half of a day (`YYYY-MM-DD`); its afternoon is this + 1. */
export const dayHalf = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH) / 86400000) * 2
}

/** The half a moment falls in, in the hotel's own time. */
const halfAt = (t: Date) => dayHalf(dateToString(t)) + (t.getHours() >= 12 ? 1 : 0)

export type HalfFacts = Pick<Booking, 'check_in' | 'check_out' | 'stay_hours' | 'stay_half' | 'actual_check_in' | 'late_check_out_hours' | 'actual_check_out'>

/**
 * The halves a booking holds, as [first, last + 1):
 *   * a night from the afternoon it arrives to the morning it leaves;
 *   * a guest who left before their check-out day to the morning of the day they left, or only the
 *     arrival afternoon if they left the day they came. The bill stays as booked (Sebastian,
 *     2026-10-31: "they should still pay for the entire stay, but the calendar should adjust");
 *   * a short stay its booked half — 12 hours that half and the next, 22 from a morning three;
 *   * and once a short stay's check-in is noted, every half up to when it should leave: the
 *     clock starts at check-in, so a 12-hour morning stay checked in at 4 PM holds the next
 *     morning too (Sebastian, 2026-10-25: "ship it").
 */
export function bookingHalves(b: HalfFacts): [number, number] {
  const hours = Number(b.stay_hours || 0)
  if (!hours) {
    const start = dayHalf(b.check_in) + 1
    const left = b.actual_check_out ? dateToString(new Date(b.actual_check_out)) : ''
    if (left && left < b.check_out) return [start, Math.max(start + 1, dayHalf(left) + 1)]
    return [start, dayHalf(b.check_out) + 1]
  }
  const half = b.stay_half ?? 1
  const start = dayHalf(b.check_in) + half
  let end = start + (hours < 12 ? 1 : hours > 12 && half === 0 ? 3 : 2)
  if (b.actual_check_in) {
    const at = new Date(b.actual_check_in)
    // A second off, so leaving at exactly 12 PM ends in the morning.
    const out = new Date(at.getTime() + (hours + Number(b.late_check_out_hours || 0)) * 3600000 - 1000)
    if (!isNaN(out.getTime())) end = Math.max(end, halfAt(out) + 1)
  }
  return [start, end]
}

/** The first booking in `list` on this unit that holds any of the halves [from, to), or none. */
export function clashIn(unitOf: (b: Booking) => string | undefined, unitId: string, from: number, to: number, list: Booking[], skipId?: string): Booking | undefined {
  return list.find(b => {
    if (b.id === skipId || b.status === 'cancelled' || unitOf(b) !== unitId) return false
    const [s, e] = bookingHalves(b)
    return from < e && to > s
  })
}

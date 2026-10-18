import { Booking } from '../types/booking'
import { dateToString } from './helpers'
import { getRateConfig } from './rateConfig'

/**
 * **Today's doors** — the check-ins and check-outs still to do today (the check-in loop
 * mocks, Sebastian, 2026-10-18). The staff forgot to check guests in and out: the calendar
 * marked it with a thin edge and nothing reminded them. A pill with a door today now glows
 * with a slow ripple (`TimelineCell`), as does the booking panel's door button. The doors are
 * only ever pressed in the booking panel.
 *
 * A door left open from an earlier day counts too — a guest who arrived yesterday and was
 * never checked in, or who should have left and was never checked out (Sebastian,
 * 2026-10-18: "the other reservations that need checking in and checking out doesn't have
 * the new designs"). A stay that ended before today with nobody checked in is a no-show.
 */
export interface Door {
  booking: Booking
  kind: 'in' | 'out'
}

// **Only once it is time** (the ripple mock, design A, Sebastian, 2026-10-18): today's door
// waits for the hotel's times — check-out from 12 PM, check-in from 2 PM — and a door left from
// an earlier day is late, so it shows all day. A short stay can arrive at any hour, and is due
// out once its hours have run from its check-in.
const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + (m || 0) }

export function todaysDoors(bookings: Booking[], now: Date): Door[] {
  const today = dateToString(now)
  const mins = now.getHours() * 60 + now.getMinutes()
  const rates = getRateConfig()
  const inTime = mins >= minutesOf(rates.standardCheckInTime)
  const outTime = mins >= minutesOf(rates.standardCheckOutTime)
  const doors: Door[] = []
  for (const b of bookings) {
    if (b.status === 'blocked' || b.status === 'cancelled') continue
    const leaves = b.stay_hours ? b.check_in : b.check_out
    if (!b.actual_check_in) {
      if ((b.check_in < today && leaves >= today) || (b.check_in === today && (b.stay_hours || inTime))) doors.push({ booking: b, kind: 'in' })
      continue
    }
    if (b.actual_check_out) continue
    const timeUp = b.stay_hours
      ? new Date(b.actual_check_in).getTime() + b.stay_hours * 3600000 <= now.getTime()
      : outTime
    if (leaves < today || (leaves === today && timeUp)) doors.push({ booking: b, kind: 'out' })
  }
  return doors
}

import { Booking } from '../../types/booking'
import { clockLabel, shortStayEnd, stayHoursOf } from '../../utils/shortStay'

/**
 * The short-stay clock inside the booking panel.
 *
 * The owner's ruling (2026-09): no countdown — the panel states the TIME the room is
 * free, and once that time has passed it says so in red, because the room is due for
 * cleaning. The hours come from the booking and the clock starts at the recorded
 * arrival, so nothing is typed and nothing is guessed.
 *
 * It renders nothing for an ordinary stay, and nothing before the guest has been
 * checked in (the desk has not started the clock yet).
 *
 * `due` is handed in rather than read here: `CalendarTab` already ticks the clock for
 * the whole page (that is what pops this panel open), so the panel must not run a second
 * one — and reading `Date.now()` while rendering is forbidden anyway.
 */
export function ShortStayClock({ booking, due }: { booking: Booking; due: boolean }) {
  const hours = stayHoursOf(booking)
  const end = shortStayEnd(booking.actual_check_in, hours)
  if (!hours || !booking.actual_check_in || !end) return null

  return (
    <div className={'rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ' +
      (due
        ? 'bg-danger-100 border-danger-400 text-danger-600'
        : 'bg-gold-100 border-gold-300 text-gold-800')}>
      {due
        ? 'Time is up at ' + clockLabel(end) + ' — the room is due for cleaning'
        : clockLabel(new Date(booking.actual_check_in)) + ' → ' + clockLabel(end) + ' · ' + hours + '-hour stay'}
    </div>
  )
}

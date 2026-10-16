import { useEffect, useState } from 'react'
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
 * A ring beside it empties as the hours go (the booking window mock, 2026-10-16), so the
 * time left is seen without a number. Once time is up the ring is full and red and gives a
 * small shake now and then, and the row says how long it is past — the earlier design the
 * owner kept ("I liked the previous design"). Nothing is charged for that time.
 *
 * It renders nothing for an ordinary stay, and nothing before the guest has been
 * checked in (the desk has not started the clock yet).
 *
 * `due` is handed in rather than read here: `CalendarTab` already ticks the clock for
 * the whole page (that is what pops this panel open), so the panel must not run a second
 * one for it.
 */
export function ShortStayClock({ booking, due }: { booking: Booking; due: boolean }) {
  const hours = stayHoursOf(booking)
  const end = shortStayEnd(booking.actual_check_in, hours)
  // The minute, kept fresh while the panel is open: the ring's place and the time past.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30000)
    return () => window.clearInterval(id)
  }, [])
  if (!hours || !booking.actual_check_in || !end) return null

  const start = new Date(booking.actual_check_in).getTime()
  const span = Math.max(1, end.getTime() - start)
  const left = Math.max(0, end.getTime() - now)
  const past = Math.max(0, Math.round((now - end.getTime()) / 60000))
  const pastWords = past >= 60 ? Math.floor(past / 60) + ' h ' + (past % 60) + ' min' : past + ' min'

  return (
    <div className={'min-h-11 flex items-center gap-2.5 rounded-lg px-3 text-[13px] font-bold ' +
      (due ? 'bg-danger-50 text-danger-600' : 'bg-gold-100 text-gold-800')}>
      {due ? (
        <>
          <span aria-hidden="true" data-up="" className="bw-ring" />
          <span><b className="font-extrabold">Time up</b> · out by {clockLabel(end)}</span>
          <small className="ml-auto text-[12px] font-semibold tabular-nums opacity-80">+{pastWords}</small>
        </>
      ) : (
        <>
          {/* How much of the stay has gone, moved on with the minute. */}
          <span aria-hidden="true" className="bw-ring transition-[--bw-p] duration-1000"
            style={{ '--bw-p': Math.min(1, 1 - left / span) } as React.CSSProperties} />
          <span>{clockLabel(new Date(start))} → <b className="font-extrabold">{clockLabel(end)}</b> · {hours}-hour stay</span>
        </>
      )}
    </div>
  )
}

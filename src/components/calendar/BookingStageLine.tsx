import { Check } from 'lucide-react'
import { Booking } from '../../types/booking'
import { stayHoursOf } from '../../utils/shortStay'
import { stayStage } from '../../utils/stayStage'

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const CHIP = 'bw-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-300 '
const TONE = {
  done: 'bg-softbg text-emerald-700',
  out: 'bg-softbg text-white',
  later: 'bg-softbg text-muted',
}

/**
 * Where a stay is: its first day, then its last, joined by a line (the staff's feedback,
 * 2026-10-04). Read from the dates, not from a check-in — the desk no longer checks guests in
 * or out (Sebastian, 2026-10-20; `stayStage`): green with a tick once the stay has begun,
 * charcoal once it is over, grey for a day still to come.
 *
 * **There is no money step** (the booking window mock, Sebastian, 2026-10-16: "make sure to
 * check for redundancies"): the big figure above it already says what is paid or owed.
 */
export function BookingStageLine({ booking, todayKey }: { booking: Booking; todayKey: string }) {
  const stage = stayStage(booking, todayKey)
  const isIn = stage !== 'before'
  const isOut = stage === 'after'
  const hours = stayHoursOf(booking)
  const dayWord = (d: string) => (d === todayKey ? 'today' : fmtDay(d))
  const tick = <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
  const inTone = isIn ? 'done' : 'later'
  const outTone = isOut ? 'out' : 'later'
  // A short stay is stored as leaving the next day; it is just its hours.
  const outWord = hours ? hours + '-hour stay' : 'Out ' + dayWord(booking.check_out)

  return (
    <ol className="flex items-center gap-1.5" aria-label="Where the stay is">
      <li className="flex">
        <span data-tone={inTone} className={CHIP + TONE[inTone]}>{isIn && tick}{'In ' + dayWord(booking.check_in)}</span>
      </li>
      <li className="flex items-center gap-1.5 min-w-0 flex-1">
        <span aria-hidden="true" data-done={isOut ? '' : undefined} className="bw-line flex-1 min-w-1.5 border-t-[1.5px] border-dashed border-paper-300" />
        <span data-tone={outTone} className={CHIP + TONE[outTone]}>{isOut && tick}{outWord}</span>
      </li>
    </ol>
  )
}

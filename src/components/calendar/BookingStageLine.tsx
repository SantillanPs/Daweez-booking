import { useState } from 'react'
import { Check } from 'lucide-react'
import { Booking } from '../../types/booking'
import { clockLabel, shortStayEnd, stayHoursOf } from '../../utils/shortStay'
import { BookingStep } from './bookingStep'

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtWhen = (iso: string, todayKey: string) => {
  const d = new Date(iso)
  const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  return key === todayKey ? clockLabel(d) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CHIP = 'bw-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-300 '
const TONE = {
  done: 'bg-softbg text-emerald-700',
  out: 'bg-softbg text-white',
  next: 'bg-gold-100 text-gold-800',
  later: 'bg-softbg text-muted',
}

interface BookingStageLineProps {
  booking: Booking
  /** The step the panel is asking for now — its chip is gold. */
  now: BookingStep
  todayKey: string
}

/**
 * Where a stay is: in, then out, joined by a line (the staff's feedback, 2026-10-04 — they
 * could not tell whether a guest was checked in or checked out). Green with a tick once in,
 * charcoal once out, gold for the one the desk does next, grey for one still to come.
 *
 * **There is no money step** (the booking window mock, Sebastian, 2026-10-16: "make sure to
 * check for redundancies"): the big figure above it already says what is paid or owed, and
 * the money chip only said it a second time — "Part paid" even when nothing had been paid.
 *
 * A step finished here fills with its colour from the left and its tick draws itself, after
 * the panel's seal has faded; a step taken back gives a small bounce.
 */
export function BookingStageLine({ booking, now, todayKey }: BookingStageLineProps) {
  const isIn = !!booking.actual_check_in
  const isOut = !!booking.actual_check_out
  // What was true when the panel opened: only a change made since then is animated.
  const [wasIn] = useState(isIn)
  const [wasOut] = useState(isOut)
  const hours = stayHoursOf(booking)
  const end = hours && booking.actual_check_in ? shortStayEnd(booking.actual_check_in, hours) : null
  const dayWord = (d: string) => (d === todayKey ? 'today' : fmtDay(d))

  const tick = <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
  const inChip = isIn
    ? { word: 'In ' + fmtWhen(booking.actual_check_in!, todayKey), tone: 'done' as const, motion: wasIn ? '' : ' bw-just' }
    : { word: 'In ' + dayWord(booking.check_in), tone: now === 'checkIn' ? 'next' as const : 'later' as const, motion: wasIn ? ' bw-back' : '' }
  const outChip = isOut
    ? { word: 'Out ' + fmtWhen(booking.actual_check_out!, todayKey), tone: 'out' as const, motion: wasOut ? '' : ' bw-just' }
    // A short stay is stored as leaving the next day; before its clock starts it is just its hours.
    : { word: end ? 'Out ' + clockLabel(end) : hours ? hours + '-hour stay' : 'Out ' + dayWord(booking.check_out), tone: now === 'checkOut' ? 'next' as const : 'later' as const, motion: wasOut ? ' bw-back' : '' }

  return (
    <ol className="flex items-center gap-1.5" aria-label="Where the stay is">
      <li className="flex">
        <span data-tone={inChip.tone} className={CHIP + TONE[inChip.tone] + inChip.motion}>{isIn && tick}{inChip.word}</span>
      </li>
      <li className="flex items-center gap-1.5 min-w-0 flex-1">
        <span aria-hidden="true" data-done={isOut ? '' : undefined}
          className={'bw-line flex-1 min-w-1.5 border-t-[1.5px] border-dashed border-paper-300' + (isOut && !wasOut ? ' bw-just' : '')} />
        <span data-tone={outChip.tone} className={CHIP + TONE[outChip.tone] + outChip.motion}>{isOut && tick}{outChip.word}</span>
      </li>
    </ol>
  )
}

import { Booking } from '../../types/booking'
import { getPaymentView, isBilledToAgency } from '../../utils/bookingMoney'
import { clockLabel, shortStayEnd, stayHoursOf } from '../../utils/shortStay'
import { BookingStep } from './bookingStep'

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const fmtWhen = (iso: string, todayKey: string) => {
  const d = new Date(iso)
  const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  return key === todayKey ? clockLabel(d) : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CHIP = 'inline-flex items-center px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-300 '
const TONE = {
  done: 'bg-emerald-50 text-emerald-700',
  next: 'bg-gold-100 text-gold-800',
  blue: 'bg-blue-50 text-blue-700',
  red: 'bg-danger-50 text-danger-600',
  later: 'bg-softbg text-muted',
}

interface BookingStageLineProps {
  booking: Booking
  /** The step the panel is asking for now — its chip is gold. */
  now: BookingStep
  todayKey: string
  /** A short stay whose hours have run out: its check-out chip turns red. */
  overdue?: boolean
}

/**
 * Where a booking stands, as three chips joined by a dashed line: the money, the arrival,
 * the departure (the staff's feedback, 2026-10-04 — they could not tell whether a booking
 * was paid, checked in or checked out). Green with a tick once done, gold for the step the
 * desk does next, grey for one still to come. Each is said in words, never colour alone.
 *
 * It sits under the panel's big figure, so the money chip names the state, not the
 * amount (the owner chose the "visual hierarchy" panel, 2026-10-15).
 */
export function BookingStageLine({ booking, now, todayKey, overdue = false }: BookingStageLineProps) {
  const view = getPaymentView(booking)
  const left = booking.actual_check_out && Number(booking.balance_due || 0) > 0
  const money: [string, keyof typeof TONE] =
    view.tone === 'paid' ? ['✓ Paid', 'done']
      : view.tone === 'billed' || isBilledToAgency(booking) ? ['Agency pays', 'blue']
        : view.tone === 'reserved' ? ['No deposit', 'blue']
          : left ? ['Still owes', 'red']
            : now === 'payment' ? ['Part paid', 'next'] : ['✓ Deposit', 'done']

  const hours = stayHoursOf(booking)
  const end = hours && booking.actual_check_in ? shortStayEnd(booking.actual_check_in, hours) : null
  const dayWord = (d: string) => (d === todayKey ? 'today' : fmtDay(d))
  const checkIn: [string, keyof typeof TONE] = booking.actual_check_in
    ? ['✓ In ' + fmtWhen(booking.actual_check_in, todayKey), 'done']
    : ['In ' + dayWord(booking.check_in), now === 'checkIn' ? 'next' : 'later']
  const checkOut: [string, keyof typeof TONE] = booking.actual_check_out
    ? ['✓ Out ' + fmtWhen(booking.actual_check_out, todayKey), 'done']
    // A short stay is stored as leaving the next day; before its clock starts it is just its hours.
    : [end ? 'Out ' + clockLabel(end) : hours ? hours + '-hour stay' : 'Out ' + dayWord(booking.check_out), overdue ? 'red' : now === 'checkOut' ? 'next' : 'later']

  return (
    <ol className="flex items-center gap-1.5" aria-label="Where the stay is">
      {[money, checkIn, checkOut].map(([word, tone], i) => (
        <li key={i} className={'flex items-center gap-1.5 min-w-0 ' + (i ? 'flex-1' : '')}>
          {i > 0 && <span aria-hidden="true" className="flex-1 min-w-1.5 border-t-[1.5px] border-dashed border-paper-300" />}
          <span className={CHIP + TONE[tone]}>{word}</span>
        </li>
      ))}
    </ol>
  )
}

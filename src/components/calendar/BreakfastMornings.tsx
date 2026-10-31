import { useState } from 'react'
import { Check, Coffee } from 'lucide-react'
import { Booking } from '../../types/booking'
import { breakfastMornings } from '../../utils/breakfast'
import { breakfastAskOpen, breakfastOn, breakfastPlanOf, isConfirmed, morningItems, wantsBreakfastToday } from '../../utils/breakfastChoice'
import { minutesLabel } from '../../utils/doorTimes'
import { dateToString } from '../../utils/helpers'
import { TimeStepper } from './BreakfastParts'

const shortDay = (d: string) => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/**
 * **Breakfast on the booking panel: an update, for when the desk has time** (Sebastian, 2026-11-01,
 * "the same mindset" as the check-in and check-out notes). The stay's time, then one line per
 * morning that opens the breakfast window. It took the place of the red "Breakfast not asked".
 */
export function BreakfastMornings({ booking, todayKey, onMorning, onTime }: {
  booking: Booking
  todayKey: string
  onMorning: (date: string) => void
  onTime: (minutes: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<number | undefined>(undefined)
  const [just, setJust] = useState(false)
  const time = breakfastPlanOf(booking)?.time
  // A guest noted as gone has no mornings left after that day.
  const gone = booking.actual_check_out ? dateToString(new Date(booking.actual_check_out)) : null
  const mornings = breakfastMornings(booking.check_in, booking.check_out, booking.breakfast_days).filter(d => !gone || d <= gone)
  if (mornings.length === 0) return null

  const row = (d: string) => {
    const choice = breakfastOn(booking, d)
    const items = morningItems(booking, d)
    const past = d < todayKey
    const today = d === todayKey
    const confirmed = isConfirmed(choice)
    // Asks only while the desk can still do something about it: after 11 AM the morning goes grey.
    const asking = today && !confirmed && wantsBreakfastToday(booking, todayKey) && breakfastAskOpen()
    const nothing = !!choice && items.length === 0
    const word = !today || !confirmed || items.length === 0 ? null
      : choice?.served_at ? <span className="text-[11.5px] font-bold text-emerald-700 whitespace-nowrap">Served</span>
      : choice?.ready_at ? <span className="text-[11.5px] font-bold text-gold-800 whitespace-nowrap">Cooked</span>
      : <span className="text-[11.5px] font-bold text-muted whitespace-nowrap">In the kitchen</span>
    return (
      <button key={d} type="button" onClick={() => onMorning(d)} aria-label={'Breakfast ' + (today ? 'today' : shortDay(d))}
        className={'w-full grid grid-cols-[22px_54px_minmax(0,1fr)_auto] items-center gap-1 min-h-[42px] py-[3px] pl-1 pr-1.5 text-[12.5px] text-left cursor-pointer transition-colors duration-200 hover:bg-page ' +
          (asking ? 'rounded-lg bg-gold-100 hover:bg-gold-100 ' : 'border-b border-soft ') + (past ? 'text-muted' : 'text-main')}>
        {asking
          ? <span aria-hidden="true" className="ask-mark w-4 h-4 rounded-full grid place-items-center bg-ink-900 text-white font-display text-[11px] font-extrabold leading-none">?</span>
          : confirmed && items.length > 0 ? <Check aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600" strokeWidth={3} /> : <span />}
        <span className={past ? 'font-semibold' : 'font-bold'}>{today ? 'Today' : shortDay(d)}</span>
        <span className={'min-w-0 leading-tight break-words ' + (nothing ? 'text-muted' : '')}>
          {nothing ? 'Nothing'
            : items.length > 0 ? items.filter(i => i.qty > 0).map(i => i.qty + ' ' + i.name).join(', ')
            : past ? ''
            : <span className="font-bold text-muted border-b-[1.5px] border-dashed border-paper-400">Menu</span>}
        </span>
        {word || <span />}
      </button>
    )
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 min-h-[30px] pb-1.5 border-b border-soft text-[12px] font-extrabold text-main">
        <Coffee aria-hidden="true" className="w-3.5 h-3.5 text-gold-600" /> Breakfast
        <button type="button" aria-expanded={editing} aria-label="Breakfast time" onClick={() => { setDraft(time); setEditing(e => !e) }}
          className={'ml-auto px-0.5 border-b-[1.5px] border-dashed font-display font-bold tabular-nums cursor-pointer hover:bg-gold-100 active:scale-95 transition-[background-color,transform] ' + (time == null ? 'border-paper-400 font-body text-muted' : 'border-gold-400 text-main')}>
          <span key={time} className={just ? 'inline-block animate-pop' : 'inline-block'}>{time == null ? 'Set time' : minutesLabel(time)}</span>
        </button>
      </div>
      {editing && (
        <div className="bw-unfold my-1.5 p-1.5 rounded-[10px] bg-softbg grid grid-cols-[auto_minmax(0,1fr)_40px] items-center gap-1.5">
          <span className="pl-1.5 text-[12.5px] font-bold text-main">Served at</span>
          <TimeStepper minutes={draft} onChange={setDraft} />
          {draft != null
            ? <button type="button" aria-label={'Save ' + minutesLabel(draft)} onClick={() => { onTime(draft); setJust(true); setEditing(false) }}
                className="h-10 rounded-[9px] grid place-items-center bg-ink-900 text-white hover:bg-ink-700 cursor-pointer active:scale-95 transition-[background-color,transform] duration-200">
                <Check className="w-4 h-4" strokeWidth={3} />
              </button>
            : <span />}
        </div>
      )}
      {mornings.map(row)}
    </section>
  )
}

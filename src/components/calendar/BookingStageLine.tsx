import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Booking } from '../../types/booking'
import { stayHoursOf } from '../../utils/shortStay'
import { stayStage } from '../../utils/stayStage'
import { Door, doorDay, doorIso, doorTime, minutesLabel, usualMinutes } from '../../utils/doorTimes'

const fmtDay = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

const CHIP = 'bw-chip inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap transition-colors duration-300 '
const TONE = {
  done: 'bg-softbg text-emerald-700',
  out: 'bg-softbg text-white',
  later: 'bg-softbg text-muted',
}
const PRESS = 'active:scale-[0.92] transition-[background-color,color,box-shadow,transform] duration-200 cursor-pointer '

/**
 * Where a stay is: its first day, then its last, joined by a line (the staff's feedback,
 * 2026-10-04). Read from the dates, not from a check-in (Sebastian, 2026-10-20; `stayStage`):
 * green with a tick once the stay has begun, charcoal once it is over, grey for a day still to come.
 *
 * **From its day on, each end asks** (the door times mock, "F · Tick box", Sebastian,
 * 2026-10-21; since 2026-10-24 a black question mark while it asks, and no tick once it is
 * answered): "Checked in" / "Checked out" opens a time — stepped by 15 minutes, never typed
 * (*"I don't like the other text field"*), with the usual time and Now one tap away — and saving
 * it only notes the time (`utils/doorTimes`). A day gone by with nothing ticked shows the usual
 * time in grey.
 *
 * **There is no money step** (the booking window mock, Sebastian, 2026-10-16: "make sure to
 * check for redundancies"): the big figure above it already says what is paid or owed.
 */
export function BookingStageLine({ booking, todayKey, onDoor }: {
  booking: Booking
  todayKey: string
  /** Notes a door's time, or clears it with `undefined`. Without it the line only shows. */
  onDoor?: (k: Door, at: string | undefined) => void
}) {
  const [editing, setEditing] = useState<Door | null>(null)
  const [mins, setMins] = useState(0)
  const [dir, setDir] = useState(0)
  const [just, setJust] = useState<Door | null>(null)
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
  const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
  const word = (k: Door) => (k === 'in' ? 'Checked in' : 'Checked out')

  const open = (k: Door) => {
    if (editing === k) return setEditing(null)
    const t = doorTime(booking, k, todayKey)
    setMins(t ? t.minutes : todayKey === doorDay(booking, k) ? nowMins() : usualMinutes(k))
    setDir(0); setEditing(k)
  }
  const step = (by: number) => { setDir(by); setMins(m => (by > 0 ? Math.floor(m / 15) * 15 + 15 : Math.ceil(m / 15) * 15 - 15)) }
  const pick = (m: number) => { setDir(m < mins ? -1 : m > mins ? 1 : 0); setMins(m) }
  const save = (at: string | undefined) => { if (editing) { onDoor?.(editing, at); setJust(at ? editing : null) } setEditing(null) }

  const door = (k: Door, plain: React.ReactNode) => {
    if (!onDoor || todayKey < doorDay(booking, k)) return plain
    const t = doorTime(booking, k, todayKey)
    return (
      <button type="button" onClick={() => open(k)} aria-expanded={editing === k}
        className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap ' + PRESS +
          (t ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-card text-main shadow-[inset_0_0_0_1.5px_#D9D2C3] hover:shadow-[inset_0_0_0_1.5px_#1C1C1C]')}>
        {!t && (
          <span aria-hidden="true" className="ask-mark w-4 h-4 rounded-full grid place-items-center bg-ink-900 text-white font-display text-[11px] font-extrabold leading-none">?</span>
        )}
        {word(k)}
        {t && <span key={t.minutes} className={'inline-block ' + (t.usual ? 'font-semibold text-muted' : 'text-main') + (just === k && !t.usual ? ' animate-pop' : '')}>{minutesLabel(t.minutes)}</span>}
      </button>
    )
  }

  const presets: [string, number][] = editing
    ? [['Usual', usualMinutes(editing)], ...(todayKey === doorDay(booking, editing) ? [['Now', nowMins()] as [string, number]] : [])]
    : []
  const noted = editing && (editing === 'in' ? booking.actual_check_in : booking.actual_check_out)

  return (
    <div>
      <ol className="flex items-center gap-1.5" aria-label="Where the stay is">
        <li className="flex">
          {door('in', <span data-tone={inTone} className={CHIP + TONE[inTone]}>{isIn && tick}{'In ' + dayWord(booking.check_in)}</span>)}
        </li>
        <li className="flex items-center gap-1.5 min-w-0 flex-1">
          <span aria-hidden="true" data-done={isOut ? '' : undefined} className="bw-line flex-1 min-w-1.5 border-t-[1.5px] border-dashed border-paper-300" />
          {door('out', <span data-tone={outTone} className={CHIP + TONE[outTone]}>{isOut && tick}{outWord}</span>)}
        </li>
      </ol>
      {editing && (
        <div className="bw-unfold mt-2.5 p-1.5 rounded-xl bg-softbg grid grid-cols-[auto_minmax(0,1fr)_40px_32px] items-center gap-1.5">
          <span className="pl-1.5 text-[12.5px] font-bold text-main">{word(editing)}</span>
          <div role="group" aria-label="Time" className="grid grid-cols-[40px_minmax(0,1fr)_40px] items-center h-10 rounded-[9px] bg-card shadow-[inset_0_0_0_1.5px_#1C1C1C]">
            <button type="button" onClick={() => step(-15)} aria-label="15 minutes earlier"
              className={'h-full rounded-[9px] font-display text-[17px] font-bold text-main hover:bg-gold-100 ' + PRESS}>−</button>
            <output aria-live="polite" className="block h-5 overflow-hidden text-center font-display text-[15px] leading-5 font-bold text-main tabular-nums whitespace-nowrap">
              <span key={mins} className={'block ' + (dir > 0 ? 'animate-time-up' : dir < 0 ? 'animate-time-down' : '')}>{minutesLabel(mins)}</span>
            </output>
            <button type="button" onClick={() => step(15)} aria-label="15 minutes later"
              className={'h-full rounded-[9px] font-display text-[17px] font-bold text-main hover:bg-gold-100 ' + PRESS}>+</button>
          </div>
          <button type="button" onClick={() => save(doorIso(booking, editing, mins))} aria-label={'Save ' + minutesLabel(mins)}
            className={'h-10 rounded-[9px] grid place-items-center bg-ink-900 text-white hover:bg-ink-700 ' + PRESS}>
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>
          <button type="button" onClick={() => setEditing(null)} aria-label="Not now"
            className={'h-10 rounded-lg grid place-items-center text-muted hover:text-main hover:bg-card ' + PRESS}>
            <X className="w-4 h-4" />
          </button>
          <div className="col-span-full flex items-center gap-1.5">
            {presets.map(([name, m]) => (
              <button key={name} type="button" onClick={() => pick(m)} aria-pressed={m === mins}
                className={'flex-1 min-h-9 rounded-[9px] inline-flex items-center justify-center gap-1.5 text-[12.5px] font-bold ' + PRESS +
                  (m === mins ? 'bg-ink-900 text-white' : 'bg-card text-main shadow-[inset_0_0_0_1.5px_#D9D2C3] hover:shadow-[inset_0_0_0_1.5px_#1C1C1C] hover:bg-gold-100')}>
                <span className={'text-[10.5px] font-semibold ' + (m === mins ? 'text-white/65' : 'text-muted')}>{name}</span>{minutesLabel(m)}
              </button>
            ))}
            {noted && (
              <button type="button" onClick={() => save(undefined)}
                className="ml-auto px-2 py-2 text-[12px] font-semibold text-muted underline underline-offset-[3px] hover:text-main cursor-pointer">
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

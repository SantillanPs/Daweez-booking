import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { Booking } from '../../types/booking'
import { addDays } from '../../utils/dailyLedger'
import { clockLabel, shortStayOut, stayHoursOf } from '../../utils/shortStay'
import { stayStage } from '../../utils/stayStage'
import { Door, doorDay, doorIso, doorTime, leftEarly, minutesLabel, usualMinutes } from '../../utils/doorTimes'

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
 * **A guest may leave before their check-out day** (Sebastian, 2026-10-31), so the far end can be
 * tapped from the day they arrive. The desk often notes it later, so it also says which day they
 * left. That frees the room from then on, and the bill stays as booked (`bookingHalves`).
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
  const [day, setDay] = useState('')
  const [just, setJust] = useState<Door | null>(null)
  const stage = stayStage(booking, todayKey)
  const isIn = stage !== 'before'
  const isOut = stage === 'after'
  const hours = stayHoursOf(booking)
  const dayWord = (d: string) => (d === todayKey ? 'today' : fmtDay(d))
  const tick = <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
  const inTone = isIn ? 'done' : 'later'
  const outTone = isOut ? 'out' : 'later'
  // A short stay is stored as leaving the next day; it is its hours until the check-in is
  // noted, then the time it should leave (#7, the "Short Stay Out" mock, 2026-10-24).
  const shortOut = hours && !booking.actual_check_out ? shortStayOut(booking) : null
  const outWord = hours ? (shortOut ? 'Out by ' + clockLabel(shortOut) : hours + ' hrs from check-in') : 'Out ' + dayWord(booking.check_out)
  // The panel may stay open past that time, so it looks at the clock while it waits for it.
  const [now, setNow] = useState(() => Date.now())
  const waiting = !!shortOut && shortOut.getTime() > now
  useEffect(() => {
    if (!waiting) return
    const id = window.setInterval(() => setNow(Date.now()), 20000)
    return () => window.clearInterval(id)
  }, [waiting])
  const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() }
  const word = (k: Door) => (k === 'in' ? 'Checked in' : 'Checked out')

  // The days the guest can have left: from the day they came, up to their check-out day or today.
  const lastDay = todayKey < booking.check_out ? todayKey : booking.check_out
  const open = (k: Door) => {
    if (editing === k) return setEditing(null)
    const t = doorTime(booking, k, todayKey)
    const on = k === 'out' && !hours ? leftEarly(booking) || lastDay : doorDay(booking, k)
    setMins(t ? t.minutes : todayKey === on ? nowMins() : usualMinutes(k))
    setDay(on); setDir(0); setEditing(k)
  }
  const step = (by: number) => { setDir(by); setMins(m => (by > 0 ? Math.floor(m / 15) * 15 + 15 : Math.ceil(m / 15) * 15 - 15)) }
  const pick = (m: number) => { setDir(m < mins ? -1 : m > mins ? 1 : 0); setMins(m) }
  const save = (at: string | undefined) => { if (editing) { onDoor?.(editing, at); setJust(at ? editing : null) } setEditing(null) }

  const door = (k: Door, plain: React.ReactNode) => {
    // Both ends open the day the stay begins: a guest can leave before their check-out day.
    if (!onDoor || todayKey < booking.check_in) return plain
    const t = doorTime(booking, k, todayKey)
    // A short stay's end says when it should leave, and asks only once that time has come. A stay
    // not yet at its check-out day keeps its date, without the question: nothing is waiting to be noted.
    const shortWord = k === 'out' && hours && !t ? (!booking.actual_check_in ? outWord : waiting ? outWord : null)
      : k === 'out' && !t && todayKey < booking.check_out ? outWord : null
    const early = k === 'out' ? leftEarly(booking) : null
    return (
      <button type="button" onClick={() => open(k)} aria-expanded={editing === k}
        className={'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-bold whitespace-nowrap ' + PRESS +
          (t ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-card text-main shadow-[inset_0_0_0_1.5px_#D9D2C3] hover:shadow-[inset_0_0_0_1.5px_#1C1C1C]')}>
        {!t && !shortWord && (
          <span aria-hidden="true" className={'ask-mark w-4 h-4 rounded-full grid place-items-center text-white ' + (k === 'in' ? 'bg-emerald-600' : 'bg-ink-900') + ' font-display text-[11px] font-extrabold leading-none'}>?</span>
        )}
        {shortWord || word(k)}
        {early && ' ' + dayWord(early)}
        {t && <span key={t.minutes} className={'inline-block ' + (t.usual ? 'font-semibold text-muted' : 'text-main') + (just === k && !t.usual ? ' animate-pop' : '')}>{minutesLabel(t.minutes)}</span>}
      </button>
    )
  }

  const presets: [string, number][] = editing
    ? [['Usual', usualMinutes(editing)], ...(todayKey === day ? [['Now', nowMins()] as [string, number]] : [])]
    : []
  const picksDay = editing === 'out' && !hours && booking.check_in < lastDay
  const DAY_NAV = 'w-10 h-9 grid place-items-center rounded-[9px] text-main hover:bg-gold-100 disabled:opacity-30 disabled:cursor-default ' + PRESS
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
          <button type="button" onClick={() => save(doorIso(booking, editing, mins, editing === 'out' && !hours ? day : undefined))} aria-label={'Save ' + minutesLabel(mins)}
            className={'h-10 rounded-[9px] grid place-items-center bg-ink-900 text-white hover:bg-ink-700 ' + PRESS}>
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>
          <button type="button" onClick={() => setEditing(null)} aria-label="Not now"
            className={'h-10 rounded-lg grid place-items-center text-muted hover:text-main hover:bg-card ' + PRESS}>
            <X className="w-4 h-4" />
          </button>
          {picksDay && (
            <div role="group" aria-label="Day they left" className="col-span-full grid grid-cols-[40px_minmax(0,1fr)_40px] items-center rounded-[9px] bg-card">
              <button type="button" disabled={day <= booking.check_in} onClick={() => setDay(d => addDays(d, -1))} aria-label="A day earlier" className={DAY_NAV}><ChevronLeft className="w-4 h-4" /></button>
              <output aria-live="polite" className="text-center font-display text-[13px] font-bold text-main">{day === todayKey ? 'Today' : new Date(day + 'T12:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</output>
              <button type="button" disabled={day >= lastDay} onClick={() => setDay(d => addDays(d, 1))} aria-label="A day later" className={DAY_NAV}><ChevronRight className="w-4 h-4" /></button>
            </div>
          )}
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

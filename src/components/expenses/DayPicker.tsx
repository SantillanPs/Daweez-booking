import { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { dateToString } from '../../utils/helpers'

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const shift = (iso: string, days: number) => {
  const d = parse(iso)
  d.setDate(d.getDate() + days)
  return dateToString(d)
}
const pretty = (iso: string) => parse(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

const STEP = 'w-7 h-7 grid place-items-center rounded-lg text-muted hover:bg-card hover:text-main active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-[background-color,color,transform] cursor-pointer'

interface DayPickerProps {
  day: string
  today: string
  onPick: (day: string) => void
  /** Whether money came in and whether anything was spent on a day, for its dots. */
  marksOf: (day: string) => { moneyIn: boolean; spent: boolean }
}

// The day on Today's money (the owner's pick from the drawing, 2026-10-27): ‹ › step a day,
// and the date opens the month, where a green dot is a day money came in and a red one a day
// something was spent, so a day to look back at is found by sight. The browser's own date box
// showed none of that.
export function DayPicker({ day, today, onPick, marksOf }: DayPickerProps) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(day.slice(0, 7))
  const [turn, setTurn] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open])

  const go = (to: string) => { setOpen(false); if (to <= today) onPick(to) }

  const cells = useMemo(() => {
    if (!open) return []
    const [y, m] = month.split('-').map(Number)
    const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
    const days = new Date(y, m, 0).getDate()
    return [
      ...Array.from({ length: lead }, () => null),
      ...Array.from({ length: days }, (_, i) => {
        const iso = month + '-' + String(i + 1).padStart(2, '0')
        return { iso, n: i + 1, later: iso > today, ...marksOf(iso) }
      }),
    ]
  }, [open, month, today, marksOf])

  const turnMonth = (by: number) => {
    const [y, m] = month.split('-').map(Number)
    setMonth(dateToString(new Date(y, m - 1 + by, 1)).slice(0, 7))
    setTurn(by)
  }
  const [y, m] = month.split('-').map(Number)

  return (
    <div ref={box} className="relative flex items-center gap-0.5 -ml-1.5 mt-0.5">
      <button type="button" onClick={() => go(shift(day, -1))} aria-label="Day before" className={STEP}><ChevronLeft className="w-4 h-4" /></button>
      <button type="button" aria-haspopup="dialog" aria-expanded={open}
        onClick={() => { setMonth(day.slice(0, 7)); setTurn(0); setOpen(o => !o) }}
        className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-lg text-[13px] text-muted hover:bg-card hover:text-main aria-expanded:bg-card aria-expanded:text-main transition-colors cursor-pointer">
        <span key={day} className="inline-block [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">{pretty(day)}</span>
        <CalendarDays className="w-3.5 h-3.5 text-gold-500" />
      </button>
      <button type="button" onClick={() => go(shift(day, 1))} disabled={day >= today} aria-label="Next day" className={STEP}><ChevronRight className="w-4 h-4" /></button>
      {day !== today && (
        <button type="button" onClick={() => go(today)} className="ml-1 px-2.5 py-1 rounded-lg text-[12px] font-bold text-gold-700 hover:bg-gold-100 active:scale-95 transition-[background-color,transform] cursor-pointer [animation:bp-ready_.3s_cubic-bezier(.34,1.56,.64,1)]">
          Back to today
        </button>
      )}

      {open && (
        <div role="dialog" aria-label="Pick a day"
          className="absolute left-0 top-full mt-1.5 z-30 w-[272px] p-2.5 bg-card rounded-xl shadow-softLg ring-1 ring-gold-100 [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]">
          <div className="flex items-center justify-between mb-1">
            <button type="button" onClick={() => turnMonth(-1)} aria-label="Month before" className={STEP}><ChevronLeft className="w-4 h-4" /></button>
            <span key={month} className={'font-display text-[13px] font-bold text-main inline-block ' + (turn ? '[animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]' : '')}>
              {new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => turnMonth(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month" className={STEP}><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => (
              <span key={w} className="py-1 text-center text-[9.5px] font-extrabold tracking-[0.06em] text-muted">{w}</span>
            ))}
            {cells.map((c, i) => c === null ? <span key={'x' + i} /> : (
              <button key={c.iso} type="button" disabled={c.later} onClick={() => go(c.iso)}
                aria-pressed={c.iso === day} aria-label={pretty(c.iso)} style={{ '--i': c.n } as CSSProperties}
                className={'relative h-[34px] grid place-items-center rounded-lg text-[12.5px] active:scale-90 transition-[background-color,transform] cursor-pointer disabled:text-paper-400 disabled:cursor-default disabled:bg-transparent [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)_both] [animation-delay:calc(var(--i)*8ms)] ' +
                  (c.iso === day ? 'bg-gold-400 text-ink-900 font-extrabold' : 'text-main font-semibold hover:bg-gold-100') +
                  (c.iso === today && c.iso !== day ? ' ring-[1.5px] ring-inset ring-ink-900 font-extrabold' : '')}>
                {c.n}
                {!c.later && (c.moneyIn || c.spent) && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                    {c.moneyIn && <i className="w-1 h-1 rounded-full bg-emerald-600" />}
                    {c.spent && <i className="w-1 h-1 rounded-full bg-danger-600" />}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-soft text-[10.5px] text-muted">
            <span className="flex items-center gap-1">
              <i className="w-[5px] h-[5px] rounded-full bg-emerald-600" />Money in
              <i className="w-[5px] h-[5px] rounded-full bg-danger-600 ml-1.5" />Spent
            </span>
            {day !== today && (
              <button type="button" onClick={() => go(today)} className="px-2 py-1 rounded-lg text-[12px] font-bold text-gold-700 hover:bg-gold-100 cursor-pointer">Today</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

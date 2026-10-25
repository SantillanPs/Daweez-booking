import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays } from '../../utils/dailyLedger'
import { dateToString } from '../../utils/helpers'
import { PriceBox } from '../PriceBox'

/**
 * **Rooms on the bill** (the mock, Sebastian, 2026-10-24): the pieces that float over the
 * new-booking bill's room lines. A list or a month opens under what was tapped and never pushes
 * the bill ("like the calendar, this shouldn't make space in the billing when opened"); above it
 * when there is no room below. A tap anywhere else, or Esc, puts it away.
 */
export function Floating({ at, sheet, right, width, label, onClose, children }: {
  /** What it opens under, asked again each time it is placed: the line it belongs to may be drawn anew. */
  at: () => HTMLElement; sheet: HTMLElement; right?: boolean; width: number; label: string
  onClose: () => void; children: React.ReactNode
}) {
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; up: boolean } | null>(null)
  useLayoutEffect(() => {
    const place = () => {
      const el = box.current
      if (!el) return
      const a = at().getBoundingClientRect(), s = sheet.getBoundingClientRect(), h = el.offsetHeight
      const up = a.bottom + 6 + h > s.bottom - 8 && a.top - h - 6 > s.top + 8
      const left = Math.min(Math.max(8, (right ? a.right - width : a.left) - s.left), s.width - width - 8)
      setPos({ left, top: up ? a.top - s.top - h - 6 : a.bottom - s.top + 6, up })
    }
    place()
    addEventListener('resize', place)
    return () => removeEventListener('resize', place)
  }, [at, sheet, right, width, children])
  // Opened below the edge of the screen: the bill glides up just enough to show all of it.
  useEffect(() => { if (pos) box.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }, [!!pos]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const away = (e: PointerEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !at().contains(t)) onClose() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc, true)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true) }
  }, [at, onClose])
  return createPortal(
    <div ref={box} role="dialog" aria-label={label} data-screen
      style={{ width, '--x': (pos?.left ?? 0) + 'px', '--y': (pos?.top ?? 0) + 'px' } as React.CSSProperties}
      className={(pos ? '' : 'invisible ') + (pos?.up ? (right ? 'origin-bottom-right' : 'origin-bottom-left') : right ? 'origin-top-right' : 'origin-top-left') + ' left-[var(--x)] top-[var(--y)] br-float print:hidden absolute z-30 p-1.5 rounded-xl bg-card shadow-[0_14px_34px_-12px_rgba(60,45,15,0.32),inset_0_0_0_1.5px_#F5EAD1] max-h-80 overflow-y-auto'}>
      {children}
    </div>,
    sheet,
  )
}

const LI = 'w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-left text-[11.5px] font-semibold text-ink-900 whitespace-nowrap cursor-pointer hover:bg-gold-100 focus-visible:bg-gold-100 focus-visible:outline-none active:scale-[0.98] transition-[background-color,transform] bw-rise'
const AMT = 'ml-auto font-mono text-[10.5px] font-medium text-ink-700'
const peso = (n: number) => '₱' + Math.round(n).toLocaleString()

/** `taken`: the first night someone else has it on those dates ("10/29"), '' when free. */
export interface UnitOption { id: string; label: string; rate: number; count: number; diff: number; venue: boolean; taken: string }

/** Every room (then the venues) in order: what each costs and what the bill changes by; a taken one says so and still picks. */
export function UnitList({ options, adding, onPick }: { options: UnitOption[]; adding: boolean; onPick: (id: string) => void }) {
  const firstVenue = options.findIndex(o => o.venue)
  return (
    <>
      {options.map((o, i) => (
        <React.Fragment key={o.id}>
          {adding && i === firstVenue && <p className="px-2 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted">Venues</p>}
          <button type="button" onClick={() => onPick(o.id)} style={{ '--i': i } as React.CSSProperties} className={LI + (o.taken ? ' text-muted' : '')}>
            {o.label}
            {o.taken
              ? <span className="px-1.5 rounded border border-ink-200 text-[9.5px] font-bold text-muted">Taken {o.taken}</span>
              : <span className={'px-1.5 py-px rounded text-[9.5px] font-bold ' + (o.diff > 0 ? 'bg-gold-100 text-gold-800' : o.diff < 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-ink-100 text-muted')}>
                {o.diff === 0 ? 'Same price' : (o.diff > 0 ? '+' : '−') + peso(Math.abs(o.diff))}
              </span>}
            <span className={AMT + (o.taken ? ' !text-muted' : '')}>{peso(o.rate)} × {o.count}</span>
          </button>
        </React.Fragment>
      ))}
      {options.length === 0 && <p className="px-2 py-1.5 text-[10px] text-muted">Every room is on this bill.</p>}
    </>
  )
}

/** A venue's kinds, the one it is ticked ("make it more contextual": only the kind it is shows on the line). */
export function KindList({ kinds, chosen, onPick }: { kinds: { key: string; label: string; price: number }[]; chosen: string; onPick: (key: string) => void }) {
  return (
    <div role="radiogroup">
      {kinds.map((k, i) => (
        <button key={k.key} type="button" role="radio" aria-checked={k.key === chosen} onClick={() => onPick(k.key)} style={{ '--i': i } as React.CSSProperties} className={LI + ' group'}>
          {k.label}<span className={AMT}>{peso(k.price)} a day</span>
          <span aria-hidden="true" className="w-3.5 text-center opacity-0 scale-50 group-aria-checked:opacity-100 group-aria-checked:scale-100 transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]">✓</span>
        </button>
      ))}
    </div>
  )
}

/**
 * Breakfast is one line for the whole bill (Sebastian, 2026-10-24: "if theres more than 1 room with
 * breakfast, just merge them in this one row"); its name opens a switch for each room ("more like a
 * drop down and toggle"). A room with no breakfast price asks for one first.
 */
export function BreakfastList({ rows, pricing, onToggle, onPrice, onPriced }: {
  rows: { id: string; label: string; price: number | null; count: number; on: boolean }[]
  pricing: string | null
  onToggle: (id: string) => void
  onPrice: (id: string | null) => void
  onPriced: (id: string, price: number) => void
}) {
  return (
    <>
      {rows.map((r, i) => pricing === r.id ? (
        <div key={r.id} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-gold-100 text-[11.5px] font-semibold text-ink-900 bw-rise">
          {r.label}
          <PriceBox className="ml-auto h-7 text-[12px]" label={null} onBack={() => onPrice(null)} onSave={p => onPriced(r.id, p)} />
        </div>
      ) : (
        <button key={r.id} type="button" role="switch" aria-checked={r.on} style={{ '--i': i } as React.CSSProperties}
          onClick={() => (r.price === null && !r.on ? onPrice(r.id) : onToggle(r.id))} className={LI}>
          {r.label}
          <span className={AMT + ' mr-1'}>{r.price === null ? 'Set price' : peso(r.price) + ' × ' + r.count}</span>
          <span aria-hidden="true" className="br-sw" />
        </button>
      ))}
    </>
  )
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * A month under the date tapped (Sebastian, 2026-10-24: "show a calendar to make it easier"). A new
 * check-in moves the stay and its nights come along; a new check-out changes the nights. A night
 * someone else has is struck through and refuses with a shake.
 */
export function MonthPick({ end, checkIn, checkOut, free, taken, onPick }: {
  end: 'in' | 'out'; checkIn: string; checkOut: string
  free: (from: string, to: string) => boolean
  /** Said over the month when someone else has these dates: they show gold until they move. */
  taken?: string
  onPick: (checkIn: string, checkOut: string) => void
}) {
  const [month, setMonth] = useState((end === 'in' ? checkIn : checkOut).slice(0, 7))
  const [y, m] = month.split('-').map(Number)
  const lead = new Date(y, m - 1, 1).getDay(), len = new Date(y, m, 0).getDate()
  const today = dateToString(new Date())
  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  const step = (k: number) => { const t = new Date(y, m - 1 + k, 1); setMonth(dateToString(t).slice(0, 7)) }
  const nope = (el: HTMLElement) => { el.classList.remove('bw-nope'); void el.offsetWidth; el.classList.add('bw-nope') }
  const tap = (d: string, el: HTMLElement) => {
    if (end === 'in') {
      if (!free(d, addDays(d, nights))) return nope(el)
      onPick(d, addDays(d, nights))
    } else {
      if (d <= checkIn || !free(checkIn, d)) return nope(el)
      onPick(checkIn, d)
    }
  }
  const NAV = 'w-[26px] h-[26px] grid place-items-center rounded-lg text-ink-700 hover:bg-gold-100 active:scale-90 transition cursor-pointer'
  return (
    <div className="p-1">
      <div className="flex items-center justify-between mb-1.5 font-display text-[12px] font-bold text-ink-900">
        <button type="button" onClick={() => step(-1)} aria-label="Previous month" className={NAV}><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span>{end === 'in' ? 'Check in' : 'Check out'} · {MONTHS[m - 1]} {y}</span>
        <button type="button" onClick={() => step(1)} aria-label="Next month" className={NAV}><ChevronRight className="w-3.5 h-3.5" /></button>
      </div>
      {taken && <p className="mb-1 px-1 text-[10px] font-semibold text-gold-800 bw-rise">{taken}</p>}
      <div className="grid grid-cols-7 text-center text-[9px] font-bold text-muted pb-0.5">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
      <div className="grid grid-cols-7">
        {Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
        {Array.from({ length: len }, (_, i) => {
          const d = month + '-' + String(i + 1).padStart(2, '0')
          const sold = !free(d, addDays(d, 1)) && !(d >= checkIn && d < checkOut)
          const stay = d >= checkIn && d < checkOut
          const edge = taken ? 'bg-gold-500 text-white' : 'bg-ink-900 text-white'
          const tone = d === checkIn ? edge + ' rounded-l-lg' : d === checkOut ? edge + ' rounded-r-lg' : stay ? 'bg-gold-100' : 'hover:bg-gold-100 hover:rounded-lg'
          return (
            <button key={d} type="button" onClick={e => tap(d, e.currentTarget)} aria-label={MONTHS[m - 1] + ' ' + (i + 1) + (sold ? ', taken' : '')}
              className={'h-[30px] grid place-items-center text-[11.5px] font-semibold active:scale-90 transition-[background-color,transform] ' + tone +
                (sold ? ' text-muted line-through cursor-not-allowed' : ' cursor-pointer') + (d === today ? ' shadow-[inset_0_-2px_0_#D0AB60]' : '')}>
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { addDays, parseDay } from '../../utils/dailyLedger'
import { dateToString } from '../../utils/helpers'
import { BillMove } from './BillDesk'

const nope = (el: HTMLElement) => { el.classList.remove('bw-nope'); void el.offsetWidth; el.classList.add('bw-nope') }
const nightsBetween = (a: string, b: string) => Math.round((parseDay(b).getTime() - parseDay(a).getTime()) / 86400000)

/**
 * **Two weeks under the stay's dates** (the reschedule mock's "A · Tap a date", Sebastian,
 * 2026-10-22). Opened by tapping Check in or Check out on the bill.
 *
 * A new check-in moves the whole stay and its nights come along — fewer when they do not all
 * fit before the next guest. A new check-out changes the nights. A night someone else has is
 * struck through and refuses with a shake. Each tap saves at once; Undo is under the charges.
 */
export function DayStrip({ move, end, onClose }: { move: BillMove; end: 'in' | 'out'; onClose: () => void }) {
  const today = dateToString(new Date())
  const [from, setFrom] = useState(() => {
    const d = addDays(move.checkIn, -3)
    return d < today ? today : d
  })
  const days = Array.from({ length: 14 }, (_, i) => addDays(from, i))
  const sold = (d: string) => !move.free(move.unitId, d, addDays(d, 1))

  const tap = (d: string, el: HTMLElement) => {
    if (end === 'in') {
      if (sold(d)) return nope(el)
      let n = nightsBetween(move.checkIn, move.checkOut)
      while (n > 1 && !move.free(move.unitId, d, addDays(d, n))) n--
      if (d === move.checkIn && n === nightsBetween(move.checkIn, move.checkOut)) return onClose()
      move.onMove(move.unitId, d, addDays(d, n))
    } else {
      if (d <= move.checkIn || !move.free(move.unitId, move.checkIn, d)) return nope(el)
      if (d !== move.checkOut) move.onMove(move.unitId, move.checkIn, d)
    }
    onClose()
  }

  const PAGE = 'w-7 h-7 grid place-items-center rounded-md text-muted hover:text-main hover:bg-card active:scale-90 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed'
  return (
    <div data-screen className="print:hidden mt-2 p-1.5 rounded-lg bg-paper-50 bw-unfold">
      <div className="flex items-center gap-1 mb-1 px-0.5">
        <span className="text-[10.5px] font-bold text-ink-900 mr-auto">{end === 'in' ? 'New check-in day' : 'New check-out day'}</span>
        <button type="button" onClick={() => setFrom(f => { const d = addDays(f, -7); return d < today ? today : d })} disabled={from <= today} aria-label="Earlier days" className={PAGE}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={() => setFrom(f => addDays(f, 7))} aria-label="Later days" className={PAGE}>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close" className={PAGE}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-[3px]">
        {days.map((d, i) => {
          const date = parseDay(d)
          const taken = sold(d)
          const inStay = d >= move.checkIn && d < move.checkOut
          const edge = end === 'in' ? d === move.checkIn : d === move.checkOut
          const tone = edge ? 'bg-gold-400 text-ink-900'
            : taken ? 'bg-[repeating-linear-gradient(135deg,#F0F0F0_0_4px,#FFFFFF_4px_8px)] text-ink-400 cursor-not-allowed'
            : inStay ? 'bg-gold-100 text-ink-900'
            : d === move.checkOut ? 'bg-card text-ink-900 shadow-[inset_0_0_0_1.5px_#D0AB60]'
            : 'bg-card text-ink-900 hover:bg-gold-100'
          return (
            <button key={d} type="button" onClick={e => tap(d, e.currentTarget)} aria-label={date.toDateString() + (taken ? ', taken' : '')}
              style={{ '--i': i } as React.CSSProperties}
              className={'relative min-h-10 rounded-md flex flex-col items-center justify-center leading-tight transition-[background-color,transform] active:scale-90 cursor-pointer bw-rise ' + tone}>
              <span className={'text-[9px] font-semibold ' + (edge ? 'text-ink-900' : 'text-muted')}>{date.toLocaleDateString('en-US', { weekday: 'short' }).slice(0, 2)}</span>
              <span className={'font-display text-[13px] font-bold ' + (taken ? 'line-through' : '')}>{date.getDate()}</span>
              {inStay && !edge && <span aria-hidden="true" className="absolute left-1.5 right-1.5 bottom-1 h-[3px] rounded-full bg-gold-400" />}
              {date.getDate() === 1 && <span className="absolute top-0.5 right-1 text-[7.5px] font-bold text-gold-800">{date.toLocaleDateString('en-US', { month: 'short' })}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

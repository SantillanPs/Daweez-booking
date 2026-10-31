import React, { useEffect, useRef, useState } from 'react'
import { Check, Clock, Coffee, Minus } from 'lucide-react'
import { BreakfastPlan } from '../../types/booking'
import { getBreakfastMenu } from '../../utils/rateConfig'
import { USUAL_BREAKFAST } from '../../utils/breakfastChoice'
import { minutesLabel } from '../../utils/doorTimes'

const PRESS = 'cursor-pointer transition-[background-color,transform] duration-200 active:scale-95'
const CHIP = 'inline-flex items-center h-[30px] px-2.5 rounded-lg text-[12px] font-bold text-main shadow-[inset_0_0_0_1px_rgba(28,28,28,0.14)] whitespace-nowrap hover:bg-gold-100 ' + PRESS

/**
 * **It reads like the restaurant's menu** (Sebastian, 2026-10-08, pointing at the menu board): the
 * dish on the left, a dotted line, and where the price would be, HOW MANY. The whole line is the
 * tap — one tap, one more plate — as on the menu (`MenuPicker`). It used to be six boxes, each
 * with a minus, a number and a plus. **The number is the way back**: tapping it takes one off, and
 * under a mouse it turns into a minus sign to say so. The window and the bill's pop-up share it.
 */
export function DishRows({ counts, moved, small, disabled, onBump }: {
  counts: Record<string, number>
  /** Which way each number last moved, so it comes in from the right side. */
  moved: Record<string, 1 | -1>
  small?: boolean
  disabled?: boolean
  onBump: (name: string, by: 1 | -1) => void
}) {
  const menu = getBreakfastMenu()
  if (menu.length === 0) return <p className="text-[13px] text-muted p-2">The breakfast menu is empty — add items in Settings.</p>
  return (
    <>
      {menu.map((item, i) => {
        const qty = counts[item.name] || 0
        const dir = moved[item.name]
        return (
          <div key={item.name} style={{ '--i': i } as React.CSSProperties}
            className={'bp-row flex items-center rounded-lg transition-colors duration-300 ' + (qty > 0 ? 'bg-gold-100' : 'hover:bg-paper-100')}>
            <button type="button" onClick={() => onBump(item.name, 1)} disabled={disabled} aria-label={'One more ' + item.name}
              className={'flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2.5 pr-0.5 text-left cursor-pointer active:scale-[0.985] transition-transform duration-200 ' + (small ? 'min-h-[40px]' : 'min-h-[48px]')}>
              <span key={qty} className={'font-bold text-main ' + (small ? 'text-[14px] ' : 'text-[15px] ') + (dir === 1 ? 'bp-nudge' : '')}>{item.name}</span>
              <span className="flex-1 border-b border-dotted border-paper-400" />
            </button>
            {qty > 0 ? (
              <button type="button" onClick={() => onBump(item.name, -1)} disabled={disabled}
                title="Tap to take one off" aria-label={qty + ' ' + item.name + '. Tap to take one off'}
                className="group/less relative mr-1.5 h-9 w-9 shrink-0 rounded-full text-main cursor-pointer transition-[background-color,transform] duration-200 hover:bg-card active:scale-90">
                <span className="absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/less:opacity-0 group-hover/less:scale-50">
                  <span key={qty} className={'font-display text-[15px] font-bold tabular-nums ' + (dir === 1 ? 'bp-up' : dir === -1 ? 'bp-down' : '')}>{qty}</span>
                </span>
                <span className="absolute inset-0 flex items-center justify-center opacity-0 -rotate-90 scale-50 transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-hover/less:opacity-100 group-hover/less:rotate-0 group-hover/less:scale-100">
                  <Minus className="w-4 h-4" strokeWidth={2.6} />
                </span>
              </button>
            ) : (
              <span className="mr-1.5 flex h-9 w-9 shrink-0 items-center justify-center font-display text-[15px] font-bold tabular-nums text-ink-300">
                <span key={dir || 0} className={dir === -1 ? 'bp-down' : ''}>0</span>
              </span>
            )}
          </div>
        )
      })}
    </>
  )
}

/** The door's time, stepped by 15 minutes and never typed. `?` until it is set; the first press gives 8 AM. */
export function TimeStepper({ minutes, onChange }: { minutes: number | undefined; onChange: (m: number) => void }) {
  const [dir, setDir] = useState(0)
  const step = (by: number) => { setDir(by); onChange(minutes == null ? USUAL_BREAKFAST : minutes + by) }
  const BTN = 'h-full rounded-[9px] font-display text-[17px] font-bold text-main hover:bg-gold-100 ' + PRESS
  return (
    <div role="group" aria-label="Time" className={'grid grid-cols-[38px_minmax(0,1fr)_38px] items-center h-10 rounded-[9px] bg-card ' + (minutes == null ? 'shadow-[inset_0_0_0_1.5px_#D9D0BC]' : 'shadow-[inset_0_0_0_1.5px_#1C1C1C]')}>
      <button type="button" onClick={() => step(-15)} aria-label="15 minutes earlier" className={BTN}>−</button>
      <output aria-live="polite" className="block h-5 overflow-hidden text-center font-display text-[14px] leading-5 font-bold text-main tabular-nums whitespace-nowrap">
        {minutes == null
          ? <span className="inline-grid w-4 h-4 place-items-center rounded-full bg-ink-900 text-white text-[11px] font-extrabold leading-none">?</span>
          : <span key={minutes} className={'block ' + (dir > 0 ? 'animate-time-up' : dir < 0 ? 'animate-time-down' : '')}>{minutesLabel(minutes)}</span>}
      </output>
      <button type="button" onClick={() => step(15)} aria-label="15 minutes later" className={BTN}>+</button>
    </div>
  )
}

/** "Usual" brings the time back to 8 AM, and is gone while it is there already. */
export function UsualChip({ minutes, onUsual }: { minutes: number | undefined; onUsual: () => void }) {
  if (minutes === USUAL_BREAKFAST) return <span />
  return <button type="button" onClick={onUsual} className={CHIP}>Usual</button>
}

const planWords = (items: BreakfastPlan['items']) => items.filter(i => i.qty > 0).map(i => i.qty + ' ' + i.name).join(', ')

/**
 * **Under a room's breakfast switch, for when they want to talk about it** (Sebastian, 2026-11-01:
 * "if the staff or guests want to talk about the breakfast, they should be able to choose to open
 * the menu and set the time when they want or need to"; "This should be with the pop up. not
 * outside it"). Neither is ever asked for, and the bill itself shows only its Breakfast line.
 */
export function BreakfastPlanLinks({ plan, others, onChange }: {
  plan: BreakfastPlan | undefined
  /** The other rooms on this bill that have food chosen. */
  others: { name: string; items: BreakfastPlan['items'] }[]
  onChange: (plan: BreakfastPlan) => void
}) {
  const [part, setPart] = useState<'food' | 'time' | null>(null)
  const [moved, setMoved] = useState<Record<string, 1 | -1>>({})
  // Unfolded below the edge of the screen, the bill glides up just enough to show it, as `Floating` does.
  const unfolded = useRef<HTMLDivElement>(null)
  useEffect(() => { if (part) unfolded.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }) }, [part])
  const items = plan?.items || []
  const time = plan?.time
  const counts = Object.fromEntries(items.map(i => [i.name, i.qty]))
  const has = items.length > 0
  const bump = (name: string, by: 1 | -1) => {
    const qty = Math.max(0, (counts[name] || 0) + by)
    const next = counts[name] ? items.map(i => (i.name === name ? { ...i, qty } : i)) : [...items, { name, qty }]
    onChange({ ...plan, items: next.filter(i => i.qty > 0) })
    setMoved(m => ({ ...m, [name]: by }))
  }
  const setTime = (m: number) => onChange({ items, time: m })
  const LINK = 'inline-flex items-center gap-1.5 min-h-6 min-w-0 border-b-[1.5px] border-dashed text-[12px] hover:bg-gold-100 aria-expanded:bg-gold-100 aria-expanded:border-solid ' + PRESS + ' '
  const SET = 'border-gold-400 font-semibold text-gold-800'
  const UNSET = 'border-paper-400 font-bold text-muted'
  const done = (
    <button type="button" onClick={() => setPart(null)} aria-label="Done" className={'w-10 h-10 shrink-0 rounded-[9px] grid place-items-center bg-ink-900 text-white hover:bg-ink-700 ' + PRESS}>
      <Check className="w-4 h-4" strokeWidth={3} />
    </button>
  )
  return (
    <div className="pb-1.5 border-b border-dotted border-ink-200 last:border-b-0">
      <div className="bw-rise flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-1">
        <button type="button" aria-expanded={part === 'food'} onClick={() => setPart(p => (p === 'food' ? null : 'food'))} className={LINK + (has ? SET : UNSET)}>
          <Coffee aria-hidden="true" className="w-[13px] h-[13px] shrink-0" /><span className="truncate max-w-[210px]">{has ? planWords(items) : 'Menu'}</span>
        </button>
        <button type="button" aria-expanded={part === 'time'} onClick={() => setPart(p => (p === 'time' ? null : 'time'))} className={LINK + (time != null ? SET : UNSET)}>
          <Clock aria-hidden="true" className="w-[13px] h-[13px] shrink-0" />{time != null ? minutesLabel(time) : 'Time'}
        </button>
      </div>
      {part === 'food' && (
        <div ref={unfolded} className="bw-unfold mx-1 p-1 rounded-[10px] bg-page">
          {!has && others.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-1 pb-1">
              {others.map(o => (
                <button key={o.name} type="button" onClick={() => onChange({ ...plan, items: o.items })} className={CHIP}>Same as {o.name}</button>
              ))}
            </div>
          )}
          <DishRows small counts={counts} moved={moved} onBump={bump} />
          <div className="flex justify-end pt-1">{done}</div>
        </div>
      )}
      {part === 'time' && (
        <div ref={unfolded} className="bw-unfold mx-1 p-1 rounded-[10px] bg-page grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5">
          <TimeStepper minutes={time} onChange={setTime} />
          <UsualChip minutes={time} onUsual={() => setTime(USUAL_BREAKFAST)} />
          {done}
        </div>
      )}
    </div>
  )
}

/** The cup on a room with a morning still to confirm: it asks, with the same small `?` as the door. */
export function AskCup({ small }: { small?: boolean }) {
  return (
    <span className="relative inline-flex">
      <Coffee aria-hidden="true" className={small ? 'w-4 h-4' : 'w-5 h-5'} />
      <span aria-hidden="true" className="ask-mark absolute -right-1.5 -top-1.5 grid w-[13px] h-[13px] place-items-center rounded-full bg-ink-900 text-white font-display text-[9px] font-extrabold leading-none">?</span>
    </span>
  )
}

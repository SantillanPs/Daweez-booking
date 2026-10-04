import React from 'react'
import { ChefHat, Minus, Plus, Printer, Trash2 } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { newCount } from '../../utils/orderSlips'
import { AnimatedNumber } from '../AnimatedNumber'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface TabBillProps {
  lines: TabLine[]
  /** What the slip comes to. */
  total: number
  busy?: boolean
  /** One more or one fewer of a row. One fewer of a single serving removes the row. */
  onQty: (line: TabLine, delta: 1 | -1) => void
  /** What to say when nothing is on the slip yet. */
  emptyText: string
  /** The kitchen's copy: what to cook, with what is new since the last print marked. */
  onPrintKitchen: () => void
  /** The guest's copy, with prices. */
  onPrintGuest: () => void
}

// What is on the order slip right now: one row per dish with its count, the total, and
// the two papers it prints (the staff's feedback, 2026-10-04).
//
// The count is changed on the row itself — − and + — because the staff asked for `2 ×`
// rather than a second row. A single serving shows a bin where the − would be: taking
// the last one off removes the row, and that asks first.
export function TabBill({ lines, total, busy = false, onQty, emptyText, onPrintKitchen, onPrintGuest }: TabBillProps) {
  if (lines.length === 0) {
    return <p className="text-[14px] text-muted">{emptyText}</p>
  }

  const toSend = lines.reduce((n, l) => n + newCount(l), 0)
  const step = 'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-soft text-main transition-[background-color,border-color,color,transform] duration-200 active:scale-95 cursor-pointer disabled:opacity-40 '
  const stepHover = 'hover:border-gold-400 hover:bg-gold-100'
  const binHover = 'hover:border-danger-400 hover:bg-danger-50 hover:text-danger-600'

  return (
    <>
      <ul className="divide-y divide-soft border-y border-soft">
        {lines.map(line => {
          const qty = Number(line.qty || 1)
          const fresh = newCount(line)
          return (
            <li key={line.id} className="py-2 flex items-center gap-2 animate-in fade-in slide-in-from-left-1 duration-200 motion-reduce:animate-none">
              <button type="button" onClick={() => onQty(line, -1)} disabled={busy}
                aria-label={qty > 1 ? 'One fewer ' + line.description : 'Remove ' + line.description}
                title={qty > 1 ? 'One fewer' : 'Remove'}
                className={step + (qty > 1 ? stepHover : binHover)}>
                {qty > 1 ? <Minus className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              </button>
              <span className="w-6 shrink-0 text-center text-[15px] font-bold tabular-nums text-main">{qty}</span>
              <button type="button" onClick={() => onQty(line, 1)} disabled={busy}
                aria-label={'One more ' + line.description} title="One more" className={step + stepHover}>
                <Plus className="w-4 h-4" />
              </button>
              <span className="min-w-0 flex-1 pl-1">
                <span className="block text-[14px] font-semibold text-main break-words">{line.description}</span>
                <span className="block text-[13px] text-muted tabular-nums">
                  {fmtPeso(line.unit_price)} each
                  {fresh > 0 && <span className="font-semibold text-gold-800"> · {fresh} new</span>}
                </span>
              </span>
              <span className="shrink-0 text-[15px] font-bold tabular-nums text-main">{fmtPeso(line.amount)}</span>
            </li>
          )
        })}
      </ul>

      {/* The total follows the slip as it changes, so the desk sees it move. */}
      <div className="flex items-baseline justify-between gap-2 mt-3">
        <span className="text-[14px] font-medium text-muted">Total</span>
        <span className="font-display text-[26px] leading-none font-extrabold tracking-tight tabular-nums text-main">
          <AnimatedNumber value={total} duration={300} prefix="₱" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {/* The kitchen's copy is the loud one while something on the slip has not been
            given to the kitchen yet; once it has, both are plain reprints. */}
        <button type="button" onClick={onPrintKitchen}
          className={'min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[14px] font-bold transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer ' +
            (toSend > 0 ? 'bg-gold-400 hover:bg-gold-600 text-ink-900' : 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
          <ChefHat className="w-4 h-4" /> Kitchen copy{toSend > 0 ? ' · ' + toSend + ' new' : ''}
        </button>
        <button type="button" onClick={onPrintGuest}
          className="min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[14px] font-bold bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100 transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer">
          <Printer className="w-4 h-4" /> Guest copy
        </button>
      </div>
    </>
  )
}

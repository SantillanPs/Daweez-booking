import React from 'react'
import { ChefHat, Minus, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { TabLine } from '../../types/tab'
import { newCount } from '../../utils/orderSlips'

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
  /** The guest has finished or asked for the bill: prints it, with prices. */
  onBillOut: () => void
  /** The bill has already been printed once, so the button reprints it. */
  billed?: boolean
}

// What is on the order slip right now: one row per dish with its count, the total, and
// its two steps — the kitchen's copy, and Bill out once the guest has finished or asks
// for the bill (the owner's ruling, 2026-10-04: no separate guest copy).
//
// The count is changed on the row itself — − and + — because the staff asked for `2 ×`
// rather than a second row. A single serving shows a bin where the − would be: taking
// the last one off removes the row, and that asks first.
export function TabBill({ lines, total, busy = false, onQty, emptyText, onPrintKitchen, onBillOut, billed = false }: TabBillProps) {
  if (lines.length === 0) {
    return <p className="text-[13px] text-muted">{emptyText}</p>
  }

  const toSend = lines.reduce((n, l) => n + newCount(l), 0)
  const step = 'w-10 h-10 shrink-0 inline-flex items-center justify-center rounded-lg border border-soft text-main transition-colors cursor-pointer disabled:opacity-40 '
  const stepHover = 'hover:border-gold-400 hover:bg-gold-100'
  const binHover = 'hover:border-danger-400 hover:bg-danger-50 hover:text-danger-600'

  return (
    <>
      <ul className="divide-y divide-soft border-y border-soft">
        {lines.map(line => {
          const qty = Number(line.qty || 1)
          const fresh = newCount(line)
          return (
            <li key={line.id} className="py-2 flex items-center gap-2">
              <button type="button" onClick={() => onQty(line, -1)} disabled={busy}
                aria-label={qty > 1 ? 'One fewer ' + line.description : 'Remove ' + line.description}
                title={qty > 1 ? 'One fewer' : 'Remove'}
                className={step + (qty > 1 ? stepHover : binHover)}>
                {qty > 1 ? <Minus className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
              </button>
              <span className="w-6 shrink-0 text-center text-[15px] font-bold text-main">{qty}</span>
              <button type="button" onClick={() => onQty(line, 1)} disabled={busy}
                aria-label={'One more ' + line.description} title="One more" className={step + stepHover}>
                <Plus className="w-4 h-4" />
              </button>
              <span className="min-w-0 flex-1 pl-1">
                <span className="block text-[13.5px] font-semibold text-main break-words">{line.description}</span>
                <span className="block text-[12px] text-muted">
                  {fmtPeso(line.unit_price)} each
                  {fresh > 0 && <span className="font-semibold text-gold-800"> · {fresh} new</span>}
                </span>
              </span>
              <span className="shrink-0 text-[14px] font-bold text-main">{fmtPeso(line.amount)}</span>
            </li>
          )
        })}
      </ul>

      <div className="flex items-baseline justify-between gap-2 mt-3">
        <span className="text-[13px] font-bold text-main">Total</span>
        <span className="font-display text-[20px] font-extrabold text-ink-900">{fmtPeso(total)}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-3">
        {/* The kitchen's copy is the loud one while something on the slip has not been
            given to the kitchen yet; once it has, both are plain reprints. */}
        <button type="button" onClick={onPrintKitchen}
          className={'min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[13px] font-bold transition-colors cursor-pointer ' +
            (toSend > 0 ? 'bg-gold-400 hover:bg-gold-600 text-ink-900' : 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
          <ChefHat className="w-4 h-4" /> Kitchen copy{toSend > 0 ? ' · ' + toSend + ' new' : ''}
        </button>
        {/* Bill out waits until the kitchen has every order: a room guest's slip goes to
            the front desk on it, and an order still on screen would never be cooked. */}
        <button type="button" onClick={onBillOut} disabled={toSend > 0}
          title={toSend > 0 ? 'Send the new orders to the kitchen first' : undefined}
          className={'min-h-11 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg text-[13px] font-bold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ' +
            (toSend > 0 || billed ? 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100' : 'bg-gold-400 hover:bg-gold-600 text-ink-900')}>
          <ReceiptText className="w-4 h-4" /> {billed ? 'Bill again' : 'Bill out'}
        </button>
      </div>
    </>
  )
}

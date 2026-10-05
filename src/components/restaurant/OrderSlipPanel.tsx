import React from 'react'
import { Receipt, X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { Served } from './ServedStrip'
import { TabBill } from './TabBill'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface OrderSlipPanelProps {
  person: Served
  /** `OS-0005`, or nothing before the slip's first order is saved. */
  number: string
  lines: TabLine[]
  total: number
  /** The person's slips that are already closed — paid, or left with the stay. */
  earlier: OrderSlip[]
  /** What went wrong, when something did. */
  errors: string[]
  /** True while an order is on its way to the kitchen, or being marked as served. */
  working: boolean
  onClose: () => void
  onQty: (line: TabLine, delta: 1 | -1) => void
  onSendKitchen: () => void
  onServed: () => void
  /** The guest has finished, or asks for the bill: it leaves the restaurant. */
  onBill: () => void
  /** A diner who sat down and ordered nothing: the empty slip is taken off the strip. */
  onDropEmpty: (tab: Tab) => void
}

// One person's order slip: who it is for, what is on it, and what happens next.
//
// The same slip is shown in two places, so it is written once: beside the menu when the
// screen has room for both (a PC, a tablet held sideways), and in the sheet that slides up
// from the order bar when it does not (a phone, a tablet held upright).
//
// It hands back the pieces of a column, not a box: whoever shows it gives the column its
// height, and only the rows give way and scroll — the total and its buttons never move.
export function OrderSlipPanel({
  person, number, lines, total, earlier, errors, working,
  onClose, onQty, onSendKitchen, onServed, onBill, onDropEmpty,
}: OrderSlipPanelProps) {
  return (
    <>
      <div className="shrink-0 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-display text-[19px] font-bold tracking-tight text-main leading-tight">
            {number ? 'Order slip ' + number : 'New order slip'}
          </h3>
          <p className="text-[14px] text-muted mt-1">
            {person.name}{person.place ? ' · ' + person.place : ''}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close this order slip" title="Close"
          className="w-11 h-11 -mr-2.5 -mt-2.5 inline-flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      <TabBill
        lines={lines}
        total={total}
        working={working}
        onQty={onQty}
        onSendKitchen={onSendKitchen}
        onServed={onServed}
        emptyText="Nothing ordered yet."
      />
      {errors.filter(Boolean).map(text => (
        <p key={text} role="alert" className="shrink-0 text-[13px] font-medium text-danger-600">{text}</p>
      ))}

      {/* Nobody pays here, and nothing is printed here. Once the guest has finished, or asks
          for the bill, it leaves the restaurant (Sebastian, 2026-10-05): a table's bill is
          asked where it goes — the front desk, or a room — and a slip that was started
          for a room goes onto that room. */}
      {lines.length > 0 && (
        <button type="button" onClick={onBill} disabled={working}
          className="shrink-0 w-full min-h-12 inline-flex items-center justify-center gap-1.5 px-3 rounded-lg border border-soft bg-card text-[14px] font-bold text-main hover:border-gold-400 hover:bg-gold-100 transition-colors duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:pointer-events-none">
          <Receipt className="w-4 h-4 shrink-0" /> {person.booking ? 'Add to ' + person.place + '’s bill' : 'Send bill'}
        </button>
      )}
      {!person.booking && person.tab && lines.length === 0 && (
        <button type="button" onClick={() => onDropEmpty(person.tab as Tab)}
          className="shrink-0 self-start min-h-11 text-[14px] font-semibold text-muted hover:text-danger-600 transition-colors cursor-pointer">
          Remove this order slip
        </button>
      )}

      {earlier.length > 0 && (
        <div className="shrink-0 pt-4 border-t border-soft">
          <p className="text-[13px] font-medium text-muted mb-1">Earlier order slips</p>
          <ul className="text-[14px]">
            {earlier.map(s => (
              <li key={s.tab.id} className="flex items-baseline justify-between gap-3 py-1">
                <span className="font-semibold text-main">{slipNumber(s.tab)}</span>
                <span className="flex items-baseline gap-3">
                  <span className="tabular-nums text-main">{fmtPeso(s.total)}</span>
                  <span className={'w-16 text-right font-semibold ' + (s.paid ? 'text-emerald-700' : 'text-danger-600')}>
                    {s.paid ? 'Paid' : 'Not paid'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

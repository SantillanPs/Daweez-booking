import React from 'react'
import { X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { Served } from './served'
import { TabBill } from './TabBill'
import { TableButton } from './TablesPopup'

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
  /** Dishes cooked and waiting to be carried out, on any table. */
  ready: number
  /** True while the tables are open. */
  tablesOpen: boolean
  /** Opens the tables, hung from the slip's title. */
  onTables: (at: DOMRect) => void
  onClose: () => void
  onQty: (line: TabLine, delta: 1 | -1) => void
  onSendKitchen: () => Promise<boolean>
  onServeLine: (line: TabLine) => void
  /** The guest has finished, or asks for the bill: it leaves the restaurant. */
  onBill: (at: DOMRect) => void
  /** A diner who sat down and ordered nothing: the empty slip is taken off the screen. */
  onDropEmpty: (tab: Tab) => void
}

// One person's order slip: who it is for, what is on it, and what happens next.
//
// The same slip is shown in two places, so it is written once: beside the menu when the
// screen has room for both (a PC, a tablet held sideways), and in the sheet that slides up
// from the order bar when it does not (a phone, a tablet held upright).
//
// **Its title is the way to the other tables** (`TableButton`): the line of tables that
// stood across the top of the screen is put away behind it (Sebastian, 2026-10-08).
//
// It hands back the pieces of a column, not a box: whoever shows it gives the column its
// height, and only the rows give way and scroll — the total and its buttons never move.
export function OrderSlipPanel({
  person, number, lines, total, earlier, errors, working, ready, tablesOpen,
  onTables, onClose, onQty, onSendKitchen, onServeLine, onBill, onDropEmpty,
}: OrderSlipPanelProps) {
  return (
    <>
      <div className="shrink-0 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <TableButton label={person.name} ready={ready} open={tablesOpen} onOpen={onTables} />
          <p className="text-[13px] text-muted tabular-nums">
            {[person.place, number].filter(Boolean).join(' · ') || 'New order slip'}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close this order slip" title="Close"
          className="w-11 h-11 -mr-2.5 -mt-1 inline-flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer shrink-0">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nobody pays here, and nothing is printed here. Once the guest has finished, or asks
          for the bill, it leaves the restaurant (Sebastian, 2026-10-05): a table's bill is
          asked where it goes — the front desk, or a room — and a slip that was started
          for a room goes onto that room. */}
      <TabBill
        lines={lines}
        total={total}
        working={working}
        onQty={onQty}
        onSendKitchen={onSendKitchen}
        onServeLine={onServeLine}
        onBill={onBill}
        billLabel={person.booking ? 'Add to ' + person.place + '’s bill' : 'Send bill'}
        emptyText="Tap a dish on the menu"
      />
      {errors.filter(Boolean).map(text => (
        <p key={text} role="alert" className="shrink-0 text-[13px] font-medium text-danger-600">{text}</p>
      ))}

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

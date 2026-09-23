import React from 'react'
import { Printer, Trash2 } from 'lucide-react'
import { TabLine } from '../../types/tab'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface TabBillProps {
  lines: TabLine[]
  /** What the tab adds to the bill. */
  total: number
  busy?: boolean
  /** True while the tab may not be touched (a stay that has not checked in). */
  locked?: boolean
  onRemove: (line: TabLine) => void
  /** What to say when nothing is on the tab yet. */
  emptyText: string
  /**
   * Who a mid-stay printout is for (k69, part D). Left out, no print is offered
   * — the paper would not know whose tab it is.
   */
  onPrint?: () => void
}

// What is on the tab right now: the lines, the running total, and the way to see
// it on paper (board card k69).
//
// The same bill stands on the left of the Restaurant screen while the menu card
// scrolls past it, and inside a booking's Guest tab — so it is written once here
// and both screens cannot drift apart. Nothing edits a line: it is removed and
// the right one is added, so the bill always recomputes itself.
export function TabBill({ lines, total, busy = false, locked = false, onRemove, emptyText, onPrint }: TabBillProps) {
  if (lines.length === 0) {
    return <p className="text-[12px] text-muted">{emptyText}</p>
  }

  return (
    <>
      <ul className="divide-y divide-soft border border-soft rounded-lg overflow-hidden">
        {lines.map(line => (
          <li key={line.id} className="px-3 py-2.5 flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[13.5px] font-semibold text-main">{line.description}</span>
              <span className="block text-[11px] text-muted">
                {line.qty > 1 ? line.qty + ' × ' + fmtPeso(line.unit_price) : fmtPeso(line.unit_price)}
              </span>
            </span>
            <span className="flex items-center gap-2 shrink-0">
              <span className="text-[13.5px] font-bold text-main">{fmtPeso(line.amount)}</span>
              <button type="button" onClick={() => onRemove(line)} disabled={busy || locked}
                title={'Remove ' + line.description}
                aria-label={'Remove ' + line.description}
                className="text-muted/60 hover:text-danger-600 p-2 -m-1 transition-colors cursor-pointer disabled:opacity-40">
                <Trash2 className="w-4 h-4" />
              </button>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between gap-2 mt-3">
        <span className="text-[12.5px] text-muted font-semibold">On the tab</span>
        <span className="flex items-center gap-2.5">
          {onPrint && (
            <button type="button" onClick={onPrint}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-600 hover:text-gold-800 border border-soft hover:border-gold-400 bg-card px-3 py-2 rounded-lg transition-colors cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Print the tab
            </button>
          )}
          <span className="text-[13px] font-bold text-main">{fmtPeso(total)}</span>
        </span>
      </div>
    </>
  )
}

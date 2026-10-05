import { useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Undo2, Utensils, X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { readTabTotal, sendBackTab } from '../../utils/tabs'
import { showToast } from '../../utils/toast'
import { TabSettlePanel } from './TabSettlePanel'
import { TabReceiptModal } from './TabReceiptModal'
import { RunningTabSlip } from './RunningTabSlip'
import { tableName } from './served'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

const QUIET = 'min-h-11 inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-main transition-colors cursor-pointer disabled:opacity-50'

interface DinerPayModalProps {
  slip: OrderSlip
  onClose: () => void
  /** The slip was paid, sent back, or found changed: the list behind this is read again. */
  onChanged: () => void
}

// A diner with no room pays their order slip — at the front desk (Sebastian, 2026-10-04:
// "the guests actually always pay at the front desk, not at the restaurant"). The pay
// buttons used to sit on the Restaurant screen under the slip.
//
// The desk sees what was ordered and what it comes to, picks how the diner paid, and the
// numbered receipt opens straight away because the diner is standing there.
//
// **The bill is printed here**, where the printer is (Sebastian, 2026-10-05): the
// restaurant sends the bill over and no longer has a "Guest copy" of its own. A bill sent
// by mistake can be sent back, which opens the slip for more orders again.
export function DinerPayModal({ slip, onClose, onChanged }: DinerPayModalProps) {
  const [receipt, setReceipt] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)
  const [changed, setChanged] = useState('')
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(false)

  if (receipt) {
    return <TabReceiptModal tab={receipt.tab} lines={receipt.lines} record={receipt.record} onClose={onClose} />
  }

  // The restaurant may still be adding to a slip whose bill has not been sent. The money
  // is only taken for the amount the desk was shown: a slip that has grown says so and is
  // read again first.
  const stillTheSame = async () => {
    const now = await readTabTotal(slip.tab.id)
    if (Math.abs(now - slip.total) <= 0.005) { setChanged(''); return true }
    setChanged('This order slip is now ' + fmtPeso(now) + '. Check it, then receive again.')
    onChanged()
    return false
  }

  const sendBack = async () => {
    setBusy(true)
    try {
      await sendBackTab(slip.tab.id)
      showToast((slipNumber(slip.tab) || 'The order slip') + ' is back with the restaurant.', 'success')
      onChanged()
      onClose()
    } catch {
      setChanged('Could not send it back. Please try again.')
      setBusy(false)
    }
  }

  const who = slip.tab.label || 'Walk-in'
  const table = tableName(slip.tab.table_label)
  // The printed bill is drawn beside this window, not inside it: a tap on the paper must
  // not count as a tap outside the window, which closes it.
  return (
    <>
      {createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-ink-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-sm bg-card rounded-xl border border-soft shadow-softLg overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main flex items-center gap-2">
              <Utensils className="w-4 h-4 text-gold-600" /> Order slip {slipNumber(slip.tab)}
            </h3>
            <p className="text-[13px] text-muted mt-0.5 truncate">
              {[table, slip.tab.label, slip.tab.billed_at ? '' : 'still eating'].filter(Boolean).join(' · ') || who}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-4 pt-3 pb-3">
          <ul className="max-h-[38vh] overflow-y-auto divide-y divide-soft text-[14px]">
            {slip.lines.map(line => (
              <li key={line.id} className="py-1.5 flex items-baseline justify-between gap-3">
                <span className="min-w-0 text-main break-words">
                  <b className="tabular-nums">{Number(line.qty || 1)} ×</b> {line.description}
                </span>
                <span className="shrink-0 tabular-nums text-main">{fmtPeso(line.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-baseline justify-between gap-2 pt-3 border-t border-soft">
            <span className="text-[14px] font-medium text-muted">Total</span>
            <span className="font-display text-[26px] leading-none font-extrabold tracking-tight tabular-nums text-main">{fmtPeso(slip.total)}</span>
          </div>
          {changed && <p role="alert" className="mt-2 text-[13px] font-semibold text-danger-600">{changed}</p>}

          <TabSettlePanel
            tab={slip.tab}
            total={slip.total}
            ready={stillTheSame}
            onSettled={record => { setReceipt({ tab: slip.tab, lines: slip.lines, record }); onChanged() }}
          />

          {/* The paper the diner is shown before paying, and the way back for a bill sent
              by mistake. Quiet: neither is the reason this window is open. */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4">
            <button type="button" onClick={() => setPrinting(true)} className={QUIET}>
              <Printer className="w-4 h-4" /> Print the bill
            </button>
            {slip.tab.billed_at && (
              <button type="button" onClick={() => void sendBack()} disabled={busy} className={QUIET}>
                <Undo2 className="w-4 h-4" /> Send back to the restaurant
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
      )}
      {printing && (
        <RunningTabSlip
          number={slipNumber(slip.tab)}
          who={who}
          place={slip.tab.table_label ? { label: 'Table', value: slip.tab.table_label } : undefined}
          lines={slip.lines}
          total={slip.total}
          note="To be paid at the front desk."
          onClose={() => setPrinting(false)}
        />
      )}
    </>
  )
}

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { slipNumber } from '../../utils/orderSlips'
import { money } from '../billing/receiptText'
import { useSlipPage } from '../billing/useSlipPage'

interface TabReceiptModalProps {
  tab: Tab
  lines: TabLine[]
  record: PaymentRecord
  onClose: () => void
}

/** One line of the slip, as on the room receipt: what it is on the left, the fact on the right. */
function Row({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  const shown = (value ?? '').trim()
  if (!shown) return null
  return (
    <div className="flex items-baseline justify-between gap-2 text-[9px]">
      <span className="min-w-0">{label}</span>
      <span className={'shrink-0 font-bold text-right ' + (mono ? 'font-mono' : '')}>{shown}</span>
    </div>
  )
}

// The receipt for a WALK-IN's paid order slip (k69, part C), carrying its own stored receipt
// number so a number staff quote to a diner stays stable.
//
// **It is the room receipt's paper** (`PaymentReceiptDocument`; the owner, 2026-10-24: "make the
// design more consistent with the payment receipts"): the same 48 mm column, header, framed
// amount first, rows and dark bar, with the dishes added under the rows. No Email: a diner
// leaves no address.
export function TabReceiptModal({ tab, lines, record, onClose }: TabReceiptModalProps) {
  useSlipPage()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = lines.reduce((sum, l) => sum + Number(l.amount || 0), 0)
  const who = tab.label || tab.table_label || 'Walk-in diner'
  const receiptNo = record.receipt_number || ''
  const paidAt = record.paid_at ? new Date(record.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  const kind = paymentKind(record.method || '')
  const showRef = (kind === 'gcash' || kind === 'bank') && !!record.reference
  const lab = 'text-[8px] font-bold uppercase tracking-[0.1em]'

  return createPortal(
    <div className="fixed inset-0 z-[80] p-3 sm:p-4 bg-slate-900/50 print:bg-white print:p-0 print:static overflow-y-auto bp-dim print:[animation:none]">
      <div className="flex flex-col items-center w-full bp-rise motion-reduce:[animation:none] print:[animation:none]">
        <div className="w-full max-w-md mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-white print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-white text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase shrink-0">Payment receipt</span>
            <span className="text-xs font-mono text-white/70 truncate">{receiptNo}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => window.print()} className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-[background-color,transform] active:scale-95 cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="my-2 print-slip w-[48mm] max-w-full bg-white text-black font-sans leading-snug pl-[2mm] pr-[4mm] py-3 print:w-auto print:max-w-none print:px-0 print:py-0 print:my-0">
          <div className="text-center">
            <h1 className="font-display font-extrabold text-[12px] uppercase leading-[1.15]">Daweez<br />Pension House</h1>
            <p className="text-[8.5px] mt-1">San Agustin Sur, Tandag City</p>
            <p className="text-[8.5px]">0910-7163830</p>
          </div>

          <div className="border-t-2 border-black my-2" />

          <div className="flex items-baseline justify-between gap-1 whitespace-nowrap">
            <span className="font-mono text-[9px] font-bold">{receiptNo}</span>
            <span className="text-[8.5px]">{paidAt}</span>
          </div>

          <div className="my-2 border-[3px] border-black py-1.5 flex flex-col items-center">
            <span className={lab}>Payment received</span>
            {/* Money in written by hand with nothing linked has no lines, so its own amount is the figure. */}
            <span className="font-display text-[22px] font-extrabold leading-none mt-1">{money(lines.length ? total - (record.discount || 0) : record.amount)}</span>
          </div>

          <div className="space-y-[3px]">
            <Row label="From" value={who} />
            {tab.label && tab.table_label ? <Row label="Table" value={tab.table_label} /> : null}
            {slipNumber(tab) ? <Row label="Order slip" value={slipNumber(tab)} mono /> : null}
            <Row label="Paid by" value={paymentMethodLabel(record.method)} />
            {showRef ? <Row label={kind === 'gcash' ? 'GCash ref no.' : 'Bank ref no.'} value={record.reference} mono /> : null}
          </div>

          <div className="border-t border-dashed border-black my-2" />

          <div className="space-y-[3px]">
            {lines.map(l => (
              <Row key={l.id} label={l.qty > 1 ? l.qty + ' × ' + l.description : l.description} value={money(l.amount)} mono />
            ))}
            {record.discount ? (
              <>
                <div className="border-t border-black pt-[3px] mt-[2px]"><Row label="Sub-total" value={money(total)} mono /></div>
                <Row label="Discount" value={'−' + money(record.discount)} mono />
              </>
            ) : null}
          </div>

          <p className="my-2 border-2 border-black py-1.5 text-center font-display text-[12px] font-extrabold uppercase tracking-[0.12em]">Paid in full</p>

          <p className={lab}>Received by</p>
          <p className="text-[9.5px] font-bold min-h-[13px]">{record.prepared_by || ''}</p>

          <p className="text-center text-[8.5px] mt-2.5">Thank you — please come again.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

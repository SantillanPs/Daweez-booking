import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Printer, X } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { Block, Row, Rule, fmtDateTime, money } from '../billing/receiptPrimitives'

interface TabReceiptModalProps {
  tab: Tab
  lines: TabLine[]
  record: PaymentRecord
  onClose: () => void
}

// The receipt for a settled WALK-IN tab (k69, part C).
//
// A diner with no booking gets the same 58 mm slip as any other payment — one
// column, black on white, nothing wider than the roll — carrying its own stored
// receipt number, so a number staff quote to a diner stays stable.
export function TabReceiptModal({ tab, lines, record, onClose }: TabReceiptModalProps) {
  // The page size is set only while this slip is on screen, so the A4 billing
  // statement keeps its own page size.
  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@page { size: 58mm auto; margin: 3mm }'
    document.head.appendChild(style)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => {
      document.head.removeChild(style)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const total = lines.reduce((sum, l) => sum + Number(l.amount || 0), 0)
  const who = tab.label || tab.table_label || 'Walk-in diner'

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-slate-900/60 p-3 print:static print:bg-white print:p-0">
      <div className="w-full max-w-[300px]">
        <div className="flex items-center justify-between gap-2 mb-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-[12px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" /> Print receipt
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-white/80 hover:text-white p-1.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="bg-white text-black font-mono p-3 rounded-lg w-[58mm]">
          <div className="text-center">
            <p className="text-[13px] font-bold tracking-wide">DAWEEZ PENSION HOUSE</p>
            <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5">Payment Receipt</p>
          </div>
          <Rule />
          <Row label="Receipt No." value={record.receipt_number || '—'} strong />
          <Row label="Date" value={fmtDateTime(record.paid_at)} />
          <Rule />
          <Block label="Guest" value={who} />
          {tab.label && tab.table_label ? <Block label="Table" value={tab.table_label} /> : null}
          <Rule />
          {lines.map(l => (
            <Row key={l.id} label={l.description} value={money(l.amount)} />
          ))}
          <Rule />
          <Row label="TOTAL" value={money(total)} strong />
          <Rule />
          <Block label="Paid by" value={paymentMethodLabel(record.method)} />
          <Block label="Reference" value={record.reference} />
          <Rule />
          <p className="text-center text-[10px] font-bold tracking-wide">PAID IN FULL</p>
          <Block label="Received by" value={record.prepared_by} />
          <p className="text-center text-[8px] mt-2">Thank you — please come again.</p>
        </div>
      </div>
    </div>,
    document.body,
  )
}

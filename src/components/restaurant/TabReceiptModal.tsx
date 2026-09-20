import React from 'react'
import { Tab, TabLine } from '../../types/tab'
import { PaymentRecord } from '../../types/booking'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { Block, Row, Rule, fmtDateTime, money } from '../billing/receiptPrimitives'
import { SlipModal } from '../billing/SlipModal'

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
  const total = lines.reduce((sum, l) => sum + Number(l.amount || 0), 0)
  const who = tab.label || tab.table_label || 'Walk-in diner'

  return (
    <SlipModal printLabel="Print receipt" onClose={onClose}>
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
    </SlipModal>
  )
}

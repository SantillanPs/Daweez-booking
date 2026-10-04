import React from 'react'
import { TabLine } from '../../types/tab'
import { Block, Rule } from '../billing/receiptPrimitives'
import { fmtDateTime } from '../billing/receiptText'
import { SlipModal } from '../billing/SlipModal'
import { newCount } from '../../utils/orderSlips'

interface KitchenSlipProps {
  /** `OS-0007`. */
  number: string
  who: string
  /** Where the food goes: the room on a stay, the table for a diner. */
  place?: { label: string; value: string }
  /** The slip's lines as they stood when Print was opened. */
  lines: TabLine[]
  /** Print was pressed: everything on the slip has now been given to the kitchen. */
  onPrinted: () => void
  onClose: () => void
}

/** One line the cook reads: the count, large, then the dish. No prices. */
function Dish({ count, name }: { count: number; name: string }) {
  return (
    <p className="flex items-baseline gap-2 mt-1 first:mt-0">
      <span className="text-[13px] font-bold shrink-0">{count} ×</span>
      <span className="text-[12px] font-bold break-words">{name}</span>
    </p>
  )
}

// The kitchen's copy of an order slip (the staff's feedback, 2026-10-04).
//
// The staff write an order on a paper slip and hand it to the kitchen; this is that
// slip, printed. It carries what the cook needs and nothing else — the number, where
// the food goes, the count and the dish. No prices.
//
// A slip stays open until it is paid, so more can be ordered on it after the kitchen
// already has a copy. What was added since the last print comes first, under NEW; what
// the kitchen was already given follows, so nothing is cooked twice.
export function KitchenSlip({ number, who, place, lines, onPrinted, onClose }: KitchenSlipProps) {
  const fresh = lines.filter(l => newCount(l) > 0)
  const given = lines.filter(l => Number(l.sent_qty || 0) > 0)

  return (
    <SlipModal printLabel="Print for the kitchen" onPrinted={onPrinted} onClose={onClose}>
      <div className="text-center">
        <p className="text-[9px] font-bold uppercase tracking-wider">Order Slip</p>
        <p className="text-[20px] font-bold leading-tight">{number}</p>
        <p className="text-[9px] font-semibold mt-0.5">{fmtDateTime(new Date().toISOString())}</p>
      </div>
      <Rule />
      {place ? <Block label={place.label} value={place.value} /> : null}
      <Block label="Guest" value={who} />
      <Rule />
      {fresh.length > 0 && (
        <>
          {given.length > 0 && <p className="text-[9px] font-bold uppercase tracking-wider mb-1">New</p>}
          {fresh.map(l => <Dish key={l.id} count={newCount(l)} name={l.description} />)}
        </>
      )}
      {given.length > 0 && (
        <>
          {fresh.length > 0 && <Rule />}
          <p className="text-[9px] font-bold uppercase tracking-wider mb-1">
            {fresh.length > 0 ? 'Already given' : 'Reprint — nothing new'}
          </p>
          {given.map(l => <Dish key={l.id} count={Number(l.sent_qty || 0)} name={l.description} />)}
        </>
      )}
      <Rule />
    </SlipModal>
  )
}

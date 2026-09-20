import React from 'react'
import { TabLine } from '../../types/tab'
import { Block, Row, Rule, fmtDateTime, money } from '../billing/receiptPrimitives'
import { SlipModal } from '../billing/SlipModal'

interface RunningTabSlipProps {
  /** Who the tab belongs to — the guest on a stay, the name on a walk-in tab. */
  who: string
  /** Where they are: the room on a stay, the table for a diner. */
  place?: { label: string; value: string }
  lines: TabLine[]
  total: number
  /** What happens with this paper next — a stay settles at check-out, a diner at the counter. */
  note: string
  onClose: () => void
}

// The guest's running food and bar tab, on paper (k69, part D).
//
// The owner asked for this: a guest can ask to see what they have run up so far,
// mid-stay, not only at check-out. It is deliberately NOT headed like a receipt —
// no amount has been received, so it must never be mistaken for one — and it
// prints on the same 58 mm roll as everything else.
export function RunningTabSlip({ who, place, lines, total, note, onClose }: RunningTabSlipProps) {
  return (
    <SlipModal printLabel="Print the tab" onClose={onClose}>
      <div className="text-center">
        <p className="text-[13px] font-bold tracking-wide">DAWEEZ PENSION HOUSE</p>
        <p className="text-[9px] font-semibold uppercase tracking-wider mt-0.5">Running Tab</p>
      </div>
      <Rule />
      <Row label="Printed" value={fmtDateTime(new Date().toISOString())} />
      <Rule />
      <Block label="Guest" value={who} />
      {place ? <Block label={place.label} value={place.value} /> : null}
      <Rule />
      {lines.map(l => (
        <Row
          key={l.id}
          label={l.qty > 1 ? l.qty + ' × ' + l.description : l.description}
          value={money(l.amount)}
        />
      ))}
      <Rule />
      <Row label="TOTAL SO FAR" value={money(total)} strong />
      <Rule />
      <p className="text-center text-[10px] font-bold tracking-wide">NOT A RECEIPT</p>
      <p className="text-center text-[8.5px] mt-1">{note}</p>
      <p className="text-center text-[8px] mt-2">Please check the items above.</p>
    </SlipModal>
  )
}

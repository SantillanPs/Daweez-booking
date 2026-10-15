import { useState } from 'react'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { RunningTabSlip } from '../restaurant/RunningTabSlip'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()
const fmtWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

interface BookingOrderSlipsProps {
  slips: OrderSlip[]
  who: string
  place: { label: string; value: string }
}

/**
 * A stay's order slips on the booking panel: the number, the total and whether it is
 * paid — never the dishes (the staff's feedback, 2026-10-04: a paid order should read
 * as its OS number, its total and its payment status). A slip opens as its paper when
 * the desk needs to see what was on it. They are lines of the panel's folded bill
 * (2026-10-15), so they render as `<li>`s; "Take orders" is on the panel's bottom row.
 */
export function BookingOrderSlips({ slips, who, place }: BookingOrderSlipsProps) {
  const [shown, setShown] = useState<OrderSlip | null>(null)

  return (
    <>
      {slips.map(s => (
        <li key={s.tab.id} className="border-b border-dashed border-paper-300 last:border-0">
          <button type="button" onClick={() => setShown(s)} title="Show this order slip"
            className="w-full min-h-10 flex items-center justify-between gap-3 text-[12px] text-left text-muted hover:text-main transition-colors cursor-pointer">
            <span className="min-w-0"><span className="font-semibold text-main">Order slip {slipNumber(s.tab)}</span> · {fmtWhen(s.tab.opened_at)}</span>
            <span className="flex items-center gap-2 shrink-0">
              <span className={'font-bold ' + (s.paid ? 'text-emerald-700' : 'text-danger-600')}>{s.paid ? 'Paid' : 'Not paid'}</span>
              <span className="font-semibold text-main tabular-nums">{fmtPeso(s.total)}</span>
            </span>
          </button>
          {shown?.tab.id === s.tab.id && (
            <RunningTabSlip
              number={slipNumber(shown.tab)}
              who={who}
              place={place}
              lines={shown.lines}
              total={shown.total}
              note={shown.paid ? 'Paid.' : 'To be paid at the front desk.'}
              onClose={() => setShown(null)}
            />
          )}
        </li>
      ))}
    </>
  )
}

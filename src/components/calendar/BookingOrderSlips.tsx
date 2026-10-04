import { useState } from 'react'
import { Utensils } from 'lucide-react'
import { OrderSlip, slipNumber } from '../../utils/orderSlips'
import { RunningTabSlip } from '../restaurant/RunningTabSlip'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()
const fmtWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

interface BookingOrderSlipsProps {
  slips: OrderSlip[]
  who: string
  place: { label: string; value: string }
  /** Takes the desk to the Restaurant screen with this guest chosen. Left out once the guest has left. */
  onTakeOrders?: () => void
}

/**
 * A stay's order slips on the booking panel: the number, the total and whether it is
 * paid — never the dishes (the staff's feedback, 2026-10-04: a paid order should read
 * as its OS number, its total and its payment status). A slip opens as its paper when
 * the desk needs to see what was on it.
 */
export function BookingOrderSlips({ slips, who, place, onTakeOrders }: BookingOrderSlipsProps) {
  const [shown, setShown] = useState<OrderSlip | null>(null)

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-[13px] font-bold text-main">Order slips</h4>
        {onTakeOrders && (
          <button type="button" onClick={onTakeOrders}
            className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-lg border border-soft bg-card text-[13px] font-bold text-main hover:border-gold-400 hover:bg-gold-100 transition-colors cursor-pointer">
            <Utensils className="w-4 h-4" /> Take orders
          </button>
        )}
      </div>

      {slips.length === 0 ? (
        <p className="text-[13px] text-muted">None</p>
      ) : (
        <ul className="mt-1.5 border-y border-soft divide-y divide-soft">
          {slips.map(s => (
            <li key={s.tab.id}>
              <button type="button" onClick={() => setShown(s)} title="Show this order slip"
                className="w-full min-h-11 flex items-center justify-between gap-3 text-[13px] text-left hover:bg-softbg transition-colors cursor-pointer">
                <span className="min-w-0">
                  <span className="font-bold text-main">{slipNumber(s.tab)}</span>
                  <span className="text-muted"> · {fmtWhen(s.tab.opened_at)}</span>
                </span>
                <span className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold text-main">{fmtPeso(s.total)}</span>
                  <span className={'w-16 text-right font-bold ' + (s.paid ? 'text-emerald-700' : 'text-danger-600')}>
                    {s.paid ? 'Paid' : 'Not paid'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {shown && (
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
    </section>
  )
}

import { Booking } from '../../types/booking'
import { amountToPayNow } from '../../utils/bookingMoney'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface BookingMoneyPanelProps {
  localBooking: Booking
  /**
   * What the guest's food tab adds to the bill (k69). Passed down so the deposit
   * stays stay-only: `amountToPayNow` takes the tab back out before working the
   * 50% out, and a lunch eaten after booking never inflates the deposit.
   */
  tabTotal?: number
}

/**
 * The money while it is still being taken (card k132 follow-up) — four tight rows,
 * not a card of two big golden cells:
 *
 *   Whole stay total   ₱1,250
 *   Received             ₱625
 *   AMOUNT TO PAY        ₱625   ← the figure staff act on
 *   [thin progress bar]
 *
 * It only REPORTS: no method, no reference, no button — those belong to the single
 * next step below it (the receive step, or the Check in / Check out button).
 *
 * It is only rendered while something is owed. A SETTLED booking has no money block
 * at all: `Fully paid ✓` and the next step sit beside the guest's name
 * ([SettledPaidTag]) — saying "Whole stay total ₱1,250 / Received ₱1,250 / Fully
 * paid ✓" in a box of its own told the same money three times and left an empty-
 * looking panel under it.
 */
export function BookingMoneyPanel({ localBooking, tabTotal = 0 }: BookingMoneyPanelProps) {
  const paid = Number(localBooking.downpayment_paid || 0)
  const owed = Number(localBooking.balance_due || 0)
  const total = paid + owed
  const dueNow = amountToPayNow(localBooking, tabTotal)

  const receivedPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  // The box's edge says the state at a glance (card k132, P4 design): red while
  // nothing is in, gold while it is part paid.
  const edge = paid > 0 ? 'border-gold-300 bg-gold-100/40' : 'border-danger-200 bg-danger-50/40'

  return (
    <div className={'rounded-lg border px-3 py-2.5 ' + edge}>
      <div className="flex items-center justify-between gap-3 text-[12px]">
        <span className="text-muted">Whole stay total</span>
        <span className="font-semibold text-main">{fmtPeso(total)}</span>
      </div>
      <div className="flex items-center justify-between gap-3 text-[12px] mt-1">
        <span className="text-muted">Received</span>
        <span className={paid > 0 ? 'font-semibold text-emerald-600' : 'text-muted'}>
          {paid > 0 ? fmtPeso(paid) : 'Nothing yet'}
        </span>
      </div>
      {tabTotal > 0 && (
        <div className="flex items-center justify-between gap-3 text-[11px] mt-1 text-muted">
          <span>Room {fmtPeso(total - tabTotal)} · Restaurant &amp; bar {fmtPeso(tabTotal)}</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 mt-2 pt-2 border-t border-paper-200">
        <span className="text-[11px] font-bold uppercase tracking-wider text-brand-text">Amount to pay</span>
        <span className="font-display text-[19px] font-extrabold leading-none text-ink-900">{fmtPeso(dueNow)}</span>
      </div>
      <div className="mt-2">
        {/* The bar only — the rows above already state both figures. */}
        <div className="h-1.5 rounded-full bg-paper-200 overflow-hidden">
          {/* The one value Tailwind cannot express: a live percentage. */}
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: receivedPct + '%' }} />
        </div>
      </div>
    </div>
  )
}

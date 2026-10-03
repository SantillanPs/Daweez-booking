import { Booking } from '../../types/booking'
import { amountToPayNow, getPaymentView, PaymentTone } from '../../utils/bookingMoney'

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

// The box wears the colour of the status word in the header and the dot on the
// calendar: red while a guest owes, gold once part is in. A reservation whose guest
// has not arrived is **a promise, not a debt** (the owner, 2026-09-28) and money an
// agency will send later is expected, not chased — so neither of those is red. The box
// used to go red for anything unpaid, which put a trusted guest's hold in alarm colour.
const EDGE: Record<PaymentTone, string> = {
  owes: 'border-danger-200 bg-danger-50/40',
  partial: 'border-gold-300 bg-gold-100/40',
  paid: 'border-gold-300 bg-gold-100/40',
  reserved: 'border-soft bg-page',
  billed: 'border-indigo-200 bg-indigo-50/50',
}

/**
 * The money while it is still being taken (card k132 follow-up).
 *
 * **It says each figure once** (the owner's feedback on the panel, 2026-10-04). With
 * nothing received and the whole stay due it is one line — `Amount to pay ₱1,100` —
 * because the total, the amount to pay and the button under it were the same ₱1,100
 * three times over, above an empty bar. The other rows arrive when they differ:
 *
 *   Whole stay total   ₱1,250   ← only when it is not the amount to pay
 *   Received             ₱625   ← only once something is in, with the bar
 *   Amount to pay        ₱625   ← the figure staff act on
 *
 * It only REPORTS: no method, no reference, no button — those belong to the single
 * next step below it (the receive step, or the Check in / Check out button).
 *
 * It is only rendered while something is owed. A SETTLED booking has no money block
 * at all: `Fully paid ✓` and the next step take its place ([SettledPaidTag]).
 */
export function BookingMoneyPanel({ localBooking, tabTotal = 0 }: BookingMoneyPanelProps) {
  const paid = Number(localBooking.downpayment_paid || 0)
  const owed = Number(localBooking.balance_due || 0)
  const total = paid + owed
  const dueNow = amountToPayNow(localBooking, tabTotal)
  const tone = getPaymentView(localBooking).tone

  const receivedPct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0
  const showTotal = total !== dueNow || paid > 0 || tabTotal > 0

  return (
    <div className={'rounded-lg border px-3 py-2.5 ' + EDGE[tone]}>
      {showTotal && (
        <div className="flex items-center justify-between gap-3 text-[13px]">
          <span className="text-muted">Whole stay total</span>
          <span className="font-semibold text-main">{fmtPeso(total)}</span>
        </div>
      )}
      {paid > 0 && (
        <div className="flex items-center justify-between gap-3 text-[13px] mt-1">
          <span className="text-muted">Received</span>
          <span className="font-semibold text-emerald-600">{fmtPeso(paid)}</span>
        </div>
      )}
      {tabTotal > 0 && (
        <p className="text-[12px] mt-1 text-muted">
          Room {fmtPeso(total - tabTotal)} · Restaurant &amp; bar {fmtPeso(tabTotal)}
        </p>
      )}

      <div className={'flex items-center justify-between gap-3' + (showTotal ? ' mt-2 pt-2 border-t border-paper-200' : '')}>
        <span className="text-[13px] font-bold text-brand-text">{tone === 'billed' ? 'Billed to agency' : 'Amount to pay'}</span>
        <span className="font-display text-[20px] font-extrabold leading-none text-ink-900">{fmtPeso(dueNow)}</span>
      </div>
      {paid > 0 && (
        <div className="mt-2 h-1.5 rounded-full bg-paper-200 overflow-hidden">
          {/* The one value Tailwind cannot express: a live percentage. */}
          <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: receivedPct + '%' }} />
        </div>
      )}
    </div>
  )
}

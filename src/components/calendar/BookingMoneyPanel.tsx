import { Booking } from '../../types/booking'
import { getPaymentView, PAYMENT_BADGE_CLASSES } from '../../utils/bookingMoney'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface BookingMoneyPanelProps {
  booking: Booking
  localBooking: Booking
  payFlash: boolean
}

// The single card in the panel: what the stay costs, what has been paid, and
// what is still owed — headlined by the plain-language verdict. The status is
// never picked by hand: it follows the money actually recorded (unpaid →
// deposit → fully paid), so it can never disagree with the receipts.
export function BookingMoneyPanel({ booking, localBooking, payFlash }: BookingMoneyPanelProps) {
  const paid = Number(localBooking.downpayment_paid || 0)
  const due = Number(localBooking.balance_due || 0)
  const total = paid + due
  const view = getPaymentView(localBooking)
  const isPaid = view.tone === 'paid'

  // What the guest agreed to when they booked (deposit / full) and how they
  // said they would pay — shown while that money is still expected.
  const planLabel = booking.payment_plan === 'full' ? 'full payment' : booking.payment_plan === 'deposit' ? 'Deposit (50%)' : ''
  const expecting = [planLabel, booking.payment_method ? 'by ' + booking.payment_method : ''].filter(Boolean).join(' ')
  const hasFooter = (due > 0 && expecting) || paid > 0

  return (
    <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ' + PAYMENT_BADGE_CLASSES[view.tone]}>
          {view.label}
        </span>
        {payFlash && <span className="text-[10px] font-bold text-emerald-600">Saved ✓</span>}
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Amount to pay</p>
          <p className={'font-display text-[26px] font-extrabold leading-none mt-1 ' + (isPaid ? 'text-emerald-600' : 'text-main')}>
            {fmtPeso(due)}
          </p>
        </div>
        <div className="text-right text-[11px] text-muted space-y-1">
          <p>Total <strong className="text-main font-mono">{fmtPeso(total)}</strong></p>
          <p>Paid <strong className={'font-mono ' + (paid > 0 ? 'text-emerald-600' : 'text-main')}>−{fmtPeso(paid)}</strong></p>
        </div>
      </div>

      {hasFooter && (
        <div className="mt-3 pt-2.5 border-t border-paper-200 space-y-0.5 text-[11px] text-muted">
          {due > 0 && expecting && (
            <p>Expecting <strong className="text-main">{expecting}</strong></p>
          )}
          {paid > 0 && (
            <p>
              {booking.payment_method ? 'Paid with' : 'Payments received'}
              {booking.payment_method && <strong className="text-main"> {booking.payment_method}</strong>}
              {booking.payment_reference && <> · Ref <strong className="font-mono text-main">{booking.payment_reference}</strong></>}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

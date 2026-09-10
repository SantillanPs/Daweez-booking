import { Booking } from '../../types/booking'
import { PaymentStatusSelect, PaymentStatusOption } from '../billing/PaymentStatusSelect'
import { getPaymentView, PAYMENT_BADGE_CLASSES } from '../../utils/bookingMoney'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface BookingMoneyPanelProps {
  booking: Booking
  localBooking: Booking
  payFlash: boolean
  onQuickPayment: (b: Booking, status: PaymentStatusOption) => void
}

// The single card in the panel: what the stay costs, what has been paid, and
// what is still owed — headlined by the plain-language verdict.
export function BookingMoneyPanel({ booking, localBooking, payFlash, onQuickPayment }: BookingMoneyPanelProps) {
  const paid = Number(localBooking.downpayment_paid || 0)
  const due = Number(localBooking.balance_due || 0)
  const total = paid + due
  const view = getPaymentView(localBooking)
  const isPaid = view.tone === 'paid'

  return (
    <div className="rounded-xl border border-paper-200 bg-paper-50 p-4">
      <div className="flex items-center justify-between gap-2">
        <span className={'text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ' + PAYMENT_BADGE_CLASSES[view.tone]}>
          {view.label}
        </span>
        <div className="flex items-center gap-2">
          {payFlash && <span className="text-[10px] font-bold text-emerald-600">Saved ✓</span>}
          <PaymentStatusSelect booking={localBooking} onChange={onQuickPayment} />
        </div>
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

      {booking.payment_method && (
        <p className="text-[11px] text-muted mt-3 pt-2.5 border-t border-paper-200">
          {paid > 0 ? 'Paid with' : 'Payment method'} <strong className="text-main">{booking.payment_method}</strong>
          {booking.payment_reference && <> · Ref <strong className="font-mono text-main">{booking.payment_reference}</strong></>}
        </p>
      )}
    </div>
  )
}

import { Booking, PaymentRecord } from '../types/booking'
import { allocatePayment } from '../components/walk-in/bookingPayment'
import { paymentStatusFromMoney } from './bookingMoney'
import { statusAfterPayment } from './bookingStatus'
import { methodNeedsReference } from './paymentMethod'
import { getSlipsByBooking, markSlipsPaid, unpaidSlips } from './orderSlips'

/**
 * **One payment on a bill of several rooms** (the owner's ruling, 2026-09-30, as the booking
 * form already does it — `recordBookingPayment`): the same receipt on every room, each room
 * keeping its share of it, shared out by what each still owes. Every room's figure is the
 * bill's, so they all go down together. The booking panel's bill and Cash Flow's "Write money
 * in" (a payment written there long after, #19) both write it this way.
 */
export function payOnBill(rows: Booking[], w: {
  amount: number
  method: string
  reference?: string
  /** When it was paid (ISO). */
  paidAt: string
  purpose?: string
  /** The receipt number, read fresh (`freshReceiptNumber`). */
  number: string
  /** Written in Cash Flow rather than on the bill (`PaymentRecord.by_hand`). */
  byHand?: boolean
}): Booking[] {
  const owed = rows.map(b => Math.max(0, Number(b.balance_due || 0)))
  const amount = Math.min(w.amount, owed.reduce((a, b) => a + b, 0)) || w.amount
  const shares = allocatePayment(owed, amount)
  const id = 'rcpt-' + Date.now()
  const reference = methodNeedsReference(w.method) ? (w.reference || '').trim() : ''
  return rows.map((b, i): Booking => {
    const paid = Number(b.downpayment_paid || 0) + shares[i]
    const balance = Math.max(0, owed[i] - shares[i])
    const rec: PaymentRecord = {
      id: id + '-' + i, amount, method: w.method, reference: reference || undefined, paid_at: w.paidAt,
      prepared_by: b.prepared_by, receipt_number: w.number, share: shares[i],
      ...(w.purpose ? { purpose: w.purpose } : {}),
      ...(w.byHand ? { by_hand: true } : {}),
    }
    return {
      ...b, payment_records: [...(b.payment_records || []), rec], downpayment_paid: paid, balance_due: balance,
      payment_status: paymentStatusFromMoney(paid, balance), status: statusAfterPayment(b.status),
      payment_method: w.method, payment_reference: reference || b.payment_reference,
    }
  })
}

/** Nothing left on the bill: every room's order slips are paid by the payment that cleared it. */
export async function paySlipsIfCleared(rows: Booking[], number: string): Promise<void> {
  if (!rows.every(b => Number(b.balance_due || 0) <= 0)) return
  const map = await getSlipsByBooking(rows.map(b => b.id))
  const open = unpaidSlips(Object.values(map).flat())
  if (open.length > 0) await markSlipsPaid(open.map(s => s.tab.id), number)
}

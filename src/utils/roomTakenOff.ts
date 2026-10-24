import { Booking } from '../types/booking'
import { paymentShare } from '../components/walk-in/bookingPayment'

/**
 * **A room taken off a bill leaves its money on the bill** (Sebastian, 2026-10-24, the rooms-on-the-bill
 * mock: "Money stays on the bill"). Its payments move onto the room `to`, each carrying the share it had
 * paid, merged into the same receipt when `to` already holds part of it. Only the receipts move:
 * `downpayment_paid` is settled by the caller, which knows what the save already kept.
 */
export function withMoneyOf(to: Booking, gone: Booking[]): Booking {
  const records = [...(to.payment_records || [])]
  for (const g of gone) {
    for (const r of g.payment_records || []) {
      const share = paymentShare(g, r, true)
      const i = records.findIndex(x => (x.receipt_number || x.id) === (r.receipt_number || r.id))
      if (i < 0) records.push({ ...r, share })
      else records[i] = { ...records[i], share: Math.min(r.amount, (records[i].share ?? records[i].amount) + share) }
    }
  }
  return { ...to, payment_records: records }
}

/** Whether a booking holds money: its receipt must survive it. */
export const holdsMoney = (b: Booking) => Number(b.downpayment_paid || 0) > 0 || (b.payment_records || []).length > 0

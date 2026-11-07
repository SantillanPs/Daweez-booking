import { Booking, PaymentRecord, Room, Venue } from '../types/booking'
import { changedRows, onLead, settleBill } from './bookingBalance'
import { groupOf } from './bookingGroup'
import { paymentStatusFromMoney } from './bookingMoney'
import { statusAfterPayment } from './bookingStatus'
import { methodNeedsReference } from './paymentMethod'
import { getSlipsByBooking, markSlipsPaid, slipsTotal, unpaidSlips } from './orderSlips'

/**
 * **One payment on a bill** (2026-11-07): stored once, whole, on the bill's first room, which holds
 * what the bill has received and still owes (`onLead`). Before, the same receipt sat on every room
 * with each room's slice of it. The booking panel's bill and Cash Flow's "Write money in" both write it.
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
  const led = onLead(rows)
  if (led.length === 0) return led
  const owed = Math.max(0, Number(led[0].balance_due || 0))
  const amount = Math.min(w.amount, owed) || w.amount
  const reference = methodNeedsReference(w.method) ? (w.reference || '').trim() : ''
  const rec: PaymentRecord = {
    id: 'rcpt-' + Date.now(), amount, method: w.method, reference: reference || undefined, paid_at: w.paidAt,
    prepared_by: led[0].prepared_by, receipt_number: w.number,
    ...(w.purpose ? { purpose: w.purpose } : {}),
    ...(w.byHand ? { by_hand: true } : {}),
  }
  const paid = Number(led[0].downpayment_paid || 0) + amount
  const balance = Math.max(0, owed - amount)
  const status = paymentStatusFromMoney(paid, balance)
  return led.map((b, i): Booking => ({
    ...b, payment_status: status, status: statusAfterPayment(b.status),
    payment_method: w.method, payment_reference: reference || b.payment_reference,
    ...(i === 0 ? { payment_records: [...(b.payment_records || []), rec], downpayment_paid: paid, balance_due: balance } : {}),
  }))
}

/** The bill priced again with every room's food read fresh (`settleBill`). */
export async function resettle(rows: Booking[], o: { rooms: Room[]; venues: Venue[] }): Promise<Booking[]> {
  const map = await getSlipsByBooking(rows.map(b => b.id))
  return settleBill(rows, { ...o, food: Object.fromEntries(rows.map(b => [b.id, slipsTotal(map[b.id] || [])])) })
}

/** One room changed by `patch`: its bill priced again. Every row to save comes back, that room always. */
export async function resettleWith(b: Booking, patch: Partial<Booking>, list: Booking[], o: { rooms: Room[]; venues: Venue[] }): Promise<Booking[]> {
  const before = groupOf(b, list)
  const after = await resettle(before.map(r => (r.id === b.id ? { ...r, ...patch } : r)), o)
  return after.filter((r, i) => r.id === b.id || changedRows([before[i]], [r]).length > 0)
}

/** Nothing left on the bill: every room's order slips are paid by the payment that cleared it. */
export async function paySlipsIfCleared(rows: Booking[], number: string): Promise<void> {
  if (!rows.every(b => Number(b.balance_due || 0) <= 0)) return
  const map = await getSlipsByBooking(rows.map(b => b.id))
  const open = unpaidSlips(Object.values(map).flat())
  if (open.length > 0) await markSlipsPaid(open.map(s => s.tab.id), number)
}

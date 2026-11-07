import { Booking, PaymentRecord } from '../../types/booking'
import { freshReceiptNumber } from '../../utils/receiptNumber'
import { onLead } from '../../utils/bookingBalance'

/**
 * Taking the money **in the booking form** (the owner's ruling, 2026-09-29, from what the
 * hotel staff actually do — this **supersedes** card k132's "the form takes no money").
 *
 * The real process is one sitting: the guest is asked deposit or full pay **and how they
 * will pay**, the desk enters both, and the form waits for the GCash reference before it
 * will finish. So the payment is recorded the moment the booking is made, instead of
 * leaving the stay sitting `Unpaid / On hold` until somebody records it later from the
 * quick view.
 *
 * Split out of `bookingSubmit` when that file crossed its 300-line limit.
 */

export interface RecordBookingPaymentParams {
  /** The bookings just created, in order. The first carries the receipt handed over. */
  bookings: Booking[]
  /**
   * Every booking the app already knows about, so the payment's receipt number cannot already be on
   * another one. Without it two payments taken minutes apart both come out `…-001`.
   */
  allBookings?: Booking[]
  /** What the guest actually handed over — 0 means nothing to record. */
  received: number
  /** `''` should never reach here: the form refuses to confirm without one. */
  method: string
  reference: string
  plan: 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
  /** What it was for, as written on the bill's payment line (the new booking on the bill). */
  purpose?: string
  updateBooking: (booking: Booking) => Promise<void>
}

/**
 * Write the payment onto the booking set and return the updated rows.
 * One receipt, one amount, stored once on the bill's first room, which holds the bill's money
 * (2026-11-07; before, the same receipt sat on every room with each room's slice of it). Recording
 * the money is also what **confirms** a walk-in.
 */
export async function recordBookingPayment(
  p: RecordBookingPaymentParams
): Promise<Booking[]> {
  const received = Math.max(0, Math.round(p.received || 0))
  if (received <= 0 || p.bookings.length === 0) return p.bookings

  const paidAt = new Date().toISOString()
  // **One number for the whole payment**, decided once — not once per booking.
  const receiptNumber = await freshReceiptNumber(p.bookings[0], p.allBookings || [])
  const reference = p.reference.trim() || undefined
  // Stored once, whole, on the bill's first room (2026-11-07); the save prices the bill after (`settleBill`).
  const receipt: PaymentRecord = {
    id: 'rcpt-' + Date.now(), amount: received, method: p.method, reference, paid_at: paidAt,
    prepared_by: p.bookings[0].prepared_by, receipt_number: receiptNumber,
    ...(p.purpose ? { purpose: p.purpose } : {}),
  }
  const led = onLead(p.bookings)
  const balance = Math.max(0, Number(led[0].balance_due || 0) - received)
  const updated: Booking[] = []
  for (const [i, b] of led.entries()) {
    const row: Booking = {
      ...b,
      ...(i === 0 ? { payment_records: [...(b.payment_records || []), receipt], downpayment_paid: received, balance_due: balance } : {}),
      payment_status: balance <= 0 ? 'paid' : 'downpayment',
      payment_method: p.method || b.payment_method,
      payment_reference: reference || b.payment_reference,
      payment_plan: p.plan,
      status: 'confirmed',
    }
    // Written one at a time on purpose: a failure part-way leaves the caller's own rollback
    // to cancel the whole set, so the form can never finish on a booking that was not paid.
    await p.updateBooking(row)
    updated.push(row)
  }

  return updated
}

/**
 * How much of a payment settled THIS booking's bill.
 *
 * A payment for several rooms sits on every one of them with its full amount, so the
 * amount is not the room's own money. Newer payments carry their `share`; an older one
 * is worked back from what the room has received, less its other payments.
 */
export function paymentShare(booking: Booking, rec: PaymentRecord, sharedWithOtherRooms: boolean): number {
  if (typeof rec.share === 'number') return rec.share
  if (!sharedWithOtherRooms) return Number(rec.amount || 0)
  const others = (booking.payment_records || [])
    .filter(r => r.id !== rec.id)
    .reduce((a, r) => a + Number(r.share ?? r.amount ?? 0), 0)
  return Math.max(0, Math.min(Number(rec.amount || 0), Number(booking.downpayment_paid || 0) - others))
}

/** What the desk can fix on a payment written wrong: the figure, how they paid, what it was for. */
export type PaymentPatch = Partial<Pick<PaymentRecord, 'amount' | 'method' | 'reference' | 'purpose' | 'paid_at'>>

/**
 * **A payment typed wrong, fixed** (Sebastian, 2026-10-24, the mock's B). It changes on every room
 * that holds it; a new figure is shared out across them as the old one was (the first room takes
 * what does not divide), and each room's money received and amount to pay follow. The receipt keeps
 * its number; a new day (Sebastian, 2026-10-27: "the date of the payment should be changeable") moves
 * the money to that day in Today's money. The old figures are kept in `fixes`.
 */
export function withFixedPayment(holders: { booking: Booking; rec: PaymentRecord }[], patch: PaymentPatch, at: string): Booking[] {
  const shared = holders.length > 1
  const old = holders.map(h => paymentShare(h.booking, h.rec, shared))
  const amount = patch.amount ?? Number(holders[0]?.rec.amount || 0)
  const oldTotal = old.reduce((a, b) => a + b, 0)
  const shares = old.map(s => (oldTotal > 0 ? Math.floor(amount * s / oldTotal) : 0))
  if (shares.length > 0) shares[0] += amount - shares.reduce((a, b) => a + b, 0)
  return holders.map(({ booking, rec }, i) => {
    const was = { amount: Number(rec.amount || 0), method: rec.method, reference: rec.reference, purpose: rec.purpose, paid_at: rec.paid_at, at }
    const fixed: PaymentRecord = { ...rec, ...patch, amount, fixes: [...(rec.fixes || []), was] }
    if (shared || typeof rec.share === 'number') fixed.share = shares[i]
    const paid = Number(booking.downpayment_paid || 0)
    const total = paid + Number(booking.balance_due || 0)
    const newPaid = Math.max(0, paid - old[i] + shares[i])
    const remaining = Math.max(0, total - newPaid)
    return {
      ...booking,
      payment_records: (booking.payment_records || []).map(r => (r.id === rec.id ? fixed : r)),
      downpayment_paid: newPaid,
      balance_due: remaining,
      payment_status: remaining <= 0 ? 'paid' : newPaid > 0 ? 'downpayment' : 'unpaid',
    }
  })
}

/**
 * The booking with one payment taken back off it: the receipt is withdrawn and only
 * this room's share of it goes back onto what is owed. Summing the receipts' amounts
 * instead counted another room's money as this room's, and could leave it reading Paid.
 */
export function withoutPayment(booking: Booking, rec: PaymentRecord, sharedWithOtherRooms: boolean): Booking {
  const paid = Number(booking.downpayment_paid || 0)
  const total = paid + Number(booking.balance_due || 0)
  const newPaid = Math.max(0, paid - paymentShare(booking, rec, sharedWithOtherRooms))
  const remaining = Math.max(0, total - newPaid)
  return {
    ...booking,
    payment_records: (booking.payment_records || []).filter(r => r.id !== rec.id),
    downpayment_paid: newPaid,
    balance_due: remaining,
    payment_status: remaining <= 0 ? 'paid' : newPaid > 0 ? 'downpayment' : 'unpaid',
  }
}

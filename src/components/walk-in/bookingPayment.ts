import { Booking, PaymentRecord } from '../../types/booking'
import { nextReceiptNumber } from '../../utils/receiptNumber'

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

/**
 * Divide one payment across the units it covers, in proportion to what each still owes.
 *
 * A group booking is **one payment for the set** — the guest hands over a single amount —
 * but each room carries its own balance, so the money has to land on each of them for the
 * two to agree. The rounding remainder goes to the earliest units that still have room for
 * it, so the shares always add back up to exactly what the guest paid: never a peso short,
 * never a peso over. The same allocation the old-paper-log backfill uses.
 */
export function allocatePayment(owed: number[], received: number): number[] {
  const shares = owed.map(() => 0)
  const owedTotal = owed.reduce((a, b) => a + b, 0)
  if (owedTotal <= 0) {
    // Nothing owed — which should not happen for a priced booking. Put it all on the first
    // rather than dropping money the guest has already handed over.
    if (shares.length > 0) shares[0] = received
    return shares
  }
  const raw = owed.map(o => Math.floor(received * o / owedTotal))
  let diff = received - raw.reduce((a, b) => a + b, 0)
  for (let i = 0; i < raw.length && diff !== 0; i++) {
    const room = owed[i] - raw[i]
    const add = Math.min(room, diff)
    raw[i] += add
    diff -= add
  }
  return raw
}

export interface RecordBookingPaymentParams {
  /** The bookings just created, in order. The receipt lands on the first. */
  bookings: Booking[]
  /** What the guest actually handed over — 0 means nothing to record. */
  received: number
  /** `''` should never reach here: the form refuses to confirm without one. */
  method: string
  reference: string
  plan: 'deposit' | 'full' | 'custom' | 'reservation'
  updateBooking: (booking: Booking) => Promise<void>
}

/**
 * Write the payment onto the booking set and return the updated rows plus the one receipt.
 *
 * **The receipt goes on the FIRST booking** — the one carrying the invoice — so a group
 * booking is one piece of paper for the set, the way the billing statement already is.
 * Every booking in the set gets its own share, its own balance and its own derived status,
 * because the money IS the status (the standing rule: it is never typed in).
 *
 * Recording the money is also what **confirms** a walk-in, which is the rule the quick view
 * has always used — it now simply happens at the moment the booking is made.
 */
export async function recordBookingPayment(
  p: RecordBookingPaymentParams
): Promise<{ bookings: Booking[]; receipt?: PaymentRecord }> {
  const received = Math.max(0, Math.round(p.received || 0))
  if (received <= 0 || p.bookings.length === 0) return { bookings: p.bookings }

  const owed = p.bookings.map(b => Math.max(0, Number(b.balance_due || 0)))
  const shares = allocatePayment(owed, received)
  const paidAt = new Date().toISOString()

  let receipt: PaymentRecord | undefined
  const updated: Booking[] = []

  for (let i = 0; i < p.bookings.length; i++) {
    const b = p.bookings[i]
    const down = shares[i]
    const balance = Math.max(0, owed[i] - down)

    const record: PaymentRecord | undefined = i === 0
      ? {
          id: 'rcpt-' + Date.now(),
          amount: received,
          method: p.method,
          reference: p.reference.trim() || undefined,
          paid_at: paidAt,
          prepared_by: b.prepared_by,
          receipt_number: nextReceiptNumber(b),
        }
      : undefined
    if (record) receipt = record

    const row: Booking = {
      ...b,
      payment_records: record ? [...(b.payment_records || []), record] : (b.payment_records || []),
      downpayment_paid: down,
      balance_due: balance,
      payment_status: balance <= 0 ? 'paid' : 'downpayment',
      payment_method: p.method || b.payment_method,
      payment_reference: p.reference.trim() || b.payment_reference,
      payment_plan: p.plan,
      status: 'confirmed',
    }
    // Written one at a time on purpose: a failure part-way leaves the caller's own rollback
    // to cancel the whole set, so the form can never finish on a booking that was not paid.
    await p.updateBooking(row)
    updated.push(row)
  }

  return { bookings: updated, receipt }
}

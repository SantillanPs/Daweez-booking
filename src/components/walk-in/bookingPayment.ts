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
  updateBooking: (booking: Booking) => Promise<void>
}

/**
 * Write the payment onto the booking set and return the updated rows plus the receipt to hand over.
 *
 * **The receipt is written onto EVERY room the payment covered** (the owner's ruling, 2026-09-30, after
 * he named the real problem: *"if there are more than one rooms booked at the same time, the staff would
 * need to find the room that holds the payment receipt"*). It used to land on the first booking only, so
 * a guest in Room 7 asking for their receipt sent the desk opening room after room until they found it —
 * and every other room held money with no receipt at all.
 *
 * So the same receipt — **one number, one amount, one payment** — is stored on all of them, and each
 * booking carries **its own share** in `downpayment_paid`, because that is what settles its own bill. The
 * share and the payment are different numbers on purpose: a reprint from Room 7 must show the ₱9,200 the
 * guest actually handed over, never Room 7's ₱1,100 slice of it.
 *
 * Stored on every room, **printed once** — the guest still gets one piece of paper.
 *
 * Recording the money is also what **confirms** a walk-in, which is the rule the quick view has always
 * used — it now simply happens at the moment the booking is made.
 */
export async function recordBookingPayment(
  p: RecordBookingPaymentParams
): Promise<{ bookings: Booking[]; receipt?: PaymentRecord }> {
  const received = Math.max(0, Math.round(p.received || 0))
  if (received <= 0 || p.bookings.length === 0) return { bookings: p.bookings }

  const owed = p.bookings.map(b => Math.max(0, Number(b.balance_due || 0)))
  const shares = allocatePayment(owed, received)
  const paidAt = new Date().toISOString()
  // **One number for the whole payment**, decided once — not once per booking.
  const receiptNumber = nextReceiptNumber(p.bookings[0], p.allBookings || [])

  let receipt: PaymentRecord | undefined
  const updated: Booking[] = []

  for (let i = 0; i < p.bookings.length; i++) {
    const b = p.bookings[i]
    const down = shares[i]
    const balance = Math.max(0, owed[i] - down)

    // The SAME receipt on every room — its own id, so two rooms never share a record, but one number
    // and one amount, because the desk took the money once.
    const record: PaymentRecord = {
      id: 'rcpt-' + Date.now() + '-' + i,
      amount: received,
      method: p.method,
      reference: p.reference.trim() || undefined,
      paid_at: paidAt,
      prepared_by: b.prepared_by,
      receipt_number: receiptNumber,
      // This room's slice of it — what removing the payment must take back off this room.
      share: p.bookings.length > 1 ? down : undefined,
    }
    if (i === 0) receipt = record

    const row: Booking = {
      ...b,
      payment_records: [...(b.payment_records || []), record],
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

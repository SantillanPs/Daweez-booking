import { Booking, PaymentRecord, Room, Venue } from '../types/booking'
import { discountsOf } from './discounts'
import { priceBooking, billStays } from './pricing'
import { paymentStatusFromMoney } from './bookingMoney'
import { normalizeVenueId } from './helpers'

// The balance rule for a stay with a food tab (board card k69):
//
//     what is owed = the stays + the food − the bill's discounts − the money received
//
// **A bill's money lives on its first room** (Sebastian, 2026-11-07: "why couldn't we just keep the
// payment and the discount apply to the total?"). Each payment is stored once, whole; each discount
// once, as typed, taken off all the bill's stays together; and the first room holds what the whole
// bill has received and still owes. The other rooms hold only their charges and 0 / 0. Before, each
// room kept its own slice of every payment and flat discount, and money paid while a room was the
// bill's only one got stranded on it past its own cost (James Hermosada, 2026-11-07: the pill said
// Part paid, the bill Paid). Anything that adds the rooms up still gets the bill's figure.
//
// The DEPOSIT is deliberately not part of this: `amountToPayNow(booking, tabTotal)` takes the tab out
// again before working out the 50%, because the deposit was agreed on the stay alone.

/**
 * Every room's money moved onto the first: its payments (each receipt once, whole), its discounts, what
 * was received and what is owed. Nothing is priced, so the bill's sums do not change. `rows[0]` leads.
 */
export function onLead(rows: Booking[]): Booking[] {
  if (rows.length === 0) return rows
  const seen = new Set<string>()
  const records: PaymentRecord[] = []
  for (const b of rows) for (const r of b.payment_records || []) {
    const key = r.receipt_number || r.id
    if (seen.has(key)) continue
    seen.add(key)
    const rest = { ...r }
    delete rest.share
    records.push(rest)
  }
  records.sort((a, b) => (a.paid_at || '').localeCompare(b.paid_at || ''))
  const paid = rows.reduce((t, b) => t + Number(b.downpayment_paid || 0), 0)
  const owed = rows.reduce((t, b) => t + Number(b.balance_due || 0), 0)
  const status = paymentStatusFromMoney(paid, owed)
  return rows.map((b, i) => i === 0
    ? { ...b, payment_records: records, applied_discount: rows.map(b => discountsOf(b.applied_discount)).find(l => l.length > 0) || [], downpayment_paid: paid, balance_due: owed, payment_status: status }
    : { ...b, payment_records: [], applied_discount: [], downpayment_paid: 0, balance_due: 0, payment_status: status })
}

/**
 * The bill priced again: its money on the first room (`onLead`), and what it owes = every room's stay
 * and food − the discounts − the money received. `food` is each room's order slips, by booking id.
 *
 * **Never re-price before the rooms' prices have arrived** (a paid ₱650 six-hour stay was saved owing
 * ₱300 that way, 2026-10-04), nor a date block, which owes nothing: the rows come back as they were.
 */
export function settleBill(
  rows: Booking[],
  opts: { rooms: Room[]; venues: Venue[]; food?: Record<string, number>; includeEarlyHours?: boolean },
): Booking[] {
  const known = (b: Booking) => b.room_id
    ? opts.rooms.some(r => r.id === b.room_id)
    : b.venue_id ? opts.venues.some(v => v.id === normalizeVenueId(b.venue_id)) : true
  if (rows.length === 0 || rows.some(b => b.status === 'blocked' || !known(b))) return rows
  const led = onLead(rows)
  const stays = billStays(led[0], led, opts) // opts.food: the discounts come off the food too
  const cost = led.reduce((t, b, i) => t + stayCost(b, { ...opts, tabTotal: opts.food?.[b.id], stays: i === 0 ? stays : undefined }), 0)
  const paid = Number(led[0].downpayment_paid || 0)
  const owed = Math.max(0, cost - paid)
  const status = paymentStatusFromMoney(paid, owed)
  return led.map((b, i) => ({ ...b, balance_due: i === 0 ? owed : 0, payment_status: status }))
}

/** The rows `settleBill` changed, to be saved. */
export const changedRows = (before: Booking[], after: Booking[]) => after.filter((b, i) => {
  const a = before[i]
  return !a || a.balance_due !== b.balance_due || a.downpayment_paid !== b.downpayment_paid || a.payment_status !== b.payment_status
    || JSON.stringify(a.payment_records || []) !== JSON.stringify(b.payment_records || [])
    || JSON.stringify(discountsOf(a.applied_discount)) !== JSON.stringify(discountsOf(b.applied_discount))
})

/** What the stay costs with its food tab. `stays` is the bill's, for the room holding its discounts. */
export const stayCost = (base: Booking, opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number; includeEarlyHours?: boolean; stays?: number }) =>
  priceBooking(base, opts).grandTotal + (opts.tabTotal || 0)

/**
 * The booking as it stands once its check-out is moved to `newCheckOut` — the ONE
 * place an extension is priced (the owner's ruling, 2026-10-03).
 *
 * Extend stay used to price itself: half of the re-priced stay, with the money already
 * received, the discount, the breakfast and the extras all left out — a fully paid
 * two-night stay at ₱950 extended by a night was saved owing ₱1,425 instead of ₱950.
 * It is the same sum as everywhere else now: the new bill + the food tab − the money
 * received.
 *
 * A short stay pushed past its day **becomes a normal stay, priced by nights** (his
 * ruling on the same page), so the hours come off the booking here.
 */
export function extendStay(
  base: Booking,
  newCheckOut: string,
  opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number },
): Booking {
  return settleBill([{ ...base, check_out: newCheckOut, stay_hours: undefined }], { ...opts, food: { [base.id]: opts.tabTotal || 0 } })[0]
}

/**
 * The early check-in money that has been **recorded but not billed yet** — the figure
 * the quick view shows as *goes on the bill at check-out*.
 *
 * It is the difference between the bill as it will stand at check-out (early hours
 * counted) and the bill as it stands now (they are held back). Worked out by asking the
 * one pricing rule twice rather than re-deriving the ₱/hour-or-a-night logic here, so
 * the number on screen can never drift from the number that lands at check-out.
 */
export function pendingEarlyCharge(
  base: Booking,
  opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number },
): number {
  const hours = Number(base.early_check_in_hours || 0)
  if (!hours || base.actual_check_out) return 0
  return Math.max(0, stayCost(base, { ...opts, includeEarlyHours: true }) - stayCost(base, opts))
}

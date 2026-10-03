import { Booking } from '../types/booking'

export type PaymentTone = 'paid' | 'partial' | 'owes' | 'reserved' | 'billed'

export interface PaymentView {
  tone: PaymentTone
  label: string
  amount: number
}

// Colors for the payment badge: money owed is the first thing staff scan for.
// `reserved` is deliberately NEUTRAL — a reservation is a promise, not a debt, and a
// red badge would put a trusted guest's name in the chase list (the owner, 2026-09-28).
export const PAYMENT_BADGE_CLASSES: Record<PaymentTone, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border border-amber-200',
  owes: 'bg-rose-100 text-rose-700 border border-rose-200',
  reserved: 'bg-ink-100 text-ink-800 border border-ink-200',
  // Money an agency will send later is expected, not chased — so it is not red either.
  billed: 'bg-indigo-50 text-indigo-800 border border-indigo-200',
}

/**
 * A **reservation** (the owner's ruling, 2026-09-28): a room held for somebody the staff
 * personally know and trust, with nothing paid and nothing agreed. The desk decides who
 * qualifies — there is no check in the app, because staff would not reserve for a
 * stranger. It blocks the room exactly like any other booking and holds until the desk
 * cancels it; the money is taken when the guest arrives to check in.
 */
export function isReservation(booking: Booking): boolean {
  return booking.payment_plan === 'reservation' && booking.status !== 'blocked'
}

/**
 * A reservation whose guest has not arrived yet.
 *
 * This is the one distinction the whole feature turns on: **before arrival a reservation
 * is a promise, not a debt.** It stays out of "Who owes right now" and never wears a red
 * badge. The moment the guest checks in it becomes an ordinary owing stay — the money is
 * due at the door, and the usual check-in gate collects it.
 */
export function isReservationAwaitingArrival(booking: Booking): boolean {
  return isReservation(booking) && !booking.actual_check_in
}

/**
 * A stay that is **billed to an agency** — a government office, a company, a university,
 * a travel agency (the owner, 2026-10-04). They pay by check or by bank, and the bank
 * payment usually arrives about three months later because it is processed first. So the
 * guest checks in and checks out with the bill still open: the money is owed by the
 * agency, not by the person at the desk.
 */
export function isBilledToAgency(booking: Booking): boolean {
  if (booking.status === 'blocked' || booking.status === 'cancelled') return false
  return !!booking.partner_deal_id || !!(booking.company_name || '').trim()
}

/** An agency stay with money still to come from the agency. */
export function isOwedByAgency(booking: Booking): boolean {
  return isBilledToAgency(booking) && booking.payment_status !== 'paid' && Number(booking.balance_due || 0) > 0
}

// Plain-language payment status, built so non-accounting staff can read it instantly.
export function getPaymentView(booking: Booking): PaymentView {
  // Nothing is owed by a guest who has not arrived against a reservation, and **no
  // money is shown at all** — the owner's ruling ("A"): the name and the word Reserved.
  if (isReservationAwaitingArrival(booking)) {
    return { tone: 'reserved', label: 'Reserved', amount: 0 }
  }
  const due = booking.balance_due || 0
  if (isOwedByAgency(booking)) {
    return { tone: 'billed', label: `Billed to agency · ₱${due.toLocaleString()}`, amount: due }
  }
  if (booking.payment_status === 'paid') {
    return { tone: 'paid', label: 'Paid', amount: 0 }
  }
  if (booking.payment_status === 'downpayment') {
    const left = due > 0 ? ` · ₱${due.toLocaleString()} left` : ''
    return { tone: 'partial', label: `Partial${left}`, amount: due }
  }
  if (due > 0) {
    return { tone: 'owes', label: `Owes ₱${due.toLocaleString()}`, amount: due }
  }
  return { tone: 'owes', label: 'Not paid', amount: 0 }
}

// True when a booking still has money left to collect (blocks don't owe, and a
// reservation whose guest has not arrived is a promise rather than a debt).
export function isOwed(booking: Booking): boolean {
  if (booking.status === 'blocked' || booking.status === 'cancelled') return false
  if (isReservationAwaitingArrival(booking)) return false
  // What an agency owes is its own list — it is not chased at the desk.
  if (isBilledToAgency(booking)) return false
  return booking.payment_status !== 'paid'
}

// True when the guest still has an unpaid balance. Blocks never owe, and a
// booking marked paid is settled even if a stale balance_due survived.
export function hasOutstandingBalance(booking: Booking): boolean {
  if (booking.status === 'blocked' || booking.status === 'cancelled') return false
  if (booking.payment_status === 'paid') return false
  return Number(booking.balance_due || 0) > 0
}

// True when the guest has already handed money over. Once they have, the
// booking's agreed deposit has been settled, so what remains is the checkout
// balance — staff collect that at check-out, not at the desk.
export function hasPaymentRecorded(booking: Booking): boolean {
  if (Number(booking.downpayment_paid || 0) > 0) return true
  return (booking.payment_records || []).length > 0
}

// What to COLLECT, from what the guest agreed to when they booked: the 50%
// deposit, or the whole thing. Older and imported bookings carry no plan, so
// those fall back to whatever is still owed.
//
// Once the deposit HAS been paid this switches to the outstanding balance: the
// deposit is done, so what is left to collect is the rest of the stay. Returning
// the deposit portion here would show ₱0 and hide money the guest still owes.
//
// `tabTotal` is what has been run up on the guest's food tab (k69). It is
// subtracted before the deposit is worked out, because the deposit is agreed on
// the STAY alone — a lunch eaten after booking must never inflate what the desk
// asks for on arrival. It does count towards the balance, which already carries
// it once the tab is folded in.
export function amountToPayNow(booking: Booking, tabTotal = 0): number {
  const paid = Number(booking.downpayment_paid || 0)
  const owed = Number(booking.balance_due || 0)
  if (hasPaymentRecorded(booking)) return owed
  if (booking.payment_plan === 'full') return owed
  // The desk agreed a figure when the booking was made (card k130): ask for
  // exactly that, never a recomputed half. Capped at what is actually owed, so a
  // deposit larger than the bill can never be requested.
  const agreed = Number(booking.agreed_deposit || 0)
  if (agreed > 0) return Math.max(0, Math.min(owed, Math.round(agreed - paid)))
  if (booking.payment_plan === 'deposit') {
    const stayOwed = Math.max(0, owed - Math.max(0, tabTotal))
    return Math.max(0, Math.min(owed, Math.round((paid + stayOwed) / 2) - paid))
  }
  return owed
}

// Just the status word, with no amount in it. For places that already show the
// money as its own big number, repeating it in the badge reads as two different
// figures when it is really the same one.
export function paymentStatusWord(booking: Booking): string {
  const tone = getPaymentView(booking).tone
  if (tone === 'paid') return 'Paid'
  if (tone === 'partial') return 'Partial'
  if (tone === 'reserved') return 'Reserved'
  if (tone === 'billed') return 'Billed'
  return 'Owes'
}


// Plain label for the agreed payment plan, or '' when nothing was agreed.
// `custom` names the figure on the paper instead — `Custom · ₱1,000 now` — because a
// custom amount means nothing without the number beside it (the statement composes it).
// `reservation` is just **`Reservation`** (the owner, 2026-09-29: *"remove the text after
// the payment plan type … the additional text after the text is redundant"*) — the word
// already says the guest agreed to pay nothing now, so `— nothing paid` only repeated it.
// Every plan label is now the PLAN'S NAME ALONE; the statement adds a figure where one
// exists, and nothing else is appended.
export function paymentPlanLabel(plan?: Booking['payment_plan']): string {
  if (plan === 'full') return 'Full payment'
  if (plan === 'deposit') return 'Deposit (50%)'
  if (plan === 'custom') return 'Custom'
  if (plan === 'reservation') return 'Reservation'
  if (plan === 'agency') return 'Billed to agency'
  return ''
}

// The one place the automatic payment status is worked out from the money:
// nothing received → unpaid, part of it → deposit, nothing left → paid. Used
// wherever the balance is recomputed (check-in, check-out, breakfast, and the
// guest's food tab), so the status can never drift from the money — including
// the case where a charge added later re-opens a bill that was already settled.
export function paymentStatusFromMoney(paid: number, remaining: number): 'unpaid' | 'downpayment' | 'paid' {
  if (remaining <= 0) return 'paid'
  return paid > 0 ? 'downpayment' : 'unpaid'
}

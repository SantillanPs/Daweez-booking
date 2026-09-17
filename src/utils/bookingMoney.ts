import { Booking } from '../types/booking'

export type PaymentTone = 'paid' | 'partial' | 'owes'

export interface PaymentView {
  tone: PaymentTone
  label: string
  amount: number
}

// Colors for the payment badge: money owed is the first thing staff scan for.
export const PAYMENT_BADGE_CLASSES: Record<PaymentTone, string> = {
  paid: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  partial: 'bg-amber-100 text-amber-800 border border-amber-200',
  owes: 'bg-rose-100 text-rose-700 border border-rose-200',
}

// Plain-language payment status, built so non-accounting staff can read it instantly.
export function getPaymentView(booking: Booking): PaymentView {
  const due = booking.balance_due || 0
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

// True when a booking still has money left to collect (blocks don't owe).
export function isOwed(booking: Booking): boolean {
  if (booking.status === 'blocked') return false
  return booking.payment_status !== 'paid'
}

// True when the guest still has an unpaid balance. Blocks never owe, and a
// booking marked paid is settled even if a stale balance_due survived.
export function hasOutstandingBalance(booking: Booking): boolean {
  if (booking.status === 'blocked') return false
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
export function amountToPayNow(booking: Booking): number {
  const paid = Number(booking.downpayment_paid || 0)
  const owed = Number(booking.balance_due || 0)
  if (hasPaymentRecorded(booking)) return owed
  if (booking.payment_plan === 'full') return owed
  if (booking.payment_plan === 'deposit') {
    return Math.max(0, Math.min(owed, Math.round((paid + owed) / 2) - paid))
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
  return 'Owes'
}


// Plain label for the agreed payment plan, or '' when nothing was agreed.
export function paymentPlanLabel(plan?: Booking['payment_plan']): string {
  if (plan === 'full') return 'Full payment'
  if (plan === 'deposit') return 'Deposit (50%)'
  return ''
}

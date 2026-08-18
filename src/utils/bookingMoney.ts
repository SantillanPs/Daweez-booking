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

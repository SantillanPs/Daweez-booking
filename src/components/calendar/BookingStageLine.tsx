import React from 'react'
import { Booking } from '../../types/booking'
import { getPaymentView, PaymentTone } from '../../utils/bookingMoney'
import { BookingStep } from './bookingStep'
import { CountPeso } from '../CountPeso'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()
const fmtWhen = (iso?: string) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

const MONEY_TEXT: Record<PaymentTone, string> = {
  paid: 'text-emerald-700',
  partial: 'text-danger-600',
  owes: 'text-danger-600',
  reserved: 'text-ink-800',
  billed: 'text-ink-800',
}

interface BookingStageLineProps {
  booking: Booking
  /** The step the panel is asking for now — its bar is gold. */
  now: BookingStep
}

/**
 * Where a booking stands, in three facts side by side: the money, the arrival, the
 * departure (the staff's feedback, 2026-10-04 — they could not tell whether a booking
 * was paid, checked in or checked out, and the panel did not say what came next).
 *
 * Each fact is said in words, never by colour alone. The bar above it is green once the
 * step is done, gold for the step the desk does next, and grey for one still to come.
 */
export function BookingStageLine({ booking, now }: BookingStageLineProps) {
  const view = getPaymentView(booking)
  const due = Number(booking.balance_due || 0)
  const moneyWord =
    view.tone === 'paid' ? 'Paid'
      : view.tone === 'reserved' ? 'Reserved'
        : view.tone === 'billed' ? 'Agency · ' + fmtPeso(due)
          : due > 0 ? fmtPeso(due) + ' left' : 'Not paid'

  const steps: { key: BookingStep; label: string; word: React.ReactNode; done: boolean; tone: string }[] = [
    // What is left counts down as money is received, where the desk is looking.
    {
      key: 'payment', label: 'Payment', done: view.tone === 'paid', tone: MONEY_TEXT[view.tone],
      word: view.tone === 'partial' || view.tone === 'owes' ? (due > 0 ? <><CountPeso value={due} /> left</> : moneyWord) : moneyWord,
    },
    {
      key: 'checkIn', label: 'Check in', done: !!booking.actual_check_in,
      word: booking.actual_check_in ? fmtWhen(booking.actual_check_in) : 'Not yet',
      tone: booking.actual_check_in ? 'text-emerald-700' : 'text-main',
    },
    {
      key: 'checkOut', label: 'Check out', done: !!booking.actual_check_out,
      word: booking.actual_check_out ? fmtWhen(booking.actual_check_out) : 'Not yet',
      tone: booking.actual_check_out ? 'text-emerald-700' : 'text-main',
    },
  ]

  return (
    <ol className="grid grid-cols-3 gap-2">
      {steps.map(step => (
        <li key={step.key} className="min-w-0">
          <span className={'block h-1 rounded-full transition-colors duration-500 ' + (step.done ? 'bg-emerald-500' : step.key === now ? 'bg-gold-400' : 'bg-paper-300')} />
          <span className="block mt-1.5 text-[12px] text-muted">{step.label}</span>
          <span className={'block text-[14px] font-bold leading-tight transition-colors duration-300 ' + step.tone}>{step.word}</span>
        </li>
      ))}
    </ol>
  )
}

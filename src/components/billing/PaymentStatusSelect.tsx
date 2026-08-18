import React from 'react'
import { Banknote, ChevronDown } from 'lucide-react'
import { Booking } from '../../types/booking'

export type PaymentStatusOption = 'unpaid' | 'downpayment' | 'paid'

interface PaymentStatusSelectProps {
  booking: Booking
  onChange: (booking: Booking, status: PaymentStatusOption) => void
}

const OPTIONS: { value: PaymentStatusOption; label: string }[] = [
  { value: 'unpaid', label: 'Unpaid' },
  { value: 'downpayment', label: 'Deposit' },
  { value: 'paid', label: 'Fully paid' },
]

// Lets staff set a booking's payment to Unpaid / Deposit / Fully paid in one tap.
export function PaymentStatusSelect({ booking, onChange }: PaymentStatusSelectProps) {
  const current: PaymentStatusOption = booking.payment_status || 'unpaid'
  return (
    <div className="relative inline-flex items-center">
      <Banknote className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-brand-primary pointer-events-none" />
      <select
        value={current}
        title="Payment status"
        onChange={e => onChange(booking, e.target.value as PaymentStatusOption)}
        className="pl-8 pr-7 py-1.5 rounded-lg border border-soft bg-card text-[11px] font-semibold text-main focus:outline-none focus:ring-1 focus:ring-brand-primary/30 appearance-none cursor-pointer"
      >
        {OPTIONS.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  )
}

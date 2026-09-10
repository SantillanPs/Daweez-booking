import React from 'react'
import { AlertCircle } from 'lucide-react'
import { Booking } from '../../types/booking'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface ExtendStayFormProps {
  booking: Booking
  extendCheckoutDate: string
  setExtendCheckoutDate: (v: string) => void
  extendError: string
  extraNights: number
  newBalanceDue: number
  showErr: (f: 'extendCheckoutDate') => string
  isInvalid: (f: 'extendCheckoutDate') => boolean
  markTouched: (f: 'extendCheckoutDate') => () => void
  onSubmit: (e: React.FormEvent) => void
}

// Push the check-out date out. Kept in its own collapsed block because it is a
// rare action — it should not compete with the day-to-day ones.
export function ExtendStayForm({
  booking, extendCheckoutDate, setExtendCheckoutDate, extendError,
  extraNights, newBalanceDue, showErr, isInvalid, markTouched, onSubmit,
}: ExtendStayFormProps) {
  const baseField = 'w-full bg-page border text-main px-2.5 py-2 rounded-lg text-xs font-mono outline-none'
  const field = baseField + ' border-gold-300 focus:bg-card focus:border-gold-500'
  const fieldErr = baseField + ' border-danger-400 focus:bg-card focus:border-danger-500'

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {extendError && (
        <div className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-xs flex items-center gap-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{extendError}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-muted font-bold block mb-1">Check-in</label>
          <input type="date" readOnly value={booking.check_in}
            className="w-full bg-softbg border border-soft text-muted px-2.5 py-2 rounded-lg text-xs font-mono outline-none" />
        </div>
        <div>
          <label className="text-[10px] text-gold-700 font-bold block mb-1">New check-out <span className="text-danger-600">*</span></label>
          <input type="date" min={booking.check_in} value={extendCheckoutDate}
            onChange={e => setExtendCheckoutDate(e.target.value)}
            onBlur={markTouched('extendCheckoutDate')}
            className={isInvalid('extendCheckoutDate') ? fieldErr : field} />
          {showErr('extendCheckoutDate') && <p className="text-[10px] text-danger-600 mt-1">{showErr('extendCheckoutDate')}</p>}
        </div>
      </div>

      {extraNights > 0 && (
        <div className="p-3 bg-gold-100 border border-gold-200 rounded-lg text-[12px] space-y-1">
          <div className="flex justify-between text-muted">
            <span>Extra nights</span>
            <span className="font-mono text-main font-semibold">+{extraNights}</span>
          </div>
          <div className="flex justify-between font-bold border-t border-gold-200/70 pt-1">
            <span className="text-muted">New amount to pay</span>
            <span className={'font-mono ' + (newBalanceDue > 0 ? 'text-danger-600' : 'text-emerald-600')}>{fmtPeso(newBalanceDue)}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={extendCheckoutDate === booking.check_out}
        className="w-full bg-card hover:bg-gold-100 disabled:bg-softbg disabled:text-muted text-main border border-soft text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer"
      >
        Save extension
      </button>
    </form>
  )
}
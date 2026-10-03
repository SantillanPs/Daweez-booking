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
  /** A short stay being turned into a normal one: the nights it will cover. 0 otherwise. */
  becomesNights?: number
  newBalanceDue: number
  showErr: (f: 'extendCheckoutDate') => string
  isInvalid: (f: 'extendCheckoutDate') => boolean
  markTouched: (f: 'extendCheckoutDate') => () => void
  onSubmit: (e: React.FormEvent) => void
}

// Push the check-out date out. A rare action, so it is opened from the quiet row at the
// bottom of the booking panel rather than sitting on screen. **One date and one button**:
// the greyed check-in box that used to stand beside it could not be changed and only
// repeated the dates in the panel's header (the owner's feedback, 2026-10-04).
export function ExtendStayForm({
  booking, extendCheckoutDate, setExtendCheckoutDate, extendError,
  extraNights, becomesNights = 0, newBalanceDue, showErr, isInvalid, markTouched, onSubmit,
}: ExtendStayFormProps) {
  const isBlock = booking.status === 'blocked'
  const baseField = 'mt-1 w-full h-11 bg-card border text-main px-3 rounded-lg text-[13px] outline-none'
  const field = baseField + ' border-soft focus:border-gold-500'
  const fieldErr = baseField + ' border-danger-400 focus:border-danger-500'

  return (
    <form onSubmit={onSubmit} className="space-y-2.5">
      {extendError && (
        <div className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-[12px] flex items-center gap-2 rounded-lg">
          <AlertCircle className="w-4 h-4 shrink-0" /><span>{extendError}</span>
        </div>
      )}
      <label className="block">
        <span className="block text-[12px] font-semibold text-muted">{isBlock ? 'Block ends' : 'New check-out'}</span>
        <input type="date" min={booking.check_in} value={extendCheckoutDate}
          onChange={e => setExtendCheckoutDate(e.target.value)}
          onBlur={markTouched('extendCheckoutDate')}
          className={isInvalid('extendCheckoutDate') ? fieldErr : field} />
      </label>
      {showErr('extendCheckoutDate') && <p className="text-[12px] font-semibold text-danger-600">{showErr('extendCheckoutDate')}</p>}

      {(extraNights > 0 || becomesNights > 0) && (
        <div className="p-3 bg-gold-100 border border-gold-200 rounded-lg text-[13px] space-y-1">
          <div className="flex justify-between text-muted">
            <span>{becomesNights > 0 ? 'Becomes a normal stay' : 'Extra nights'}</span>
            <span className="text-main font-semibold">
              {becomesNights > 0 ? becomesNights + (becomesNights === 1 ? ' night' : ' nights') : '+' + extraNights}
            </span>
          </div>
          <div className="flex justify-between font-bold border-t border-gold-200/70 pt-1">
            <span className="text-muted">New amount to pay</span>
            <span className={newBalanceDue > 0 ? 'text-danger-600' : 'text-emerald-600'}>{fmtPeso(newBalanceDue)}</span>
          </div>
        </div>
      )}

      <button
        type="submit"
        disabled={extendCheckoutDate === booking.check_out && !booking.stay_hours}
        className="w-full min-h-11 bg-card hover:bg-gold-100 disabled:bg-softbg disabled:text-muted disabled:cursor-default text-main border border-soft text-[13px] font-bold rounded-lg transition-colors cursor-pointer"
      >
        {isBlock ? 'Save the dates' : booking.stay_hours ? 'Change to a normal stay' : 'Save extension'}
      </button>
    </form>
  )
}

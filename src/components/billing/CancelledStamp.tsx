import { Booking } from '../../types/booking'

// A cancelled bill is stamped like a paid one (Sebastian, 2026-10-29: "similar to how the
// fully paid design looks"), in red with the day it was cancelled, and the desk's reason
// written under it. Sits to the left of the totals column, which must be `relative`.
export function CancelledStamp({ booking }: { booking: Pick<Booking, 'status' | 'cancelled_at' | 'cancel_note'> }) {
  if (booking.status !== 'cancelled') return null
  const on = booking.cancelled_at ? new Date(booking.cancelled_at) : null
  const day = on && !isNaN(on.getTime())
    ? on.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()
    : ''
  const note = (booking.cancel_note || '').trim()
  return (
    <>
      <span aria-label="Cancelled"
        className="bill-stamp pointer-events-none absolute right-full mr-6 top-2 px-3 py-0.5 rounded-lg border-[3px] border-danger-600 text-danger-600 font-display text-[24px] font-extrabold tracking-[0.12em] leading-tight opacity-85 mix-blend-multiply text-center">
        CANCELLED
        {day && <small className="block -mt-0.5 font-mono text-[9.5px] font-bold tracking-[0.04em]">{day}</small>}
      </span>
      {note && (
        <p className="bill-why pointer-events-none absolute right-full mr-4 top-[74px] w-max max-w-[220px] -rotate-3 text-right text-[12px] font-semibold leading-snug text-danger-600">
          “{note}”
        </p>
      )}
    </>
  )
}

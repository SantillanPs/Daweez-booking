import React from 'react'
import { X, BedDouble, PartyPopper, CalendarX } from 'lucide-react'

interface BookingWizardHeaderProps {
  hasVenues: boolean
  hasRooms: boolean
  bookingType: 'individual' | 'partner'
  formStatus: 'confirmed' | 'blocked'
  setFormStatus: (s: 'confirmed' | 'blocked') => void
  formGuestName: string
  onClose: () => void
}

// Modal header + the Booking / Block dates switch.
//
// The three steps are gone (owner's decision, card k126): the whole booking is
// one page now, so there is no step indicator to draw and nothing to click
// through — the form reads like the paper form staff already know.
export function BookingWizardHeader({
  hasVenues, hasRooms, bookingType,
  formStatus, setFormStatus, onClose,
}: BookingWizardHeaderProps) {
  return (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-base-300 shrink-0 bg-base-100">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 flex items-center justify-center bg-primary/10 border border-base-300 rounded-lg">
          {hasVenues && !hasRooms
            ? <PartyPopper className="w-3.5 h-3.5 text-primary" />
            : <BedDouble className="w-3.5 h-3.5 text-primary" />}
        </div>
        <div>
          <h3 className="text-sm font-bold text-base-content">New Reservation</h3>
          <p className="text-[10px] text-base-content/60 font-medium">
            {bookingType === 'partner' ? 'Quick Partner Booking' : 'One form — everything on this page'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {formStatus === 'blocked' ? (
          <button type="button" onClick={() => setFormStatus('confirmed')} className="btn btn-ghost btn-sm">&larr; Booking</button>
        ) : (
          <button type="button" onClick={() => setFormStatus('blocked')} className="btn btn-outline btn-primary btn-sm">
            <CalendarX className="w-3.5 h-3.5" /> Block dates
          </button>
        )}
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm -mr-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

import React from 'react'
import { X, BedDouble, PartyPopper, CalendarX } from 'lucide-react'

interface BookingWizardHeaderProps {
  hasVenues: boolean
  hasRooms: boolean
  bookingType: 'individual' | 'partner'
  /** Only ever `blocked` while CORRECTING a block — see the note below. */
  formStatus: 'confirmed' | 'blocked'
  setFormStatus: (s: 'confirmed' | 'blocked') => void
  formGuestName: string
  onClose: () => void
}

// Modal header. **No Booking / Block dates switch any more** (the owner, 2026-09):
// blocking starts on the CALENDAR — you pick the dates, then the block icon in the
// grid's action bar opens a small pane that only asks why (`BlockDatesPane`). The form
// is therefore always the booking form. The `Block dates` switch survives in ONE case:
// correcting a block that already exists, where `formStatus` is restored as `blocked`
// and the desk can switch it back to a booking.
//
// The three steps are gone too (owner's decision, card k126): the whole booking is one
// page, so there is no step indicator to draw and nothing to click through — the form
// reads like the paper form staff already know.
//
// **There is no agency mark in here** (the owner's ruling, 2026-09): asking “is an agency
// paying?” belongs with the guest, so it lives behind a small ⋯ on the Guest Information
// card (`RoomDetailsForm` → `AgencyFields`). This header is only a title and a close.
export function BookingWizardHeader({
  hasVenues, hasRooms, bookingType,
  formStatus, setFormStatus, formGuestName, onClose,
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
          <h3 className="text-sm font-bold text-base-content">
            {formStatus === 'blocked' ? 'Blocked dates' : bookingType === 'partner' && formGuestName ? 'c/o ' + formGuestName : 'New Reservation'}
          </h3>
          <p className="text-[10px] text-base-content/60 font-medium">
            {formStatus === 'blocked'
              ? 'Correcting a block'
              : bookingType === 'partner' ? 'An agency is paying' : 'One form — everything on this page'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        {/* Only while correcting a block: the only way back to a booking. */}
        {formStatus === 'blocked' && (
          <button type="button" onClick={() => setFormStatus('confirmed')} className="btn btn-ghost btn-sm">
            <CalendarX className="w-3.5 h-3.5" /> &larr; Booking
          </button>
        )}
        <button type="button" onClick={onClose} className="btn btn-ghost btn-sm -mr-1.5">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

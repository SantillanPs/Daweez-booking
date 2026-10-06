import React from 'react'
import { X, CalendarX } from 'lucide-react'

interface BookingWizardHeaderProps {
  bookingType: 'individual' | 'partner'
  /** Only ever `blocked` while CORRECTING a block — see the note below. */
  formStatus: 'confirmed' | 'blocked'
  setFormStatus: (s: 'confirmed' | 'blocked') => void
  formGuestName: string
  /** A saved booking is being corrected, not a new one made. */
  editing: boolean
  /** What is being booked — `Bunk Bed 3 · Oct 4 → Oct 5 · 1 night` (see `stayLines`). */
  stay: string[]
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
// section (`RoomDetailsForm` → `AgencyFields`). This header is only a title and a close.
//
// **Under the title is the stay itself** (the design review, 2026-10-04): the room, the
// dates and the nights, so the desk can read them back before taking money. That line
// used to be a caption about the form (`One form — everything on this page`). The title
// is `New booking`, the calendar's own words — it said `New Reservation`, and
// `Reservation` is also one of the four payment plans, meaning something else. The bed
// in a tinted tile beside it went with the rest of the form's boxes: the line already
// says `Room 4` or `Gazebo`.
export function BookingWizardHeader({
  bookingType, formStatus, setFormStatus, formGuestName, editing, stay, onClose,
}: BookingWizardHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 pl-5 sm:pl-6 pr-2 py-3 border-b border-soft shrink-0 bg-card">
      <div className="min-w-0">
        <h3 className="text-[13px] font-medium text-muted">
          {formStatus === 'blocked' ? 'Blocked dates' : bookingType === 'partner' && formGuestName ? 'c/o ' + formGuestName : editing ? 'Correcting a booking' : 'New booking'}
        </h3>
        {formStatus === 'blocked' || stay.length === 0 ? (
          <p className="font-display text-[18px] leading-snug font-bold tracking-tight text-main">
            {formStatus === 'blocked' ? 'Correcting a block' : 'No room or venue picked'}
          </p>
        ) : stay.map(line => (
          <p key={line} className="font-display text-[18px] leading-snug font-bold tracking-tight text-main">{line}</p>
        ))}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Only while correcting a block: the only way back to a booking. */}
        {formStatus === 'blocked' && (
          <button type="button" onClick={() => setFormStatus('confirmed')} className="min-h-11 px-3 inline-flex items-center gap-1.5 rounded-lg text-[14px] font-bold text-main hover:bg-softbg transition-colors cursor-pointer">
            <CalendarX className="w-4 h-4" /> &larr; Booking
          </button>
        )}
        <button type="button" onClick={onClose} title="Close" aria-label="Close"
          className="w-11 h-11 inline-flex items-center justify-center rounded-md text-muted hover:bg-softbg hover:text-main transition-colors cursor-pointer">
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

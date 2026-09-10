import React from 'react'
import { X, BedDouble, PartyPopper, CalendarX } from 'lucide-react'

interface BookingWizardHeaderProps {
  hasVenues: boolean
  hasRooms: boolean
  bookingType: 'individual' | 'partner'
  formStep: number
  setFormStep: (s: number) => void
  formStatus: 'confirmed' | 'blocked'
  setFormStatus: (s: 'confirmed' | 'blocked') => void
  formGuestName: string
  onClose: () => void
}

// Modal header + the 3-step indicator (Booking / Block dates toggle).
export function BookingWizardHeader({
  hasVenues, hasRooms, bookingType, formStep, setFormStep,
  formStatus, setFormStatus, formGuestName, onClose,
}: BookingWizardHeaderProps) {
  return (
    <>
      {/* ── Header ── */}
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
              {bookingType === 'partner' ? 'Quick Partner Booking' : `Step ${formStep} of 3`}
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


      {bookingType === 'individual' && (
        <div className="flex items-center px-5 py-2.5 border-b border-base-300 shrink-0 bg-base-200/50">
          {[1, 2, 3].map(s => {
            const isActive = formStep === s
            const isCompleted = formStep > s
            const isNextStepReady = (s === 2 || s === 3) && formStatus === 'confirmed' && !!formGuestName
            const isUnlocked = s <= formStep || isNextStepReady
            return (
              <React.Fragment key={s}>
                {s > 1 && (
                  <div className={'flex-1 h-0.5 transition-all duration-300 ' + (isCompleted ? 'bg-primary' : 'bg-base-300')} />
                )}
                <button type="button" disabled={!isUnlocked} onClick={() => setFormStep(s)}
                  className={'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer ' + (isActive ? 'bg-primary border-primary text-primary-content shadow-sm ring-2 ring-primary/20' : isCompleted ? 'bg-primary/10 border-primary text-primary hover:bg-primary hover:text-primary-content' : isUnlocked ? 'bg-base-100 border-primary text-primary hover:bg-primary hover:text-primary-content animate-pulse' : 'bg-base-100 border-base-300 text-base-content/60 disabled:cursor-not-allowed opacity-50')}>
                  {s}
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </>
  )
}

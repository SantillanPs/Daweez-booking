import React, { useState, useMemo } from 'react'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import {
  X, AlertCircle, BedDouble, PartyPopper
} from 'lucide-react'

// Import modular subcomponents
import { GuestDetailsForm } from './walk-in/GuestDetailsForm'
import { RoomDetailsForm } from './walk-in/RoomDetailsForm'
import { AmenitiesForm } from './walk-in/AmenitiesForm'
import { BillingSummary } from './walk-in/BillingSummary'

interface WalkInBookingFormProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  createManualBooking: (params: {
    roomId?: string
    venueId?: string
    guestName: string
    guestEmail: string
    guestPhone: string
    checkIn: string
    checkOut: string
    source: BookingSource
    status: 'confirmed' | 'blocked'
    breakfastOrders?: BreakfastOrder[]
    equipmentRentals?: EquipmentRental
    eventAddons?: EventAddons
    rateMultiplier?: number
    companions?: Companion[]
  }) => Promise<Booking>
  cancelBooking: (bookingId: string) => Promise<void>
  initialRoomIds: Set<string>
  initialVenueIds: Set<string>
  initialCheckIn: string
  initialCheckOut: string
  onClose: () => void
}

export function WalkInBookingForm({
  rooms,
  venues,
  bookings,
  createManualBooking,
  cancelBooking,
  initialRoomIds,
  initialVenueIds,
  initialCheckIn,
  initialCheckOut,
  onClose
}: WalkInBookingFormProps) {
  // ── Core wizard state ──
  const [formStep, setFormStep] = useState<number>(1)
  
  // Staggered Date Selection Map per selected Room/Venue
  const [unitSelections, setUnitSelections] = useState<Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>>(() => {
    const initial: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
    initialRoomIds.forEach(id => {
      initial[id] = { checkIn: initialCheckIn, checkOut: initialCheckOut, type: 'room' }
    })
    initialVenueIds.forEach(id => {
      initial[id] = { checkIn: initialCheckIn, checkOut: initialCheckOut, type: 'venue' }
    })
    return initial
  })

  const [formGuestName, setFormGuestName] = useState('')
  const [formGuestEmail, setFormGuestEmail] = useState('')
  const [formGuestPhone, setFormGuestPhone] = useState('')
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState('')
  const [formCompanions, setFormCompanions] = useState<Companion[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formAdditionalDiscount, setFormAdditionalDiscount] = useState(0)

  // ── Add-ons state ──
  const [formChairs, setFormChairs] = useState(0)
  const [formExtraFoam, setFormExtraFoam] = useState(0)
  const [formExtraPillow, setFormExtraPillow] = useState(0)
  const [formExtraBlanket, setFormExtraBlanket] = useState(0)
  const [formExtraTowel, setFormExtraTowel] = useState(0)
  const [formEventTable, setFormEventTable] = useState(0)
  const [formEventTent, setFormEventTent] = useState(0)

  // ── Collapsible toggles ──
  const [showCompanions, setShowCompanions] = useState(true)

  const formRoomIds = useMemo(() => {
    const s = new Set<string>()
    Object.entries(unitSelections).forEach(([id, sel]) => {
      if (sel.type === 'room') s.add(id)
    })
    return s
  }, [unitSelections])

  const formVenueIds = useMemo(() => {
    const s = new Set<string>()
    Object.entries(unitSelections).forEach(([id, sel]) => {
      if (sel.type === 'venue') s.add(id)
    })
    return s
  }, [unitSelections])

  const hasRooms = formRoomIds.size > 0
  const hasVenues = formVenueIds.size > 0

  const isValidDates = useMemo(() => {
    const entries = Object.values(unitSelections)
    if (entries.length === 0) return false
    return entries.every(sel => sel.checkIn && sel.checkOut && sel.checkIn < sel.checkOut)
  }, [unitSelections])

  // ── Pricing calculations ──
  const { estBreakfast, estRentals, estAddons, estTotal, estDown, estDue } = useMemo(() => {
    let base = 0
    let breakfast = 0
    let rentals = 0

    const baselineDiscount = formSource === 'manual' ? 20 : 0
    const totalDiscount = baselineDiscount + formAdditionalDiscount
    const rateMultiplier = Math.max(0, 1 - totalDiscount / 100)

    Object.entries(unitSelections).forEach(([id, sel]) => {
      const price = sel.type === 'room'
        ? (rooms.find(r => r.id === id)?.base_price ?? 0)
        : (venues.find(v => v.id === id)?.base_price ?? 0)
      
      const n = sel.checkIn && sel.checkOut
        ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
        : 1
      
      base += Math.round(price * rateMultiplier) * n

      if (sel.type === 'room') {
        breakfast += 150 * (1 + formCompanions.length) * n
        rentals += (formExtraFoam * 200 + formExtraPillow * 50 + formExtraBlanket * 50 + formExtraTowel * 50) * n
      }
    })

    if (hasVenues) {
      rentals += formEventTable * 150 + formEventTent * 500 + formChairs * 15
    }

    const total = base + breakfast + rentals
    const down = Math.round(total * 0.5)
    
    // Per-unit security deposit: ₱500 per room and venue
    const unitCount = Object.keys(unitSelections).length
    const due = (total - down) + (formStatus === 'blocked' ? 0 : 500 * unitCount)

    return {
      estBreakfast: breakfast,
      estRentals: rentals,
      estAddons: 0,
      estTotal: total,
      estDown: down,
      estDue: due
    }
  }, [unitSelections, formSource, formAdditionalDiscount, formCompanions.length, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs, formStatus, rooms, venues, hasVenues])

  const hasAddons = estBreakfast > 0 || estRentals > 0 || estAddons > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (!isValidDates) {
      setFormError('Please select valid check-in and check-out dates for all units.'); return
    }
    if (Object.keys(unitSelections).length === 0) {
      setFormError('Please select at least one room or event venue.'); return
    }
    if (formStatus === 'confirmed' && !formGuestName) {
      setFormError('Guest name is required.'); return
    }
    setIsSubmitting(true)

    // 1. Run collision checks for all selected units on their respective dates
    for (const [id, sel] of Object.entries(unitSelections)) {
      const isRoom = sel.type === 'room'
      if (isRoom) {
        if (!syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, bookings)) {
          const roomNum = rooms.find(r => r.id === id)?.room_number || id
          setFormError(`Room ${roomNum} is already booked for the selected dates.`)
          setIsSubmitting(false); return
        }
      } else {
        if (!syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, bookings)) {
          const venueName = venues.find(v => v.id === id)?.name || id
          setFormError(`Venue ${venueName} is already reserved for the selected dates.`)
          setIsSubmitting(false); return
        }
      }
    }

    const totalDiscount = (formSource === 'manual' ? 20 : 0) + formAdditionalDiscount
    const rateMultiplier = Math.max(0, 1 - totalDiscount / 100)

    const createdBookings: Booking[] = []
    try {
      // 2. Loop to create room bookings
      let isFirstRoom = true
      for (const roomId of Array.from(formRoomIds)) {
        const sel = unitSelections[roomId]
        const rentals = isFirstRoom ? {
          bigTableCount: 0,
          smallTableCount: 0,
          chairCount: 0,
          mineralWaterCount: 0,
          extraFoamCount: formExtraFoam,
          extraPillowCount: formExtraPillow,
          extraBlanketCount: formExtraBlanket,
          extraTowelCount: formExtraTowel
        } : undefined
        isFirstRoom = false

        const b = await createManualBooking({
          roomId, guestName: formGuestName, guestEmail: formGuestEmail,
          guestPhone: formGuestPhone, checkIn: sel.checkIn, checkOut: sel.checkOut,
          source: formSource, status: formStatus,
          equipmentRentals: rentals,
          rateMultiplier,
          companions: formCompanions.length > 0 ? formCompanions : undefined
        })
        createdBookings.push(b)
      }

      // 3. Loop to create venue bookings
      let isFirstVenue = true
      for (const venueId of Array.from(formVenueIds)) {
        const sel = unitSelections[venueId]
        const rentals = isFirstVenue ? {
          bigTableCount: 0,
          smallTableCount: 0,
          chairCount: formChairs,
          mineralWaterCount: 0,
          tableCount: formEventTable,
          tentCount: formEventTent
        } : undefined
        isFirstVenue = false

        const b = await createManualBooking({
          venueId, guestName: formGuestName, guestEmail: formGuestEmail,
          guestPhone: formGuestPhone, checkIn: sel.checkIn, checkOut: sel.checkOut,
          source: formSource, status: formStatus,
          equipmentRentals: rentals,
          rateMultiplier,
          companions: formCompanions.length > 0 ? formCompanions : undefined
        })
        createdBookings.push(b)
      }

      onClose()
    } catch (err: unknown) {
      // Rollback successfully created bookings on failure
      for (const b of createdBookings) {
        try {
          await cancelBooking(b.id)
        } catch (rollbackErr) {
          console.error('Failed to rollback booking:', b.id, rollbackErr)
        }
      }
      setFormError(err instanceof Error ? err.message : 'Booking failed — possible date overlap.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-md md:max-w-4xl bg-white rounded-lg border border-slate-200 shadow-xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden transition-all duration-300" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center bg-[#FDFBF7] border border-[#E5D5C0] rounded-md">
              {hasVenues && !hasRooms
                ? <PartyPopper className="w-3.5 h-3.5 text-[#B89251]" />
                : <BedDouble className="w-3.5 h-3.5 text-[#B89251]" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">New Reservation</h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Step {formStep} of {formStatus === 'blocked' ? 2 : 3}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 -mr-1.5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step Progress Indicator ── */}
        <div className="flex items-center px-5 py-2.5 border-b border-slate-100 shrink-0 bg-slate-50/50">
          {[1, 2, 3].map(s => {
            if (s === 3 && formStatus === 'blocked') return null
            const isActive = formStep === s
            const isCompleted = formStep > s
            return (
              <React.Fragment key={s}>
                {s > 1 && (
                  <div className={`flex-1 h-0.5 transition-all duration-300 ${isCompleted ? 'bg-[#B89251]' : 'bg-slate-200'}`} />
                )}
                <button type="button" disabled={s > formStep} onClick={() => setFormStep(s)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#B89251] border-[#B89251] text-white shadow-sm'
                      : isCompleted
                        ? 'bg-[#FDFBF7] border-[#B89251] text-[#9A783E] font-semibold'
                        : 'bg-white border-slate-200 text-slate-400 disabled:cursor-not-allowed'
                  }`}>
                  {s}
                </button>
              </React.Fragment>
            )
          })}
        </div>

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-5 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6">

              {/* ── LEFT COLUMN: Progressive Wizard Fields ── */}
              <div className="space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-md animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                  </div>
                )}

                {/* STEP 1: Resource Schedule & Type Selection */}
                {formStep === 1 && (
                  <GuestDetailsForm
                    rooms={rooms}
                    venues={venues}
                    bookings={bookings}
                    unitSelections={unitSelections}
                    setUnitSelections={setUnitSelections}
                    formSource={formSource}
                    setFormSource={setFormSource}
                    formStatus={formStatus}
                    setFormStatus={setFormStatus}
                    formAdditionalDiscount={formAdditionalDiscount}
                    setFormAdditionalDiscount={setFormAdditionalDiscount}
                  />
                )}

                {/* STEP 2: Guest Details & Companions */}
                {formStep === 2 && (
                  <RoomDetailsForm
                    formStatus={formStatus}
                    formGuestName={formGuestName}
                    setFormGuestName={setFormGuestName}
                    formGuestEmail={formGuestEmail}
                    setFormGuestEmail={setFormGuestEmail}
                    formGuestPhone={formGuestPhone}
                    setFormGuestPhone={setFormGuestPhone}
                    formCompanions={formCompanions}
                    setFormCompanions={setFormCompanions}
                    showCompanions={showCompanions}
                    setShowCompanions={setShowCompanions}
                    hasRooms={hasRooms}
                  />
                )}

                {/* STEP 3: Add-ons & Services */}
                {formStep === 3 && formStatus === 'confirmed' && (
                  <AmenitiesForm
                    hasRooms={hasRooms}
                    hasVenues={hasVenues}
                    hasAddons={hasAddons}
                    estRentals={estRentals}
                    estAddons={estAddons}
                    formChairs={formChairs}
                    setFormChairs={setFormChairs}
                    formExtraFoam={formExtraFoam}
                    setFormExtraFoam={setFormExtraFoam}
                    formExtraPillow={formExtraPillow}
                    setFormExtraPillow={setFormExtraPillow}
                    formExtraBlanket={formExtraBlanket}
                    setFormExtraBlanket={setFormExtraBlanket}
                    formExtraTowel={formExtraTowel}
                    setFormExtraTowel={setFormExtraTowel}
                    formEventTable={formEventTable}
                    setFormEventTable={setFormEventTable}
                    formEventTent={formEventTent}
                    setFormEventTent={setFormEventTent}
                  />
                )}

                {/* ── Step-by-Step Navigation Buttons ── */}
                <div className="flex justify-between items-center pt-4 border-t border-slate-200/60 mt-5 shrink-0 bg-white">
                  {formStep > 1 ? (
                    <button type="button" onClick={() => setFormStep(formStep - 1)}
                      className="text-xs text-[#9A783E] hover:text-[#B89251] font-bold px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer">
                      &larr; Back
                    </button>
                  ) : <div />}
                  
                  {formStep === 1 && (
                    <button type="button" disabled={!isValidDates} onClick={() => setFormStep(2)}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                      Next &rarr;
                    </button>
                  )}

                  {formStep === 2 && formStatus === 'confirmed' && (
                    <button type="button" disabled={!formGuestName} onClick={() => setFormStep(3)}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                      Next &rarr;
                    </button>
                  )}

                  {formStep === 2 && formStatus === 'blocked' && (
                    <button type="submit" disabled={isSubmitting}
                      className="bg-slate-700 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                      {isSubmitting ? 'Creating...' : 'Create Block'}
                    </button>
                  )}

                  {formStep === 3 && (
                    <button type="submit" disabled={isSubmitting}
                      className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2.5 rounded transition-all cursor-pointer shadow-sm">
                      {isSubmitting ? 'Creating...' : 'Confirm Booking'}
                    </button>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN: Invoice Estimate ── */}
              <BillingSummary
                formStatus={formStatus}
                unitSelections={unitSelections}
                rooms={rooms}
                venues={venues}
                estBreakfast={estBreakfast}
                estRentals={estRentals}
                estAddons={estAddons}
                estTotal={estTotal}
                estDown={estDown}
                estDue={estDue}
                formSource={formSource}
                formAdditionalDiscount={formAdditionalDiscount}
                guestEmail={formGuestEmail}
              />

            </div>
          </div>
        </form>

      </div>
    </div>
  )
}

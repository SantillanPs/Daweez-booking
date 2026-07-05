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
  initialPathway: 'room' | 'venue'
  initialRoomIds: Set<string>
  initialVenueId?: string
  initialCheckIn: string
  initialCheckOut: string
  onClose: () => void
}

export function WalkInBookingForm({
  rooms,
  venues,
  bookings,
  createManualBooking,
  initialPathway,
  initialRoomIds,
  initialVenueId,
  initialCheckIn,
  initialCheckOut,
  onClose
}: WalkInBookingFormProps) {
  // ── Core wizard state ──
  const [formStep, setFormStep] = useState<number>(1)
  const [formPathway, setFormPathway] = useState<'room' | 'venue'>(initialPathway)
  const [formRoomIds, setFormRoomIds] = useState<Set<string>>(initialRoomIds)
  const [formVenueId, setFormVenueId] = useState<string>(initialVenueId || venues[0]?.id || 'venue-gazebo')
  const [formGuestName, setFormGuestName] = useState('')
  const [formGuestEmail, setFormGuestEmail] = useState('')
  const [formGuestPhone, setFormGuestPhone] = useState('')
  const [formCheckIn, setFormCheckIn] = useState(initialCheckIn)
  const [formCheckOut, setFormCheckOut] = useState(initialCheckOut)
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState('')
  const [formCompanions, setFormCompanions] = useState<Companion[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ── Add-ons state ──
  const [formBreakfastQty, setFormBreakfastQty] = useState<Record<string, number>>({ Bangsilog: 0, Lumpiasilog: 0, Cornsilog: 0, Hotsilog: 0 })
  const [formBigTable, setFormBigTable] = useState(0)
  const [formSmallTable, setFormSmallTable] = useState(0)
  const [formChairs, setFormChairs] = useState(0)
  const [formWater, setFormWater] = useState(0)
  const [formBand, setFormBand] = useState(false)
  const [formStage, setFormStage] = useState(false)
  const [formLedWall, setFormLedWall] = useState(false)

  // ── Collapsible toggles ──
  const [showAddons, setShowAddons] = useState(true) 
  const [showCompanions, setShowCompanions] = useState(true)

  // ── Pricing calculations ──
  const { basePrice, estNights, estBreakfast, estRentals, estAddons, estTotal, estDown, estDue } = useMemo(() => {
    const bp = formPathway === 'room'
      ? Array.from(formRoomIds).reduce((s, id) => s + (rooms.find(r => r.id === id)?.base_price ?? 0), 0)
      : (venues.find(v => v.id === formVenueId)?.base_price ?? 0)

    const nights = formCheckIn && formCheckOut
      ? Math.max(1, Math.ceil((new Date(formCheckOut).getTime() - new Date(formCheckIn).getTime()) / 86400000))
      : 1

    const base = bp * nights
    let breakfast = 0
    if (formPathway === 'room') {
      Object.values(formBreakfastQty).forEach(q => { breakfast += 200 * q })
    }
    let rentals = 0
    if (formPathway === 'venue') {
      rentals = formBigTable * 150 + formSmallTable * 100 + formChairs * 15 + formWater * 35
    }
    let addons = 0
    if (formPathway === 'venue') {
      if (formBand) addons += 2000
      if (formStage) addons += 2000
      if (formLedWall) addons += 5000
    }

    const total = base + breakfast + rentals + addons
    const down = Math.round(total * 0.5)
    const due = (total - down) + (formStatus === 'blocked' ? 0 : 500)

    return {
      basePrice: bp,
      estNights: nights,
      estBreakfast: breakfast,
      estRentals: rentals,
      estAddons: addons,
      estTotal: total,
      estDown: down,
      estDue: due
    }
  }, [formPathway, formRoomIds, formVenueId, formCheckIn, formCheckOut,
    formBreakfastQty, formBigTable, formSmallTable, formChairs, formWater,
    formBand, formStage, formLedWall, formStatus, rooms, venues])

  const hasAddons = estBreakfast > 0 || estRentals > 0 || estAddons > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (!formCheckIn || !formCheckOut) {
      setFormError('Please select active check-in and check-out dates.'); return
    }
    if (formCheckIn >= formCheckOut) {
      setFormError('Check-out date must be after check-in date.'); return
    }
    if (formStatus === 'confirmed' && !formGuestName) {
      setFormError('Guest name is required.'); return
    }
    setIsSubmitting(true)
    try {
      const breakfasts: BreakfastOrder[] = []
      if (formPathway === 'room') {
        Object.entries(formBreakfastQty).forEach(([meal, qty]) => {
          if (qty > 0) breakfasts.push({ option: meal as BreakfastOrder['option'], quantity: qty, withCoffee: true })
        })
      }
      if (formPathway === 'room') {
        const unavail = Array.from(formRoomIds).filter(id => !syncEngine.isRoomAvailable(id, formCheckIn, formCheckOut, bookings))
        if (unavail.length > 0) {
          setFormError(`${unavail.map(id => rooms.find(r => r.id === id)?.name || id).join(', ')} already booked for these dates.`)
          setIsSubmitting(false); return
        }
        for (const roomId of Array.from(formRoomIds)) {
          await createManualBooking({
            roomId, guestName: formGuestName, guestEmail: formGuestEmail,
            guestPhone: formGuestPhone, checkIn: formCheckIn, checkOut: formCheckOut,
            source: formSource, status: formStatus,
            breakfastOrders: breakfasts.length > 0 ? breakfasts : undefined,
            rateMultiplier: 1.0,
            companions: formCompanions.length > 0 ? formCompanions : undefined
          })
        }
      } else {
        if (!syncEngine.isVenueRangeAvailable(formVenueId, formCheckIn, formCheckOut, bookings)) {
          const venueName = venues.find(v => v.id === formVenueId)?.name || formVenueId
          setFormError(`${venueName} is already reserved for these dates.`);
          setIsSubmitting(false); return
        }
        await createManualBooking({
          venueId: formVenueId, guestName: formGuestName, guestEmail: formGuestEmail,
          guestPhone: formGuestPhone, checkIn: formCheckIn, checkOut: formCheckOut,
          source: formSource, status: formStatus,
          equipmentRentals: { bigTableCount: formBigTable, smallTableCount: formSmallTable, chairCount: formChairs, mineralWaterCount: formWater },
          eventAddons: { fullBandAndLights: formBand, stage: formStage, ledWall: formLedWall },
          rateMultiplier: 1.0
        })
      }
      onClose()
    } catch (err: unknown) {
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
              {formPathway === 'room'
                ? <BedDouble className="w-3.5 h-3.5 text-[#B89251]" />
                : <PartyPopper className="w-3.5 h-3.5 text-[#B89251]" />}
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
                    formPathway={formPathway}
                    setFormPathway={setFormPathway}
                    formRoomIds={formRoomIds}
                    setFormRoomIds={setFormRoomIds}
                    formVenueId={formVenueId}
                    setFormVenueId={setFormVenueId}
                    formCheckIn={formCheckIn}
                    setFormCheckIn={setFormCheckIn}
                    formCheckOut={formCheckOut}
                    setFormCheckOut={setFormCheckOut}
                    formSource={formSource}
                    setFormSource={setFormSource}
                    formStatus={formStatus}
                    setFormStatus={setFormStatus}
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
                  />
                )}

                {/* STEP 3: Add-ons & Services */}
                {formStep === 3 && formStatus === 'confirmed' && (
                  <AmenitiesForm
                    formPathway={formPathway}
                    showAddons={showAddons}
                    setShowAddons={setShowAddons}
                    hasAddons={hasAddons}
                    estBreakfast={estBreakfast}
                    estRentals={estRentals}
                    estAddons={estAddons}
                    formBreakfastQty={formBreakfastQty}
                    setFormBreakfastQty={setFormBreakfastQty}
                    formBigTable={formBigTable}
                    setFormBigTable={setFormBigTable}
                    formSmallTable={formSmallTable}
                    setFormSmallTable={setFormSmallTable}
                    formChairs={formChairs}
                    setFormChairs={setFormChairs}
                    formWater={formWater}
                    setFormWater={setFormWater}
                    formBand={formBand}
                    setFormBand={setFormBand}
                    formStage={formStage}
                    setFormStage={setFormStage}
                    formLedWall={formLedWall}
                    setFormLedWall={setFormLedWall}
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
                    <button type="button" disabled={!formCheckIn || (formPathway === 'room' && !formCheckOut)} onClick={() => setFormStep(2)}
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
                formPathway={formPathway}
                basePrice={basePrice}
                estNights={estNights}
                formRoomIds={formRoomIds}
                rooms={rooms}
                venues={venues}
                formVenueId={formVenueId}
                estBreakfast={estBreakfast}
                estRentals={estRentals}
                estAddons={estAddons}
                estTotal={estTotal}
                estDown={estDown}
                estDue={estDue}
              />

            </div>
          </div>
        </form>

      </div>
    </div>
  )
}

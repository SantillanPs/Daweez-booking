import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { useDashboardData } from './DashboardContext'
import {
  X, AlertCircle, BedDouble, PartyPopper, CheckCircle2
} from 'lucide-react'
import { PrintInvoiceModal } from './billing/PrintInvoiceModal'

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
    partnerDealId?: string
    companyName?: string
    vehiclePlate?: string
    invoiceType?: 'folio' | 'billing'
    breakfastIncluded?: boolean
    contractRateOverride?: number
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
  const [bookingType, setBookingType] = useState<'individual' | 'partner'>('individual')

  // ── Corporate / Partner presets state ──
  const { partnerDeals } = useDashboardData()
  const [formPartnerDealId, setFormPartnerDealId] = useState('')
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formVehiclePlate, setFormVehiclePlate] = useState('')
  const [formTIN, setFormTIN] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formInvoiceType, setFormInvoiceType] = useState<'folio' | 'billing'>('folio')

  const handleSelectPartnerDeal = (deal: PartnerDeal | null) => {
    if (deal) {
      setFormPartnerDealId(deal.id)
      setFormCompanyName(deal.name)
      setFormTIN(deal.tin || '')
      setFormAddress(deal.address || '')
      setFormVehiclePlate(deal.vehicle_plate || '')
      setFormInvoiceType(deal.invoice_type)
      setFormGuestEmail(deal.email || '')
      setFormGuestPhone(deal.contact_no || '')

      // Auto-select all rooms/venues that have contracted rates in this partner deal
      const initial: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
      if (deal.contracted_rates) {
        Object.entries(deal.contracted_rates).forEach(([id, rate]) => {
          if (rate > 0) {
            const isRoom = rooms.some(r => r.id === id)
            const isVenue = venues.some(v => v.id === id)
            if (isRoom) {
              initial[id] = { checkIn: formCheckIn || initialCheckIn, checkOut: formCheckOut || initialCheckOut, type: 'room' }
            } else if (isVenue) {
              initial[id] = { checkIn: formCheckIn || initialCheckIn, checkOut: formCheckOut || initialCheckOut, type: 'venue' }
            }
          }
        })
      }
      setUnitSelections(initial)
    } else {
      setFormPartnerDealId('')
      setFormCompanyName('')
      setFormTIN('')
      setFormAddress('')
      setFormVehiclePlate('')
      setFormInvoiceType('folio')
      setFormGuestEmail('')
      setFormGuestPhone('')
      setUnitSelections({})
    }
  }

  // ── Searchable Partner Selector state ──
  const [partnerSearchQuery, setPartnerSearchQuery] = useState('')
  const [isPartnerDropdownOpen, setIsPartnerDropdownOpen] = useState(false)
  const partnerDropdownRef = useRef<HTMLDivElement>(null)

  const filteredDeals = useMemo(() => {
    const q = partnerSearchQuery.toLowerCase().trim()
    if (!q) return partnerDeals
    return partnerDeals.filter(d => 
      d.name.toLowerCase().includes(q) || 
      d.type.toLowerCase().includes(q)
    )
  }, [partnerSearchQuery, partnerDeals])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (partnerDropdownRef.current && !partnerDropdownRef.current.contains(event.target as Node)) {
        setIsPartnerDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Local check-in / check-out dates for quick partner form
  const [formCheckIn, setFormCheckIn] = useState(initialCheckIn || '')
  const [formCheckOut, setFormCheckOut] = useState(initialCheckOut || '')
  
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

  const handlePartnerDateChange = (field: 'checkIn' | 'checkOut', value: string) => {
    if (field === 'checkIn') {
      setFormCheckIn(value)
      setUnitSelections(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => {
          next[k] = { ...next[k], checkIn: value }
        })
        return next
      })
    } else {
      setFormCheckOut(value)
      setUnitSelections(prev => {
        const next = { ...prev }
        Object.keys(next).forEach(k => {
          next[k] = { ...next[k], checkOut: value }
        })
        return next
      })
    }
  }

  const handleTogglePartnerUnit = (id: string, type: 'room' | 'venue') => {
    setUnitSelections(prev => {
      const next = { ...prev }
      if (next[id]) {
        delete next[id]
      } else {
        next[id] = { checkIn: formCheckIn, checkOut: formCheckOut, type }
      }
      return next
    })
  }

  const [formGuestName, setFormGuestName] = useState('')
  const [formGuestEmail, setFormGuestEmail] = useState('')
  const [formGuestPhone, setFormGuestPhone] = useState('')
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState('')
  const [formCompanions, setFormCompanions] = useState<Companion[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formAdditionalDiscount, setFormAdditionalDiscount] = useState(0)
  const [formWalkInDiscount, setFormWalkInDiscount] = useState(true)
  const [createdBookingList, setCreatedBookingList] = useState<Booking[]>([])
  const [printTargetBooking, setPrintTargetBooking] = useState<Booking | null>(null)

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

    const baselineDiscount = bookingType === 'partner'
      ? (formWalkInDiscount ? 20 : 0)
      : ((formSource === 'manual' || formSource === 'facebook') ? 20 : 0)
    const totalDiscount = baselineDiscount + formAdditionalDiscount
    const rateMultiplier = Math.max(0, 1 - totalDiscount / 100)

    Object.entries(unitSelections).forEach(([id, sel]) => {
      const deal = partnerDeals.find(d => d.id === formPartnerDealId)
      const contractedRate = deal?.contracted_rates[id]

      const price = contractedRate !== undefined && contractedRate !== null
        ? contractedRate
        : sel.type === 'room'
          ? (rooms.find(r => r.id === id)?.base_price ?? 0)
          : (venues.find(v => v.id === id)?.base_price ?? 0)
      
      const n = sel.checkIn && sel.checkOut
        ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
        : 1
      
      const finalRate = Math.round(price * rateMultiplier)
      
      base += finalRate * n

      // Breakfast: check if it's default included in partner deal
      const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
      if (sel.type === 'room') {
        // If breakfast is pre-negotiated w/o breakfast, price is 150/guest/night.
        // If it's pre-negotiated w/ breakfast (included), we count breakfast cost as 0 (it's already in the room rate override!)
        if (!isBreakfastIncluded) {
          breakfast += 150 * (1 + formCompanions.length) * n
        }
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
  }, [unitSelections, formSource, formAdditionalDiscount, formWalkInDiscount, formCompanions.length, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs, formStatus, rooms, venues, hasVenues, partnerDeals, formPartnerDealId, bookingType])

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

    const cleanGuestName = formGuestName.trim() || (bookingType === 'partner' && formPartnerDealId ? `${partnerDeals.find(d => d.id === formPartnerDealId)?.name || 'Corporate'} Guest` : '')
    if (formStatus === 'confirmed' && !cleanGuestName && bookingType === 'individual') {
      setFormError('Guest name is required.'); return
    }

    const totalDiscount = (bookingType === 'partner'
      ? (formWalkInDiscount ? 20 : 0)
      : ((formSource === 'manual' || formSource === 'facebook') ? 20 : 0)) + formAdditionalDiscount
    const rateMultiplier = Math.max(0, 1 - totalDiscount / 100)

    const createdBookings: Booking[] = []
    try {
      // 2. Loop to create room bookings
      let isFirstRoom = true
      for (const roomId of Array.from(formRoomIds)) {
        const sel = unitSelections[roomId]
        const rentals = (bookingType === 'partner' || !isFirstRoom) ? undefined : {
          bigTableCount: 0,
          smallTableCount: 0,
          chairCount: 0,
          mineralWaterCount: 0,
          extraFoamCount: formExtraFoam,
          extraPillowCount: formExtraPillow,
          extraBlanketCount: formExtraBlanket,
          extraTowelCount: formExtraTowel
        }
        isFirstRoom = false

        const deal = partnerDeals.find(d => d.id === formPartnerDealId)
        const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
        const contractedPrice = deal?.contracted_rates[roomId]

        const b = await createManualBooking({
          roomId,
          guestName: cleanGuestName,
          guestEmail: formGuestEmail || (deal?.email || 'admin@daweez-booking.vercel.app'),
          guestPhone: formGuestPhone || (deal?.contact_no || 'None'),
          checkIn: sel.checkIn,
          checkOut: sel.checkOut,
          source: bookingType === 'partner' ? 'manual' : formSource,
          status: bookingType === 'partner' ? 'confirmed' : formStatus,
          equipmentRentals: rentals,
          rateMultiplier,
          companions: bookingType === 'partner' ? undefined : (formCompanions.length > 0 ? formCompanions : undefined),
          partnerDealId: formPartnerDealId || undefined,
          companyName: formCompanyName || undefined,
          vehiclePlate: formVehiclePlate || undefined,
          invoiceType: formInvoiceType,
          breakfastIncluded: isBreakfastIncluded,
          contractRateOverride: contractedPrice || undefined
        })
        createdBookings.push(b)
      }

      // 3. Loop to create venue bookings
      let isFirstVenue = true
      for (const venueId of Array.from(formVenueIds)) {
        const sel = unitSelections[venueId]
        const rentals = (bookingType === 'partner' || !isFirstVenue) ? undefined : {
          bigTableCount: 0,
          smallTableCount: 0,
          chairCount: formChairs,
          mineralWaterCount: 0,
          tableCount: formEventTable,
          tentCount: formEventTent
        }
        isFirstVenue = false

        const deal = partnerDeals.find(d => d.id === formPartnerDealId)
        const contractedPrice = deal?.contracted_rates[venueId]

        const b = await createManualBooking({
          venueId,
          guestName: cleanGuestName,
          guestEmail: formGuestEmail || (deal?.email || 'admin@daweez-booking.vercel.app'),
          guestPhone: formGuestPhone || (deal?.contact_no || 'None'),
          checkIn: sel.checkIn,
          checkOut: sel.checkOut,
          source: bookingType === 'partner' ? 'manual' : formSource,
          status: bookingType === 'partner' ? 'confirmed' : formStatus,
          equipmentRentals: rentals,
          rateMultiplier,
          companions: bookingType === 'partner' ? undefined : (formCompanions.length > 0 ? formCompanions : undefined),
          partnerDealId: formPartnerDealId || undefined,
          companyName: formCompanyName || undefined,
          vehiclePlate: formVehiclePlate || undefined,
          invoiceType: formInvoiceType,
          contractRateOverride: contractedPrice || undefined
        })
        createdBookings.push(b)
      }

      setCreatedBookingList(createdBookings)
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

  if (createdBookingList.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-md bg-white rounded-xl shadow-2xl overflow-hidden font-sans p-6 text-center space-y-5 border border-slate-100" onClick={e => e.stopPropagation()}>
          <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto border border-emerald-100/50">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">Booking Saved Successfully!</h3>
            <p className="text-xs text-slate-400 mt-1 leading-normal font-medium">
              Sequential invoice(s) generated for check-in records:
            </p>
          </div>
          
          <div className="bg-slate-50 border border-slate-100/60 p-4 rounded-xl space-y-2.5 text-xs text-left max-h-[220px] overflow-y-auto">
            {createdBookingList.map(b => (
              <div key={b.id} className="flex justify-between items-center border-b border-slate-200/40 pb-2.5 last:border-b-0 last:pb-0">
                <div>
                  <span className="font-bold text-slate-700 block">
                    {b.room_id ? `Room ${rooms.find(r => r.id === b.room_id)?.room_number}` : (venues.find(v => v.id === b.venue_id)?.name || 'Venue')}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-mono">
                    Check-in: {b.check_in}
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-[#9A783E] block text-[11px]">{b.invoice_number}</span>
                  <button
                    type="button"
                    onClick={() => setPrintTargetBooking(b)}
                    className="text-[#B89251] hover:text-[#9A783E] text-[10px] font-bold underline select-none cursor-pointer mt-0.5 bg-transparent border-none p-0"
                  >
                    Print Statement
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-semibold py-2.5 rounded-lg transition-colors cursor-pointer"
            >
              Close & Return to Calendar
            </button>
          </div>
        </div>
        
        {printTargetBooking && (
          <PrintInvoiceModal
            booking={printTargetBooking}
            rooms={rooms}
            venues={venues}
            bookingsList={bookings}
            onClose={() => setPrintTargetBooking(null)}
          />
        )}
      </div>
    )
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
                {bookingType === 'partner' ? 'Quick Partner Booking' : `Step ${formStep} of ${formStatus === 'blocked' ? 2 : 3}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700 transition-colors p-1.5 -mr-1.5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Booking Type Toggle (Only if not successfully submitted yet) ── */}
        {createdBookingList.length === 0 && (
          <div className="flex border-b border-slate-100 px-5 py-2 bg-slate-50/50 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setBookingType('individual');
                setFormStep(1);
                setFormWalkInDiscount(true);
                const initial: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
                initialRoomIds.forEach(id => {
                  initial[id] = { checkIn: initialCheckIn, checkOut: initialCheckOut, type: 'room' }
                })
                initialVenueIds.forEach(id => {
                  initial[id] = { checkIn: initialCheckIn, checkOut: initialCheckOut, type: 'venue' }
                })
                setUnitSelections(initial);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${bookingType === 'individual' ? 'bg-[#B89251] text-white border-[#B89251] shadow-sm font-bold' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Walk-in Guest
            </button>
            <button
              type="button"
              onClick={() => {
                setBookingType('partner');
                setFormWalkInDiscount(false);
                setFormPartnerDealId('');
                setFormCompanyName('');
                setUnitSelections({});
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${bookingType === 'partner' ? 'bg-[#B89251] text-white border-[#B89251] shadow-sm font-bold' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              Corporate Partner / Agency
            </button>
          </div>
        )}

        {/* ── Step Progress Indicator ── */}
        {bookingType === 'individual' && (
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
        )}

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-5 bg-slate-50/30">
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6">

              {/* ── LEFT COLUMN: Progressive Wizard / Quick Form Fields ── */}
              <div className="space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-md animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                  </div>
                )}

                {bookingType === 'partner' ? (
                  <div className="space-y-4 font-sans bg-white border border-slate-200/60 rounded-xl p-5 shadow-sm">
                    <div className="border-b border-slate-100 pb-3">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Corporate / Agency details
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                        Select a partner account to automatically populate contract rates, invoices, and contact info.
                      </p>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      {/* 1. Searchable Partner Selector */}
                      <div className="relative" ref={partnerDropdownRef}>
                        <label className="text-[10px] text-[#9A783E] font-bold block mb-1 uppercase tracking-wider">Partner Account</label>
                        <div
                          onClick={() => setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
                          className="w-full bg-[#FCFBF9] border border-[#E5D5C0] text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] font-semibold cursor-pointer flex justify-between items-center shadow-sm select-none"
                        >
                          <span className={formCompanyName ? 'text-slate-800' : 'text-slate-400 font-normal'}>
                            {formCompanyName || '-- Search & Select Partner --'}
                          </span>
                          <span className="text-[10px] text-slate-400">▼</span>
                        </div>

                        {isPartnerDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60" onClick={e => e.stopPropagation()}>
                            <div className="p-2 border-b border-slate-100 bg-slate-50">
                              <input
                                type="text"
                                placeholder="Type to search agency..."
                                value={partnerSearchQuery}
                                onChange={e => setPartnerSearchQuery(e.target.value)}
                                className="w-full bg-white border border-slate-200 text-slate-800 px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-[#B89251]"
                                autoFocus
                              />
                            </div>
                            <div className="overflow-y-auto flex-1 py-1 max-h-48">
                              {filteredDeals.length > 0 ? (
                                filteredDeals.map(d => (
                                  <button
                                    key={d.id}
                                    type="button"
                                    onClick={() => {
                                      handleSelectPartnerDeal(d)
                                      setFormGuestName(`${d.name} Representative`)
                                      setIsPartnerDropdownOpen(false)
                                      setPartnerSearchQuery('')
                                    }}
                                    className="w-full text-left px-3 py-2 hover:bg-[#FDFBF7] hover:text-[#9A783E] text-xs font-semibold text-slate-700 flex justify-between items-center transition-colors border-none bg-transparent cursor-pointer"
                                  >
                                    <span>{d.name}</span>
                                    <span className="text-[9px] bg-slate-100 text-slate-400 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">{d.type}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-3 text-center text-xs text-slate-400 font-medium">
                                  No matching partner accounts
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 2. Dates Row */}
                      <div className="grid grid-cols-2 gap-3.5">
                        <div>
                          <label className="text-[10px] text-[#9A783E] font-bold block mb-1 uppercase tracking-wider">Check-in</label>
                          <input
                            type="date"
                            required
                            value={formCheckIn}
                            onChange={e => handlePartnerDateChange('checkIn', e.target.value)}
                            className="w-full bg-[#FCFBF9] border border-[#E5D5C0] text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-[#9A783E] font-bold block mb-1 uppercase tracking-wider">Check-out</label>
                          <input
                            type="date"
                            required
                            value={formCheckOut}
                            onChange={e => handlePartnerDateChange('checkOut', e.target.value)}
                            className="w-full bg-[#FCFBF9] border border-[#E5D5C0] text-slate-800 px-3 py-2 rounded-lg focus:outline-none focus:border-[#B89251] font-mono font-medium"
                          />
                        </div>
                      </div>

                      {/* 3. Selected Rooms Display (Read-Only) */}
                      <div>
                        <label className="text-[10px] text-[#9A783E] font-bold block mb-1.5 uppercase tracking-wider">Selected Rooms</label>
                        <div className="flex flex-wrap gap-2.5">
                          {Object.entries(unitSelections).map(([id, sel]) => {
                            const isRoom = sel.type === 'room'
                            const name = isRoom 
                              ? `Room ${rooms.find(r => r.id === id)?.room_number || id}`
                              : (venues.find(v => v.id === id)?.name || id)
                            const deal = partnerDeals.find(d => d.id === formPartnerDealId)
                            const contractedPrice = deal?.contracted_rates[id]
                            const basePrice = isRoom 
                              ? (rooms.find(r => r.id === id)?.base_price || 0)
                              : (venues.find(v => v.id === id)?.base_price || 0)
                            
                            return (
                              <div key={id} className="bg-[#FDFBF7] border border-[#E5D5C0] rounded-md px-2 py-1 flex items-center gap-1.5 shadow-sm text-[11px] animate-in fade-in select-none">
                                <span className="font-bold text-slate-700">{name}</span>
                                <span className="text-slate-300">|</span>
                                {contractedPrice !== undefined && contractedPrice !== null ? (
                                  <span className="font-extrabold text-[#9A783E] flex items-center gap-1">
                                    ₱{contractedPrice.toLocaleString()}
                                    <span className="text-[8px] text-[#9A783E] font-bold bg-[#9A783E]/10 px-1 py-0.5 rounded uppercase">Neg</span>
                                  </span>
                                ) : (
                                  <span className="font-semibold text-slate-500 flex items-center gap-1">
                                    ₱{basePrice.toLocaleString()}
                                    <span className="text-[8px] text-slate-400 font-bold bg-slate-100 px-1 py-0.5 rounded uppercase">Std</span>
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Walk-in Discount Checkbox */}
                      <div className="pt-2 border-t border-slate-100">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formWalkInDiscount}
                            onChange={e => setFormWalkInDiscount(e.target.checked)}
                            className="rounded text-[#B89251] focus:ring-[#B89251] w-3.5 h-3.5 cursor-pointer accent-[#B89251]"
                          />
                          <span className="text-[10px] text-[#9A783E] font-bold uppercase tracking-wider">Apply 20% Walk-in Discount</span>
                        </label>
                      </div>

                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-slate-100 mt-4 shrink-0 bg-white">
                      <button
                        type="button"
                        onClick={onClose}
                        className="text-xs text-slate-500 font-bold px-3 py-1.5 rounded border border-slate-200 bg-white hover:bg-slate-50 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting || !formPartnerDealId || Object.keys(unitSelections).length === 0}
                        className="bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm"
                      >
                        {isSubmitting ? 'Booking...' : 'Confirm Corporate Booking'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
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
                        partnerDeals={partnerDeals}
                        formPartnerDealId={formPartnerDealId}
                        setFormPartnerDealId={setFormPartnerDealId}
                        formCompanyName={formCompanyName}
                        setFormCompanyName={setFormCompanyName}
                        formVehiclePlate={formVehiclePlate}
                        setFormVehiclePlate={setFormVehiclePlate}
                        formTIN={formTIN}
                        setFormTIN={setFormTIN}
                        formAddress={formAddress}
                        setFormAddress={setFormAddress}
                        formInvoiceType={formInvoiceType}
                        setFormInvoiceType={setFormInvoiceType}
                        onSelectPartnerDeal={handleSelectPartnerDeal}
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
                  </>
                )}
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
                bookingType={bookingType}
                formWalkInDiscount={formWalkInDiscount}
                partnerDeals={partnerDeals}
                formPartnerDealId={formPartnerDealId}
              />

            </div>
          </div>
        </form>

      </div>
    </div>
  )
}

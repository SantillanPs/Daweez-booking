import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
    breakfastIncluded?: boolean
    contractRateOverride?: number
    paymentMethod?: string
    paymentReference?: string
    venueExcessHours?: number
    id?: string
    invoiceNumber?: string
    paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
    downpaymentPaid?: number
    balanceDue?: number
    securityDeposit?: number
  }) => Promise<Booking>
  cancelBooking: (bookingId: string) => Promise<void>
  updateBooking?: (booking: Booking) => Promise<void>
  initialSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  editingBookings?: Booking[]
  onClose: () => void
}

export function WalkInBookingForm({
  rooms,
  venues,
  bookings,
  createManualBooking,
  cancelBooking,
  updateBooking,
  initialSelections,
  editingBookings,
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

  const handleSelectPartnerDeal = (deal: PartnerDeal | null) => {
    if (deal) {
      setFormPartnerDealId(deal.id)
      setFormCompanyName(deal.name)
      setFormTIN(deal.tin || '')
      setFormAddress(deal.address || '')
      setFormVehiclePlate(deal.vehicle_plate || '')
      setFormGuestEmail(deal.email || '')
      setFormGuestPhone(deal.contact_no || '')

      // Auto-select all rooms/venues that have contracted rates in this partner deal
      const fallbackCheckIn = Object.values(initialSelections)[0]?.checkIn || ''
      const fallbackCheckOut = Object.values(initialSelections)[0]?.checkOut || ''
      const initial: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
      if (deal.contracted_rates) {
        Object.entries(deal.contracted_rates).forEach(([id, rate]) => {
          if (rate > 0) {
            const isRoom = rooms.some(r => r.id === id)
            const isVenue = venues.some(v => v.id === id)
            if (isRoom) {
              initial[id] = { checkIn: formCheckIn || fallbackCheckIn, checkOut: formCheckOut || fallbackCheckOut, type: 'room' }
            } else if (isVenue) {
              initial[id] = { checkIn: formCheckIn || fallbackCheckIn, checkOut: formCheckOut || fallbackCheckOut, type: 'venue' }
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
  const [formCheckIn, setFormCheckIn] = useState(() => {
    const vals = Object.values(initialSelections)
    return vals.length > 0 ? vals[0].checkIn : ''
  })
  const [formCheckOut, setFormCheckOut] = useState(() => {
    const vals = Object.values(initialSelections)
    return vals.length > 0 ? vals[0].checkOut : ''
  })
  
  // Staggered Date Selection Map per selected Room/Venue
  const [unitSelections, setUnitSelections] = useState<Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>>(initialSelections)

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


  // ── Breakfast state ──
  const [formBreakfastEnabled, setFormBreakfastEnabled] = useState(true)
  const [formBreakfastGuests, setFormBreakfastGuests] = useState(1)

  // Sync breakfast guest count with companions when they change
  useEffect(() => {
    setFormBreakfastGuests(prev => Math.max(1, 1 + formCompanions.length))
  }, [formCompanions.length])

  // ── Add-ons state ──
  const [formChairs, setFormChairs] = useState(0)
  const [formExtraFoam, setFormExtraFoam] = useState(0)
  const [formExtraPillow, setFormExtraPillow] = useState(0)
  const [formExtraBlanket, setFormExtraBlanket] = useState(0)
  const [formExtraTowel, setFormExtraTowel] = useState(0)
  const [formEventTable, setFormEventTable] = useState(0)
  const [formEventTent, setFormEventTent] = useState(0)
  const [formVenueExcessHours, setFormVenueExcessHours] = useState(0)

  // ── Payment Details ──
  const [formPaymentMethod, setFormPaymentMethod] = useState('')
  const [formPaymentReference, setFormPaymentReference] = useState('')
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('')
  
  // ── Manual Financial Overrides (for Edit Mode) ──
  const [formPaymentStatus, setFormPaymentStatus] = useState<'unpaid' | 'downpayment' | 'paid'>('unpaid')
  const [formDownpaymentPaid, setFormDownpaymentPaid] = useState(0)
  const [formBalanceDue, setFormBalanceDue] = useState<number | null>(null)
  const [formSecurityDeposit, setFormSecurityDeposit] = useState<number | null>(null)

  // ── Collapsible toggles ──
  const [showCompanions, setShowCompanions] = useState(true)

  // ── Edit Mode Initialization ──
  useEffect(() => {
    if (editingBookings && editingBookings.length > 0) {
      const b = editingBookings[0]
      setFormGuestName(b.guest_name)
      setFormGuestEmail(b.guest_email)
      setFormGuestPhone(b.guest_phone)
      setFormSource(b.source)
      setFormStatus(b.status === 'pending' ? 'confirmed' : b.status) // Upgrade pending to confirmed in edit mode usually
      
      if (b.partner_deal_id) {
        setBookingType('partner')
        setFormPartnerDealId(b.partner_deal_id)
        setFormCompanyName(b.company_name || '')
        setFormVehiclePlate(b.vehicle_plate || '')
      }

      setFormCompanions(b.companions || [])
      
      if (b.equipment_rentals) {
        setFormChairs(b.equipment_rentals.chairCount || 0)
        setFormExtraFoam(b.equipment_rentals.extraFoamCount || 0)
        setFormExtraPillow(b.equipment_rentals.extraPillowCount || 0)
        setFormExtraBlanket(b.equipment_rentals.extraBlanketCount || 0)
        setFormExtraTowel(b.equipment_rentals.extraTowelCount || 0)
        setFormEventTable(b.equipment_rentals.tableCount || 0)
        setFormEventTent(b.equipment_rentals.tentCount || 0)
      }

      setFormPaymentMethod(b.payment_method || '')
      setFormPaymentReference(b.payment_reference || '')
      setFormVenueExcessHours(b.venue_excess_hours || 0)
      setFormInvoiceNumber(b.invoice_number || '')
      
      setFormPaymentStatus(b.payment_status || 'unpaid')
      // Sum financials across all bookings in the group
      let totalDown = 0
      let totalBalance = 0
      let totalSec = 0
      editingBookings.forEach(eb => {
        totalDown += eb.downpayment_paid || 0
        totalBalance += eb.balance_due || 0
        totalSec += eb.security_deposit || 0
      })
      setFormDownpaymentPaid(totalDown)
      setFormBalanceDue(totalBalance)
      setFormSecurityDeposit(totalSec)

      // Initialize selections for all bookings in the group
      const initial: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
      editingBookings.forEach(eb => {
        if (eb.room_id) initial[eb.room_id] = { checkIn: eb.check_in, checkOut: eb.check_out, type: 'room' }
        else if (eb.venue_id) initial[eb.venue_id] = { checkIn: eb.check_in, checkOut: eb.check_out, type: 'venue' }
      })
      setUnitSelections(initial)
    }
  }, [editingBookings])

  const activeBookingsContext = useMemo(() => {
    if (!editingBookings || editingBookings.length === 0) return bookings
    return bookings.filter(b => !editingBookings.find(eb => eb.id === b.id))
  }, [bookings, editingBookings])

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
        // If breakfast is pre-negotiated w/ breakfast (included), cost is 0 (already in room rate override).
        // Otherwise, charge only if the user opted in, for the selected number of guests.
        if (!isBreakfastIncluded && formBreakfastEnabled) {
          breakfast += 150 * formBreakfastGuests * n
        }
        rentals += (formExtraFoam * 200 + formExtraPillow * 50 + formExtraBlanket * 50 + formExtraTowel * 50) * n
      }
    })

    if (hasVenues) {
      rentals += formEventTable * 150 + formEventTent * 500 + formChairs * 15
    }

    const total = base + breakfast + rentals
    const down = Math.round(total * 0.5)
    
    const due = formStatus === 'blocked' ? 0 : (total - down)

    return {
      estBreakfast: breakfast,
      estRentals: rentals,
      estAddons: 0,
      estTotal: total,
      estDown: down,
      estDue: due
    }
  }, [unitSelections, formSource, formAdditionalDiscount, formWalkInDiscount, formCompanions.length, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs, formStatus, rooms, venues, hasVenues, partnerDeals, formPartnerDealId, bookingType, formBreakfastEnabled, formBreakfastGuests])

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
        if (!syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, activeBookingsContext)) {
          const roomNum = rooms.find(r => r.id === id)?.room_number || id
          setFormError(`Room ${roomNum} is already booked for the selected dates.`)
          setIsSubmitting(false); return
        }
      } else {
        if (!syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, activeBookingsContext)) {
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
    const processedBookingIds = new Set<string>()

    try {
      // 2. Loop to create or update room bookings
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

        const existingBooking = editingBookings?.find(eb => eb.room_id === roomId)
        if (existingBooking) processedBookingIds.add(existingBooking.id)

        const b = await createManualBooking({
          id: existingBooking?.id,
          invoiceNumber: formInvoiceNumber || undefined,
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
          breakfastOrders: formBreakfastEnabled ? undefined : ([] as BreakfastOrder[]),
          breakfastIncluded: isBreakfastIncluded,
          contractRateOverride: contractedPrice || undefined,
          paymentMethod: formPaymentMethod || undefined,
          paymentReference: formPaymentReference || undefined,
          paymentStatus: editingBookings ? formPaymentStatus : undefined,
          downpaymentPaid: editingBookings ? formDownpaymentPaid : undefined,
          balanceDue: editingBookings && formBalanceDue !== null ? formBalanceDue : undefined,
          securityDeposit: editingBookings && formSecurityDeposit !== null ? formSecurityDeposit : undefined
        })
        createdBookings.push(b)
      }

      // 3. Loop to create or update venue bookings
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
        const existingBooking = editingBookings?.find(eb => eb.venue_id === venueId)
        if (existingBooking) processedBookingIds.add(existingBooking.id)

        const deal = partnerDeals.find(d => d.id === formPartnerDealId)
        const contractedPrice = deal?.contracted_rates[venueId]

        const b = await createManualBooking({
          id: existingBooking?.id,
          invoiceNumber: formInvoiceNumber || undefined,
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
          contractRateOverride: contractedPrice || undefined,
          paymentMethod: formPaymentMethod || undefined,
          paymentReference: formPaymentReference || undefined,
          venueExcessHours: formVenueExcessHours,
          paymentStatus: editingBookings ? formPaymentStatus : undefined,
          downpaymentPaid: editingBookings ? formDownpaymentPaid : undefined,
          balanceDue: editingBookings && formBalanceDue !== null ? formBalanceDue : undefined,
          securityDeposit: editingBookings && formSecurityDeposit !== null ? formSecurityDeposit : undefined
        })
        createdBookings.push(b)
      }

      // 4. Cancel any bookings from editingBookings that were NOT processed (i.e. removed by user)
      if (editingBookings) {
        for (const eb of editingBookings) {
          if (!processedBookingIds.has(eb.id)) {
            try {
              await cancelBooking(eb.id)
            } catch (err) {
              console.error('Failed to cancel removed booking:', eb.id, err)
            }
          }
        }
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
    return createPortal(
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="w-full max-w-5xl bg-transparent shadow-2xl" onClick={e => e.stopPropagation()}>
          <PrintInvoiceModal
            bookingsToPrint={createdBookingList}
            rooms={rooms}
            venues={venues}
            bookingsList={bookings}
            onClose={onClose}
          />
        </div>
      </div>,
      document.body
    )
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-md md:max-w-4xl bg-card rounded-lg border border-soft shadow-xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden transition-all duration-300" onClick={e => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-soft shrink-0 bg-card">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 flex items-center justify-center bg-brand-bg border border-brand-border rounded-md">
              {hasVenues && !hasRooms
                ? <PartyPopper className="w-3.5 h-3.5 text-brand-primary" />
                : <BedDouble className="w-3.5 h-3.5 text-brand-primary" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-main">New Reservation</h3>
              <p className="text-[10px] text-muted font-medium">
                {bookingType === 'partner' ? 'Quick Partner Booking' : `Step ${formStep} of ${formStatus === 'blocked' ? 2 : 3}`}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-main transition-colors p-1.5 -mr-1.5 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Booking Type Toggle (Only if not successfully submitted yet) ── */}
        {createdBookingList.length === 0 && (
          <div className="flex border-b border-soft px-5 py-2 bg-page/50 gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setBookingType('individual');
                setFormStep(1);
                setFormWalkInDiscount(true);
                setUnitSelections(initialSelections);
              }}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${bookingType === 'individual' ? 'bg-brand-primary text-white border-brand-primary shadow-sm font-bold' : 'bg-card text-muted border-soft hover:bg-page'}`}
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
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${bookingType === 'partner' ? 'bg-brand-primary text-white border-brand-primary shadow-sm font-bold' : 'bg-card text-muted border-soft hover:bg-page'}`}
            >
              Corporate Partner / Agency
            </button>
          </div>
        )}

        {/* ── Step Progress Indicator ── */}
        {bookingType === 'individual' && (
          <div className="flex items-center px-5 py-2.5 border-b border-soft shrink-0 bg-page/50">
            {[1, 2, 3].map(s => {
              if (s === 3 && formStatus === 'blocked') return null
              const isActive = formStep === s
              const isCompleted = formStep > s
              const isNextStepReady = 
                (s === 2 && isValidDates) || 
                (s === 3 && isValidDates && !!formGuestName)
              const isUnlocked = s <= formStep || isNextStepReady

              return (
                <React.Fragment key={s}>
                  {s > 1 && (
                    <div className={`flex-1 h-0.5 transition-all duration-300 ${isCompleted ? 'bg-brand-primary' : 'bg-slate-200'}`} />
                  )}
                  <button type="button" disabled={!isUnlocked} onClick={() => setFormStep(s)}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-brand-primary border-brand-primary text-white shadow-sm ring-2 ring-brand-primary/20'
                        : isCompleted
                          ? 'bg-brand-bg border-brand-primary text-brand-text font-semibold hover:bg-brand-primary hover:text-white'
                          : isUnlocked
                            ? 'bg-card border-brand-primary text-brand-primary shadow-sm hover:bg-brand-primary hover:text-white animate-pulse'
                            : 'bg-card border-soft text-muted disabled:cursor-not-allowed opacity-50'
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
          <div className="overflow-y-auto flex-1 p-5 bg-page/30">
            <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6">

              {/* ── LEFT COLUMN: Progressive Wizard / Quick Form Fields ── */}
              <div className="space-y-4">
                {formError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-md animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                  </div>
                )}

                {bookingType === 'partner' ? (
                  <div className="space-y-4 font-sans bg-card border border-soft/60 rounded-xl p-5 shadow-sm">
                    <div className="border-b border-soft pb-3">
                      <h4 className="text-xs font-bold text-main uppercase tracking-wider">
                        Corporate / Agency details
                      </h4>
                      <p className="text-[10px] text-muted font-medium mt-0.5">
                        Select a partner account to automatically populate contract rates, invoices, and contact info.
                      </p>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      {/* 1. Searchable Partner Selector */}
                      <div className="relative" ref={partnerDropdownRef}>
                        <label className="text-[10px] text-brand-text font-bold block mb-1 uppercase tracking-wider">Partner Account</label>
                        <div
                          onClick={() => setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
                          className="w-full bg-brand-bg border border-brand-border text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary font-semibold cursor-pointer flex justify-between items-center shadow-sm select-none"
                        >
                          <span className={formCompanyName ? 'text-main' : 'text-muted font-normal'}>
                            {formCompanyName || '-- Search & Select Partner --'}
                          </span>
                          <span className="text-[10px] text-muted">▼</span>
                        </div>

                        {isPartnerDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-card border border-soft rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60" onClick={e => e.stopPropagation()}>
                            <div className="p-2 border-b border-soft bg-page">
                              <input
                                type="text"
                                placeholder="Type to search agency..."
                                value={partnerSearchQuery}
                                onChange={e => setPartnerSearchQuery(e.target.value)}
                                className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded text-xs focus:outline-none focus:border-brand-primary"
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
                                    className="w-full text-left px-3 py-2 hover:bg-brand-bg hover:text-brand-text text-xs font-semibold text-main flex justify-between items-center transition-colors border-none bg-transparent cursor-pointer"
                                  >
                                    <span>{d.name}</span>
                                    <span className="text-[9px] bg-softbg text-muted px-1.5 py-0.5 rounded uppercase font-bold shrink-0">{d.type}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-3 text-center text-xs text-muted font-medium">
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
                          <label className="text-[10px] text-brand-text font-bold block mb-1 uppercase tracking-wider">Check-in</label>
                          <input
                            type="date"
                            required
                            value={formCheckIn}
                            onChange={e => handlePartnerDateChange('checkIn', e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary font-mono font-medium"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-brand-text font-bold block mb-1 uppercase tracking-wider">Check-out</label>
                          <input
                            type="date"
                            required
                            value={formCheckOut}
                            onChange={e => handlePartnerDateChange('checkOut', e.target.value)}
                            className="w-full bg-brand-bg border border-brand-border text-main px-3 py-2 rounded-lg focus:outline-none focus:border-brand-primary font-mono font-medium"
                          />
                        </div>
                      </div>

                      {/* 3. Selected Rooms Display (Read-Only) */}
                      <div>
                        <label className="text-[10px] text-brand-text font-bold block mb-1.5 uppercase tracking-wider">Selected Rooms</label>
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
                              <div key={id} className="bg-brand-bg border border-brand-border rounded-md px-2 py-1 flex items-center gap-1.5 shadow-sm text-[11px] animate-in fade-in select-none">
                                <span className="font-bold text-main">{name}</span>
                                <span className="text-slate-300">|</span>
                                {contractedPrice !== undefined && contractedPrice !== null ? (
                                  <span className="font-extrabold text-brand-text flex items-center gap-1">
                                    ₱{contractedPrice.toLocaleString()}
                                    <span className="text-[8px] text-brand-text font-bold bg-[#9A783E]/10 px-1 py-0.5 rounded uppercase">Neg</span>
                                  </span>
                                ) : (
                                  <span className="font-semibold text-muted flex items-center gap-1">
                                    ₱{basePrice.toLocaleString()}
                                    <span className="text-[8px] text-muted font-bold bg-softbg px-1 py-0.5 rounded uppercase">Std</span>
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Walk-in Discount Checkbox */}
                      <div className="pt-2 border-t border-soft">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formWalkInDiscount}
                            onChange={e => setFormWalkInDiscount(e.target.checked)}
                            className="rounded text-brand-primary focus:ring-[#B89251] w-3.5 h-3.5 cursor-pointer accent-brand-primary"
                          />
                          <span className="text-[10px] text-brand-text font-bold uppercase tracking-wider">Apply 20% Walk-in Discount</span>
                        </label>
                        <div className="pt-4 border-t border-soft/60 mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={onClose}
                            className="text-xs text-muted font-bold px-4 py-3 rounded-md border border-soft bg-card hover:bg-page transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting || !formPartnerDealId || Object.keys(unitSelections).length === 0}
                            className="flex-1 bg-brand-primary hover:bg-brand-text disabled:bg-softbg disabled:text-muted text-white text-xs font-bold py-3 rounded-md transition-all cursor-pointer shadow-sm"
                          >
                            {isSubmitting ? 'Booking...' : 'Confirm Corporate Booking'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* STEP 1: Resource Schedule & Type Selection */}
                    {formStep === 1 && (
                      <div className="space-y-4">
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
                        <div className="flex justify-end pt-2">
                          <button type="button" disabled={!isValidDates} onClick={() => setFormStep(2)} className="bg-brand-primary hover:bg-brand-text disabled:bg-softbg disabled:text-muted text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                            Next Step &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Guest Details & Companions */}
                    {formStep === 2 && (
                      <div className="space-y-4">
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
                          onSelectPartnerDeal={handleSelectPartnerDeal}
                        />
                        {formStatus === 'blocked' ? (
                          <div className="pt-2">
                            <button type="submit" disabled={isSubmitting} className="w-full bg-slate-700 hover:bg-slate-800 disabled:bg-slate-200 text-white disabled:text-muted text-xs font-bold py-3 rounded-md transition-all cursor-pointer shadow-sm">
                              {isSubmitting ? 'Creating...' : 'Create Block'}
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-between items-center pt-2">
                            <button type="button" onClick={() => setFormStep(1)} className="text-xs text-brand-text hover:text-brand-primary font-bold px-4 py-2 hover:bg-page rounded transition-colors cursor-pointer">&larr; Back</button>
                            <button type="button" disabled={!formGuestName} onClick={() => setFormStep(3)} className="bg-brand-primary hover:bg-brand-text disabled:bg-softbg disabled:text-muted text-white text-xs font-semibold px-6 py-2 rounded transition-all cursor-pointer shadow-sm">
                              Next Step &rarr;
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* STEP 3: Add-ons & Services */}
                    {formStep === 3 && formStatus === 'confirmed' && (
                      <div className="space-y-4">
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
                        formVenueExcessHours={formVenueExcessHours}
                        setFormVenueExcessHours={setFormVenueExcessHours}
                        formBreakfastEnabled={formBreakfastEnabled}
                        setFormBreakfastEnabled={setFormBreakfastEnabled}
                        formBreakfastGuests={formBreakfastGuests}
                        setFormBreakfastGuests={setFormBreakfastGuests}
                      />
                      <div className="flex justify-between items-center pt-2">
                          <button type="button" onClick={() => setFormStep(2)} className="text-xs text-brand-text hover:text-brand-primary font-bold px-4 py-2 hover:bg-page rounded transition-colors cursor-pointer">&larr; Back</button>
                          <button type="submit" disabled={isSubmitting} className="bg-brand-primary hover:bg-brand-text disabled:bg-softbg disabled:text-muted text-white text-xs font-bold px-6 py-2.5 rounded transition-all cursor-pointer shadow-sm">
                            {isSubmitting ? 'Creating...' : 'Confirm Booking'}
                          </button>
                      </div>
                    </div>
                    )}


                  </>
                )}
              </div>

              {/* ── RIGHT COLUMN: Invoice Estimate & Navigation ── */}
              <div className="flex flex-col gap-4">
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
                  formPaymentMethod={formPaymentMethod}
                  setFormPaymentMethod={setFormPaymentMethod}
                  formPaymentReference={formPaymentReference}
                  setFormPaymentReference={setFormPaymentReference}
                  formVenueExcessHours={formVenueExcessHours}
                />
              </div>
            </div>
          </div>
        </form>


      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

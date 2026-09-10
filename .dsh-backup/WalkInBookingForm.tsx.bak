import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal, PaymentRecord } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { useDashboardData } from './DashboardContext'
import {
  X, AlertCircle, BedDouble, PartyPopper, CircleDollarSign, UserCheck, CheckCircle2, CalendarX
} from 'lucide-react'
import { PrintInvoiceModal } from './billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from './billing/PrintPaymentReceiptModal'

// Import modular subcomponents
import { DiscountPricingControls, DiscountType } from './calendar/DiscountPricingControls'
import { roomDisplayName } from './calendar/bookingStyles'
import { RoomDetailsForm } from './walk-in/RoomDetailsForm'
import { AmenitiesForm } from './walk-in/AmenitiesForm'
import { BillingSummary } from './walk-in/BillingSummary'
import { dateToString } from '../utils/helpers'

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
    usePromo?: boolean
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
    guestGender?: string
    guestNationality?: string
    guestAddress?: string
    birthdate?: string
    preparedBy?: string
    appliedDiscount?: { type: 'percent' | 'flat'; value: number }
    venueDayBlocks?: number
    notes?: string
  }) => Promise<Booking>
  cancelBooking: (bookingId: string) => Promise<void>
  updateBooking?: (booking: Booking) => Promise<void>
  initialSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  editingBookings?: Booking[]
  onClose: () => void
  initialBookingType?: 'individual' | 'partner'
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
  onClose,
  initialBookingType
}: WalkInBookingFormProps) {
  // ── Core form state ──
  const [formStep, setFormStep] = useState<number>(1)
  const [bookingType, setBookingType] = useState<'individual' | 'partner'>(initialBookingType || 'individual')

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

  const [formGuestName, setFormGuestName] = useState('')
  const [formGuestEmail, setFormGuestEmail] = useState('')
  const [formGuestPhone, setFormGuestPhone] = useState('')
  const [formGuestGender, setFormGuestGender] = useState('')
  const [formGuestNationality, setFormGuestNationality] = useState('')
  const [formGuestAddress, setFormGuestAddress] = useState('')
  const [formSource, setFormSource] = useState<BookingSource>('manual')
  const [formStatus, setFormStatus] = useState<'confirmed' | 'blocked'>('confirmed')
  const [formError, setFormError] = useState('')
  const [formCompanions, setFormCompanions] = useState<Companion[]>([])
  const [formGuestBreakfast, setFormGuestBreakfast] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Explicit promo override — staff picks "Use Promo Price" per booking
  // (replaces the old automatic 20% discount).
  const [formUsePromo, setFormUsePromo] = useState(false)
  const [createdBookingList, setCreatedBookingList] = useState<Booking[]>([])


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

  // ── Post-create payment (Option B) ──
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState('Cash')
  const [payReference, setPayReference] = useState('')
  const [payDate, setPayDate] = useState(() => dateToString(new Date()))
  const [isRecordingPay, setIsRecordingPay] = useState(false)
  const [receiptRecord, setReceiptRecord] = useState<PaymentRecord | null>(null)
  const [receiptBooking, setReceiptBooking] = useState<Booking | null>(null)

  // ── Quick-form parity fields ──
  const [formPreparedBy, setFormPreparedBy] = useState('')
  const [formBirthdate, setFormBirthdate] = useState('')
  const [formBlockNotes, setFormBlockNotes] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState(0)
  const [venueDayBlocks, setVenueDayBlocks] = useState(1)
  
  // ── Manual Financial Overrides (for Edit Mode) ──
  const [formPaymentStatus, setFormPaymentStatus] = useState<'unpaid' | 'downpayment' | 'paid'>('unpaid')
  const [formDownpaymentPaid, setFormDownpaymentPaid] = useState(0)
  const [formBalanceDue, setFormBalanceDue] = useState<number | null>(null)
  const [formSecurityDeposit, setFormSecurityDeposit] = useState<number | null>(null)

  // ── Collapsible toggles ──
  const [showCompanions, setShowCompanions] = useState(true)

  // ── Edit Mode Initialization ──
  // Seeds local form state from the editing booking(s) — the documented
  // "reset state when a prop changes" case, so the sync is intentional.
  /* eslint-disable react-hooks/set-state-in-effect */
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
      setFormBirthdate(b.birthdate || '')
      setFormPreparedBy(b.prepared_by || '')
      setFormBlockNotes(b.notes || '')
      if (b.applied_discount) { setDiscountType(b.applied_discount.type); setDiscountValue(b.applied_discount.value) }
      setVenueDayBlocks(b.venue_day_blocks || 1)
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
  /* eslint-enable react-hooks/set-state-in-effect */

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
  const hasDayBlock = useMemo(() =>
    Object.entries(unitSelections).some(([id, sel]) => sel.type === 'venue' && ['Gazebo', 'Garden Area'].includes(venues.find(v => v.id === id)?.name || '')),
  [unitSelections, venues])

  const isValidDates = useMemo(() => {
    const entries = Object.values(unitSelections)
    if (entries.length === 0) return false
    return entries.every(sel => sel.checkIn && sel.checkOut && sel.checkIn < sel.checkOut)
  }, [unitSelections])

  // ── Inline required-field validation (mirrors LogOldBookingModal) ──
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)
  const fieldErrors = {
    checkIn: bookingType === 'partner' ? (formCheckIn.trim() ? '' : 'Check-in date is required.') : '',
    checkOut: bookingType === 'partner' ? (!formCheckOut ? 'Check-out date is required.' : (formCheckOut <= formCheckIn ? 'Check-out must be after check-in.' : '')) : '',
    units: Object.keys(unitSelections).length === 0 ? 'Select at least one room or venue.' : '',
    dates: Object.keys(unitSelections).length === 0 ? '' : (isValidDates ? '' : 'Please select valid check-in and check-out dates for all units.'),
    guestName: (formStatus === 'confirmed' && bookingType === 'individual' && !formGuestName.trim()) ? 'Guest name is required.' : '',
  }
  const showErr = (k: keyof typeof fieldErrors) => (touched[k] || trySave) ? fieldErrors[k] : ''
  const isInvalid = (k: keyof typeof fieldErrors) => Boolean(showErr(k))
  const markTouched = (k: keyof typeof fieldErrors) => () => setTouched(t => ({ ...t, [k]: true }))
  const dateBase = 'input input-bordered w-full font-mono'
  const dateField = 'input input-bordered w-full'
  const dateFieldErr = 'input input-bordered input-error w-full'

  // ── Pricing calculations (estimate for totals; real nightly rate goes through calculatePricing) ──
  const { estBreakfast, estRentals, estAddons, estTotal, estDown, estDue } = useMemo(() => {
    let regularTotal = 0
    let discountedTotal = 0
    let breakfast = 0
    let rentals = 0

    Object.entries(unitSelections).forEach(([id, sel]) => {
      const deal = partnerDeals.find(d => d.id === formPartnerDealId)
      const contractedRate = deal?.contracted_rates[id]
      const n = sel.checkIn && sel.checkOut
        ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
        : 1

      const room = sel.type === 'room' ? rooms.find(r => r.id === id) : undefined
      const venue = sel.type === 'venue' ? venues.find(v => v.id === id) : undefined
      const regular = contractedRate !== undefined && contractedRate !== null
        ? contractedRate
        : sel.type === 'room'
          ? (room?.base_price ?? 0)
          : (venue?.base_price ?? 0)
      const promo = sel.type === 'room'
        ? (room?.promo_price ?? null)
        : (venue?.promo_price ?? null)
      const effectiveRate = formUsePromo && promo != null && promo > 0 ? promo : regular
      regularTotal += regular * n
      discountedTotal += effectiveRate * n

      const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
      if (sel.type === 'room') {
        const bfCount = (formGuestBreakfast ? 1 : 0) + formCompanions.filter(c => c.breakfast).length
        if (!isBreakfastIncluded && bfCount > 0) {
          breakfast += 150 * bfCount * n
        }
        rentals += (formExtraFoam * 200 + formExtraPillow * 50 + formExtraBlanket * 50 + formExtraTowel * 50) * n
      }
    })

    if (hasVenues) {
      rentals += formEventTable * 150 + formEventTent * 500 + formChairs * 15
    }

    const subtotal = discountedTotal
    const total = subtotal + breakfast + rentals
    const down = Math.round(total * 0.5)
    const due = formStatus === 'blocked' ? 0 : (total - down)

    return {
      estBreakfast: breakfast,
      estRentals: rentals,
      estAddons: 0,
      estSubtotal: subtotal,
      estRegularTotal: regularTotal,
      estDiscountAmount: Math.max(0, regularTotal - discountedTotal),
      estTotal: total,
      estDown: down,
      estDue: due,
    }
  }, [unitSelections, formUsePromo, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs, formStatus, rooms, venues, hasVenues, partnerDeals, formPartnerDealId, formGuestBreakfast, formCompanions]) as { estBreakfast: number; estRentals: number; estAddons: number; estSubtotal: number; estRegularTotal: number; estDiscountAmount: number; estTotal: number; estDown: number; estDue: number }

  const hasAddons = estBreakfast > 0 || estRentals > 0 || estAddons > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (Object.values(fieldErrors).some(v => v)) { setTrySave(true); return }
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

    const usePromoForBooking = formUsePromo

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
          guestGender: formGuestGender || undefined,
          guestNationality: formGuestNationality || undefined,
          guestAddress: formGuestAddress || undefined,
          birthdate: formBirthdate || undefined,
          preparedBy: formPreparedBy || undefined,
          appliedDiscount: discountType === 'none' ? undefined : { type: discountType, value: discountValue },
          venueDayBlocks,
          notes: formBlockNotes.trim() || undefined,
          checkIn: sel.checkIn,
          checkOut: sel.checkOut,
          source: bookingType === 'partner' ? 'manual' : formSource,
          status: bookingType === 'partner' ? 'confirmed' : formStatus,
          equipmentRentals: rentals,
          usePromo: usePromoForBooking,
          companions: bookingType === 'partner' ? undefined : (formCompanions.length > 0 ? formCompanions : undefined),
          partnerDealId: formPartnerDealId || undefined,
          companyName: formCompanyName || undefined,
          vehiclePlate: formVehiclePlate || undefined,
          breakfastOrders: (formGuestBreakfast || formCompanions.some(c => c.breakfast)) ? undefined : ([] as BreakfastOrder[]),
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
      const isFirstVenue = true
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
          guestGender: formGuestGender || undefined,
          guestNationality: formGuestNationality || undefined,
          guestAddress: formGuestAddress || undefined,
          birthdate: formBirthdate || undefined,
          preparedBy: formPreparedBy || undefined,
          appliedDiscount: discountType === 'none' ? undefined : { type: discountType, value: discountValue },
          venueDayBlocks,
          notes: formBlockNotes.trim() || undefined,
          checkIn: sel.checkIn,
          checkOut: sel.checkOut,
          source: bookingType === 'partner' ? 'manual' : formSource,
          status: bookingType === 'partner' ? 'confirmed' : formStatus,
          equipmentRentals: rentals,
          usePromo: usePromoForBooking,
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
      setPayAmount(String(createdBookings.reduce((a, b) => a + (b.balance_due || 0), 0)))
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

  const createdDue = useMemo(() => createdBookingList.reduce((a, b) => a + (b.balance_due || 0), 0), [createdBookingList])

  const recordPayment = async () => {
    const amount = parseFloat(payAmount) || createdDue
    if (!createdBookingList.length || amount <= 0) return
    setIsRecordingPay(true)
    try {
      const rec: PaymentRecord = { id: 'rcpt-' + Date.now(), amount, method: payMethod, reference: payReference.trim() || undefined, paid_at: payDate ? new Date(payDate + 'T12:00:00').toISOString() : new Date().toISOString() }
      const target = createdBookingList[0]
      const total = (target.balance_due || 0) + (target.downpayment_paid || 0)
      const newDown = (target.downpayment_paid || 0) + amount
      const newBalance = Math.max(0, total - newDown)
      const status: Booking['payment_status'] = newBalance <= 0 ? 'paid' : 'downpayment'
      const updated: Booking = { ...target, payment_records: [...(target.payment_records || []), rec], downpayment_paid: newDown, balance_due: newBalance, payment_status: status }
      setCreatedBookingList(list => list.map(b => b.id === target.id ? updated : b))
      if (updateBooking) { try { await updateBooking(updated) } catch (e) { console.error('Could not persist payment:', e) } }
      setReceiptRecord(rec)
      setReceiptBooking(updated)
    } finally {
      setIsRecordingPay(false)
    }
  }

  if (createdBookingList.length > 0) {
    return createPortal(
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 flex flex-col items-center" onClick={onClose}>
        <div className="w-full max-w-3xl mb-8" onClick={e => e.stopPropagation()}>
          <div className="bg-base-100 border border-base-300 rounded-xl p-4 shadow-sm mb-4">
            <h4 className="text-xs font-bold text-base-content uppercase tracking-wider mb-1">Record a payment</h4>
            <p className="text-[10px] text-base-content/60 mb-3">Total due: <b className="text-success font-mono">₱{createdDue.toLocaleString()}</b></p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
              <label className="text-[10px] text-base-content/60 font-bold block">Amount (₱)
                <input type="text" inputMode="decimal" value={payAmount || String(createdDue || '')} onChange={e => setPayAmount(e.target.value)} placeholder={String(createdDue || 0)} className="input input-bordered w-full mt-1" />
              </label>
              <label className="text-[10px] text-base-content/60 font-bold block">Method
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="select select-bordered w-full mt-1">
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </label>
              <label className="text-[10px] text-base-content/60 font-bold block">Reference
                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Optional" className="input input-bordered w-full mt-1" />
              </label>
              <label className="text-[10px] text-base-content/60 font-bold block">Date
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="input input-bordered w-full mt-1" />
              </label>
            </div>
            <button type="button" onClick={recordPayment} disabled={isRecordingPay || !(parseFloat(payAmount) || createdDue)} className="btn btn-primary btn-block">
              {isRecordingPay ? 'Recording…' : 'Record a payment'}
            </button>
          </div>

          <PrintInvoiceModal
            bookingsToPrint={createdBookingList}
            rooms={rooms}
            venues={venues}
            bookingsList={bookings}
            onClose={onClose}
            embedded
          />
        </div>
        {receiptRecord && receiptBooking && (
          <PrintPaymentReceiptModal booking={receiptBooking} record={receiptRecord} rooms={rooms} venues={venues} onClose={() => setReceiptRecord(null)} />
        )}
      </div>,
      document.body
    )
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-md md:max-w-4xl bg-base-100 rounded-lg border border-base-300 shadow-xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden transition-all duration-300" onClick={e => e.stopPropagation()}>

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

        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="overflow-y-auto flex-1 p-5 bg-base-200/30">
            <div className="space-y-2.5">
                {formError && (
                  <div className="p-3 bg-error/10 border border-error/20 text-error text-xs flex items-center gap-2 rounded-md animate-in fade-in">
                    <AlertCircle className="w-4 h-4 shrink-0" /><span>{formError}</span>
                  </div>
                )}

                {bookingType === 'partner' ? (
                  <div className="space-y-4 font-sans bg-base-100 border border-base-300 rounded-xl p-5 shadow-sm">
                    <div className="border-b border-base-300 pb-3">
                      <h4 className="text-xs font-bold text-base-content uppercase tracking-wider">
                        Corporate / Agency details
                      </h4>
                      <p className="text-[10px] text-base-content/60 font-medium mt-0.5">
                        Select a partner account to automatically populate contract rates, invoices, and contact info.
                      </p>
                    </div>

                    <div className="space-y-3.5 text-xs">
                      {/* 1. Searchable Partner Selector */}
                      <div className="relative" ref={partnerDropdownRef}>
                        <label className="text-[10px] text-primary font-bold block mb-1 uppercase tracking-wider">Partner Account</label>
                        <div
                          onClick={() => setIsPartnerDropdownOpen(!isPartnerDropdownOpen)}
                          className="w-full bg-base-100 border border-base-300 text-base-content px-3 py-2 rounded-lg focus:outline-none font-semibold cursor-pointer flex justify-between items-center shadow-sm select-none"
                        >
                          <span className={formCompanyName ? 'text-base-content' : 'text-base-content/60 font-normal'}>
                            {formCompanyName || '-- Search & Select Partner --'}
                          </span>
                          <span className="text-[10px] text-base-content/60">▼</span>
                        </div>

                        {isPartnerDropdownOpen && (
                          <div className="absolute z-50 mt-1 w-full bg-base-100 border border-base-300 rounded-lg shadow-lg overflow-hidden flex flex-col max-h-60" onClick={e => e.stopPropagation()}>
                            <div className="p-2 border-b border-base-300 bg-base-200">
                              <input
                                type="text"
                                placeholder="Type to search agency..."
                                value={partnerSearchQuery}
                                onChange={e => setPartnerSearchQuery(e.target.value)}
                                className="input input-bordered w-full text-sm"
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
                                    className="w-full text-left px-3 py-2 hover:bg-primary/10 hover:text-primary text-xs font-semibold text-base-content flex justify-between items-center transition-colors border-none bg-transparent cursor-pointer"
                                  >
                                    <span>{d.name}</span>
                                    <span className="text-[9px] bg-base-300/50 text-base-content/60 px-1.5 py-0.5 rounded uppercase font-bold shrink-0">{d.type}</span>
                                  </button>
                                ))
                              ) : (
                                <div className="px-3 py-3 text-center text-xs text-base-content/60 font-medium">
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
                          <label className="text-[10px] text-primary font-bold block mb-1 uppercase tracking-wider">Check-in *</label>
                          <input
                            type="date"
                            onBlur={markTouched('checkIn')}
                            value={formCheckIn}
                            onChange={e => handlePartnerDateChange('checkIn', e.target.value)}
                            className={isInvalid('checkIn') ? dateFieldErr : dateField}
                          />
                          {showErr('checkIn') && <p className="text-[10px] text-error mt-1">{showErr('checkIn')}</p>}
                        </div>
                        <div>
                          <label className="text-[10px] text-primary font-bold block mb-1 uppercase tracking-wider">Check-out *</label>
                          <input
                            type="date"
                            onBlur={markTouched('checkOut')}
                            value={formCheckOut}
                            onChange={e => handlePartnerDateChange('checkOut', e.target.value)}
                            className={isInvalid('checkOut') ? dateFieldErr : dateField}
                          />
                          {showErr('checkOut') && <p className="text-[10px] text-error mt-1">{showErr('checkOut')}</p>}
                        </div>
                      </div>
                      {showErr('dates') && <p className="text-[10px] text-error mt-1">{showErr('dates')}</p>}
                      {showErr('units') && <p className="text-[10px] text-error mt-1">{showErr('units')}</p>}

                      {/* 3. Selected Rooms Display (Read-Only) */}
                      <div>
                        <label className="text-[10px] text-primary font-bold block mb-1.5 uppercase tracking-wider">Selected Rooms</label>
                        <div className="flex flex-wrap gap-2.5">
                          {Object.entries(unitSelections).map(([id, sel]) => {
                            const isRoom = sel.type === 'room'
                            const name = isRoom 
                              ? roomDisplayName(rooms.find(r => r.id === id))
                              : (venues.find(v => v.id === id)?.name || id)
                            const deal = partnerDeals.find(d => d.id === formPartnerDealId)
                            const contractedPrice = deal?.contracted_rates[id]
                            const basePrice = isRoom 
                              ? (rooms.find(r => r.id === id)?.base_price || 0)
                              : (venues.find(v => v.id === id)?.base_price || 0)
                            
                            return (
                              <div key={id} className="bg-primary/10 border border-base-300 rounded-md px-2 py-1 flex items-center gap-1.5 shadow-sm text-[11px] animate-in fade-in select-none">
                                <span className="font-bold text-base-content">{name}</span>
                                <span className="text-slate-300">|</span>
                                {contractedPrice !== undefined && contractedPrice !== null ? (
                                  <span className="font-extrabold text-primary flex items-center gap-1">
                                    ₱{contractedPrice.toLocaleString()}
                                    <span className="text-[8px] text-primary font-bold bg-[#9A783E]/10 px-1 py-0.5 rounded uppercase">Neg</span>
                                  </span>
                                ) : (
                                  <span className="font-semibold text-base-content/60 flex items-center gap-1">
                                    ₱{basePrice.toLocaleString()}
                                    <span className="text-[8px] text-base-content/60 font-bold bg-base-300/50 px-1 py-0.5 rounded uppercase">Std</span>
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* Promo Price Checkbox */}
                      <div className="pt-2 border-t border-base-300">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formUsePromo}
                            onChange={e => setFormUsePromo(e.target.checked)}
                            className="checkbox checkbox-primary"
                          />
                          <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Use Promo Price</span>
                        </label>
                        {formUsePromo && <p className="text-xs text-base-content/60 mt-1">Guests are charged the exact promo price from the rate card.</p>}
                        <div className="pt-4 border-t border-base-300 mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-ghost"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isSubmitting || !formPartnerDealId || Object.keys(unitSelections).length === 0}
                            className="flex-1 btn btn-primary"
                          >
                            {isSubmitting ? 'Booking...' : 'Confirm Corporate Booking'}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">

                    {showErr('units') && <p className="text-[10px] text-error mt-1">{showErr('units')}</p>}

                    {/* STEP 1: Guest Information + Companions */}
                    {formStatus === 'blocked' && (
                      <div className="space-y-2.5">
                        <div className="bg-base-200 border border-base-300 rounded-lg px-2.5 py-2 space-y-1.5">
                          <p className="text-[10px] font-bold text-base-content flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Block — just blocks the calendar (no charge).
                          </p>
                          <label className="text-[10px] text-base-content/60 font-bold block">Block reason (maintenance / cleaning)</label>
                          <input value={formBlockNotes} onChange={e => setFormBlockNotes(e.target.value.toUpperCase())} placeholder="e.g. Room maintenance" className="input input-sm input-bordered w-full" />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
                          <button type="submit" disabled={isSubmitting} className="btn btn-neutral">{isSubmitting ? 'Creating...' : 'Create Block'}</button>
                        </div>
                      </div>
                    )}

                    {formStatus === 'confirmed' && formStep === 1 && (
                      <div className="space-y-2.5">
                        <RoomDetailsForm
                          formStatus={formStatus}
                          formGuestName={formGuestName}
                          setFormGuestName={setFormGuestName}
                          formGuestBreakfast={formGuestBreakfast}
                          setFormGuestBreakfast={setFormGuestBreakfast}
                          formGuestEmail={formGuestEmail}
                          setFormGuestEmail={setFormGuestEmail}
                          formGuestPhone={formGuestPhone}
                          setFormGuestPhone={setFormGuestPhone}
                          formGuestGender={formGuestGender}
                          setFormGuestGender={setFormGuestGender}
                          formGuestNationality={formGuestNationality}
                          setFormGuestNationality={setFormGuestNationality}
                          formGuestAddress={formGuestAddress}
                          setFormGuestAddress={setFormGuestAddress}
                          formGuestBirthdate={formBirthdate}
                          setFormGuestBirthdate={setFormBirthdate}
                          formBlockNotes={formBlockNotes}
                          setFormBlockNotes={setFormBlockNotes}
                          formVehiclePlate={formVehiclePlate}
                          setFormVehiclePlate={setFormVehiclePlate}
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
                          formTIN={formTIN}
                          setFormTIN={setFormTIN}
                          formAddress={formAddress}
                          setFormAddress={setFormAddress}
                          onSelectPartnerDeal={handleSelectPartnerDeal}
                          guestNameError={showErr('guestName')}
                          onGuestNameBlur={markTouched('guestName')}
                        />
                        <div className="flex justify-between items-center pt-2">
                          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
                          <button type="button" disabled={formStatus === 'confirmed' && !formGuestName.trim()} onClick={() => setFormStep(2)} className="btn btn-primary">
                            Next Step &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 2: Add-ons & Discount + Billing + Receptionist */}
                    {formStatus === 'confirmed' && formStep === 2 && (
                      <div className="space-y-2.5">
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
                        />
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
                          <DiscountPricingControls
                            isDayBlock={hasDayBlock}
                            discountType={discountType}
                            setDiscountType={setDiscountType}
                            discountValue={discountValue}
                            setDiscountValue={setDiscountValue}
                            venueDayBlocks={venueDayBlocks}
                            setVenueDayBlocks={setVenueDayBlocks}
                          />
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><UserCheck className="w-3 h-3" /></span>
                              <h4 className="text-[10px] font-bold text-base-content tracking-widest uppercase">Receptionist on duty</h4>
                            </div>
                            <input value={formPreparedBy} onChange={e => setFormPreparedBy(e.target.value.toUpperCase())} placeholder="Staff name" className="input input-bordered w-full" />
                          </div>
                        </div>
                        <div className="flex justify-between items-center pt-2">
                          <button type="button" onClick={() => setFormStep(1)} className="btn btn-ghost btn-sm">&larr; Back</button>
                          <button type="button" onClick={() => setFormStep(3)} className="btn btn-primary">
                            Next Step &rarr;
                          </button>
                        </div>
                      </div>
                    )}

                    {/* STEP 3: Billing & Confirm */}
                    {formStatus === 'confirmed' && formStep === 3 && (
                      <div className="space-y-2.5">
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
                          formAdditionalDiscount={discountType === 'percent' ? discountValue : 0}
                          guestEmail={formGuestEmail}
                          bookingType={bookingType}
                          formUsePromo={formUsePromo}
                          partnerDeals={partnerDeals}
                          formPartnerDealId={formPartnerDealId}
                          formPaymentMethod={formPaymentMethod}
                          setFormPaymentMethod={setFormPaymentMethod}
                          formPaymentReference={formPaymentReference}
                          setFormPaymentReference={setFormPaymentReference}
                          formVenueExcessHours={formVenueExcessHours}
                          isEditMode={!!editingBookings}
                          formInvoiceNumber={formInvoiceNumber}
                          setFormInvoiceNumber={setFormInvoiceNumber}
                          formPaymentStatus={formPaymentStatus}
                          setFormPaymentStatus={setFormPaymentStatus}
                          formDownpaymentPaid={formDownpaymentPaid}
                          setFormDownpaymentPaid={setFormDownpaymentPaid}
                          formBalanceDue={formBalanceDue}
                          setFormBalanceDue={setFormBalanceDue}
                          formSecurityDeposit={formSecurityDeposit}
                          setFormSecurityDeposit={setFormSecurityDeposit}
                        />
                        <div className="flex justify-between items-center pt-2">
                          <button type="button" onClick={() => setFormStep(2)} className="btn btn-ghost btn-sm">&larr; Back</button>
                          <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                            {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}

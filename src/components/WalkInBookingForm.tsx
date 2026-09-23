import React, { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal } from '../types/booking'
import { useDashboardData } from './DashboardContext'
import {
  AlertCircle, UserCheck, CheckCircle2
} from 'lucide-react'

// Import modular subcomponents
import { DiscountPricingControls, DiscountType } from './calendar/DiscountPricingControls'
import { RoomDetailsForm } from './walk-in/RoomDetailsForm'
import { AmenitiesForm } from './walk-in/AmenitiesForm'
import { BookingDepositFields } from './walk-in/BookingDepositFields'
import { BreakfastRoomChips } from './walk-in/BreakfastRoomChips'
import { breakfastSellable } from '../utils/breakfast'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { getRateConfig } from '../utils/rateConfig'
import { computeBookingEstimate } from './walk-in/bookingEstimate'
import { submitBookingForm } from './walk-in/bookingSubmit'
import { PartnerBookingFields } from './walk-in/PartnerBookingFields'
import { BookingCreatedPanel } from './walk-in/BookingCreatedPanel'
import { BookingWizardHeader } from './walk-in/BookingWizardHeader'

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
    status: 'pending' | 'confirmed' | 'blocked'
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
  initialSelections,
  editingBookings,
  onClose,
  initialBookingType
}: WalkInBookingFormProps) {
  // ── Core form state ──
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
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Explicit promo override — staff picks "Use Promo Price" per booking
  // (replaces the old automatic 20% discount). It STARTS from the global promo
  // switch (bug B3): the calendar already showed promo prices while the form
  // quietly charged the regular ones, so a booking made during a promo sale came
  // out at the wrong price unless staff noticed this switch.
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
  // What the guest agreed to pay now — a 50% deposit or the full amount.
  const [formPaymentPlan, setFormPaymentPlan] = useState<'deposit' | 'full'>('deposit')
  const [formPaymentReference, setFormPaymentReference] = useState('')
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('')

  // ── Quick-form parity fields ──
  const [formPreparedBy, setFormPreparedBy] = useState('')
  // What the guest agreed to pay now (card k130): half the stay by default,
  // typable when the desk agrees something else. 0 means "work it out".
  const [formAgreedDeposit, setFormAgreedDeposit] = useState(0)
  // Which ROOMS take breakfast (breakfast is ₱150 × the room's beds, card k140).
  // It builds OFF: the desk taps the rooms that want it.
  const [formBreakfastRoomIds, setFormBreakfastRoomIds] = useState<string[]>([])
  const [depositTouched, setDepositTouched] = useState(false)
  const [formBirthdate, setFormBirthdate] = useState('')
  const [formBlockNotes, setFormBlockNotes] = useState('')
  const [discountType, setDiscountType] = useState<DiscountType>('none')
  const [discountValue, setDiscountValue] = useState(0)
  const [venueDayBlocks, setVenueDayBlocks] = useState(1)
  
  // ── Manual Financial Overrides (for Edit Mode) ──
  // Kept only to re-derive the status when editing — it is never typed by hand.
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
      setFormPaymentPlan(b.payment_plan === 'full' ? 'full' : 'deposit')
      setFormVenueExcessHours(b.venue_excess_hours || 0)
      setFormInvoiceNumber(b.invoice_number || '')
      
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
    // There is deliberately NO payment-method rule any more (card k132): the
    // guest chooses how they pay, and that choice is recorded when the money is
    // actually received. Staff are not made to guess it at booking time.
  }
  const showErr = (k: keyof typeof fieldErrors) => (touched[k] || trySave) ? fieldErrors[k] : ''
  const isInvalid = (k: keyof typeof fieldErrors) => Boolean(showErr(k))
  const markTouched = (k: keyof typeof fieldErrors) => () => setTouched(t => ({ ...t, [k]: true }))
  const dateField = 'input input-bordered w-full'
  const dateFieldErr = 'input input-bordered input-error w-full'

  // ── Pricing calculations (estimate for totals; real nightly rate goes through calculatePricing) ──
  const { estBreakfast, estRentals, estAddons, estSubtotal, estTotal, estDown, estDue } = useMemo(
    () => computeBookingEstimate({
      unitSelections, rooms, venues, partnerDeals, formPartnerDealId, formStatus, hasVenues,
      formBreakfastRoomIds, formCompanions, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel,
      formEventTable, formEventTent, formChairs,
    }),
    [unitSelections, rooms, venues, partnerDeals, formPartnerDealId, formStatus, hasVenues, formBreakfastRoomIds, formCompanions, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs]
  )

  // The deposit box arrives filled with half the stay and keeps following the
  // stay until somebody types their own figure (card k130).
  useEffect(() => {
    if (depositTouched) return
    setFormAgreedDeposit(Math.max(0, Math.round(estTotal / 2)))
  }, [estTotal, depositTouched])
  // How many nights the picked dates add up to — the figure the deposit is
  // worked from, shown to the desk so half the stay is never a mystery sum.
  const stayNights = useMemo(
    () => Math.max(1, ...Object.values(unitSelections).map(sel =>
      sel.checkIn && sel.checkOut
        ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
        : 1
    )),
    [unitSelections]
  )

  const staffNames = useMemo(
    () => Array.from(new Set((bookings || []).map(b => (b.prepared_by || '').trim()).filter(Boolean))).sort(),
    [bookings]
  )

  // The picked rooms, in calendar order — what the breakfast chips offer.
  const pickedRooms = useMemo(
    () => Array.from(formRoomIds).map(id => rooms.find(r => r.id === id)).filter(Boolean) as Room[],
    [formRoomIds, rooms]
  )

  const hasAddons = estBreakfast > 0 || estRentals > 0 || estAddons > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (Object.values(fieldErrors).some(v => v)) { setTrySave(true); return }
    setIsSubmitting(true)
    // A brand-new walk-in booking is NOT confirmed yet — it stays in the
    // "Unpaid"/pending state until the first payment is recorded. Corporate
    // bookings are contract-backed, so they confirm immediately. Editing keeps
    // whatever status the booking already had (no silent confirm).
    const bookingStatus: 'pending' | 'confirmed' | 'blocked' =
      formStatus === 'blocked'
        ? 'blocked'
        : bookingType === 'partner'
          ? 'confirmed'
          : (editingBookings && editingBookings.length > 0)
            ? (editingBookings[0].status || 'confirmed')
            : 'pending'
    // Payment status is never chosen by hand: editing a booking keeps the status
    // that the money already recorded implies (nothing / part / all of it).
    const derivedPaymentStatus: 'unpaid' | 'downpayment' | 'paid' =
      formDownpaymentPaid <= 0 ? 'unpaid' : (formBalanceDue ?? estDue) <= 0 ? 'paid' : 'downpayment'
    const result = await submitBookingForm({
      bookingStatus,
      unitSelections, formRoomIds, formVenueIds, rooms, venues,
      activeBookings: activeBookingsContext,
      partnerDeals, formPartnerDealId, bookingType, formStatus, formGuestName,
      formGuestEmail, formGuestPhone, formGuestGender, formGuestNationality, formGuestAddress,
      formBirthdate, formPreparedBy, formCompanyName, formVehiclePlate, formInvoiceNumber,
      formSource, formBreakfastRoomIds, formCompanions,
      formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel,
      formChairs, formEventTable, formEventTent, formVenueExcessHours,
      formBlockNotes, discountType, discountValue, venueDayBlocks, editingBookings,
      formPaymentMethod, formPaymentReference, formPaymentPlan, derivedPaymentStatus, formDownpaymentPaid,
      formBalanceDue, formSecurityDeposit, formAgreedDeposit, createManualBooking, cancelBooking,
    })
    if (!result.ok) { setFormError(result.error); setIsSubmitting(false); return }
    setCreatedBookingList(result.bookings)
    setIsSubmitting(false)
  }

  if (createdBookingList.length > 0) {
    return createPortal(
      <BookingCreatedPanel
        createdBookingList={createdBookingList}
        rooms={rooms}
        venues={venues}
        bookings={bookings}
        /* The statement is handed over first; closing it opens the booking that
           was just made in the quick view (card k134). */
        onClose={() => { focusBookingAfterCreate(createdBookingList[0]?.id); onClose() }}
      />,
      document.body
    )
  }

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 font-sans" onClick={onClose}>
      <div className="w-full max-w-md md:max-w-4xl bg-base-100 rounded-lg border border-base-300 shadow-xl flex flex-col max-h-[92vh] md:max-h-[85vh] overflow-hidden transition-all duration-300" onClick={e => e.stopPropagation()}>

        <BookingWizardHeader
          hasVenues={hasVenues}
          hasRooms={hasRooms}
          bookingType={bookingType}
          formStatus={formStatus}
          setFormStatus={setFormStatus}
          formGuestName={formGuestName}
          onClose={onClose}
        />
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
                  <PartnerBookingFields
                    partnerDropdownRef={partnerDropdownRef}
                    isPartnerDropdownOpen={isPartnerDropdownOpen}
                    setIsPartnerDropdownOpen={setIsPartnerDropdownOpen}
                    partnerSearchQuery={partnerSearchQuery}
                    setPartnerSearchQuery={setPartnerSearchQuery}
                    filteredDeals={filteredDeals}
                    onSelectDeal={handleSelectPartnerDeal}
                    setFormGuestName={setFormGuestName}
                    formCompanyName={formCompanyName}
                    formCheckIn={formCheckIn}
                    formCheckOut={formCheckOut}
                    handlePartnerDateChange={handlePartnerDateChange}
                    markTouched={markTouched}
                    isInvalid={isInvalid}
                    showErr={showErr}
                    dateField={dateField}
                    dateFieldErr={dateFieldErr}
                    unitSelections={unitSelections}
                    rooms={rooms}
                    venues={venues}
                    partnerDeals={partnerDeals}
                    formPartnerDealId={formPartnerDealId}
                    isSubmitting={isSubmitting}
                    onClose={onClose}
                  />
                ) : (
                  <div className="space-y-2.5">

                    {showErr('units') && <p className="text-[10px] text-error mt-1">{showErr('units')}</p>}

                    {/* ONE FORM (cards k126, k128, k130, k132, k138): guest,
                        companions, unit and dates, add-ons, discount, the
                        receptionist and the deposit are all on this page — the
                        paper form the staff already know, with no steps. */}
                    {formStatus === 'confirmed' && (
                      <div className="space-y-2.5">
                        <RoomDetailsForm
                          formStatus={formStatus}
                          formGuestName={formGuestName}
                          setFormGuestName={setFormGuestName}
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

                        {/* Breakfast is a ROOM's choice, not a guest's (card k140): one line of
                            room chips, right above the add-ons. */}
                        <BreakfastRoomChips
                          rooms={pickedRooms}
                          chosen={formBreakfastRoomIds}
                          onToggle={id => setFormBreakfastRoomIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                          onAll={on => setFormBreakfastRoomIds(on ? pickedRooms.filter(breakfastSellable).map(r => r.id) : [])}
                        />

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
                            {/* The names used before suggest themselves (card k136), so
                                the same person is never written two different ways. */}
                            <input list="staff-names" value={formPreparedBy}
                              onChange={e => setFormPreparedBy(e.target.value.toUpperCase())}
                              placeholder="Staff name" className="input input-bordered w-full" />
                            <datalist id="staff-names">
                              {staffNames.map(name => <option key={name} value={name} />)}
                            </datalist>
                          </div>
                        </div>

                        <BookingDepositFields
                          estTotal={estTotal}
                          nights={stayNights}
                          stayAmount={estSubtotal}
                          breakfast={estBreakfast}
                          extras={estRentals + estAddons}
                          agreedDeposit={formAgreedDeposit}
                          setAgreedDeposit={v => { setDepositTouched(true); setFormAgreedDeposit(v) }}
                          isEditMode={!!editingBookings}
                          formInvoiceNumber={formInvoiceNumber}
                          setFormInvoiceNumber={setFormInvoiceNumber}
                          formDownpaymentPaid={formDownpaymentPaid}
                          setFormDownpaymentPaid={setFormDownpaymentPaid}
                          formBalanceDue={formBalanceDue}
                          setFormBalanceDue={setFormBalanceDue}
                          formSecurityDeposit={formSecurityDeposit}
                          setFormSecurityDeposit={setFormSecurityDeposit}
                        />

                        <div className="flex justify-end items-center gap-2 pt-2">
                          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
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
import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal, PaymentRecord } from '../types/booking'
import { useDashboardData } from './DashboardContext'
import {
  AlertCircle, UserCheck
} from 'lucide-react'

// Import modular subcomponents
import { DiscountPricingControls, DiscountType } from './calendar/DiscountPricingControls'
import { RoomDetailsForm } from './walk-in/RoomDetailsForm'
import { AmenitiesForm } from './walk-in/AmenitiesForm'
import { BookingDepositFields, PayPlan, PayMethod } from './walk-in/BookingDepositFields'
import { methodNeedsReference, paymentKind, paymentMethodChoice } from '../utils/paymentMethod'
import { BreakfastRoomChips } from './walk-in/BreakfastRoomChips'
import { breakfastSellable } from '../utils/breakfast'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { computeBookingEstimate } from './walk-in/bookingEstimate'
import { submitBookingForm } from './walk-in/bookingSubmit'
import { AgencyFields } from './walk-in/AgencyFields'
import { AgencyProfileForm } from './walk-in/AgencyProfileForm'
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
  /**
   * Used to write the payment the form has just taken (2026-09-29). The booking is created
   * first and the money is applied to it, so each unit's balance is worked out by the
   * pricing engine before the payment is split across them.
   */
  updateBooking: (booking: Booking) => Promise<void>
  initialSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  editingBookings?: Booking[]
  onClose: () => void
  initialBookingType?: 'individual' | 'partner'
  /** The hours tapped on the calendar's bar (3, 6 or 12), already chosen when the form opens. */
  initialStayHours?: number
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
  initialBookingType,
  initialStayHours
}: WalkInBookingFormProps) {
  /**
   * Is an agency paying for this stay? (the owner's design, 2026-09)
   *
   * The quiet `agency` mark in the header row is the only switch, and it does ONE thing:
   * it adds the agency block to this same single-page form. There is no separate corporate
   * form any more, and no room is ever picked for the desk — the agency only changes what
   * the bill is addressed to and what the rooms cost.
   */
  const [agencyOn, setAgencyOn] = useState((initialBookingType || 'individual') === 'partner')
  /** True while the bill-to picker is open (the ⋯ can open it, as can the line's Change). */
  const [agencyPicking, setAgencyPicking] = useState(false)
  /** The agency profile being created or corrected — one editor for both (the owner's ruling). */
  const [agencyProfile, setAgencyProfile] = useState<{ deal: PartnerDeal | null; draftName: string } | null>(null)

  // ── Corporate / Partner presets state ──
  const { partnerDeals } = useDashboardData()
  const [formPartnerDealId, setFormPartnerDealId] = useState('')
  const [formCompanyName, setFormCompanyName] = useState('')
  const [formVehiclePlate, setFormVehiclePlate] = useState('')
  const [formTIN, setFormTIN] = useState('')
  const [formAddress, setFormAddress] = useState('')

  /** An agency booking IS a normal booking (the owner's rule): all `partner` means here is
   *  that the trip is contract-backed, which is what confirms it and what the bill uses. */
  const bookingType: 'individual' | 'partner' = agencyOn ? 'partner' : 'individual'

  const handleSelectPartnerDeal = (deal: PartnerDeal | null) => {
    if (deal) {
      setFormPartnerDealId(deal.id)
      setFormCompanyName(deal.name)
      setFormTIN(deal.tin || '')
      setFormAddress(deal.address || '')
      setFormVehiclePlate(deal.vehicle_plate || '')
      setFormGuestEmail(deal.email || '')
      setFormGuestPhone(deal.contact_no || '')
      // NOTE: no rooms are selected here (the owner's ruling, 2026-09). The corporate
      // path used to tick every room the agency had a rate for, which is exactly the
      // "automatic booking" his note rejected — an agency changes the PRICE, the desk
      // still picks the rooms. The agency's rates are applied to whatever is picked.
    } else {
      setFormPartnerDealId('')
      setFormCompanyName('')
      setFormTIN('')
      setFormAddress('')
      setFormVehiclePlate('')
    }
  }

  // Local check-in / check-out dates, used by the AGENCY path's own date guard.
  const [formCheckIn] = useState(() => {
    const vals = Object.values(initialSelections)
    return vals.length > 0 ? vals[0].checkIn : ''
  })
  const [formCheckOut] = useState(() => {
    const vals = Object.values(initialSelections)
    return vals.length > 0 ? vals[0].checkOut : ''
  })
  
  // Staggered Date Selection Map per selected Room/Venue
  const [unitSelections, setUnitSelections] = useState<Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>>(initialSelections)


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
  /** The receipt for money taken **in this form** — null for a Reservation, which pays nothing. */
  const [createdReceipt, setCreatedReceipt] = useState<PaymentRecord | null>(null)


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
  // How the guest pays, asked here since 2026-09-29 because the form now takes the money
  // too. `''` is a real state — nothing is preselected, so a GCash guest can never be
  // handed a Cash receipt by a default the desk never chose.
  const [formPaymentMethod, setFormPaymentMethod] = useState<PayMethod>('')
  // What the guest pays now (the owner's ruling, 2026-09): Deposit is the standard,
  // Full pay and Custom are the two other things a guest ever asks for.
  const [formPaymentPlan, setFormPaymentPlan] = useState<PayPlan>('deposit')
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
  // SHORT STAY (the printed rate board): the hours the room is being sold for — 3, 6
  // or 12 — or null for an ordinary overnight booking. It is SETTLED BEFORE this form
  // opens: the calendar's action bar carries the hours at the room's own board prices,
  // so there is no hours picker here any more (the owner's instruction) and the hours
  // are read-only for the rest of the booking.
  const shortStayHours = initialStayHours ?? null
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
      
      if (b.partner_deal_id || b.company_name) {
        setAgencyOn(true)
        setFormPartnerDealId(b.partner_deal_id || '')
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

      setFormPaymentMethod(paymentMethodChoice(b.payment_method || undefined))
      setFormPaymentReference(b.payment_reference || '')
      setFormPaymentPlan(
        b.payment_plan === 'full' ? 'full'
          : b.payment_plan === 'custom' ? 'custom'
            : b.payment_plan === 'reservation' ? 'reservation'
              : 'deposit',
      )
      // The Custom figure the desk typed when the booking was made, put back in the box —
      // without this, editing any booking showed Custom as ₱0 and saving wrote that zero
      // over the agreed deposit.
      setFormAgreedDeposit(b.agreed_deposit ?? 0)
      setDepositTouched(b.agreed_deposit != null)
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
    // The guest's name is required on EVERY booking, agency or not: it is the name that
    // stays on the stay, and an agency booking prints it as `c/o <name>`.
    guestName: (formStatus === 'confirmed' && !formGuestName.trim()) ? 'Guest name is required.' : '',
    // There is deliberately NO payment-method rule any more (card k132): the
    // guest chooses how they pay, and that choice is recorded when the money is
    // actually received. Staff are not made to guess it at booking time.
  }
  const showErr = (k: keyof typeof fieldErrors) => (touched[k] || trySave) ? fieldErrors[k] : ''
  const markTouched = (k: keyof typeof fieldErrors) => () => setTouched(t => ({ ...t, [k]: true }))

  // ── Pricing calculations (estimate for totals; real nightly rate goes through calculatePricing) ──
  const { estBreakfast, estRentals, estAddons, estTotal, estDue } = useMemo(
    () => computeBookingEstimate({
      unitSelections, rooms, venues, partnerDeals, formPartnerDealId, formStatus, hasVenues,
      formBreakfastRoomIds, formCompanions, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel,
      formEventTable, formEventTent, formChairs,
      shortStayHours,
    }),
    [unitSelections, rooms, venues, partnerDeals, formPartnerDealId, formStatus, hasVenues, formBreakfastRoomIds, formCompanions, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs, shortStayHours]
  )

  // The figure the desk asks for now, by plan (the owner's ruling): the half for a
  // deposit, the whole stay for Full pay, and the typed figure for Custom. A
  // **Reservation** agrees to nothing, so its figure is 0 — deliberately, so no screen
  // and no printed page can show money the guest never promised. `depositTouched` still
  // means "the desk has typed in the Custom box". DERIVED, not copied into state by an
  // effect: an effect here re-rendered the whole form on every estimate change, and the
  // figure is only ever read below.
  const agreedDeposit = formPaymentPlan === 'full'
    ? Math.max(0, Math.round(estTotal))
    : formPaymentPlan === 'custom'
      ? (depositTouched ? formAgreedDeposit : 0)
      : formPaymentPlan === 'reservation'
        ? 0
        : Math.max(0, Math.round(estTotal / 2))

  /**
   * **The payment gate** (the owner's ruling, 2026-09-29). The form now takes the money, so
   * it cannot finish without knowing how the guest paid — and for GCash or a bank transfer,
   * not without the reference the guest is reading out. Confirm stays asleep and says why
   * underneath, in exactly the shape the agency gate already uses, rather than failing on
   * the press. A **Reservation** pays nothing, so it is asked nothing.
   */
  const paysSomething = shortStayHours ? true : formPaymentPlan !== 'reservation'
  const paymentPrompt = !paysSomething || agreedDeposit <= 0 ? ''
    : !formPaymentMethod ? 'Choose how the guest paid.'
      : methodNeedsReference(formPaymentMethod) && !formPaymentReference.trim()
        ? (paymentKind(formPaymentMethod) === 'gcash'
            ? 'Enter the GCash reference number before confirming.'
            : 'Enter the bank transfer reference number before confirming.')
        : ''

  /**
   * The money card's props in one place: it is rendered twice (a short stay shows the
   * `Paid by` row alone), and the two call sites must never drift apart.
   */
  const depositFieldProps = {
    estTotal,
    plan: formPaymentPlan,
    setPlan: setFormPaymentPlan,
    agreedDeposit,
    setAgreedDeposit: (v: number) => { setDepositTouched(true); setFormAgreedDeposit(v) },
    method: formPaymentMethod,
    setMethod: (m: PayMethod) => {
      setFormPaymentMethod(m)
      // A reference belongs to the method that asked for it: switching from GCash to Cash
      // must not leave the GCash number behind on a booking that was paid in cash.
      if (!methodNeedsReference(m)) setFormPaymentReference('')
    },
    reference: formPaymentReference,
    setReference: setFormPaymentReference,
    formInvoiceNumber,
    setFormInvoiceNumber,
    formDownpaymentPaid,
    setFormDownpaymentPaid,
    formBalanceDue,
    setFormBalanceDue,
    formSecurityDeposit,
    setFormSecurityDeposit,
  }

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

  /** What the agency block shows, gathered from the fields it fills in. */
  const agency = {
    dealId: formPartnerDealId,
    name: formCompanyName,
    address: formAddress,
    contact: formGuestPhone,
    tin: formTIN,
    plate: formVehiclePlate,
  }

  /** An agency booking cannot be confirmed until the bill has an addressee. */
  const agencyMissing = agencyOn && formStatus === 'confirmed' && !formCompanyName.trim()

  /**
   * Create a new agency, or correct the one that is on the booking — same profile form.
   *
   * The `deal` argument decides which: `null` means **create a new one**, and it is the
   * only thing `＋ New agency` ever sends. This used to fall back to the agency already
   * named on the booking when `null` arrived, so pressing `＋ New agency` opened that
   * agency as **Edit agency** — pre-filled with its details and room prices, with Save
   * agency writing over it, and no new agency ever created (the owner's report,
   * 2026-09-28). The fallback was written for a caller that does not exist: **Change**
   * reopens the picker on purpose (the owner's ruling), so it never asks for a profile.
   */
  const openAgencyProfile = (deal: PartnerDeal | null, draftName: string) => {
    setAgencyProfile({ deal, draftName })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setFormError('')
    if (Object.values(fieldErrors).some(v => v)) { setTrySave(true); return }

    // ── The money gate (the owner's ruling, 2026-09-29) ──────────────────────────────
    // The form now TAKES the payment, because that is what really happens: the guest is
    // asked deposit or full pay **and how they will pay** in the same breath, and the desk
    // writes both down. So every plan except **Reservation** must name a way to pay, and
    // GCash / bank must carry the reference the guest is reading out — the form will not
    // finish without it. A Reservation pays nothing and is exempt by definition.
    const paidNow = shortStayHours ? estTotal : agreedDeposit
    const isReservation = !shortStayHours && formPaymentPlan === 'reservation'
    if (!isReservation && paidNow > 0) {
      if (!formPaymentMethod) {
        setFormError('Choose how the guest paid.')
        return
      }
      if (methodNeedsReference(formPaymentMethod) && !formPaymentReference.trim()) {
        setFormError(paymentKind(formPaymentMethod) === 'gcash'
          ? 'Enter the GCash reference number before confirming.'
          : 'Enter the bank transfer reference number before confirming.')
        return
      }
    }

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
      formPaymentMethod, formPaymentReference, derivedPaymentStatus, formDownpaymentPaid,
      formBalanceDue, formSecurityDeposit, formAgreedDeposit: shortStayHours ? estTotal : agreedDeposit, createManualBooking, cancelBooking,
      // A short stay is paid in full at the counter, so its plan is the whole amount.
      formPaymentPlan: shortStayHours ? 'full' : formPaymentPlan,
      stay_hours: shortStayHours ?? undefined,
      // **What the guest hands over in this form.** A short stay is paid in full, a
      // Reservation hands over nothing, and everything else is the agreed figure — the same
      // number the `Pays now` row is showing, so the form can never take a different amount
      // from the one the desk read out.
      receivedAmount: shortStayHours ? estTotal : isReservation ? 0 : paidNow,
      updateBooking,
    })
    if (!result.ok) { setFormError(result.error); setIsSubmitting(false); return }
    setCreatedBookingList(result.bookings)
    // **The money was taken in this form** (2026-09-29), so what the guest is handed is the
    // receipt, not the bill. A Reservation pays nothing and returns no receipt, so it still
    // gets the billing statement — exactly as it always has.
    setCreatedReceipt(result.receipt ?? null)
    setIsSubmitting(false)
  }

  if (createdBookingList.length > 0) {
    return createPortal(
      <BookingCreatedPanel
        createdBookingList={createdBookingList}
        rooms={rooms}
        venues={venues}
        bookings={bookings}
        receipt={createdReceipt}
        /* Closing the paper opens the booking that was just made in the quick view
           (card k134). */
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

                <div className="space-y-2.5">

                    {showErr('units') && <p className="text-[10px] text-error mt-1">{showErr('units')}</p>}

                    {/* ONE FORM (cards k126, k128, k130, k132, k138): guest,
                        companions, unit and dates, add-ons, discount, the
                        receptionist and the deposit are all on this page — the
                        paper form the staff already know, with no steps. */}
                    {formStatus === 'confirmed' && (
                      <div className="space-y-2.5">
                        {/* THE HOURS ARE CHOSEN ON THE CALENDAR, NOT HERE (the owner's
                            instruction): the bar that pops up on the day the desk picked
                            carries `3h · 6h · 12h` at the room's own board prices, and
                            the hours arrive in this form already settled. A SHORT STAY
                            takes the room for the whole day and is paid in full at the
                            counter, so breakfast, add-ons, discount and deposit simply
                            step out of the way — the hours and what they cost are stated
                            on the gold line where the deposit would be. */}

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
                          agencyOn={agencyOn}
                          agencyKey={formPartnerDealId || formCompanyName}
                          agencyPicking={agencyPicking}
                          onAddAgency={() => { setAgencyOn(true); setAgencyPicking(true) }}
                          onRemoveAgency={() => { handleSelectPartnerDeal(null); setAgencyOn(false); setAgencyPicking(false) }}
                          agencySlot={agencyOn ? (
                            <AgencyFields
                              value={agency}
                              picking={agencyPicking}
                              setPicking={setAgencyPicking}
                              onChange={v => {
                                setFormPartnerDealId(v.dealId)
                                setFormCompanyName(v.name)
                                setFormAddress(v.address)
                                setFormTIN(v.tin)
                                setFormVehiclePlate(v.plate)
                                if (v.contact) setFormGuestPhone(v.contact)
                                setAgencyPicking(false)
                              }}
                              onOpenProfile={openAgencyProfile}
                              onRemove={() => { handleSelectPartnerDeal(null); setAgencyOn(false); setAgencyPicking(false) }}
                            />
                          ) : null}
                        />

                        {/* Breakfast is a ROOM's choice, not a guest's (card k140): one line of
                            room chips, right above the add-ons. Not for a short stay —
                            a three-hour guest buys no breakfast. */}
                        {!shortStayHours && (
                          <>
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
                          </>
                        )}

                        {/* ── The money block (the owner's 2026-09-29 layout fix) ──────────
                            Two columns that end together. The Discount card is one row and the
                            money card is three, so sitting them side by side left a band of empty
                            surface under the Discount card — *"the gap between the two is
                            ridiculous."* Receptionist moves up into that space, and Cancel /
                            Confirm Booking take its old place directly under the money card, which
                            is where the eye already is when the button is pressed. */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 items-start">
                          {/* Left: what the stay is priced at, and who took it. */}
                          <div className="space-y-2.5">
                            {!shortStayHours && (
                              <DiscountPricingControls
                                isDayBlock={hasDayBlock}
                                discountType={discountType}
                                setDiscountType={setDiscountType}
                                discountValue={discountValue}
                                setDiscountValue={setDiscountValue}
                                venueDayBlocks={venueDayBlocks}
                                setVenueDayBlocks={setVenueDayBlocks}
                              />
                            )}
                            <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-2 flex items-center gap-2">
                              <span className="flex items-center gap-1.5 shrink-0 w-[104px]" title="Who took this booking — it prints on the bill and the receipt.">
                                <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><UserCheck className="w-2.5 h-2.5" /></span>
                                <span className="text-[10px] font-bold text-base-content/70 whitespace-nowrap">Receptionist</span>
                              </span>
                              {/* The names used before suggest themselves (card k136), so
                                  the same person is never written two different ways. */}
                              <input list="staff-names" value={formPreparedBy} aria-label="Receptionist on duty"
                                onChange={e => setFormPreparedBy(e.target.value.toUpperCase())}
                                placeholder="Staff name" className="input input-bordered input-sm flex-1 min-w-0" />
                              <datalist id="staff-names">
                                {staffNames.map(name => <option key={name} value={name} />)}
                              </datalist>
                            </div>
                          </div>

                          {/* Right: what the guest pays, then the buttons under it. */}
                          <div className="space-y-2.5">
                            {shortStayHours ? (
                              <>
                                <div className="bg-gold-100 border border-gold-400 rounded-lg px-3.5 py-2">
                                  <p className="text-[13px] font-bold text-ink-900">
                                    {shortStayHours}-hour stay · ₱{estTotal.toLocaleString()} — paid in full at the counter
                                  </p>
                                  <p className="text-[11px] text-ink-600 mt-0.5">
                                    No deposit and no statement: the guest pays the whole amount now, and the receipt is printed from the booking. The room stays taken for the rest of the day while it is cleaned.
                                  </p>
                                </div>
                                <BookingDepositFields shortStay {...depositFieldProps} isEditMode={false} />
                              </>
                            ) : (
                              <BookingDepositFields {...depositFieldProps} isEditMode={!!editingBookings} />
                            )}

                            <div>
                              <div className="flex justify-end items-center gap-2">
                                <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
                                <button type="submit" disabled={isSubmitting || agencyMissing || !!paymentPrompt} className="btn btn-primary">
                                  {isSubmitting ? 'Booking...' : 'Confirm Booking'}
                                </button>
                              </div>
                              {/* The agency is step one of the agency path (the owner's ruling):
                                  Confirm stays asleep until the bill has an addressee, and it says
                                  so right under the button rather than in a popup. */}
                              {agencyMissing && (
                                <p className="text-[11px] text-danger-600 font-semibold text-right mt-1">
                                  Choose the agency above — the bill is addressed to them.
                                </p>
                              )}
                              {/* …and Confirm stays asleep for the money too (2026-09-29), saying
                                  which half is missing rather than failing on the press. */}
                              {paymentPrompt && !agencyMissing && (
                                <p className="text-[11px] text-danger-600 font-semibold text-right mt-1">{paymentPrompt}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
            </div>
          </div>
        </form>

        {/* The agency's own profile — details AND its per-room prices (the owner's ruling,
            2026-09). It opens when a new agency is created from the bill-to picker, and
            again from Change, so one editor owns an agency whether it is new or old. */}
        {agencyProfile && (
          <AgencyProfileForm
            deal={agencyProfile.deal}
            draftName={agencyProfile.draftName}
            rooms={rooms}
            onClose={() => { setAgencyProfile(null); setAgencyPicking(true) }}
            onSaved={saved => {
              handleSelectPartnerDeal(saved)
              setAgencyOn(true)
              setAgencyPicking(false)
              setAgencyProfile(null)
            }}
          />
        )}
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
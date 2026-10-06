import React, { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Room, Venue, Booking, BookingSource, BreakfastOrder, Companion, EquipmentRental, EventAddons, PartnerDeal, PaymentRecord } from '../types/booking'
import { useDashboardData } from './DashboardContext'

// Import modular subcomponents
import { DiscountPricingControls, DiscountType } from './calendar/DiscountPricingControls'
import { RoomDetailsForm } from './walk-in/RoomDetailsForm'
import { AmenitiesForm } from './walk-in/AmenitiesForm'
import { BookingDepositFields, PayPlan, PayMethod } from './walk-in/BookingDepositFields'
import { BookingCorrectionFields } from './walk-in/BookingCorrectionFields'
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
import { Field } from './walk-in/Field'
import { FIELD, GROUP, GROUP_TITLE, OPTION_LIST } from './walk-in/formStyles'
import { stayLines } from './walk-in/stayLine'

/**
 * The receptionist named on the last booking made on THIS computer (the design review,
 * 2026-10-04). The box used to open empty on every booking and was easy to miss, so
 * bills and receipts went out with nobody's name on them. Now it opens already filled
 * and the desk only retypes it when the person on duty changes.
 */
const RECEPTIONIST_KEY = 'daweez_pms_receptionist'
const lastReceptionist = () => {
  try { return localStorage.getItem(RECEPTIONIST_KEY) || '' } catch { return '' }
}
const rememberReceptionist = (name: string) => {
  try { localStorage.setItem(RECEPTIONIST_KEY, name.trim()) } catch { /* storage is off: nothing to remember */ }
}

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
  deleteBooking: (bookingId: string) => Promise<void>
  /** Every booking, cancelled ones included — for receipt numbering only. */
  allBookings: Booking[]
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
  deleteBooking,
  allBookings,
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
  // How the payment is decided: Custom, Full pay or No deposit — one toggle, for an agency
  // booking too. **A new booking opens with none of the three chosen** (Sebastian,
  // 2026-10-06: *"don't default to custom. let it be unselected"*), and the form waits for
  // the desk to pick one — a payment the form chose by itself is one nobody agreed. Until
  // then `formPaymentPlan` is only a placeholder; `planChosen` says whether it means anything.
  // A booking being corrected already has its plan, so it opens chosen.
  const [formPaymentPlan, setFormPaymentPlan] = useState<PayPlan>('custom')
  const [planChosen, setPlanChosen] = useState(() => !!(editingBookings && editingBookings.length > 0))
  const [formPaymentReference, setFormPaymentReference] = useState('')
  const [formInvoiceNumber, setFormInvoiceNumber] = useState('')

  // ── Quick-form parity fields ──
  // A NEW booking opens with the last receptionist; a booking being corrected keeps the
  // name already on it (seeded below), never the name of whoever is correcting it.
  const [formPreparedBy, setFormPreparedBy] = useState(() => editingBookings && editingBookings.length > 0 ? '' : lastReceptionist())
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
  /** The note written beside a Custom deposit. It is saved in the booking's `notes`, and
   *  only a Custom deposit keeps one (Sebastian, 2026-10-06). */
  const [formPaymentNote, setFormPaymentNote] = useState('')
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
      // These three sit behind "＋ More details". Left unseeded they were saved back
      // empty, so correcting any booking blanked the guest's sex, nationality and address.
      setFormGuestGender(b.guest_gender || '')
      setFormGuestNationality(b.guest_nationality || '')
      setFormGuestAddress(b.guest_address || '')
      // Same for breakfast: an unseeded list saved every room back as "no breakfast".
      setFormBreakfastRoomIds(editingBookings.filter(eb => eb.room_id && eb.breakfast_included).map(eb => eb.room_id as string))
      setFormSource(b.source)
      // Upgrade pending to confirmed in edit mode usually. (A cancelled booking is never opened here.)
      setFormStatus(b.status === 'blocked' ? 'blocked' : 'confirmed')
      
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
          : b.payment_plan === 'agency' ? 'agency'
            : b.payment_plan === 'reservation' ? 'reservation'
              : 'deposit',
      )
      setPlanChosen(true)
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
      setFormPaymentNote(b.status === 'blocked' ? '' : b.notes || '')
      // A zero discount is a removed one (see `bookingSubmit`), so it reads as None.
      if (b.applied_discount && b.applied_discount.value > 0) { setDiscountType(b.applied_discount.type); setDiscountValue(b.applied_discount.value) }
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
      formEventTable, formEventTent, formChairs, formVenueExcessHours,
      discountType, discountValue, venueDayBlocks, bookingType,
      shortStayHours,
    }),
    [unitSelections, rooms, venues, partnerDeals, formPartnerDealId, formStatus, hasVenues, formBreakfastRoomIds, formCompanions, formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel, formEventTable, formEventTent, formChairs, formVenueExcessHours, discountType, discountValue, venueDayBlocks, bookingType, shortStayHours]
  )

  // The figure the desk asks for now, by plan (the owner's ruling): the whole stay for
  // Full pay, and for Custom the typed figure — **which is half the stay until the desk
  // types one** (2026-10-06), following the stay as it changes. A **Reservation** agrees
  // to nothing, so its figure is 0 — deliberately, so no screen and no printed page can
  // show money the guest never promised. `depositTouched` means "the desk has typed in
  // the Custom box". DERIVED, not copied into state by an effect: an effect here
  // re-rendered the whole form on every estimate change, and the figure is only ever
  // read below. **Nothing agreed is nothing owed**: until the desk has chosen one of the
  // three, the figure is 0.
  const agreedDeposit = !planChosen
    ? 0
    : formPaymentPlan === 'full'
    ? Math.max(0, Math.round(estTotal))
    : formPaymentPlan === 'custom'
      ? (depositTouched ? formAgreedDeposit : Math.max(0, Math.round(estTotal / 2)))
      : formPaymentPlan === 'reservation' || formPaymentPlan === 'agency'
        ? 0
        : Math.max(0, Math.round(estTotal / 2))

  /**
   * **The payment gate** (the owner's ruling, 2026-09-29). The form now takes the money, so
   * it cannot finish without knowing how the guest paid — and for GCash or a bank transfer,
   * not without the reference the guest is reading out. Confirm stays asleep and says why
   * underneath, in exactly the shape the agency gate already uses, rather than failing on
   * the press. A **Reservation** pays nothing, so it is asked nothing.
   */
  const paysSomething = shortStayHours ? true : (formPaymentPlan !== 'reservation' && formPaymentPlan !== 'agency')
  // Correcting a booking takes no money, so it never waits on a method.
  const methodRequired = !editingBookings && paysSomething && agreedDeposit > 0
  // A new booking says what the payment is before anything else about the money: one of
  // the three, and for Custom a figure. Nothing is chosen for the desk, so a payment nobody
  // agreed can never be printed on a receipt.
  const depositRequired = !editingBookings && !shortStayHours
  const depositPrompt = !depositRequired ? ''
    : !planChosen ? 'Choose Custom, Full pay or No deposit.'
    : formPaymentPlan === 'custom' && agreedDeposit <= 0
      ? 'Type the amount, or choose No deposit.'
      : agreedDeposit > Math.round(estTotal) ? 'The payment is more than the stay comes to.'
        : ''
  const paymentPrompt = depositPrompt ? depositPrompt
    : !methodRequired ? ''
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
    chosen: planChosen,
    setPlan: (p: PayPlan) => { setPlanChosen(true); setFormPaymentPlan(p) },
    agreedDeposit,
    setAgreedDeposit: (v: number) => { setDepositTouched(true); setFormAgreedDeposit(v) },
    note: formPaymentNote,
    setNote: setFormPaymentNote,
    method: formPaymentMethod,
    setMethod: (m: PayMethod) => {
      setFormPaymentMethod(m)
      // A reference belongs to the method that asked for it: switching from GCash to Cash
      // must not leave the GCash number behind on a booking that was paid in cash.
      if (!methodNeedsReference(m)) setFormPaymentReference('')
    },
    reference: formPaymentReference,
    setReference: setFormPaymentReference,
    methodRequired,
    depositRequired,
  }

  /** What the guest hands over in this form — the figure beside the Confirm button. */
  const paysNow = Math.max(0, Math.round(shortStayHours ? estTotal : agreedDeposit))
  /** Something that actually went wrong: a refused save, or a box Confirm found empty. */
  const footerProblem = formError || (trySave ? (Object.values(fieldErrors).find(Boolean) || '') : '')

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
    // A Reservation and a stay billed to its agency both take nothing at the desk.
    const isReservation = !shortStayHours && (formPaymentPlan === 'reservation' || formPaymentPlan === 'agency')
    if (depositPrompt) {
      setFormError(depositPrompt)
      return
    }
    if (!editingBookings && !isReservation && paidNow > 0) {
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
            ? (editingBookings[0].status === 'pending' ? 'pending' : 'confirmed')
            : 'pending'
    // Payment status is never chosen by hand: editing a booking keeps the status
    // that the money already recorded implies (nothing / part / all of it).
    const derivedPaymentStatus: 'unpaid' | 'downpayment' | 'paid' =
      formDownpaymentPaid <= 0 ? 'unpaid' : (formBalanceDue ?? estDue) <= 0 ? 'paid' : 'downpayment'
    const result = await submitBookingForm({
      bookingStatus,
      unitSelections, formRoomIds, formVenueIds, rooms, venues,
      activeBookings: activeBookingsContext, allBookings,
      partnerDeals, formPartnerDealId, bookingType, formStatus, formGuestName,
      formGuestEmail, formGuestPhone, formGuestGender, formGuestNationality, formGuestAddress,
      formBirthdate, formPreparedBy, formCompanyName, formVehiclePlate, formInvoiceNumber,
      formSource, formBreakfastRoomIds, formCompanions,
      formExtraFoam, formExtraPillow, formExtraBlanket, formExtraTowel,
      formChairs, formEventTable, formEventTent, formVenueExcessHours,
      // A block's reason, or — on a booking — the note beside a Custom deposit. Any other
      // way of paying has no note, so one typed and then abandoned is not saved.
      formBlockNotes: formStatus === 'blocked'
        ? formBlockNotes
        : (!shortStayHours && (formPaymentPlan === 'custom' || formPaymentPlan === 'deposit') ? formPaymentNote : ''),
      discountType, discountValue, venueDayBlocks, editingBookings,
      formPaymentMethod, formPaymentReference, derivedPaymentStatus, formDownpaymentPaid,
      formBalanceDue, formSecurityDeposit, formAgreedDeposit: shortStayHours ? estTotal : agreedDeposit, createManualBooking, cancelBooking, deleteBooking,
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
    if (!editingBookings) rememberReceptionist(formPreparedBy)
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
    // A press outside the form does nothing: it used to close it, so one stray tap beside
    // the form threw away everything the desk had typed. Cancel and ✕ are the ways out.
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 font-sans">
      {/* TWO COLUMNS on a wide screen — the guest and the stay on the left, the payment
          on the right — so the money is beside the guest instead of under everything
          else, and nothing a walk-in needs is below the fold. On a tablet it is one
          column, with the payment last and the amount held beside Confirm. */}
      <div className="w-full max-w-2xl lg:max-w-5xl bg-card rounded-xl shadow-softLg flex flex-col max-h-[92dvh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">

        <BookingWizardHeader
          bookingType={bookingType}
          formStatus={formStatus}
          setFormStatus={setFormStatus}
          formGuestName={formGuestName}
          editing={!!editingBookings && editingBookings.length > 0}
          stay={stayLines(unitSelections, rooms, venues, shortStayHours)}
          onClose={onClose}
        />
        {/* ── Scrollable Body ── */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          {/* ONE FORM, THREE PARTS (cards k126, k128, k130, k132, k138, and the staff's
              feedback of 2026-10-04 that the flat form was hard to read): Guest, Stay,
              Payment. It is still the paper form the staff already know, on one page,
              with no steps and no cards. The parts settle in one after another when the
              form opens, in the order they are filled in. */}
          {formStatus === 'confirmed' ? (
            <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="px-5 sm:px-6 py-5 space-y-7 lg:overflow-y-auto">
                {showErr('units') && <p role="alert" className="text-[13px] font-medium text-danger-600">{showErr('units')}</p>}

                <div className="animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none">
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
                    onRemoveAgency={() => { handleSelectPartnerDeal(null); setAgencyOn(false); setAgencyPicking(false); setFormPaymentPlan(p => p === 'agency' ? 'custom' : p) }}
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
                        onRemove={() => { handleSelectPartnerDeal(null); setAgencyOn(false); setAgencyPicking(false); setFormPaymentPlan(p => p === 'agency' ? 'custom' : p) }}
                      />
                    ) : null}
                  />
                </div>

                {/* THE HOURS ARE CHOSEN ON THE CALENDAR, NOT HERE (the owner's
                    instruction): the bar that pops up on the day the desk picked carries
                    the hours at the room's own board prices, and they arrive in this form
                    already settled. A SHORT STAY takes the room for the whole day and is
                    paid in full at the counter, so breakfast, add-ons and discount simply
                    step out of the way. Breakfast is a ROOM's choice, not a guest's
                    (card k140). */}
                {!shortStayHours && (
                  <section className={GROUP + ' font-sans delay-75 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none'}>
                    <h4 className={GROUP_TITLE}>Stay</h4>
                    <ul className={OPTION_LIST}>
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
                      <DiscountPricingControls
                        isDayBlock={hasDayBlock}
                        discountType={discountType}
                        setDiscountType={setDiscountType}
                        discountValue={discountValue}
                        setDiscountValue={setDiscountValue}
                        venueDayBlocks={venueDayBlocks}
                        setVenueDayBlocks={setVenueDayBlocks}
                      />
                    </ul>
                  </section>
                )}

                {/* Only while correcting a saved booking — and never a short stay,
                    which is paid in full and has no figures to correct. */}
                {editingBookings && !shortStayHours && (
                  <BookingCorrectionFields
                    formInvoiceNumber={formInvoiceNumber}
                    setFormInvoiceNumber={setFormInvoiceNumber}
                    formDownpaymentPaid={formDownpaymentPaid}
                    setFormDownpaymentPaid={setFormDownpaymentPaid}
                    formBalanceDue={formBalanceDue}
                    setFormBalanceDue={setFormBalanceDue}
                    formSecurityDeposit={formSecurityDeposit}
                    setFormSecurityDeposit={setFormSecurityDeposit}
                  />
                )}
              </div>

              {/* What the guest pays, and who took it — its own column, with the amount
                  leading it. */}
              <div className="px-5 sm:px-6 py-5 border-t lg:border-t-0 lg:border-l border-soft lg:overflow-y-auto">
                <section className={GROUP + ' font-sans delay-150 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both motion-reduce:animate-none'}>
                  <h4 className={GROUP_TITLE}>Payment</h4>
                  <BookingDepositFields
                    shortStay={!!shortStayHours}
                    {...depositFieldProps}
                  />
                  {/* The names used before suggest themselves (card k136), so the same
                      person is never written two different ways. */}
                  <Field label="Receptionist" className="pt-1">
                    <input list="staff-names" value={formPreparedBy}
                      title="Who took this booking — it prints on the bill and the receipt."
                      autoComplete="off"
                      onChange={e => setFormPreparedBy(e.target.value.toUpperCase())}
                      className={FIELD} />
                    <datalist id="staff-names">
                      {staffNames.map(name => <option key={name} value={name} />)}
                    </datalist>
                  </Field>
                </section>
              </div>
            </div>
          ) : (
            <div className="flex-1 px-5 sm:px-6 py-5">
              {showErr('units') && <p role="alert" className="text-[13px] font-medium text-danger-600">{showErr('units')}</p>}
            </div>
          )}

          {/* ── Cancel / Confirm, always on screen ──
              The buttons hold the bottom edge the way the title holds the top (the design
              review, 2026-10-04). On one column the payment is the last part of the form,
              so what the guest hands over now is repeated here, where it never scrolls
              away; on two columns it is already beside the buttons.

              ONE line says what Confirm is waiting on, in the order the desk meets it:
              what a press just refused, then the guest's name, the agency, the money. It
              is red only for something that went wrong — a form nobody has finished yet
              is not a mistake.

              It sits against the buttons (the usability pass, 2026-10-05). It was at the
              far end of the bar from a button that would not press, in grey, and it asked
              for the payment while the name — the first box on the form — was still
              empty, so the form told the desk what it wanted from the bottom up. */}
          {formStatus === 'confirmed' && (
            <div className="shrink-0 border-t border-soft bg-card px-5 sm:px-6 py-3 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p role="status" className={'basis-full lg:basis-0 lg:flex-1 lg:text-right min-w-0 text-[14px] font-medium empty:hidden ' + (footerProblem ? 'text-danger-600' : 'text-main')}>
                {footerProblem || (!formGuestName.trim() ? 'Type the guest’s name.'
                  : agencyMissing ? 'Choose the agency — the bill is addressed to them.' : paymentPrompt)}
              </p>
              {!editingBookings && (
                <p className="lg:hidden flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-muted">To pay now</span>
                  <b className="font-display text-[22px] leading-none font-extrabold tracking-tight tabular-nums text-main">₱{paysNow.toLocaleString()}</b>
                </p>
              )}
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={onClose} className="min-h-12 px-4 rounded-lg text-[15px] font-bold text-main hover:bg-softbg transition-colors cursor-pointer">Cancel</button>
                <button type="submit" disabled={isSubmitting || agencyMissing || !!paymentPrompt} className="min-h-12 px-6 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[15px] font-bold shadow-sm transition-[background-color,transform] duration-150 active:scale-[0.98] cursor-pointer disabled:bg-softbg disabled:text-muted disabled:shadow-none disabled:cursor-default disabled:active:scale-100">
                  {isSubmitting ? 'Saving…' : editingBookings ? 'Save changes' : 'Confirm booking'}
                </button>
              </div>
            </div>
          )}
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
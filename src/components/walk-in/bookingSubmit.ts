import {
  Booking, BookingSource, Room, Venue, PartnerDeal, Companion,
  EquipmentRental, BreakfastOrder, AppliedDiscount,
} from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { DiscountType } from '../calendar/DiscountPricingControls'

// The shape of a manual booking write (mirrors the createManualBooking prop).
export interface ManualBookingInput {
  id?: string
  invoiceNumber?: string
  roomId?: string
  venueId?: string
  guestName: string
  guestEmail: string
  guestPhone: string
  guestGender?: string
  guestNationality?: string
  guestAddress?: string
  birthdate?: string
  preparedBy?: string
  appliedDiscount?: AppliedDiscount
  venueDayBlocks?: number
  notes?: string
  checkIn: string
  checkOut: string
  source: BookingSource
  status: 'pending' | 'confirmed' | 'blocked'
  equipmentRentals?: EquipmentRental
  usePromo?: boolean
  companions?: Companion[]
  partnerDealId?: string
  companyName?: string
  vehiclePlate?: string
  breakfastOrders?: BreakfastOrder[]
  breakfastIncluded?: boolean
  contractRateOverride?: number
  paymentMethod?: string
  paymentReference?: string
  paymentPlan?: 'deposit' | 'full'
  venueExcessHours?: number
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
  downpaymentPaid?: number
  balanceDue?: number
  securityDeposit?: number
}

export interface BookingSubmitParams {
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  formRoomIds: Set<string>
  formVenueIds: Set<string>
  rooms: Room[]
  venues: Venue[]
  activeBookings: Booking[]
  partnerDeals: PartnerDeal[]
  formPartnerDealId: string
  bookingType: 'individual' | 'partner'
  formStatus: 'confirmed' | 'blocked'
  bookingStatus: 'pending' | 'confirmed' | 'blocked'
  formGuestName: string
  formGuestEmail: string
  formGuestPhone: string
  formGuestGender: string
  formGuestNationality: string
  formGuestAddress: string
  formBirthdate: string
  formPreparedBy: string
  formCompanyName: string
  formVehiclePlate: string
  formInvoiceNumber: string
  formSource: BookingSource
  formUsePromo: boolean
  formGuestBreakfast: boolean
  formCompanions: Companion[]
  formExtraFoam: number
  formExtraPillow: number
  formExtraBlanket: number
  formExtraTowel: number
  formChairs: number
  formEventTable: number
  formEventTent: number
  formVenueExcessHours: number
  formBlockNotes: string
  discountType: DiscountType
  discountValue: number
  venueDayBlocks: number
  editingBookings?: Booking[]
  formPaymentMethod: string
  formPaymentReference: string
  formPaymentPlan: 'deposit' | 'full'
  /** Derived from the money on the booking — never typed in by staff. */
  derivedPaymentStatus: 'unpaid' | 'downpayment' | 'paid'
  formDownpaymentPaid: number
  formBalanceDue: number | null
  formSecurityDeposit: number | null
  createManualBooking: (params: ManualBookingInput) => Promise<Booking>
  cancelBooking: (id: string) => Promise<void>
}

export type BookingSubmitResult =
  | { ok: true; bookings: Booking[]; payAmount: string }
  | { ok: false; error: string }

// Collision-check every selected unit, then create/update one booking per room
// and per venue, cancelling any edit-mode bookings the user removed.
export async function submitBookingForm(p: BookingSubmitParams): Promise<BookingSubmitResult> {
  // 1. Run collision checks for all selected units on their respective dates
  for (const [id, sel] of Object.entries(p.unitSelections)) {
    const isRoom = sel.type === 'room'
    if (isRoom) {
      if (!syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, p.activeBookings)) {
        const roomNum = p.rooms.find(r => r.id === id)?.room_number || id
        return { ok: false, error: `Room ${roomNum} is already booked for the selected dates.` }
      }
    } else {
      if (!syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, p.activeBookings)) {
        const venueName = p.venues.find(v => v.id === id)?.name || id
        return { ok: false, error: `Venue ${venueName} is already reserved for the selected dates.` }
      }
    }
  }

  const cleanGuestName = p.formGuestName.trim() || (p.bookingType === 'partner' && p.formPartnerDealId ? `${p.partnerDeals.find(d => d.id === p.formPartnerDealId)?.name || 'Corporate'} Guest` : '')
  if (p.bookingStatus !== 'blocked' && !cleanGuestName && p.bookingType === 'individual') {
    return { ok: false, error: 'Guest name is required.' }
  }

  const usePromoForBooking = p.formUsePromo
  const createdBookings: Booking[] = []
  const processedBookingIds = new Set<string>()

  try {
    // 2. Loop to create or update room bookings
    let isFirstRoom = true
    for (const roomId of Array.from(p.formRoomIds)) {
      const sel = p.unitSelections[roomId]
      const rentals = (p.bookingType === 'partner' || !isFirstRoom) ? undefined : {
        bigTableCount: 0,
        smallTableCount: 0,
        chairCount: 0,
        mineralWaterCount: 0,
        extraFoamCount: p.formExtraFoam,
        extraPillowCount: p.formExtraPillow,
        extraBlanketCount: p.formExtraBlanket,
        extraTowelCount: p.formExtraTowel
      }
      isFirstRoom = false

      const deal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
      const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
      const contractedPrice = deal?.contracted_rates[roomId]

      const existingBooking = p.editingBookings?.find(eb => eb.room_id === roomId)
      if (existingBooking) processedBookingIds.add(existingBooking.id)

      const b = await p.createManualBooking({
        id: existingBooking?.id,
        invoiceNumber: p.formInvoiceNumber || undefined,
        roomId,
        guestName: cleanGuestName,
        guestEmail: p.formGuestEmail || (deal?.email || 'admin@daweez-booking.vercel.app'),
        guestPhone: p.formGuestPhone || (deal?.contact_no || 'None'),
        guestGender: p.formGuestGender || undefined,
        guestNationality: p.formGuestNationality || undefined,
        guestAddress: p.formGuestAddress || undefined,
        birthdate: p.formBirthdate || undefined,
        preparedBy: p.formPreparedBy || undefined,
        appliedDiscount: p.discountType === 'none' ? undefined : { type: p.discountType, value: p.discountValue },
        venueDayBlocks: p.venueDayBlocks,
        notes: p.formBlockNotes.trim() || undefined,
        checkIn: sel.checkIn,
        checkOut: sel.checkOut,
        source: p.bookingType === 'partner' ? 'manual' : p.formSource,
        status: p.bookingStatus,
        equipmentRentals: rentals,
        usePromo: usePromoForBooking,
        companions: p.bookingType === 'partner' ? undefined : (p.formCompanions.length > 0 ? p.formCompanions : undefined),
        partnerDealId: p.formPartnerDealId || undefined,
        companyName: p.formCompanyName || undefined,
        vehiclePlate: p.formVehiclePlate || undefined,
        breakfastOrders: (p.formGuestBreakfast || p.formCompanions.some(c => c.breakfast)) ? undefined : ([] as BreakfastOrder[]),
        breakfastIncluded: isBreakfastIncluded,
        contractRateOverride: contractedPrice || undefined,
        paymentMethod: p.formPaymentMethod || undefined,
        paymentReference: p.formPaymentReference || undefined,
        paymentPlan: p.bookingStatus === 'blocked' ? undefined : p.formPaymentPlan,
        paymentStatus: p.editingBookings ? p.derivedPaymentStatus : undefined,
        downpaymentPaid: p.editingBookings ? p.formDownpaymentPaid : undefined,
        balanceDue: p.editingBookings && p.formBalanceDue !== null ? p.formBalanceDue : undefined,
        securityDeposit: p.editingBookings && p.formSecurityDeposit !== null ? p.formSecurityDeposit : undefined
      })
      createdBookings.push(b)
    }

    // 3. Loop to create or update venue bookings
    const isFirstVenue = true
    for (const venueId of Array.from(p.formVenueIds)) {
      const sel = p.unitSelections[venueId]
      const rentals = (p.bookingType === 'partner' || !isFirstVenue) ? undefined : {
        bigTableCount: 0,
        smallTableCount: 0,
        chairCount: p.formChairs,
        mineralWaterCount: 0,
        tableCount: p.formEventTable,
        tentCount: p.formEventTent
      }
      const existingBooking = p.editingBookings?.find(eb => eb.venue_id === venueId)
      if (existingBooking) processedBookingIds.add(existingBooking.id)

      const deal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
      const contractedPrice = deal?.contracted_rates[venueId]

      const b = await p.createManualBooking({
        id: existingBooking?.id,
        invoiceNumber: p.formInvoiceNumber || undefined,
        venueId,
        guestName: cleanGuestName,
        guestEmail: p.formGuestEmail || (deal?.email || 'admin@daweez-booking.vercel.app'),
        guestPhone: p.formGuestPhone || (deal?.contact_no || 'None'),
        guestGender: p.formGuestGender || undefined,
        guestNationality: p.formGuestNationality || undefined,
        guestAddress: p.formGuestAddress || undefined,
        birthdate: p.formBirthdate || undefined,
        preparedBy: p.formPreparedBy || undefined,
        appliedDiscount: p.discountType === 'none' ? undefined : { type: p.discountType, value: p.discountValue },
        venueDayBlocks: p.venueDayBlocks,
        notes: p.formBlockNotes.trim() || undefined,
        checkIn: sel.checkIn,
        checkOut: sel.checkOut,
        source: p.bookingType === 'partner' ? 'manual' : p.formSource,
        status: p.bookingStatus,
        equipmentRentals: rentals,
        usePromo: usePromoForBooking,
        companions: p.bookingType === 'partner' ? undefined : (p.formCompanions.length > 0 ? p.formCompanions : undefined),
        partnerDealId: p.formPartnerDealId || undefined,
        companyName: p.formCompanyName || undefined,
        vehiclePlate: p.formVehiclePlate || undefined,
        contractRateOverride: contractedPrice || undefined,
        paymentMethod: p.formPaymentMethod || undefined,
        paymentReference: p.formPaymentReference || undefined,
        paymentPlan: p.bookingStatus === 'blocked' ? undefined : p.formPaymentPlan,
        venueExcessHours: p.formVenueExcessHours,
        paymentStatus: p.editingBookings ? p.derivedPaymentStatus : undefined,
        downpaymentPaid: p.editingBookings ? p.formDownpaymentPaid : undefined,
        balanceDue: p.editingBookings && p.formBalanceDue !== null ? p.formBalanceDue : undefined,
        securityDeposit: p.editingBookings && p.formSecurityDeposit !== null ? p.formSecurityDeposit : undefined
      })
      createdBookings.push(b)
    }

    // 4. Cancel any bookings from editingBookings that were NOT processed (i.e. removed by user)
    if (p.editingBookings) {
      for (const eb of p.editingBookings) {
        if (!processedBookingIds.has(eb.id)) {
          try {
            await p.cancelBooking(eb.id)
          } catch (err) {
            console.error('Failed to cancel removed booking:', eb.id, err)
          }
        }
      }
    }

    return {
      ok: true,
      bookings: createdBookings,
      payAmount: String(createdBookings.reduce((a, b) => a + (b.balance_due || 0), 0)),
    }
  } catch (err: unknown) {
    // Rollback successfully created bookings on failure
    for (const b of createdBookings) {
      try {
        await p.cancelBooking(b.id)
      } catch (rollbackErr) {
        console.error('Failed to rollback booking:', b.id, rollbackErr)
      }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Booking failed — possible date overlap.' }
  }
}
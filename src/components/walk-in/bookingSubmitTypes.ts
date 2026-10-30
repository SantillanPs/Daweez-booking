import {
  Booking, BookingSource, Room, Venue, PartnerDeal, Companion,
  EquipmentRental, BreakfastOrder, AppliedDiscount, PaymentRecord, EventAddons, BillCharge,
} from '../../types/booking'

/**
 * The shapes `submitBookingForm` reads and answers with — split out of `bookingSubmit` when
 * that file crossed its 300-line limit, the same reason `bookingPayment` was.
 */

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
  appliedDiscount?: AppliedDiscount | AppliedDiscount[]
  venueDayBlocks?: number
  notes?: string
  checkIn: string
  checkOut: string
  source: BookingSource
  status: 'pending' | 'confirmed' | 'blocked' | 'cancelled'
  equipmentRentals?: EquipmentRental
  /** A venue booking's `event_addons` — here it holds the chosen kind of venue (`venue_type`). */
  eventAddons?: EventAddons
  agreedDeposit?: number
  companions?: Companion[]
  partnerDealId?: string
  companyName?: string
  institution?: string
  vehiclePlate?: string
  breakfastOrders?: BreakfastOrder[]
  breakfastIncluded?: boolean
  breakfastDays?: string[]
  contractRateOverride?: number
  paymentMethod?: string
  paymentReference?: string
  paymentPlan?: 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
  venueExcessHours?: number
  earlyCheckInHours?: number
  lateCheckOutHours?: number
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
  downpaymentPaid?: number
  balanceDue?: number
  securityDeposit?: number
  /** Short stay (printed rate board): the hours the room was taken for — 3/6/12/22. */
  stayHours?: number
  /** The half of the day a short stay was booked for: 0 the morning, 1 the afternoon. */
  stayHalf?: 0 | 1
  /** Ties the rooms of one booking together — the same value on each of them. */
  groupId?: string
}

export interface BookingSubmitParams {
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  formRoomIds: Set<string>
  formVenueIds: Set<string>
  rooms: Room[]
  venues: Venue[]
  activeBookings: Booking[]
  /** Every booking, cancelled ones included — so a receipt number is never used twice. */
  allBookings: Booking[]
  partnerDeals: PartnerDeal[]
  formPartnerDealId: string
  bookingType: 'individual' | 'partner'
  formStatus: 'confirmed' | 'blocked'
  bookingStatus: 'pending' | 'confirmed' | 'blocked' | 'cancelled'
  formAgreedDeposit?: number
  formGuestName: string
  formGuestEmail: string
  formGuestPhone: string
  formGuestGender: string
  formGuestNationality: string
  formGuestAddress: string
  formBirthdate: string
  formPreparedBy: string
  formCompanyName: string
  formInstitution: string
  formVehiclePlate: string
  formInvoiceNumber: string
  formSource: BookingSource
  formBreakfastRoomIds: string[]
  /** The bill's chosen breakfast mornings by room; a room not in it has every morning. Left out, the saved ones stay. */
  formBreakfastDays?: Record<string, string[]>
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
  /** The bill's discounts, each with its note; none is an empty list. */
  discounts: AppliedDiscount[]
  /** The kind chosen for each venue (`VenueType.key`, by venue id). */
  formVenueTypes: Record<string, string>
  venueDayBlocks?: number
  editingBookings?: Booking[]
  formPaymentMethod: string
  formPaymentReference: string
  formPaymentPlan: 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
  /**
   * Short stay: the hours the room is being sold for (3/6/12/22). Set only by the
   * booking form's Short stay switch; undefined means an ordinary overnight stay.
   */
  stay_hours?: number
  /** The half of the day the short stay was picked on (0 the morning, 1 the afternoon). */
  stay_half?: 0 | 1
  /** Derived from the money on the booking — never typed in by staff. */
  derivedPaymentStatus: 'unpaid' | 'downpayment' | 'paid'
  formDownpaymentPaid: number
  formBalanceDue: number | null
  formSecurityDeposit: number | null
  /**
   * **What the guest actually hands over in this form** (the owner's ruling, 2026-09-29).
   *
   * The booking form now takes the payment, because that is what really happens — the guest
   * is asked deposit or full pay **and how they will pay** in the same breath. This is the
   * agreed figure (half the stay, the whole stay, or the typed Custom amount); **0 for a
   * Reservation**, which pays nothing and is left exactly as it was.
   */
  receivedAmount: number
  /** What the payment was for — written on the bill's payment line (`NewBookingBill`). */
  formPaymentPurpose?: string
  /** Charges written on the bill ("Add a charge" → Something else), put on the first room or venue. */
  formCharges?: BillCharge[]
  /**
   * A rate typed on the bill for a room or venue (the rooms-on-the-bill mock, 2026-10-24). When sent,
   * it is the whole truth: a unit missing from it is back on its own price, an older figure included.
   */
  formRates?: Record<string, number>
  /** Early check-in and late checkout hours set on the bill, by line; a line left out keeps its saved hours. */
  formHours?: Record<string, { early?: number; late?: number }>
  createManualBooking: (params: ManualBookingInput) => Promise<Booking>
  updateBooking: (booking: Booking) => Promise<void>
  cancelBooking: (id: string) => Promise<void>
  /** Removes a row outright: a booking this form created and then had to roll back. */
  deleteBooking: (id: string) => Promise<void>
}

export type BookingSubmitResult =
  | { ok: true; bookings: Booking[]; payAmount: string; receipt?: PaymentRecord }
  | { ok: false; error: string }

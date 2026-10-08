import {
  Booking, BookingSource, Room, Venue, PartnerDeal, Companion,
  EquipmentRental, BreakfastOrder, AppliedDiscount, PaymentRecord, EventAddons,
} from '../../types/booking'
import { DiscountType } from '../calendar/DiscountPricingControls'

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
  appliedDiscount?: AppliedDiscount
  venueDayBlocks?: number
  notes?: string
  checkIn: string
  checkOut: string
  source: BookingSource
  status: 'pending' | 'confirmed' | 'blocked'
  equipmentRentals?: EquipmentRental
  /** A venue booking's `event_addons` — here it holds the chosen kind of venue (`venue_type`). */
  eventAddons?: EventAddons
  agreedDeposit?: number
  companions?: Companion[]
  partnerDealId?: string
  companyName?: string
  vehiclePlate?: string
  breakfastOrders?: BreakfastOrder[]
  breakfastIncluded?: boolean
  contractRateOverride?: number
  paymentMethod?: string
  paymentReference?: string
  paymentPlan?: 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
  venueExcessHours?: number
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'
  downpaymentPaid?: number
  balanceDue?: number
  securityDeposit?: number
  /** Short stay (printed rate board): the hours the room was taken for — 3/6/12/22. */
  stayHours?: number
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
  bookingStatus: 'pending' | 'confirmed' | 'blocked'
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
  formVehiclePlate: string
  formInvoiceNumber: string
  formSource: BookingSource
  formBreakfastRoomIds: string[]
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
  /** The kind chosen for each venue (`VenueType.key`, by venue id). */
  formVenueTypes: Record<string, string>
  venueDayBlocks: number
  editingBookings?: Booking[]
  formPaymentMethod: string
  formPaymentReference: string
  formPaymentPlan: 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
  /**
   * Short stay: the hours the room is being sold for (3/6/12/22). Set only by the
   * booking form's Short stay switch; undefined means an ordinary overnight stay.
   */
  stay_hours?: number
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
  createManualBooking: (params: ManualBookingInput) => Promise<Booking>
  updateBooking: (booking: Booking) => Promise<void>
  cancelBooking: (id: string) => Promise<void>
  /** Removes a row outright: a booking this form created and then had to roll back. */
  deleteBooking: (id: string) => Promise<void>
}

export type BookingSubmitResult =
  | { ok: true; bookings: Booking[]; payAmount: string; receipt?: PaymentRecord }
  | { ok: false; error: string }

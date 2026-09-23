export interface Room {
  id: string
  room_number: number
  name: string
  base_price: number // Regular price (PHP)
  promo_price?: number | null // Promo price when a sale is active
  /**
   * What this room charges for breakfast — one charge for the stay, typed by the
   * desk in Settings (card k140). `null`/absent means the room does not sell
   * breakfast yet, and the booking form says so instead of charging ₱0.
   */
  breakfast_price?: number | null
  /**
   * Short stays: what the room charges for 3, 6 and 12 hours, typed by the desk in
   * Settings from the hotel's printed board. `null`/absent means the room is NOT
   * sold short — the dash on that board. The 22-hour price is the room's own
   * single price above, so a 22-hour stay needs nothing new.
   */
  hour3_price?: number | null
  hour6_price?: number | null
  hour12_price?: number | null
  capacity: number
  description: string
  image_url: string
}

export interface Venue {
  id: string
  name: 'Gazebo' | 'Vacation House' | 'Garden Area'
  base_price: number // Regular price (PHP)
  promo_price?: number | null // Promo price when a sale is active
  capacity: number
  description: string
  image_url: string
  details: {
    chairs: number
    tables: number
    extras: string[]
  }
}

export type BookingSource = 
  | 'website' 
  | 'airbnb' 
  | 'booking_com' 
  | 'facebook' 
  | 'google_maps' 
  | 'manual'

export type BookingStatus = 'pending' | 'confirmed' | 'blocked'

export interface BreakfastOrder {
  option: 'Bangsilog' | 'Lumpiasilog' | 'Cornsilog' | 'Hotsilog'
  quantity: number
  withCoffee: boolean
}

// A staff-editable breakfast menu item. Staff add/rename items and set each
// item's price in Settings → Rates (defaults: Bangsilog / Tapsilog / Longsilog).
export interface BreakfastMenuOption {
  name: string
  price: number
}

// One breakfast served on one stay day, recorded during the stay (not planned
// ahead). Charged per person and shown on the billing statement at check-out.
export interface BreakfastRecord {
  id: string
  date: string // YYYY-MM-DD the breakfast was served
  item: string // menu item name (e.g. 'Bangsilog')
  quantity: number // how many guests ate
  price: number // price per person at the time it was recorded
}

export interface EquipmentRental {
  bigTableCount: number  // ₱150
  smallTableCount: number // ₱100
  chairCount: number     // ₱15
  mineralWaterCount: number // ₱35
  extraFoamCount?: number // ₱200
  extraPillowCount?: number // ₱50
  extraBlanketCount?: number // ₱50
  extraTowelCount?: number // ₱50
  tableCount?: number     // ₱150
  tentCount?: number      // ₱500
}

export interface EventAddons {
  fullBandAndLights?: boolean // ₱2,000
  stage?: boolean             // ₱2,000
  ledWall?: boolean           // ₱5,000
  payment_reference?: string
}

// Staff-applied discount. 'percent' takes a % (20% or 10%) off the stay;
// 'flat' is a fixed peso amount off the stay (the "custom" option).
export interface AppliedDiscount {
  type: 'percent' | 'flat'
  value: number
}

// One payment receipt, created only after the guest actually pays. A booking
// can have many of these (one per payment), each with its own date & time.
export interface PaymentRecord {
  id: string
  amount: number
  method: string
  reference?: string
  paid_at: string // ISO date-time
  prepared_by?: string
  // Stored when the payment is recorded so the receipt keeps the same number
  // even if another payment is later removed (see utils/receiptNumber.ts).
  receipt_number?: string
}

export interface Companion {
  name: string
  nationality?: string
  breakfast?: boolean
}

export interface Booking {
  id: string
  room_id?: string // Nullable if booking a venue
  venue_id?: string // Nullable if booking a room
  guest_name: string
  guest_email: string
  guest_phone: string
  guest_gender?: string
  guest_nationality?: string
  guest_address?: string
  birthdate?: string // Birth Date from the paper Guest Registration form
  check_in: string // YYYY-MM-DD
  check_out: string // YYYY-MM-DD
  source: BookingSource
  status: BookingStatus
  payment_status?: 'unpaid' | 'downpayment' | 'paid'
  downpayment_paid: number // 50% downpayment
  payment_method?: string
  payment_reference?: string
  // What the guest agreed to pay when they booked: a 50% deposit or the full
  // amount. Shown as "expecting" in the booking quick view; the booking's
  // payment STATUS itself follows the money actually recorded.
  payment_plan?: 'deposit' | 'full'
  /**
   * What the desk and the guest agreed the guest would pay now, in pesos
   * (card k130). Half the stay by default, but the desk may type any figure —
   * `undefined` means "work it out", which `amountToPayNow` does.
   */
  agreed_deposit?: number
  /**
   * Short stay: how many hours the room was taken for — 3, 6, 12 or 22. `undefined`
   * is an ordinary overnight booking. The stay still blocks the WHOLE day for that
   * room, because housekeeping cleans it afterwards (the owner's ruling), so every
   * availability check, the calendar and the bill keep working exactly as they do
   * for a night.
   */
  stay_hours?: number
  balance_due: number      // Remaining 50% + rentals/addons + security deposit
  security_deposit: number // ₱500 flat
  breakfast_orders?: BreakfastOrder[]
  equipment_rentals?: EquipmentRental
  event_addons?: EventAddons
  companions?: Companion[]
  venue_excess_hours?: number
  venue_day_blocks?: number
  created_at: string // ISO date-time
  expires_at: string | null // ISO date-time for 30-min website locks
  partner_deal_id?: string
  company_name?: string
  vehicle_plate?: string
  invoice_number?: string
  invoice_type?: 'folio' | 'billing'
  breakfast_included?: boolean
  breakfast_days?: string[]
  breakfast_records?: BreakfastRecord[]
  contract_rate_override?: number
  promo_applied?: boolean
  applied_discount?: AppliedDiscount
  early_check_in_hours?: number
  late_check_out_hours?: number
  // Actual arrival/departure times recorded by the check-in / check-out button.
  actual_check_in?: string // ISO date-time
  actual_check_out?: string // ISO date-time
  // Blocked-date notes (maintenance / cleaning reason).
  notes?: string
  prepared_by?: string
  // Original paper log reference (kept when importing old bookings so staff
  // can find the physical log by its registration number / date).
  reference_number?: string
  registered_on?: string // YYYY-MM-DD date on the original paper log
  // One receipt per payment the guest made (populated only after they pay).
  payment_records?: PaymentRecord[]
}

// Where the guest sends a downpayment (GCash / bank). Defaults match the
// official Daweez Pension House form; editable in Settings → Rates.
export interface PaymentAccounts {
  gcashName: string
  gcashNumber: string
  bankName: string
  bankAccountName: string
  bankAccountNumber: string
}

// Editable rate settings (items staff can change: late/early check-in-out,
// breakfast, venue hourly, venue day-block, security deposit).
export interface RateConfig {
  lateEarlyRatePesos: number // ₱100/hour default; vacation house uses its own hourly rate
  lateEarlyCapHours: number  // after this many early/late hours the charge becomes 1 night (3)
  breakfastPrice: number     // ₱150/person/night (fallback for legacy planned-ahead breakfast)
  breakfastMenu: BreakfastMenuOption[] // editable menu; each item has its own price
  venueHourlyRate: number    // ₱500/hour (vacation house late/early + venue excess hours)
  venueDayBlockHours: number // 6 hours per day block for Gazebo & Garden
  dayBlockRate: number       // price for one 6-hour day block (default = venue base_price)
  securityDeposit: number    // ₱500
  standardCheckInTime: string  // 'HH:MM' local, default '14:00' (2 PM)
  standardCheckOutTime: string // 'HH:MM' local, default '12:00' (noon)
  // Extras / rental rates (per unit)
  foamRate: number        // ₱200/night
  pillowRate: number      // ₱50/night
  blanketRate: number     // ₱50/night
  towelRate: number       // ₱50/night
  bigTableRate: number    // ₱150
  smallTableRate: number  // ₱100
  chairRate: number       // ₱15
  mineralWaterRate: number // ₱35
  tentRate: number        // ₱500
  accommodationExtras: number // flat extras shown for Pension rooms + Vacation House
  venueExtras: number        // flat extras shown for Garden Area + Gazebo
}

export interface PartnerDeal {
  id: string
  name: string
  type: 'agency' | 'company' | 'government' | 'university' | 'other'
  tin?: string
  address?: string
  contact_no?: string
  email?: string
  vehicle_plate?: string
  breakfast_default: 'w/o' | 'with'
  contracted_rates: Record<string, number>
  created_at: string
}

export interface SyncFeed {
  id: string
  room_id: string
  channel: 'airbnb' | 'booking_com'
  url: string
  last_synced: string | null // ISO date-time
}

export interface GuestRecord {
  email: string
  name: string
  phone: string
  visit_count: number
  last_visit: string
}

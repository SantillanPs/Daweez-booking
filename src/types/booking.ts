export interface Room {
  id: string
  room_number: number
  name: string
  base_price: number // PHP
  capacity: number
  description: string
  image_url: string
}

export interface Venue {
  id: string
  name: 'Gazebo' | 'Vacation House' | 'Garden Area'
  base_price: number // PHP Promo
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

export interface Companion {
  name: string
  gender: 'male' | 'female'
}

export interface Booking {
  id: string
  room_id?: string // Nullable if booking a venue
  venue_id?: string // Nullable if booking a room
  guest_name: string
  guest_email: string
  guest_phone: string
  check_in: string // YYYY-MM-DD
  check_out: string // YYYY-MM-DD
  source: BookingSource
  status: BookingStatus
  downpayment_paid: number // 50% downpayment
  balance_due: number      // Remaining 50% + rentals/addons + security deposit
  security_deposit: number // ₱500 flat
  breakfast_orders?: BreakfastOrder[]
  equipment_rentals?: EquipmentRental
  event_addons?: EventAddons
  companions?: Companion[]
  created_at: string // ISO date-time
  expires_at: string | null // ISO date-time for 30-min website locks
  partner_deal_id?: string
  company_name?: string
  vehicle_plate?: string
  invoice_number?: string
  invoice_type?: 'folio' | 'billing'
  breakfast_included?: boolean
  contract_rate_override?: number
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
  invoice_type: 'folio' | 'billing'
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

import { Room, Venue, Booking, SyncFeed, BookingSource, BookingStatus, BreakfastOrder, EquipmentRental, EventAddons, GuestRecord, Companion, PartnerDeal } from '../types/booking'
import { Expense, ExpenseCategory } from '../types/expense'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// Helper: Generate UUID
export function generateUUID(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// Helper: Normalize Venue ID
export function normalizeVenueId(vid: string | undefined | null): string | undefined {
  if (!vid) return undefined
  if (vid.startsWith('venue-')) return vid
  const lower = vid.toLowerCase()
  if (lower.includes('vacation')) return 'venue-vacation'
  if (lower.includes('garden')) return 'venue-garden'
  if (lower.includes('gazebo')) return 'venue-gazebo'
  return vid
}

// 1. Initial Prepopulated Rooms List (Philippine Peso PMS Rates)
export const DEFAULT_ROOMS: Room[] = [
  {
    id: 'room-1',
    room_number: 1,
    name: 'Full Double Deluxe',
    base_price: 1755,
    capacity: 2,
    description: 'A large and comfortable room with a double bed, nice seating area, and a private balcony with a view of the city skyline.',
    image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-2',
    room_number: 2,
    name: 'Full Double',
    base_price: 1625,
    capacity: 2,
    description: 'A clean and quiet room with a double bed and a desk. Perfect for work or relaxation.',
    image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-3',
    room_number: 3,
    name: 'Full Double',
    base_price: 1625,
    capacity: 2,
    description: 'A cozy interior room with a double bed and warm, soft lighting. Safe and quiet.',
    image_url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-4',
    room_number: 4,
    name: 'Full Double',
    base_price: 1625,
    capacity: 2,
    description: 'A high room with a double bed, simple design, and a nice view of Manila Bay.',
    image_url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-5',
    room_number: 5,
    name: 'Matrimonial',
    base_price: 1950,
    capacity: 2,
    description: 'A nice room for couples. It has a queen bed, warm lighting, and a large private bathtub.',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-6',
    room_number: 6,
    name: 'Family Room',
    base_price: 2730,
    capacity: 5,
    description: 'A big room for families. It has two double beds, one single roll-away bed, and a dining table.',
    image_url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-7',
    room_number: 7,
    name: 'Bunk Bed 3',
    base_price: 2015,
    capacity: 3,
    description: 'A shared room with three comfortable bunk bed spaces, curtains for privacy, and power plugs.',
    image_url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-8',
    room_number: 8,
    name: 'Double',
    base_price: 1495,
    capacity: 2,
    description: 'A simple studio room with a double bed, private bathroom, and bright windows.',
    image_url: 'https://images.unsplash.com/photo-1611891404724-5f9a241e243b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-9',
    room_number: 9,
    name: 'Bunk Bed 2',
    base_price: 1560,
    capacity: 2,
    description: 'A cozy shared room with two parallel bunk bed spaces and warm lighting.',
    image_url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-10',
    room_number: 10,
    name: 'Bunk Bed 6',
    base_price: 4290,
    capacity: 6,
    description: 'A large group suite with six comfortable bunk bed spaces and two private bathrooms.',
    image_url: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80'
  }
]

// 2. Prepopulated Event Venues
export const DEFAULT_VENUES: Venue[] = [
  {
    id: 'venue-gazebo',
    name: 'Gazebo',
    base_price: 5000,
    capacity: 50,
    description: 'A beautiful open-air gazebo. Includes 50 chairs, 9 tables, a speaker, and a water dispenser. Great for small parties and celebrations.',
    image_url: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?auto=format&fit=crop&w=800&q=80',
    details: {
      chairs: 50,
      tables: 9,
      extras: ['Bluetooth Speaker', 'Water Dispenser']
    }
  },
  {
    id: 'venue-vacation',
    name: 'Vacation House',
    base_price: 15000,
    capacity: 50,
    description: 'A fully furnished house for staycations. Includes 50 chairs, 10 tables, and a large outdoor tent to protect against rain or sun.',
    image_url: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=800&q=80',
    details: {
      chairs: 50,
      tables: 10,
      extras: ['Fully Furnished Interior', 'Big Weather-proof Tent']
    }
  },
  {
    id: 'venue-garden',
    name: 'Garden Area',
    base_price: 7500,
    capacity: 50,
    description: 'A green garden lawn with lovely hanging lights. Includes 50 chairs, 10 tables, and a large canopy tent.',
    image_url: 'https://images.unsplash.com/photo-1545232979-8bf34eb9757b?auto=format&fit=crop&w=800&q=80',
    details: {
      chairs: 50,
      tables: 10,
      extras: ['Outdoor string lights', 'Big Canopy Tent']
    }
  }
]

// 3. Local Storage Database Keys
const BOOKINGS_KEY = 'l_etoile_bookings_db'
const FEEDS_KEY = 'l_etoile_feeds_db'
const PARTNERS_KEY = 'l_etoile_partners_db'

// 4. Initialization
function initDB() {
  if (isSupabaseConfigured) return // Suppressed seed if using Supabase

  if (!localStorage.getItem(BOOKINGS_KEY)) {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
    const inTwoDays = new Date(today)
    inTwoDays.setDate(today.getDate() + 2)
    const inThreeDays = new Date(today)
    inThreeDays.setDate(today.getDate() + 3)
    const inFiveDays = new Date(today)
    inFiveDays.setDate(today.getDate() + 5)

    const initialBookings: Booking[] = [
      {
        id: 'mock-1',
        room_id: 'room-1',
        guest_name: 'Juan Dela Cruz',
        guest_email: 'juan.delacruz@gmail.com',
        guest_phone: '0917-123-4567',
        check_in: tomorrow.toISOString().split('T')[0],
        check_out: inThreeDays.toISOString().split('T')[0],
        source: 'airbnb',
        status: 'confirmed',
        downpayment_paid: 1050, // 50% downpayment
        balance_due: 1550,      // 50% + 500 deposit
        security_deposit: 500,
        created_at: new Date().toISOString(),
        expires_at: null
      },
      {
        id: 'mock-2',
        room_id: 'room-5',
        guest_name: 'Guinevere Santos',
        guest_email: 'guinevere@gmail.com',
        guest_phone: '0918-987-6543',
        check_in: inThreeDays.toISOString().split('T')[0],
        check_out: inFiveDays.toISOString().split('T')[0],
        source: 'booking_com',
        status: 'confirmed',
        downpayment_paid: 1200,
        balance_due: 1700,
        security_deposit: 500,
        created_at: new Date().toISOString(),
        expires_at: null
      },
      {
        id: 'mock-venue-1',
        venue_id: 'venue-gazebo',
        guest_name: 'Maria Clara',
        guest_email: 'maria@rizal.ph',
        guest_phone: '0919-876-5432',
        check_in: tomorrow.toISOString().split('T')[0],
        check_out: inTwoDays.toISOString().split('T')[0], // Adjusted to satisfy check_in < check_out
        source: 'website',
        status: 'confirmed',
        downpayment_paid: 2500,
        balance_due: 3000,
        security_deposit: 500,
        event_addons: {
          fullBandAndLights: true,
          stage: false,
          ledWall: false
        },
        equipment_rentals: {
          bigTableCount: 2,
          smallTableCount: 0,
          chairCount: 10,
          mineralWaterCount: 1
        },
        created_at: new Date().toISOString(),
        expires_at: null
      }
    ]
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(initialBookings))
  }

  if (!localStorage.getItem(FEEDS_KEY)) {
    const initialFeeds: SyncFeed[] = DEFAULT_ROOMS.flatMap(room => [
      {
        id: `feed-ab-${room.id}`,
        room_id: room.id,
        channel: 'airbnb',
        url: `https://www.airbnb.com/calendar/ical/${room.room_number}.ics`,
        last_synced: new Date().toISOString()
      },
      {
        id: `feed-bc-${room.id}`,
        room_id: room.id,
        channel: 'booking_com',
        url: `https://ical.booking.com/v1/export?t=${room.room_number}`,
        last_synced: new Date().toISOString()
      }
    ])
    localStorage.setItem(FEEDS_KEY, JSON.stringify(initialFeeds))
  }

  if (!localStorage.getItem(PARTNERS_KEY)) {
    localStorage.setItem(PARTNERS_KEY, JSON.stringify([]))
  }
}

// 5. Booking Operations
export async function getBookings(): Promise<Booking[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
      if (error) throw error

      if (data) {
        // Clean expired pending website locks on the fly
        const now = new Date()
        const activeRecords = data.filter(b => {
          if (b.status === 'pending' && b.expires_at) {
            const expires = new Date(b.expires_at)
            return expires > now
          }
          return true
        })

        // Clean expired remote bookings asynchronously
        const expiredIds = data.filter(b => b.status === 'pending' && b.expires_at && new Date(b.expires_at) <= now).map(b => b.id)
        if (expiredIds.length > 0) {
          await supabase.from('bookings').delete().in('id', expiredIds)
        }

        return activeRecords.map(b => ({
          id: b.id,
          room_id: b.room_id || undefined,
          venue_id: b.venue_id || undefined,
          guest_name: b.guest_name,
          guest_email: b.guest_email,
          guest_phone: b.guest_phone,
          check_in: b.check_in,
          check_out: b.check_out,
          source: b.source as BookingSource,
          status: b.status as BookingStatus,
          downpayment_paid: Number(b.downpayment_paid || 0),
          balance_due: Number(b.balance_due || 0),
          security_deposit: Number(b.security_deposit || 0),
          breakfast_orders: b.breakfast_orders || undefined,
          equipment_rentals: b.equipment_rentals || undefined,
          event_addons: b.event_addons || undefined,
          companions: b.companions || undefined,
          created_at: b.created_at,
          expires_at: b.expires_at || null,
          partner_deal_id: b.partner_deal_id || undefined,
          company_name: b.company_name || undefined,
          vehicle_plate: b.vehicle_plate || undefined,
          invoice_number: b.invoice_number || undefined,
          invoice_type: b.invoice_type as any || undefined,
          breakfast_included: !!b.breakfast_included,
          contract_rate_override: b.contract_rate_override ? Number(b.contract_rate_override) : undefined
        }))
      }
    } catch (err) {
      console.error('Supabase getBookings Error, falling back to LocalStorage:', err)
    }
  }

  // Fallback local storage logic
  initDB()
  const data = localStorage.getItem(BOOKINGS_KEY)
  if (!data) return []

  const bookings: Booking[] = JSON.parse(data)
  const now = new Date()
  const activeBookings = bookings.filter(b => {
    if (b.status === 'pending' && b.expires_at) {
      const expires = new Date(b.expires_at)
      return expires > now
    }
    return true
  })

  if (activeBookings.length !== bookings.length) {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify(activeBookings))
  }

  return activeBookings
}

export async function saveBookings(bookings: Booking[]): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      // Upsert full list to Supabase
      const records = bookings.map(b => ({
        id: b.id,
        room_id: b.room_id || null,
        venue_id: b.venue_id || null,
        guest_name: b.guest_name,
        guest_email: b.guest_email,
        guest_phone: b.guest_phone,
        check_in: b.check_in,
        check_out: b.check_out,
        source: b.source,
        status: b.status,
        downpayment_paid: b.downpayment_paid,
        balance_due: b.balance_due,
        security_deposit: b.security_deposit,
        breakfast_orders: b.breakfast_orders || null,
        equipment_rentals: b.equipment_rentals || null,
        event_addons: b.event_addons || null,
        companions: b.companions || null,
        expires_at: b.expires_at || null,
        partner_deal_id: b.partner_deal_id || null,
        company_name: b.company_name || null,
        vehicle_plate: b.vehicle_plate || null,
        invoice_number: b.invoice_number || null,
        invoice_type: b.invoice_type || null,
        breakfast_included: !!b.breakfast_included,
        contract_rate_override: b.contract_rate_override || null
      }))

      const { error } = await supabase.from('bookings').upsert(records)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase saveBookings Error, falling back to LocalStorage:', err)
    }
  }

  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings))
}

// Single-row INSERT — use this for new bookings instead of read+upsert-all
export async function insertBooking(booking: Booking): Promise<void> {
  // Generate invoice number if not already present
  if (!booking.invoice_number && booking.status !== 'blocked') {
    const allBookings = await getBookings()
    const checkInDate = booking.check_in
    const prefixYearMonth = checkInDate.substring(0, 7) // "YYYY-MM"
    const prefixDocType = booking.invoice_type === 'billing' ? 'GRB' : 'GRF'
    
    const sameMonthBookings = allBookings.filter(b => 
      b.invoice_number && 
      b.invoice_number.startsWith(`${prefixDocType}-${prefixYearMonth}-`)
    )
    
    let nextSeq = 1
    if (sameMonthBookings.length > 0) {
      const seqs = sameMonthBookings.map(b => {
        const parts = b.invoice_number!.split('-')
        const lastPart = parts[parts.length - 1]
        const num = parseInt(lastPart, 10)
        return isNaN(num) ? 0 : num
      })
      nextSeq = Math.max(...seqs) + 1
    }
    
    const paddedSeq = String(nextSeq).padStart(4, '0')
    booking.invoice_number = `${prefixDocType}-${prefixYearMonth}-${paddedSeq}`
  }

  const record = {
    id: booking.id,
    room_id: booking.room_id || null,
    venue_id: booking.venue_id || null,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone,
    check_in: booking.check_in,
    check_out: booking.check_out,
    source: booking.source,
    status: booking.status,
    downpayment_paid: booking.downpayment_paid,
    balance_due: booking.balance_due,
    security_deposit: booking.security_deposit,
    breakfast_orders: booking.breakfast_orders || null,
    equipment_rentals: booking.equipment_rentals || null,
    event_addons: booking.event_addons || null,
    companions: booking.companions || null,
    expires_at: booking.expires_at || null,
    partner_deal_id: booking.partner_deal_id || null,
    company_name: booking.company_name || null,
    vehicle_plate: booking.vehicle_plate || null,
    invoice_number: booking.invoice_number || null,
    invoice_type: booking.invoice_type || null,
    breakfast_included: !!booking.breakfast_included,
    contract_rate_override: booking.contract_rate_override || null
  }

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('bookings').insert(record)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase insertBooking Error, falling back to LocalStorage:', err)
    }
  }

  // LocalStorage fallback
  initDB()
  const data = localStorage.getItem(BOOKINGS_KEY)
  const existing: Booking[] = data ? JSON.parse(data) : []
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify([...existing, booking]))
}

export async function getFeeds(): Promise<SyncFeed[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('ical_feeds').select('*')
      if (error) throw error
      if (data) {
        return data.map(f => ({
          id: f.id,
          room_id: f.room_id,
          channel: f.channel,
          url: f.url,
          last_synced: f.last_synced
        }))
      }
    } catch (err) {
      console.error('Supabase getFeeds Error:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(FEEDS_KEY)
  return data ? JSON.parse(data) : []
}

export async function saveFeeds(feeds: SyncFeed[]): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const records = feeds.map(f => ({
        id: f.id,
        room_id: f.room_id,
        channel: f.channel,
        url: f.url,
        last_synced: f.last_synced
      }))
      const { error } = await supabase.from('ical_feeds').upsert(records)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase saveFeeds Error:', err)
    }
  }

  localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds))
}

// 6. Availability Collision Vectors (Bilateral safety)
export function isRoomAvailable(roomId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  const checkIn = new Date(checkInStr)
  const checkOut = new Date(checkOutStr)
  if (checkIn >= checkOut) return false

  return !bookingsList.some(booking => {
    if (booking.room_id !== roomId) return false
    if (booking.id === skipBookingId) return false

    const bStart = new Date(booking.check_in)
    const bEnd = new Date(booking.check_out)
    return checkIn < bEnd && checkOut > bStart
  })
}

export function isVenueAvailable(venueId: string, eventDateStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  return !bookingsList.some(booking => {
    if (booking.venue_id !== venueId) return false
    if (booking.id === skipBookingId) return false
    return booking.check_in === eventDateStr
  })
}

export function isVenueRangeAvailable(venueId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  const checkIn = new Date(checkInStr)
  const checkOut = new Date(checkOutStr)
  if (checkIn >= checkOut) return false

  return !bookingsList.some(booking => {
    if (normalizeVenueId(booking.venue_id) !== normalizeVenueId(venueId)) return false
    if (booking.id === skipBookingId) return false

    const bStart = new Date(booking.check_in)
    const bEnd = new Date(booking.check_out)
    return checkIn < bEnd && checkOut > bStart
  })
}

// 8. Dynamic Invoice Calculations
export function calculatePricing(params: {
  roomId?: string
  venueId?: string
  checkIn: string
  checkOut: string
  guestEmail: string
  breakfastOrders?: BreakfastOrder[]
  equipmentRentals?: EquipmentRental
  eventAddons?: EventAddons
  bookingsList?: Booking[]
  rateMultiplier?: number
  companions?: Companion[]
  source?: BookingSource
  contractRateOverride?: number
}) {
  const { roomId, venueId, checkIn, checkOut, guestEmail, breakfastOrders, equipmentRentals, eventAddons, bookingsList = [], rateMultiplier, companions, source, contractRateOverride } = params

  const defaultMultiplier = (source === 'manual' || source === 'facebook' || source === 'website') ? 0.8 : 1.0
  const finalMultiplier = rateMultiplier !== undefined ? rateMultiplier : defaultMultiplier

  let basePrice = 0
  let undiscountedBasePrice = 0
  let nights = 0

  // A. Nightly Room vs Daily Venue rate mapping
  if (contractRateOverride !== undefined && contractRateOverride !== null) {
    undiscountedBasePrice = contractRateOverride
    basePrice = Math.round(contractRateOverride * finalMultiplier)
    nights = roomId
      ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
      : Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
  } else if (roomId) {
    const room = DEFAULT_ROOMS.find(r => r.id === roomId)
    undiscountedBasePrice = room ? room.base_price : 0
    basePrice = Math.round(undiscountedBasePrice * finalMultiplier)
    nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  } else if (venueId) {
    const venue = DEFAULT_VENUES.find(v => v.id === normalizeVenueId(venueId))
    undiscountedBasePrice = venue ? venue.base_price : 0
    basePrice = Math.round(undiscountedBasePrice * finalMultiplier)
    nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
  }

  // B. Subtotals
  const subtotal = basePrice * nights
  const undiscountedSubtotal = undiscountedBasePrice * nights
  const discountAmount = undiscountedSubtotal - subtotal
  const discountPercent = Math.round((1 - finalMultiplier) * 100)
  const grandTotal = subtotal * ((contractRateOverride !== undefined && contractRateOverride !== null) ? 1 : 1.0)

  // C. Breakfast is always included for room bookings (₱150/guest/night)
  let breakfastTotal = 0
  if (roomId) {
    const guestCount = 1 + (companions?.length || 0)
    breakfastTotal = 150 * guestCount * nights
  } else if (breakfastOrders && breakfastOrders.length > 0) {
    // Venue bookings: use stored orders if present
    breakfastOrders.forEach(order => {
      breakfastTotal += 150 * order.quantity
    })
  }

  // D. Equipment Rentals (Table: 150, Chairs: 15, Tent: 500, Extra Foam: 200, Extra Pillow: 50, Extra Blanket: 50, Extra Towel: 50)
  let rentalsTotal = 0
  if (equipmentRentals) {
    if (roomId) {
      // Room nightly rentals
      const nightlyRentals =
        ((equipmentRentals.extraFoamCount || 0) * 200) +
        ((equipmentRentals.extraPillowCount || 0) * 50) +
        ((equipmentRentals.extraBlanketCount || 0) * 50) +
        ((equipmentRentals.extraTowelCount || 0) * 50)
      rentalsTotal += nightlyRentals * nights
    } else {
      // Venue flat rentals
      rentalsTotal += ((equipmentRentals.bigTableCount || 0) * 150)
      rentalsTotal += ((equipmentRentals.smallTableCount || 0) * 100)
      rentalsTotal += ((equipmentRentals.chairCount || 0) * 15)
      rentalsTotal += ((equipmentRentals.mineralWaterCount || 0) * 35)
      rentalsTotal += ((equipmentRentals.tableCount || 0) * 150)
      rentalsTotal += ((equipmentRentals.tentCount || 0) * 500)
    }
  }

  // E. Event Add-ons (Band: 2000, Stage: 2000, LED Wall: 5000)
  let addonsTotal = 0
  if (eventAddons) {
    if (eventAddons.fullBandAndLights) addonsTotal += 2000
    if (eventAddons.stage) addonsTotal += 2000
    if (eventAddons.ledWall) addonsTotal += 5000
  }

  // F. Balance & Deposit Sums
  const securityDeposit = 0
  const calculatedGrand = grandTotal + breakfastTotal + rentalsTotal + addonsTotal
  const downpayment = Math.round(calculatedGrand * 0.50) // 50% reservation policy
  const balanceDue = (calculatedGrand - downpayment) + securityDeposit

  return {
    subtotal: Math.round(subtotal),
    undiscountedSubtotal: Math.round(undiscountedSubtotal),
    discountAmount: Math.round(discountAmount),
    discountPercent,
    hasLoyalty: false,
    breakfastTotal,
    rentalsTotal,
    addonsTotal,
    securityDeposit,
    grandTotal: calculatedGrand,
    downpayment,
    balanceDue
  }
}



// 10. iCal Scraper & Ingestion
function parseiCalFeed(icsString: string): Omit<Booking, 'id' | 'room_id' | 'created_at' | 'expires_at' | 'downpayment_paid' | 'balance_due' | 'security_deposit'>[] {
  const events: Omit<Booking, 'id' | 'room_id' | 'created_at' | 'expires_at' | 'downpayment_paid' | 'balance_due' | 'security_deposit'>[] = []
  const lines = icsString.split(/\r?\n/)

  let currentEvent: Record<string, string> = {}
  let inEvent = false

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim()
    while (i + 1 < lines.length && (lines[i + 1].startsWith(' ') || lines[i + 1].startsWith('\t'))) {
      line += lines[i + 1].substring(1)
      i++
    }

    if (line === 'BEGIN:VEVENT') {
      inEvent = true
      currentEvent = {}
    } else if (line === 'END:VEVENT') {
      inEvent = false
      if (currentEvent.check_in && currentEvent.check_out) {
        events.push({
          guest_name: currentEvent.guest_name || 'External OTA Reservation',
          guest_email: 'sync@channel.external',
          guest_phone: 'None',
          check_in: currentEvent.check_in,
          check_out: currentEvent.check_out,
          source: (currentEvent.source || 'airbnb') as BookingSource,
          status: 'confirmed'
        })
      }
    } else if (inEvent) {
      const match = line.match(/^([^:;]+)(?:;([^:]+))?:(.*)$/)
      if (!match) continue

      const name = match[1]
      const value = match[3]

      if (name === 'DTSTART') {
        currentEvent.check_in = parseiCalDate(value)
      } else if (name === 'DTEND') {
        currentEvent.check_out = parseiCalDate(value)
      } else if (name === 'SUMMARY') {
        currentEvent.guest_name = value.trim()
        if (value.toLowerCase().includes('airbnb')) {
          currentEvent.source = 'airbnb'
        } else if (value.toLowerCase().includes('booking')) {
          currentEvent.source = 'booking_com'
        }
      }
    }
  }
  return events
}

function parseiCalDate(value: string): string {
  const datePart = value.split('T')[0]
  if (datePart.length === 8) {
    const year = datePart.substring(0, 4)
    const month = datePart.substring(4, 6)
    const day = datePart.substring(6, 8)
    return `${year}-${month}-${day}`
  }
  return value
}

// 11. Scraper Mocks
const MOCK_AIRBNB_FEED = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260605
DTEND;VALUE=DATE:20260609
SUMMARY:Airbnb Booking - Jean Valjean
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260614
DTEND;VALUE=DATE:20260618
SUMMARY:Airbnb Booking - Cosette Fauchelevent
END:VEVENT
END:VCALENDAR
`

const MOCK_BOOKING_COM_FEED = `
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Booking.com//iCal Export//EN
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260610
DTEND;VALUE=DATE:20260613
SUMMARY:Booking.com - Ebenezer Scrooge
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260620
DTEND;VALUE=DATE:20260625
SUMMARY:Booking.com - Tiny Tim Cratchit
END:VEVENT
END:VCALENDAR
`

export async function runSimulatedOTASync(currentBookings?: Booking[], currentFeeds?: SyncFeed[]): Promise<number> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.functions.invoke('sync-ical')
      if (error) throw error
      return data?.syncedCount ?? 0
    } catch (err) {
      console.error('Failed to invoke sync-ical edge function, falling back to local simulation:', err)
    }
  }

  const bookings = currentBookings || await getBookings()
  const feeds = currentFeeds || await getFeeds()

  const updatedBookings = bookings.filter(b => b.source === 'website' || b.source === 'manual' || b.source === 'facebook' || b.source === 'google_maps')
  let newSyncCount = 0

  // Sync Room 2 Airbnb
  const abEvents = parseiCalFeed(MOCK_AIRBNB_FEED)
  abEvents.forEach(evt => {
    if (isRoomAvailable('room-2', evt.check_in, evt.check_out, bookings)) {
      updatedBookings.push({
        id: `sync-ab-${generateUUID()}`,
        room_id: 'room-2',
        guest_name: evt.guest_name,
        guest_email: evt.guest_email,
        guest_phone: evt.guest_phone,
        check_in: evt.check_in,
        check_out: evt.check_out,
        source: 'airbnb',
        status: 'confirmed',
        downpayment_paid: 950, // Suite 2 nightly PHP rate downpayment
        balance_due: 1450,
        security_deposit: 500,
        created_at: new Date().toISOString(),
        expires_at: null
      })
      newSyncCount++
    }
  })

  // Sync Room 3 Booking.com
  const bcEvents = parseiCalFeed(MOCK_BOOKING_COM_FEED)
  bcEvents.forEach(evt => {
    if (isRoomAvailable('room-3', evt.check_in, evt.check_out, bookings)) {
      updatedBookings.push({
        id: `sync-bc-${generateUUID()}`,
        room_id: 'room-3',
        guest_name: evt.guest_name,
        guest_email: evt.guest_email,
        guest_phone: evt.guest_phone,
        check_in: evt.check_in,
        check_out: evt.check_out,
        source: 'booking_com',
        status: 'confirmed',
        downpayment_paid: 950,
        balance_due: 1450,
        security_deposit: 500,
        created_at: new Date().toISOString(),
        expires_at: null
      })
      newSyncCount++
    }
  })

  // Compare original OTA bookings with updated OTA bookings to determine if database writes are needed
  const originalOtaKeys = new Set(
    bookings
      .filter(b => b.source === 'airbnb' || b.source === 'booking_com')
      .map(b => `${b.room_id}-${b.check_in}-${b.check_out}`)
  )
  const updatedOtaKeys = new Set(
    updatedBookings
      .filter(b => b.source === 'airbnb' || b.source === 'booking_com')
      .map(b => `${b.room_id}-${b.check_in}-${b.check_out}`)
  )

  let hasChanges = originalOtaKeys.size !== updatedOtaKeys.size
  if (!hasChanges) {
    for (const key of originalOtaKeys) {
      if (!updatedOtaKeys.has(key)) {
        hasChanges = true
        break
      }
    }
  }

  // Only perform database writes if there is a change in the OTA sync bookings list
  if (hasChanges) {
    await saveBookings(updatedBookings)
    const updatedFeeds = feeds.map(f => ({ ...f, last_synced: new Date().toISOString() }))
    await saveFeeds(updatedFeeds)
  }

  return newSyncCount
}

// 13. Seed Future Mock Data (June - Dec 2026) for testing
export async function seedFutureMockData(): Promise<number> {
  const futureBookings: Booking[] = [
    {
      id: 'mock-june-1',
      room_id: 'room-2',
      guest_name: 'Gabriel Reyes',
      guest_email: 'gabriel.reyes@gmail.com',
      guest_phone: '0917-222-3344',
      check_in: '2026-06-10',
      check_out: '2026-06-14',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 1900,
      balance_due: 2400,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-june-2',
      room_id: 'room-6',
      guest_name: 'Sofia Dimagiba',
      guest_email: 'sofia@dimagiba.org',
      guest_phone: '0918-333-4455',
      check_in: '2026-06-18',
      check_out: '2026-06-20',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 1800,
      balance_due: 2300,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-june-3',
      venue_id: 'venue-gazebo',
      guest_name: 'Clara Cruz',
      guest_email: 'clara.cruz@yahoo.com',
      guest_phone: '0919-444-5566',
      check_in: '2026-06-25',
      check_out: '2026-06-26', // Modified to satisfy check constraint
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 2500,
      balance_due: 3000,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-1',
      room_id: 'room-1',
      guest_name: 'Ramon Magsaysay',
      guest_email: 'ramon@magsaysay.ph',
      guest_phone: '0920-555-6677',
      check_in: '2026-07-05',
      check_out: '2026-07-09',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 2100,
      balance_due: 2600,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-2',
      room_id: 'room-8',
      guest_name: 'Alfonso Sy',
      guest_email: 'alfonso@sygroup.com.ph',
      guest_phone: '0921-666-7788',
      check_in: '2026-07-15',
      check_out: '2026-07-18',
      source: 'google_maps',
      status: 'confirmed',
      downpayment_paid: 1275,
      balance_due: 1775,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-3',
      room_id: 'room-1',
      guest_name: 'Juan Luna',
      guest_email: 'juan.luna@spoliarium.ph',
      guest_phone: '0917-111-2222',
      check_in: '2026-07-12',
      check_out: '2026-07-16',
      source: 'facebook',
      status: 'confirmed',
      downpayment_paid: 2100,
      balance_due: 2600,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-4',
      room_id: 'room-1',
      guest_name: 'Andres Bonifacio',
      guest_email: 'andres@katipunan.org',
      guest_phone: '0917-222-3333',
      check_in: '2026-07-20',
      check_out: '2026-07-25',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 2625,
      balance_due: 3125,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-5',
      room_id: 'room-2',
      guest_name: 'Emilio Aguinaldo',
      guest_email: 'emilio@kawit.gov.ph',
      guest_phone: '0917-333-4444',
      check_in: '2026-07-01',
      check_out: '2026-07-06',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 2375,
      balance_due: 2875,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-6',
      room_id: 'room-2',
      guest_name: 'Apolinario Mabini',
      guest_email: 'apolinario@sublime.ph',
      guest_phone: '0917-444-5555',
      check_in: '2026-07-10',
      check_out: '2026-07-15',
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 2375,
      balance_due: 2875,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-7',
      room_id: 'room-2',
      guest_name: 'Melchora Aquino',
      guest_email: 'tandangsora@balintawak.org',
      guest_phone: '0917-555-6666',
      check_in: '2026-07-18',
      check_out: '2026-07-24',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 2850,
      balance_due: 3350,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-8',
      room_id: 'room-2',
      guest_name: 'Gregoria de Jesus',
      guest_email: 'gregoria@lakambini.ph',
      guest_phone: '0917-666-7777',
      check_in: '2026-07-26',
      check_out: '2026-07-30',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 1900,
      balance_due: 2400,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-9',
      room_id: 'room-3',
      guest_name: 'Marcelo H. del Pilar',
      guest_email: 'plaridel@solidaridad.es',
      guest_phone: '0917-777-8888',
      check_in: '2026-07-03',
      check_out: '2026-07-08',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 2375,
      balance_due: 2875,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-10',
      room_id: 'room-3',
      guest_name: 'Graciano Lopez Jaena',
      guest_email: 'graciano@solidaridad.es',
      guest_phone: '0917-888-9999',
      check_in: '2026-07-12',
      check_out: '2026-07-17',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 2375,
      balance_due: 2875,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-11',
      room_id: 'room-3',
      guest_name: 'Antonio Luna',
      guest_email: 'general.luna@artillery.ph',
      guest_phone: '0917-999-0000',
      check_in: '2026-07-20',
      check_out: '2026-07-26',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 2850,
      balance_due: 3350,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-12',
      room_id: 'room-4',
      guest_name: 'Jose Abad Santos',
      guest_email: 'jose.abadsantos@judiciary.gov',
      guest_phone: '0918-111-2222',
      check_in: '2026-07-02',
      check_out: '2026-07-07',
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 2375,
      balance_due: 2875,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-13',
      room_id: 'room-4',
      guest_name: 'Gabriela Silang',
      guest_email: 'gabriela@silang.org',
      guest_phone: '0918-222-3333',
      check_in: '2026-07-12',
      check_out: '2026-07-16',
      source: 'facebook',
      status: 'confirmed',
      downpayment_paid: 1900,
      balance_due: 2400,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-14',
      room_id: 'room-4',
      guest_name: 'Diego Silang',
      guest_email: 'diego@silang.org',
      guest_phone: '0918-333-4444',
      check_in: '2026-07-22',
      check_out: '2026-07-28',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 2850,
      balance_due: 3350,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-15',
      room_id: 'room-5',
      guest_name: 'Macario Sakay',
      guest_email: 'macario@sakay.org',
      guest_phone: '0918-444-5555',
      check_in: '2026-07-04',
      check_out: '2026-07-10',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 3600,
      balance_due: 4100,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-16',
      room_id: 'room-5',
      guest_name: 'Artemio Ricarte',
      guest_email: 'artemio@ricarte.ph',
      guest_phone: '0918-555-6666',
      check_in: '2026-07-14',
      check_out: '2026-07-20',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 3600,
      balance_due: 4100,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-17',
      room_id: 'room-5',
      guest_name: 'Teresa Magbanua',
      guest_email: 'teresa@magbanua.org',
      guest_phone: '0918-666-7777',
      check_in: '2026-07-24',
      check_out: '2026-07-29',
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 3000,
      balance_due: 3500,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-18',
      room_id: 'room-6',
      guest_name: 'Francisco Balagtas',
      guest_email: 'francisco@balagtas.ph',
      guest_phone: '0918-777-8888',
      check_in: '2026-07-01',
      check_out: '2026-07-06',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 4500,
      balance_due: 5000,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-19',
      room_id: 'room-6',
      guest_name: 'Jose Palma',
      guest_email: 'jose@palma.ph',
      guest_phone: '0918-888-9999',
      check_in: '2026-07-10',
      check_out: '2026-07-15',
      source: 'facebook',
      status: 'confirmed',
      downpayment_paid: 4500,
      balance_due: 5000,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-20',
      room_id: 'room-6',
      guest_name: 'Julian Felipe',
      guest_email: 'julian@felipe.ph',
      guest_phone: '0918-999-0000',
      check_in: '2026-07-20',
      check_out: '2026-07-25',
      source: 'google_maps',
      status: 'confirmed',
      downpayment_paid: 4500,
      balance_due: 5000,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-21',
      room_id: 'room-7',
      guest_name: 'Josefa Llanes Escoda',
      guest_email: 'josefa@girlscouts.ph',
      guest_phone: '0919-111-2222',
      check_in: '2026-07-05',
      check_out: '2026-07-10',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 2750,
      balance_due: 3250,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-22',
      room_id: 'room-7',
      guest_name: 'Gliceria de Villavicencio',
      guest_email: 'gliceria@patriot.ph',
      guest_phone: '0919-222-3333',
      check_in: '2026-07-15',
      check_out: '2026-07-20',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 2750,
      balance_due: 3250,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-23',
      room_id: 'room-7',
      guest_name: 'Marina Dizon',
      guest_email: 'marina@dizon.org',
      guest_phone: '0919-333-4444',
      check_in: '2026-07-22',
      check_out: '2026-07-28',
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 3300,
      balance_due: 3800,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-24',
      room_id: 'room-8',
      guest_name: 'Trinidad Tecson',
      guest_email: 'trinidad@tecson.ph',
      guest_phone: '0919-444-5555',
      check_in: '2026-07-02',
      check_out: '2026-07-07',
      source: 'facebook',
      status: 'confirmed',
      downpayment_paid: 2125,
      balance_due: 2625,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-25',
      room_id: 'room-8',
      guest_name: 'Patrocinio Gamboa',
      guest_email: 'patrocinio@gamboa.org',
      guest_phone: '0919-555-6666',
      check_in: '2026-07-22',
      check_out: '2026-07-27',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 2125,
      balance_due: 2625,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-26',
      room_id: 'room-9',
      guest_name: 'Galicano Apacible',
      guest_email: 'galicano@apacible.ph',
      guest_phone: '0919-666-7777',
      check_in: '2026-07-06',
      check_out: '2026-07-12',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 2700,
      balance_due: 3200,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-27',
      room_id: 'room-9',
      guest_name: 'Leon Apacible',
      guest_email: 'leon@apacible.ph',
      guest_phone: '0919-777-8888',
      check_in: '2026-07-16',
      check_out: '2026-07-21',
      source: 'google_maps',
      status: 'confirmed',
      downpayment_paid: 2250,
      balance_due: 2750,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-28',
      room_id: 'room-9',
      guest_name: 'Felipe Agoncillo',
      guest_email: 'felipe@agoncillo.ph',
      guest_phone: '0919-888-9999',
      check_in: '2026-07-24',
      check_out: '2026-07-30',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 2700,
      balance_due: 3200,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-29',
      room_id: 'room-10',
      guest_name: 'Marcela Agoncillo',
      guest_email: 'marcela@agoncillo.ph',
      guest_phone: '0919-999-0000',
      check_in: '2026-07-04',
      check_out: '2026-07-09',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 6000,
      balance_due: 6500,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-30',
      room_id: 'room-10',
      guest_name: 'Juan Sumulong',
      guest_email: 'juan@sumulong.ph',
      guest_phone: '0920-111-2222',
      check_in: '2026-07-14',
      check_out: '2026-07-20',
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 7200,
      balance_due: 7700,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-july-31',
      room_id: 'room-10',
      guest_name: 'Claro M. Recto',
      guest_email: 'claro@recto.org',
      guest_phone: '0920-222-3333',
      check_in: '2026-07-23',
      check_out: '2026-07-28',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 6000,
      balance_due: 6500,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-aug-1',
      room_id: 'room-3',
      guest_name: 'Maria Leonora',
      guest_email: 'leonora.maria@outlook.com',
      guest_phone: '0922-777-8899',
      check_in: '2026-08-12',
      check_out: '2026-08-15',
      source: 'facebook',
      status: 'confirmed',
      downpayment_paid: 1425,
      balance_due: 1925,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-aug-2',
      room_id: 'room-10',
      guest_name: 'Jose Rizal',
      guest_email: 'rizal.jose@ilustrado.es',
      guest_phone: '0923-888-9900',
      check_in: '2026-08-20',
      check_out: '2026-08-22',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 2400,
      balance_due: 2900,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-sept-1',
      room_id: 'room-5',
      guest_name: 'Liza Soberano',
      guest_email: 'liza@soberano.com',
      guest_phone: '0924-999-0011',
      check_in: '2026-09-08',
      check_out: '2026-09-12',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 2400,
      balance_due: 2900,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-sept-2',
      venue_id: 'venue-garden',
      guest_name: 'Pedro Penduko',
      guest_email: 'pedro@penduko.ph',
      guest_phone: '0925-000-1122',
      check_in: '2026-09-18',
      check_out: '2026-09-19', // Modified to satisfy check constraint
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 3750,
      balance_due: 4250,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-oct-1',
      room_id: 'room-7',
      guest_name: 'Catriona Gray',
      guest_email: 'catriona@missuniverse.tv',
      guest_phone: '0926-111-2233',
      check_in: '2026-10-10',
      check_out: '2026-10-13',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 1650,
      balance_due: 2150,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-oct-2',
      room_id: 'room-4',
      guest_name: 'Manny Pacquiao',
      guest_email: 'manny@pacman.com',
      guest_phone: '0927-222-3344',
      check_in: '2026-10-24',
      check_out: '2026-10-28',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 1900,
      balance_due: 2400,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-nov-1',
      room_id: 'room-9',
      guest_name: 'Carlos Yulo',
      guest_email: 'carlos@gymnastics.org',
      guest_phone: '0928-333-4455',
      check_in: '2026-11-14',
      check_out: '2026-11-17',
      source: 'facebook',
      status: 'confirmed',
      downpayment_paid: 1350,
      balance_due: 1850,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-nov-2',
      room_id: 'room-2',
      guest_name: 'Kylie Verzosa',
      guest_email: 'kylie@verzosa.com',
      guest_phone: '0929-444-5566',
      check_in: '2026-11-20',
      check_out: '2026-11-23',
      source: 'airbnb',
      status: 'confirmed',
      downpayment_paid: 1425,
      balance_due: 1925,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-dec-1',
      room_id: 'room-5',
      guest_name: 'Pia Wurtzbach',
      guest_email: 'pia.wurtzbach@universe.org',
      guest_phone: '0930-555-6677',
      check_in: '2026-12-12',
      check_out: '2026-12-15',
      source: 'booking_com',
      status: 'confirmed',
      downpayment_paid: 1800,
      balance_due: 2300,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-dec-2',
      room_id: 'room-6',
      guest_name: 'Lea Salonga',
      guest_email: 'lea@salongatheatre.com',
      guest_phone: '0931-666-7788',
      check_in: '2026-12-22',
      check_out: '2026-12-27',
      source: 'website',
      status: 'confirmed',
      downpayment_paid: 4500,
      balance_due: 5000,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    },
    {
      id: 'mock-dec-3',
      venue_id: 'venue-vacation',
      guest_name: 'Vicente Manansala',
      guest_email: 'vicente@manansala.ph',
      guest_phone: '0932-777-8899',
      check_in: '2026-12-24',
      check_out: '2026-12-25', // Modified to satisfy check constraint
      source: 'manual',
      status: 'confirmed',
      downpayment_paid: 7500,
      balance_due: 8000,
      security_deposit: 500,
      created_at: new Date().toISOString(),
      expires_at: null
    }
  ]

  const current = await getBookings()
  const currentIds = new Set(current.map(b => b.id))

  // Only add if not already seeded
  const toAdd = futureBookings.filter(b => !currentIds.has(b.id))

  if (toAdd.length > 0) {
    await saveBookings([...current, ...toAdd])
  }

  return toAdd.length
}

// ── Partner Deals Operations ──

export async function getPartnerDeals(): Promise<PartnerDeal[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('partner_deals')
        .select('*')
        .order('name', { ascending: true })
      if (error) throw error

      if (data) {
        return data.map(d => ({
          id: d.id,
          name: d.name,
          type: d.type as any,
          tin: d.tin || undefined,
          address: d.address || undefined,
          contact_no: d.contact_no || undefined,
          email: d.email || undefined,
          vehicle_plate: d.vehicle_plate || undefined,
          invoice_type: d.invoice_type as any,
          breakfast_default: d.breakfast_default as any,
          contracted_rates: d.contracted_rates || {},
          created_at: d.created_at
        }))
      }
    } catch (err) {
      console.error('Supabase getPartnerDeals Error, falling back to LocalStorage:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(PARTNERS_KEY)
  if (!data) return []
  return JSON.parse(data)
}

export async function savePartnerDeals(deals: PartnerDeal[]): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const records = deals.map(d => ({
        id: d.id,
        name: d.name,
        type: d.type,
        tin: d.tin || null,
        address: d.address || null,
        contact_no: d.contact_no || null,
        email: d.email || null,
        vehicle_plate: d.vehicle_plate || null,
        invoice_type: d.invoice_type,
        breakfast_default: d.breakfast_default,
        contracted_rates: d.contracted_rates,
        created_at: d.created_at
      }))

      const { error } = await supabase.from('partner_deals').upsert(records)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase savePartnerDeals Error, falling back to LocalStorage:', err)
    }
  }

  localStorage.setItem(PARTNERS_KEY, JSON.stringify(deals))
}

export async function insertPartnerDeal(deal: PartnerDeal): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const record = {
        id: deal.id,
        name: deal.name,
        type: deal.type,
        tin: deal.tin || null,
        address: deal.address || null,
        contact_no: deal.contact_no || null,
        email: deal.email || null,
        vehicle_plate: deal.vehicle_plate || null,
        invoice_type: deal.invoice_type,
        breakfast_default: deal.breakfast_default,
        contracted_rates: deal.contracted_rates,
        created_at: deal.created_at
      }

      const { error } = await supabase.from('partner_deals').insert(record)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase insertPartnerDeal Error, falling back to LocalStorage:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(PARTNERS_KEY)
  const existing: PartnerDeal[] = data ? JSON.parse(data) : []
  localStorage.setItem(PARTNERS_KEY, JSON.stringify([...existing, deal]))
}

export async function deletePartnerDeal(dealId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('partner_deals').delete().eq('id', dealId)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase deletePartnerDeal Error, falling back to LocalStorage:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(PARTNERS_KEY)
  if (data) {
    const existing: PartnerDeal[] = JSON.parse(data)
    localStorage.setItem(PARTNERS_KEY, JSON.stringify(existing.filter(d => d.id !== dealId)))
  }
}

// ==========================================
// EXPENSE TRACKING
// ==========================================

const EXPENSE_CATEGORIES_KEY = 'l_etoile_expense_categories_db'
const EXPENSES_KEY = 'l_etoile_expenses_db'

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('expense_categories').select('*').order('name')
      if (error) throw error
      if (data) return data
    } catch (err) {
      console.error('Supabase getExpenseCategories Error:', err)
    }
  }
  const data = localStorage.getItem(EXPENSE_CATEGORIES_KEY)
  if (data) return JSON.parse(data)
  
  const defaultCats: ExpenseCategory[] = [
    { id: 'cat-1', name: 'Maintenance & Repairs', created_at: new Date().toISOString() },
    { id: 'cat-2', name: 'Utilities (Water/Electricity)', created_at: new Date().toISOString() },
    { id: 'cat-3', name: 'Salaries & Wages', created_at: new Date().toISOString() },
    { id: 'cat-4', name: 'Supplies & Toiletries', created_at: new Date().toISOString() },
    { id: 'cat-5', name: 'Marketing & Promos', created_at: new Date().toISOString() }
  ]
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(defaultCats))
  return defaultCats
}

export async function insertExpenseCategory(category: Omit<ExpenseCategory, 'created_at'> & { created_at?: string }): Promise<ExpenseCategory> {
  const newCat = { ...category, created_at: category.created_at || new Date().toISOString() } as ExpenseCategory
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expense_categories').insert(newCat)
      if (error) throw error
      return newCat
    } catch (err) {
      console.error('Supabase insertExpenseCategory Error:', err)
    }
  }
  const existing = await getExpenseCategories()
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify([...existing, newCat]))
  return newCat
}

export async function updateExpenseCategory(category: ExpenseCategory): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expense_categories').update({ name: category.name }).eq('id', category.id)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase updateExpenseCategory Error:', err)
    }
  }
  const existing = await getExpenseCategories()
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(existing.map(c => c.id === category.id ? category : c)))
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expense_categories').delete().eq('id', id)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase deleteExpenseCategory Error:', err)
    }
  }
  const existing = await getExpenseCategories()
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(existing.filter(c => c.id !== id)))
}

export async function getExpenses(): Promise<Expense[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
      if (error) throw error
      if (data) return data
    } catch (err) {
      console.error('Supabase getExpenses Error:', err)
    }
  }
  const data = localStorage.getItem(EXPENSES_KEY)
  if (data) return JSON.parse(data)
  
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  const lastWeek = new Date(today.getTime() - 86400000 * 7)

  const defaultExpenses: Expense[] = [
    { id: 'exp-1', amount: 12500, category_id: 'cat-3', expense_date: today.toISOString().split('T')[0], notes: 'Weekly Staff Payroll', created_at: today.toISOString() },
    { id: 'exp-2', amount: 4500, category_id: 'cat-2', expense_date: yesterday.toISOString().split('T')[0], notes: 'Electric Bill', created_at: yesterday.toISOString() },
    { id: 'exp-3', amount: 1200, category_id: 'cat-4', expense_date: yesterday.toISOString().split('T')[0], notes: 'Restock soap and shampoo', created_at: yesterday.toISOString() },
    { id: 'exp-4', amount: 3500, category_id: 'cat-1', expense_date: lastWeek.toISOString().split('T')[0], notes: 'Aircon cleaning service (Rooms 1-4)', created_at: lastWeek.toISOString() }
  ]
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(defaultExpenses))
  return defaultExpenses
}

export async function insertExpense(expense: Omit<Expense, 'created_at'> & { created_at?: string }): Promise<Expense> {
  const newExp = { ...expense, created_at: expense.created_at || new Date().toISOString() } as Expense
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expenses').insert(newExp)
      if (error) throw error
      return newExp
    } catch (err) {
      console.error('Supabase insertExpense Error:', err)
    }
  }
  const existing = await getExpenses()
  localStorage.setItem(EXPENSES_KEY, JSON.stringify([...existing, newExp]))
  return newExp
}

export async function deleteExpense(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase deleteExpense Error:', err)
    }
  }
  const existing = await getExpenses()
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(existing.filter(e => e.id !== id)))
}

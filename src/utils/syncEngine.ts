import { Room, Venue, Booking, SyncFeed, BookingSource, BookingStatus, BreakfastOrder, EquipmentRental, EventAddons, GuestRecord } from '../types/booking'

// Helper: Generate UUID
export function generateUUID(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
}

// 1. Initial Prepopulated Rooms List (Philippine Peso PMS Rates)
export const DEFAULT_ROOMS: Room[] = [
  {
    id: 'room-1',
    room_number: 1,
    name: 'Full Double Deluxe',
    base_price: 1050,
    capacity: 2,
    description: 'A large and comfortable room with a double bed, nice seating area, and a private balcony with a view of the city skyline.',
    image_url: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-2',
    room_number: 2,
    name: 'Full Double',
    base_price: 950,
    capacity: 2,
    description: 'A clean and quiet room with a double bed and a desk. Perfect for work or relaxation.',
    image_url: 'https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-3',
    room_number: 3,
    name: 'Full Double',
    base_price: 950,
    capacity: 2,
    description: 'A cozy interior room with a double bed and warm, soft lighting. Safe and quiet.',
    image_url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-4',
    room_number: 4,
    name: 'Full Double',
    base_price: 950,
    capacity: 2,
    description: 'A high room with a double bed, simple design, and a nice view of Manila Bay.',
    image_url: 'https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-5',
    room_number: 5,
    name: 'Matrimonial',
    base_price: 1200,
    capacity: 2,
    description: 'A nice room for couples. It has a queen bed, warm lighting, and a large private bathtub.',
    image_url: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-6',
    room_number: 6,
    name: 'Family Room',
    base_price: 1800,
    capacity: 5,
    description: 'A big room for families. It has two double beds, one single roll-away bed, and a dining table.',
    image_url: 'https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-7',
    room_number: 7,
    name: 'Bunk Bed 3',
    base_price: 1100,
    capacity: 3,
    description: 'A shared room with three comfortable bunk bed spaces, curtains for privacy, and power plugs.',
    image_url: 'https://images.unsplash.com/photo-1555854877-bab0e564b8d5?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-8',
    room_number: 8,
    name: 'Double',
    base_price: 850,
    capacity: 2,
    description: 'A simple studio room with a double bed, private bathroom, and bright windows.',
    image_url: 'https://images.unsplash.com/photo-1611891404724-5f9a241e243b?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-9',
    room_number: 9,
    name: 'Bunk Bed 2',
    base_price: 900,
    capacity: 2,
    description: 'A cozy shared room with two parallel bunk bed spaces and warm lighting.',
    image_url: 'https://images.unsplash.com/photo-1564507592333-c60657eea523?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'room-10',
    room_number: 10,
    name: 'Bunk Bed 6',
    base_price: 2400,
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

// 4. Initialization
export function initDB() {
  if (!localStorage.getItem(BOOKINGS_KEY)) {
    const today = new Date()
    const tomorrow = new Date(today)
    tomorrow.setDate(today.getDate() + 1)
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
        check_out: tomorrow.toISOString().split('T')[0], // Single day event
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
}

// 5. Booking Operations
export function getBookings(): Booking[] {
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

export function saveBookings(bookings: Booking[]) {
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings))
}

export function getFeeds(): SyncFeed[] {
  initDB()
  const data = localStorage.getItem(FEEDS_KEY)
  return data ? JSON.parse(data) : []
}

export function saveFeeds(feeds: SyncFeed[]) {
  localStorage.setItem(FEEDS_KEY, JSON.stringify(feeds))
}

// 6. Availability Collision Vectors (Bilateral safety)
export function isRoomAvailable(roomId: string, checkInStr: string, checkOutStr: string, skipBookingId?: string): boolean {
  const checkIn = new Date(checkInStr)
  const checkOut = new Date(checkOutStr)
  if (checkIn >= checkOut) return false

  const bookings = getBookings()
  return !bookings.some(booking => {
    if (booking.room_id !== roomId) return false
    if (booking.id === skipBookingId) return false
    
    const bStart = new Date(booking.check_in)
    const bEnd = new Date(booking.check_out)
    return checkIn < bEnd && checkOut > bStart
  })
}

export function isVenueAvailable(venueId: string, eventDateStr: string, skipBookingId?: string): boolean {
  const bookings = getBookings()
  return !bookings.some(booking => {
    if (booking.venue_id !== venueId) return false
    if (booking.id === skipBookingId) return false
    return booking.check_in === eventDateStr
  })
}

// 7. Silent Loyalty Verification (10% discount trigger)
export function checkGuestLoyalty(email: string): boolean {
  const bookings = getBookings()
  // Check if guest has at least 1 confirmed past stay in the system under this email
  return bookings.some(b => b.guest_email.toLowerCase() === email.toLowerCase() && b.status === 'confirmed')
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
}) {
  const { roomId, venueId, checkIn, checkOut, guestEmail, breakfastOrders, equipmentRentals, eventAddons } = params
  
  let basePrice = 0
  let isVenue = false
  let nights = 0
  
  // A. Nightly Room vs Daily Venue rate mapping
  if (roomId) {
    const room = DEFAULT_ROOMS.find(r => r.id === roomId)
    basePrice = room ? room.base_price : 0
    nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  } else if (venueId) {
    const venue = DEFAULT_VENUES.find(v => v.id === venueId)
    basePrice = venue ? venue.base_price : 0
    nights = 1 // Venue bookings are charged per day/event
    isVenue = true
  }

  // B. Loyalty Program: 10% auto-deducted if guest has past completed stay
  const hasLoyalty = checkGuestLoyalty(guestEmail)
  const discountMultiplier = hasLoyalty ? 0.90 : 1.0
  const subtotal = basePrice * nights * discountMultiplier

  // C. Breakfast Add-ons (₱200/set)
  let breakfastTotal = 0
  if (breakfastOrders && breakfastOrders.length > 0) {
    breakfastOrders.forEach(order => {
      breakfastTotal += 200 * order.quantity
    })
  }

  // D. Equipment Rentals (Big Table: 150, Small Table: 100, Chair: 15, Water: 35)
  let rentalsTotal = 0
  if (equipmentRentals) {
    rentalsTotal += (equipmentRentals.bigTableCount * 150)
    rentalsTotal += (equipmentRentals.smallTableCount * 100)
    rentalsTotal += (equipmentRentals.chairCount * 15)
    rentalsTotal += (equipmentRentals.mineralWaterCount * 35)
  }

  // E. Event Add-ons (Band: 2000, Stage: 2000, LED Wall: 5000)
  let addonsTotal = 0
  if (eventAddons) {
    if (eventAddons.fullBandAndLights) addonsTotal += 2000
    if (eventAddons.stage) addonsTotal += 2000
    if (eventAddons.ledWall) addonsTotal += 5000
  }

  // F. Balance & Deposit Sums
  const securityDeposit = 500 // Flat rate
  const grandTotal = subtotal + breakfastTotal + rentalsTotal + addonsTotal
  const downpayment = Math.round(grandTotal * 0.50) // 50% reservation policy
  const balanceDue = (grandTotal - downpayment) + securityDeposit

  return {
    subtotal: Math.round(subtotal),
    hasLoyalty,
    breakfastTotal,
    rentalsTotal,
    addonsTotal,
    securityDeposit,
    grandTotal,
    downpayment,
    balanceDue
  }
}

// 9. Generate iCal string (Rooms only)
export function generateRoomiCal(roomId: string): string {
  const bookings = getBookings().filter(b => b.room_id === roomId && (b.status === 'confirmed' || b.status === 'blocked'))
  
  let ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Daweez Central Channel Manager//Pension House//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH'
  ]

  bookings.forEach(b => {
    const dateStart = b.check_in.replace(/-/g, '')
    const dateEnd = b.check_out.replace(/-/g, '')
    const createdStr = b.created_at.replace(/[-:.]/g, '').split('T')[0] + 'T000000Z'

    ics.push(
      'BEGIN:VEVENT',
      `UID:${b.id}@daweez-pensionhouse.com`,
      `DTSTAMP:${createdStr}`,
      `DTSTART;VALUE=DATE:${dateStart}`,
      `DTEND;VALUE=DATE:${dateEnd}`,
      `SUMMARY:${b.source.toUpperCase()} - Reserved`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    )
  })

  ics.push('END:VCALENDAR')
  return ics.join('\r\n')
}

// 10. iCal Scraper & Ingestion
export function parseiCalFeed(icsString: string): Omit<Booking, 'id' | 'room_id' | 'created_at' | 'expires_at' | 'downpayment_paid' | 'balance_due' | 'security_deposit'>[] {
  const events: any[] = []
  const lines = icsString.split(/\r?\n/)
  
  let currentEvent: any = {}
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
          source: currentEvent.source || 'airbnb',
          status: 'confirmed'
        })
      }
    } else if (inEvent) {
      const match = line.match(/^([^:;]+)(?:;([^:]+))?:(.*)$/)
      if (!match) continue

      const name = match[1]
      const params = match[2]
      const value = match[3]

      if (name === 'DTSTART') {
        currentEvent.check_in = parseiCalDate(value, params)
      } else if (name === 'DTEND') {
        currentEvent.check_out = parseiCalDate(value, params)
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

function parseiCalDate(value: string, params?: string): string {
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
export const MOCK_AIRBNB_FEED = `
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

export const MOCK_BOOKING_COM_FEED = `
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

export function runSimulatedOTASync(): number {
  const bookings = getBookings()
  const feeds = getFeeds()
  
  let updatedBookings = bookings.filter(b => b.source === 'website' || b.source === 'manual' || b.source === 'facebook' || b.source === 'google_maps')
  let newSyncCount = 0

  // Sync Room 2 Airbnb
  const abEvents = parseiCalFeed(MOCK_AIRBNB_FEED)
  abEvents.forEach(evt => {
    if (isRoomAvailable('room-2', evt.check_in, evt.check_out)) {
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
        downpayment_paid: 4500, // Predefined PHP downpayment
        balance_due: 5000,
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
    if (isRoomAvailable('room-3', evt.check_in, evt.check_out)) {
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
        downpayment_paid: 4500,
        balance_due: 5000,
        security_deposit: 500,
        created_at: new Date().toISOString(),
        expires_at: null
      })
      newSyncCount++
    }
  })

  saveBookings(updatedBookings)

  const updatedFeeds = feeds.map(f => ({ ...f, last_synced: new Date().toISOString() }))
  saveFeeds(updatedFeeds)

  return newSyncCount
}

// 12. Retrieve visit logs stats for PMS Loyalty Tab
export function getGuestRecords(): GuestRecord[] {
  const bookings = getBookings().filter(b => b.status === 'confirmed')
  const map = new Map<string, GuestRecord>()

  bookings.forEach(b => {
    const key = b.guest_email.toLowerCase()
    const current = map.get(key)
    
    if (current) {
      current.visit_count += 1
      if (b.created_at > current.last_visit) {
        current.last_visit = b.created_at
      }
    } else {
      map.set(key, {
        email: b.guest_email,
        name: b.guest_name,
        phone: b.guest_phone,
        visit_count: 1,
        last_visit: b.created_at
      })
    }
  })

  return Array.from(map.values())
}

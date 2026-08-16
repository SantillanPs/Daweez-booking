import { Room, Venue, Booking, SyncFeed, BookingSource, BookingStatus } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { randomUUID, isValidUUID } from './helpers'
import { DEFAULT_ROOMS, DEFAULT_VENUES } from './defaultData'

// Local Storage Database Keys
const BOOKINGS_KEY = 'l_etoile_bookings_db'
const FEEDS_KEY = 'l_etoile_feeds_db'
export const PARTNERS_KEY = 'l_etoile_partners_db'

// Initialization
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
        downpayment_paid: 1050,
        balance_due: 1550,
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
        check_out: inTwoDays.toISOString().split('T')[0],
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

export async function getRooms(): Promise<Room[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('rooms').select('*').order('room_number')
      if (error) throw error
      if (data && data.length > 0) {
        return data.map(r => ({
          id: r.id,
          room_number: r.room_number,
          name: r.name,
          base_price: Number(r.base_price),
          capacity: r.capacity,
          description: r.description || undefined,
          image_url: r.image_url || undefined
        })) as Room[]
      }
    } catch (err) {
      console.error('Supabase getRooms Error, falling back to defaults:', err)
    }
  }
  return DEFAULT_ROOMS
}

export async function getVenues(): Promise<Venue[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('venues').select('*').order('name')
      if (error) throw error
      if (data && data.length > 0) {
        return data.map(v => ({
          id: v.id,
          name: v.name,
          base_price: Number(v.base_price),
          capacity: v.capacity,
          description: v.description || undefined,
          image_url: v.image_url || undefined,
          details: v.details || undefined
        })) as Venue[]
      }
    } catch (err) {
      console.error('Supabase getVenues Error, falling back to defaults:', err)
    }
  }
  return DEFAULT_VENUES
}

export async function getBookings(): Promise<Booking[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
      if (error) throw error

      if (data) {
        const now = new Date()
        const activeRecords = data.filter(b => {
          if (b.status === 'pending' && b.expires_at) {
            const expires = new Date(b.expires_at)
            return expires > now
          }
          return true
        })

        // Remove abandoned 30-min locks via RPC (anon no longer has DELETE).
        try { await supabase.rpc('cleanup_expired_pending') } catch { /* non-fatal */ }

        return activeRecords.map(b => ({
          id: b.id,
          room_id: b.room_id || undefined,
          venue_id: b.venue_id || undefined,
          guest_name: b.guest_name,
          guest_email: b.guest_email,
          guest_phone: b.guest_phone,
          guest_gender: b.guest_gender || undefined,
          guest_nationality: b.guest_nationality || undefined,
          guest_address: b.guest_address || undefined,
          check_in: b.check_in,
          check_out: b.check_out,
          source: b.source as BookingSource,
          status: b.status as BookingStatus,
          payment_method: b.payment_method || undefined,
          payment_reference: b.payment_reference || undefined,
          downpayment_paid: Number(b.downpayment_paid || 0),
          balance_due: Number(b.balance_due || 0),
          security_deposit: Number(b.security_deposit || 0),
          breakfast_orders: b.breakfast_orders || undefined,
          equipment_rentals: b.equipment_rentals || undefined,
          event_addons: b.event_addons || undefined,
          companions: b.companions || undefined,
          venue_excess_hours: b.venue_excess_hours ? Number(b.venue_excess_hours) : undefined,
          created_at: b.created_at,
          expires_at: b.expires_at || null,
          partner_deal_id: b.partner_deal_id || undefined,
          company_name: b.company_name || undefined,
          vehicle_plate: b.vehicle_plate || undefined,
          invoice_number: b.invoice_number || undefined,
          invoice_type: b.invoice_type || undefined,
          breakfast_included: !!b.breakfast_included,
          contract_rate_override: b.contract_rate_override ? Number(b.contract_rate_override) : undefined
        }))
      }
    } catch (err) {
      console.error('Supabase getBookings Error, falling back to LocalStorage:', err)
    }
  }

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

// ── Shared Supabase record mapper (single source of truth for column shape) ──
function toBookingRecord(booking: Booking): Record<string, unknown> {
  return {
    id: booking.id,
    room_id: booking.room_id || null,
    venue_id: booking.venue_id || null,
    guest_name: booking.guest_name,
    guest_email: booking.guest_email,
    guest_phone: booking.guest_phone,
    guest_gender: booking.guest_gender || null,
    guest_nationality: booking.guest_nationality || null,
    guest_address: booking.guest_address || null,
    check_in: booking.check_in,
    check_out: booking.check_out,
    source: booking.source,
    status: booking.status,
    payment_status: booking.payment_status || null,
    payment_method: booking.payment_method || null,
    payment_reference: booking.payment_reference || null,
    downpayment_paid: booking.downpayment_paid,
    balance_due: booking.balance_due,
    security_deposit: booking.security_deposit,
    breakfast_orders: booking.breakfast_orders || null,
    equipment_rentals: booking.equipment_rentals || null,
    event_addons: booking.event_addons || null,
    companions: booking.companions || null,
    venue_excess_hours: booking.venue_excess_hours || 0,
    expires_at: booking.expires_at || null,
    partner_deal_id: booking.partner_deal_id || null,
    company_name: booking.company_name || null,
    vehicle_plate: booking.vehicle_plate || null,
    invoice_number: booking.invoice_number || null,
    invoice_type: booking.invoice_type || null,
    breakfast_included: !!booking.breakfast_included,
    contract_rate_override: booking.contract_rate_override || null
  }
}

// Business-rule failures must surface to the UI — never silently fall back.
function isBusinessRuleError(err: unknown): boolean {
  const msg = (err as { message?: string })?.message || ''
  return msg.includes('ROOM_UNAVAILABLE') || msg.includes('VENUE_UNAVAILABLE') || msg.includes('Check-in must be earlier')
}

// Compute the next sequential invoice number for a check-in month.
async function nextInvoiceNumber(checkInDate: string): Promise<string> {
  const allBookings = await getBookings()
  const prefixYearMonth = checkInDate.substring(0, 7)
  const prefixDocType = 'GRF'

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

  return `${prefixDocType}-${prefixYearMonth}-${String(nextSeq).padStart(4, '0')}`
}

export async function saveBookings(bookings: Booking[]): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      // Per-row insert/update through the RPCs (whole-array upsert is no longer
      // permitted for anon and would cause lost updates between tabs).
      const existing = await getBookings()
      for (const b of bookings) {
        if (existing.some(x => x.id === b.id)) {
          await updateBooking(b)
        } else {
          await insertBooking(b)
        }
      }
      return
    } catch (err) {
      console.error('Supabase saveBookings Error, falling back to LocalStorage:', err)
    }
  }

  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings))
}

export async function insertBooking(booking: Booking): Promise<Booking> {
  // The DB id column is UUID-typed; legacy ids ('manual-abc') would silently
  // fail on Supabase, so normalize to a real UUID before writing.
  const dbId = isValidUUID(booking.id) ? booking.id! : randomUUID()
  const withId: Booking = { ...booking, id: dbId }

  // Assign a sequential invoice number client-side (retried on conflict below).
  if (!withId.invoice_number && withId.status !== 'blocked') {
    withId.invoice_number = await nextInvoiceNumber(withId.check_in)
  }

  const record = toBookingRecord(withId)

  if (isSupabaseConfigured) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const { data, error } = await supabase.rpc('book_booking', { p_booking: record })
        if (error) {
          // Race on the sequential invoice number → bump and retry.
          const isInvoiceConflict = withId.invoice_number &&
            (error.code === '23505' || /duplicate key/i.test(String(error.message || '')))
          if (isInvoiceConflict) {
            withId.invoice_number = await nextInvoiceNumber(withId.check_in)
            record.invoice_number = withId.invoice_number
            continue
          }
          throw error
        }
        return (data as unknown as Booking) ?? withId
      } catch (err) {
        if (isBusinessRuleError(err)) throw err
        console.error('Supabase insertBooking Error, falling back to LocalStorage:', err)
        break
      }
    }
  }

  initDB()
  const data = localStorage.getItem(BOOKINGS_KEY)
  const existing: Booking[] = data ? JSON.parse(data) : []
  const next = [...existing, withId]
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(next))
  return withId
}

export async function updateBooking(booking: Booking): Promise<Booking> {
  // Supabase rows always carry real UUID ids; legacy localStorage rows don't.
  if (isSupabaseConfigured && isValidUUID(booking.id)) {
    try {
      const { data, error } = await supabase.rpc('update_booking', { p_booking: toBookingRecord(booking) })
      if (error) throw error
      return (data as unknown as Booking) ?? booking
    } catch (err) {
      if (isBusinessRuleError(err)) throw err
      console.error('Supabase updateBooking Error, falling back to LocalStorage:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(BOOKINGS_KEY)
  const existing: Booking[] = data ? JSON.parse(data) : []
  const updated = existing.map(b => b.id === booking.id ? booking : b)
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated))
  return booking
}

export async function deleteBooking(bookingId: string): Promise<void> {
  if (isSupabaseConfigured && isValidUUID(bookingId)) {
    try {
      const { error } = await supabase.rpc('delete_booking', { p_booking_id: bookingId })
      if (error) throw error
      return
    } catch (err) {
      if (isBusinessRuleError(err)) throw err
      console.error('Supabase deleteBooking Error, falling back to LocalStorage:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(BOOKINGS_KEY)
  const existing: Booking[] = data ? JSON.parse(data) : []
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(existing.filter(b => b.id !== bookingId)))
}

export async function confirmBooking(bookingId: string): Promise<Booking> {
  if (isSupabaseConfigured && isValidUUID(bookingId)) {
    try {
      const { data, error } = await supabase.rpc('confirm_booking', { p_booking_id: bookingId })
      if (error) throw error
      return data as unknown as Booking
    } catch (err) {
      if (isBusinessRuleError(err)) throw err
      console.error('Supabase confirmBooking Error, falling back to LocalStorage:', err)
    }
  }

  initDB()
  const data = localStorage.getItem(BOOKINGS_KEY)
  const existing: Booking[] = data ? JSON.parse(data) : []
  const updated = existing.map(b => b.id === bookingId ? { ...b, status: 'confirmed' as const, expires_at: null } : b)
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(updated))
  return updated.find(b => b.id === bookingId)!
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

import { Booking, SyncFeed, BookingSource } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { generateUUID } from './helpers'
import { getBookings, getFeeds, saveBookings, saveFeeds } from './db'
import { isRoomAvailable } from './availability'

// iCal Scraper & Ingestion
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

// Mock OTA feeds are only injected when explicitly enabled. This prevents the
// local/offline fallback from fabricating fake bookings that look real.
const MOCK_SYNC_ENABLED = import.meta.env.VITE_ENABLE_MOCK_SYNC === 'true'

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

  let updatedBookings = bookings
  let newSyncCount = 0

  // Only inject mock OTA bookings when the dev/test flag is set.
  if (MOCK_SYNC_ENABLED) {
    updatedBookings = bookings.filter(b => b.source === 'website' || b.source === 'manual' || b.source === 'facebook' || b.source === 'google_maps')

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
          downpayment_paid: 950,
          balance_due: 1450,
          security_deposit: 500,
          created_at: new Date().toISOString(),
          expires_at: null
        })
        newSyncCount++
      }
    })

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

    if (hasChanges) {
      await saveBookings(updatedBookings)
    }
  }

  // Always refresh the "last synced" stamp so staff can see the sync ran.
  const updatedFeeds = feeds.map(f => ({ ...f, last_synced: new Date().toISOString() }))
  await saveFeeds(updatedFeeds)

  return newSyncCount
}

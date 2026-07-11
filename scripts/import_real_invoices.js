import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRlZmF1bHQiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY3OTIzOTg0MiwiZXhwIjoxOTk0ODE1ODQyfQ'
const supabase = createClient(supabaseUrl, supabaseKey)

const ROOM_MAP = {
  'Rm 1': 'room-1',
  'Rm 2': 'room-2',
  'Rm 3': 'room-3',
  'Rm 4': 'room-4',
  'Rm 5': 'room-5',
  'Rm 6': 'room-6',
  'Rm 7': 'room-7',
  'Rm 8': 'room-8',
  'Rm 9': 'room-9',
  'Rm 10': 'room-10',
  'Bunk Bed 1': 'room-7',
  'Bunk Bed 2': 'room-9',
  'Bunk Bed 3': 'room-7',
  'Bunk Bed 4': 'room-9',
  'Bunk Bed 5': 'room-10',
  'Bunk Bed 6': 'room-10',
  'Bunk Bed 10': 'room-10',
  'Matrimonial Room 5': 'room-5',
  'Gazebo': 'venue-gazebo',
  'Garden': 'venue-garden',
  'Garden Only': 'venue-garden',
  'Parking Garden': 'venue-garden',
  'Vacation House': 'venue-vacation',
  'Vacation House Only': 'venue-vacation',
  'V-House': 'venue-vacation'
}

function normalizeDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0]
  // Handle formats like "7/1/26", "July 9, 2026", "7-4-26 - 8:30 am"
  try {
    const cleanStr = dateStr.split('-')[0].trim()
    const d = new Date(cleanStr)
    if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0]
    return d.toISOString().split('T')[0]
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

function parseAmount(amountStr) {
  if (!amountStr) return 0
  const match = amountStr.match(/[\d,]+/)
  if (!match) return 0
  return parseInt(match[0].replace(/,/g, ''), 10) || 0
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

async function main() {
  console.log('Clearing old imported bookings...')
  await supabase.from('bookings').delete().like('id', 'imported-%')
  
  const data = JSON.parse(fs.readFileSync('real-invoice.json', 'utf-8'))
  const bookings = []

  for (const record of data) {
    const rawRoomTypes = record.room_information?.room_type || ''
    // Handle cases like "Rm 6 + Rm 9"
    const roomTypes = rawRoomTypes.split('+').map(s => s.trim()).filter(Boolean)

    if (roomTypes.length === 0) continue

    const checkIn = normalizeDate(record.room_information?.check_in_date_time || record.date)
    const nightsStr = record.room_information?.number_of_nights || '1'
    let checkOutDate = new Date(checkIn)
    
    // Default to 1 night if missing
    let nights = 1
    if (nightsStr.toLowerCase().includes('hr') || nightsStr.toLowerCase().includes('hour')) {
      nights = 1 // Treat hours as 1 day for checkout purposes
    } else {
      nights = parseInt(nightsStr) || 1
    }
    
    checkOutDate.setDate(checkOutDate.getDate() + nights)
    const checkOut = checkOutDate.toISOString().split('T')[0]

    const depositPaidStr = record.billing?.deposit_paid || ''
    const downpayment = parseAmount(depositPaidStr)
    const paymentMethod = record.billing?.mode_of_payment || 'Cash'
    
    // Extract reference from deposit string if present
    let reference = ''
    const refMatch = depositPaidStr.match(/Ref#\s*([\w\d]+)/i)
    if (refMatch) reference = refMatch[1]

    let venueExcessHours = 0
    // Check if venue and has excess hours (e.g., 6 hrs standard but charged more)
    // We'll leave it as 0 unless explicitly mentioned in notes, but there are no explicit notes here.

    let unitIndex = 1
    for (const rt of roomTypes) {
      const isVenue = rt.toLowerCase().includes('gazebo') || rt.toLowerCase().includes('garden') || rt.toLowerCase().includes('vacation') || rt.toLowerCase().includes('v-house')
      const roomId = isVenue ? undefined : ROOM_MAP[rt]
      const venueId = isVenue ? ROOM_MAP[rt] : undefined

      if (!roomId && !venueId) {
        console.warn(`Unknown room/venue type: ${rt} in invoice ${record.form_number}`)
        continue
      }
      
      const invoiceNumber = roomTypes.length > 1 ? `${record.form_number}-${unitIndex}` : record.form_number

      bookings.push({
        id: `imported-${generateUUID()}`,
        room_id: roomId,
        venue_id: venueId,
        guest_name: record.guest_information?.name || 'Walk-in Guest',
        guest_email: 'imported@daweez-booking.vercel.app',
        guest_phone: record.guest_information?.contact_no || 'None',
        check_in: checkIn,
        check_out: checkOut,
        source: 'manual',
        status: 'confirmed',
        downpayment_paid: downpayment,
        payment_method: paymentMethod,
        payment_reference: reference || null,
        venue_excess_hours: venueExcessHours,
        balance_due: parseAmount(record.billing?.balance),
        security_deposit: 500,
        invoice_number: invoiceNumber,
        invoice_type: 'folio',
        created_at: new Date().toISOString()
      })
      unitIndex++
    }
  }

  console.log(`Prepared ${bookings.length} bookings for import.`)

  // Insert into Supabase
  const { data: result, error } = await supabase.from('bookings').insert(bookings)
  
  if (error) {
    console.error('Import failed:', error)
  } else {
    console.log('Import successful!')
  }
}

main().catch(console.error)

import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const data = JSON.parse(fs.readFileSync('real-invoice.json', 'utf-8'))
  
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('invoice_number, guest_name')
    .like('id', 'imported-%')
    
  if (error) {
    console.error('Error fetching from DB:', error)
    return
  }

  const dbInvoices = new Set(bookings.map(b => b.invoice_number.split('-')[0] + '-' + b.invoice_number.split('-')[1] + '-' + b.invoice_number.split('-')[2])) // Normalize in case we appended -1, -2
  
  const missing = []
  const expected = new Set()
  
  for (const record of data) {
    if (!record.form_number) continue
    
    // Check if it was skipped due to unknown room type
    const rawRoomTypes = record.room_information?.room_type || ''
    const roomTypes = rawRoomTypes.split('+').map(s => s.trim()).filter(Boolean)
    
    let hasValidRoom = false
    const ROOM_MAP = {
      'Rm 1': true, 'Rm 2': true, 'Rm 3': true, 'Rm 4': true, 'Rm 5': true,
      'Rm 6': true, 'Rm 7': true, 'Rm 8': true, 'Rm 9': true, 'Rm 10': true,
      'Bunk Bed 1': true, 'Bunk Bed 2': true, 'Bunk Bed 3': true, 'Bunk Bed 4': true,
      'Bunk Bed 5': true, 'Bunk Bed 6': true, 'Gazebo': true, 'Garden': true
    }
    
    for (const rt of roomTypes) {
      if (ROOM_MAP[rt]) hasValidRoom = true
    }
    
    if (hasValidRoom) {
      expected.add(record.form_number)
      
      let found = false
      for (const b of bookings) {
        if (b.invoice_number.startsWith(record.form_number)) {
          found = true
          break
        }
      }
      
      if (!found) {
        missing.push({ form_number: record.form_number, guest: record.guest_information?.name, room: record.room_information?.room_type })
      }
    }
  }

  console.log(`Total records in JSON: ${data.length}`)
  console.log(`Total valid records expected to be imported: ${expected.size}`)
  console.log(`Total bookings found in DB starting with imported-: ${bookings.length}`)
  
  if (missing.length === 0) {
    console.log('\nAll valid records from the JSON are present in the database!')
  } else {
    console.log('\nMissing valid records:')
    console.table(missing)
  }
}

check().catch(console.error)

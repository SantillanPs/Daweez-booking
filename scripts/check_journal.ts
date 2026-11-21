// Run: npx esbuild scripts/check_journal.ts --bundle --platform=node --banner:js='globalThis.window=globalThis;globalThis.addEventListener=()=>{};globalThis.localStorage={getItem:()=>null,setItem:()=>{}}' --define:import.meta.env='{"VITE_SUPABASE_URL":"http://x","VITE_SUPABASE_ANON_KEY":"x"}' --outfile=node_modules/.cache/c.js && node node_modules/.cache/c.js
// The staff's monthly Journal (2026-11-22): bills booked in the month, paid ones only, priced like the bill.
import { buildJournal } from '../src/utils/journal'
import type { Booking, Room, Venue } from '../src/types/booking'

const eq = (a: unknown, b: unknown, what: string) => { if (a !== b) throw new Error(what + ': ' + a + ' ≠ ' + b) }
const rooms = [4, 5, 10].map(n => ({ id: 'room-' + n, room_number: n, name: '', base_price: n === 10 ? 2400 : 1050, capacity: 2, description: '', image_url: '' })) as Room[]
const venues = [{ id: 'venue-gazebo', name: 'Gazebo', base_price: 5000 }] as unknown as Venue[]
const pay = (amount: number, at: string) => ({ id: at + amount, amount, method: 'Cash', paid_at: at })
const bk = (o: Partial<Booking>) => ({ status: 'confirmed', created_at: '2026-11-08T02:00:00Z', guest_name: 'Mark', ...o }) as Booking

const bookings: Booking[] = [
  // two rooms on one bill, a ₱200 discount, paid in part in November and the rest in December
  bk({ id: 'a', group_id: 'g', invoice_number: '202611-3-2', room_id: 'room-4', check_in: '2026-11-14', check_out: '2026-11-16',
    applied_discount: [{ type: 'flat', value: 200 }], payment_records: [pay(2000, '2026-11-08T03:00:00Z'), pay(1000, '2026-12-01T03:00:00Z')] }),
  bk({ id: 'b', group_id: 'g', invoice_number: '202611-4-3', room_id: 'room-5', check_in: '2026-11-14', check_out: '2026-11-16' }),
  // a venue with catering, part paid: the money fills the Gazebo first
  bk({ id: 'c', invoice_number: '202611-5-4', venue_id: 'venue-gazebo', check_in: '2026-11-22', check_out: '2026-11-22',
    event_addons: { charges: [{ id: 'x', name: 'Lunch', amount: 12000, date: '2026-11-21', kind: 'catering', qty: 120, price: 100 }] },
    payment_records: [pay(6000, '2026-11-21T03:00:00Z')] }),
  // no deposit: left out
  bk({ id: 'd', invoice_number: '202611-6-5', room_id: 'room-10', check_in: '2026-12-03', check_out: '2026-12-07' }),
  // booked in October: another month's
  bk({ id: 'e', invoice_number: '202610-9-9', room_id: 'room-10', created_at: '2026-10-30T02:00:00Z', check_in: '2026-11-01', check_out: '2026-11-02', payment_records: [pay(2400, '2026-10-30T03:00:00Z')] }),
]

const j = buildJournal({ month: '2026-11', bookings, rooms, venues, food: { b: 640 } })
eq(j.bills.length, 2, 'bills')
const [mark, gazebo] = j.bills
eq(mark.total, 4840, 'two rooms and food'); eq(mark.discount, 200, 'discount'); eq(mark.net, 4640, 'net')
eq(mark.paid, 3000, 'a later payment counts on the month booked'); eq(mark.owed, 1640, 'owed')
eq(mark.lines.map(l => l.what).join(), 'Room 4,Room 5,Food', 'lines')
eq(gazebo.lines.length, 2, 'catering line'); eq(gazebo.owed, gazebo.net - 6000, 'gazebo owed')
const at = (p: string) => j.places.find(x => x.place === p)!
eq(at('Gazebo').paid, at('Gazebo').net, 'the venue is paid before the catering')
eq(at('Catering').paid, 6000 - at('Gazebo').net, 'catering gets what is left')
eq(Math.round(at('Rooms').discount + at('Restaurant').discount), 200, 'discount split by place')
// paid over the bill: the extra shows on its place, and it owes nothing (Sebastian, 2026-11-22)
const over = buildJournal({ month: '2026-11', rooms, venues, food: {}, bookings: [
  bk({ id: 'f', invoice_number: '202611-7-6', room_id: 'room-4', check_in: '2026-11-13', check_out: '2026-11-14', payment_records: [pay(5000, '2026-11-12T03:00:00Z')] }) ] })
const r = over.places.find(x => x.place === 'Rooms')!
eq(r.paid, 5000, 'overpaid money shows in the summary'); eq(r.owed, 0, 'an overpaid bill owes nothing')
eq(at('Catering').owed, at('Catering').net - at('Catering').paid, 'catering owes what is left')
console.log('ok')
process.exit(0) // the app's connection watcher keeps a timer running

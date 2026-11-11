// Self-check: node scripts/check_bill_total.cjs
// A bill's discounts come off its WHOLE total, like a payment (Sebastian, 2026-11-11: a ₱100 discount
// read −₱0 because only the stays counted, not the extras). This builds a bill with every kind of
// line the statement can print — a room's stay, breakfast, early and late hours, linen, a venue's day,
// its rentals, extra hours and add-ons, the desk's charges, food — gives it a discount bigger than all
// of it, and fails unless the discount takes off exactly what the lines add up to. A new kind of line
// the discounts cannot reach fails here: add it to `calculatePricing`'s total (or the food) too.
const path = require('path')
const { buildSync } = require('esbuild')

const entry = `
import { bookingLines } from './src/utils/statementLines'
import { billStays } from './src/utils/pricing'
const rooms = [{ id: 'room-1', room_number: 1, name: 'Room 1', base_price: 1000, breakfast_price: 150, capacity: 2, description: '', image_url: '' }]
const venues = [{ id: 'venue-gazebo', name: 'Gazebo', base_price: 4000, capacity: 50, description: '', image_url: '', details: { chairs: 0, tables: 0, extras: [] } }]
const charges = [{ id: 'c1', name: 'Catering', amount: 26600, date: '2026-11-15' }]
const room = {
  id: 'b-room', room_id: 'room-1', check_in: '2026-11-15', check_out: '2026-11-17', status: 'confirmed',
  breakfast_included: true, early_check_in_hours: 2, late_check_out_hours: 3, actual_check_out: '2026-11-17T15:00:00',
  equipment_rentals: { extraFoamCount: 1, extraPillowCount: 1, extraBlanketCount: 1, extraTowelCount: 1 },
  event_addons: { charges }, applied_discount: [{ type: 'flat', value: 1e9, note: 'All of it' }],
}
const venue = {
  id: 'b-venue', venue_id: 'venue-gazebo', check_in: '2026-11-15', check_out: '2026-11-16', status: 'confirmed', venue_excess_hours: 2,
  equipment_rentals: { bigTableCount: 1, smallTableCount: 1, chairCount: 10, mineralWaterCount: 2, tableCount: 1, tentCount: 1 },
  event_addons: { fullBandAndLights: true, stage: true, ledWall: true, charges }, applied_discount: [],
}
const slip = (id, total) => ({ tab: { id, os_number: 1 }, lines: [], total, paid: false })
const slipsByBooking = { 'b-room': [slip('t1', 850)], 'b-venue': [slip('t2', 1200)] }
const food = { 'b-room': 850, 'b-venue': 1200 }
const rows = [room, venue]
let charged = 0, off = 0
for (const b of rows) {
  const { items } = bookingLines(b, { rooms, venues, bookingsList: rows, slipsByBooking, stays: billStays(b, rows, { rooms, venues, food }) })
  for (const i of items) i.band === 'discount' ? (off -= i.amount) : (charged += i.amount)
}
if (Math.round(off) !== Math.round(charged)) throw new Error('A bill line is out of reach of the discounts: the lines add up to ' + charged + ', the discount took off ' + off)
console.log('bill total ok (' + charged + ')'); process.exit(0)
`

const out = buildSync({
  stdin: { contents: entry, resolveDir: path.join(__dirname, '..'), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
// The database client is pulled in on the way and listens for the browser going offline; nothing here calls it.
const noop = () => {}
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval: noop, clearInterval: noop, setTimeout: noop, clearTimeout: noop, location: { href: '' } }
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
globalThis.document = { addEventListener: noop, removeEventListener: noop, visibilityState: 'visible' }
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop }
try { new Function('require', 'module', 'exports', 'process', out.outputFiles[0].text)(require, { exports: {} }, {}, process) } catch (e) { console.error(e.message); process.exit(1) }

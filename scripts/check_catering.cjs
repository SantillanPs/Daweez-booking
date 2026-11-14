// Self-check: node scripts/check_catering.cjs
// A bill's money fills its rooms and venues first, then its catering (Sebastian, 2026-11-14). A Gazebo
// day of ₱4,000 with ₱26,600 of catering, paid ₱10,000 in October and ₱20,600 in November: October is
// ₱4,000 Gazebo + ₱6,000 Catering, November is all Catering.
const path = require('path')
const { buildSync } = require('esbuild')

const entry = `
import { buildIncomeStatement } from './src/utils/incomeStatement'
const venues = [{ id: 'venue-gazebo', name: 'Gazebo' }]
const bookings = [{ id: 'b1', venue_id: 'venue-gazebo', status: 'confirmed', downpayment_paid: 30600, balance_due: 0,
  event_addons: { charges: [{ id: 'c1', name: 'Catering 380x70 Pax', amount: 26600, date: '2026-11-15' }] } }]
const pay = (day, amount) => ({ day, amount, paidAt: day + 'T10:00:00', bookingId: 'b1', slip: false })
const payments = [pay('2026-11-02', 20600), pay('2026-10-05', 10000)]
const line = (from, to, label) => buildIncomeStatement({ from, to, payments, bookings, venues, expenses: [], categories: [] }).income.find(l => l.label === label).amount
const got = [line('2026-10-01', '2026-10-31', 'Gazebo'), line('2026-10-01', '2026-10-31', 'Catering'), line('2026-11-01', '2026-11-30', 'Gazebo'), line('2026-11-01', '2026-11-30', 'Catering')]
if (got.join() !== '4000,6000,0,20600') throw new Error('Catering split wrong: ' + got.join())
console.log('catering ok'); process.exit(0)
`
const out = buildSync({
  stdin: { contents: entry, resolveDir: path.join(__dirname, '..'), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'error',
  define: { 'import.meta.env': '{}' },
})
const noop = () => {}
globalThis.window = { addEventListener: noop, removeEventListener: noop, setInterval: noop, clearInterval: noop, setTimeout: noop, clearTimeout: noop, location: { href: '' } }
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true })
globalThis.document = { addEventListener: noop, removeEventListener: noop, visibilityState: 'visible' }
globalThis.localStorage = { getItem: () => null, setItem: noop, removeItem: noop }
try { new Function('require', 'module', 'exports', 'process', out.outputFiles[0].text)(require, { exports: {} }, {}, process) } catch (e) { console.error(e.message); process.exit(1) }

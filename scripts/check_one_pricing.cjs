// Self-check: node scripts/check_one_pricing.cjs
// A saved booking is priced only through `priceBooking` (src/utils/pricing.ts), so a fix to how a
// room, venue, short stay or agency's stay is priced reaches every screen at once. Only these
// files may call `calculatePricing` itself, because they price a form that is not a booking yet.
const fs = require('fs'), path = require('path')
const allowed = new Set(['utils/pricing.ts', 'components/PublicReservePortal.tsx', 'components/walk-in/discountSplit.ts', 'hooks/useBookings.ts', 'components/calendar/LogOldBookingModal.tsx'])
const src = path.join(__dirname, '..', 'src'), bad = []
const walk = d => fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
  const p = path.join(d, e.name)
  if (e.isDirectory()) return walk(p)
  const rel = path.relative(src, p).split(path.sep).join('/')
  if (/\.tsx?$/.test(e.name) && !allowed.has(rel) && /calculatePricing\(/.test(fs.readFileSync(p, 'utf8'))) bad.push(rel)
})
walk(src)
if (bad.length) throw new Error('Price a saved booking with priceBooking, not calculatePricing: ' + bad.join(', '))
console.log('one pricing ok')

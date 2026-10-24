// Run: npx tsx src/utils/billNumber.check.ts
import { billNumber } from './billNumber'
const assert = { equal: (a: string, b: string) => { if (a !== b) throw new Error(a + ' ≠ ' + b) } }

const b = (n: string, at: string) => ({ invoice_number: n, created_at: at }) as never
const oct = new Date(2026, 9, 24, 10)
assert.equal(billNumber([], oct), '202610-1-1')
// Old numbers made this year count; one made in September counts for the year only.
assert.equal(billNumber([b('GRF-2026-09-0001', '2026-09-05T02:00:00Z'), b('GRF-2026-12-0001', '2026-10-02T02:00:00Z')], oct), '202610-3-2')
// A deleted booking: the highest number given wins over the count.
assert.equal(billNumber([b('202610-9-4', '2026-10-20T02:00:00Z')], oct), '202610-10-5')
// Last year's do not count.
assert.equal(billNumber([b('202512-50-7', '2025-12-30T02:00:00Z')], oct), '202610-1-1')
console.log('ok')

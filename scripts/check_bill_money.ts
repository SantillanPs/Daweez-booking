// Run: npx esbuild scripts/check_bill_money.ts --bundle --platform=node --banner:js='globalThis.window=globalThis;globalThis.addEventListener=()=>{};globalThis.localStorage={getItem:()=>null,setItem:()=>{}}' --define:import.meta.env='{"VITE_SUPABASE_URL":"http://x","VITE_SUPABASE_ANON_KEY":"x"}' --outfile=node_modules/.cache/c.js && node node_modules/.cache/c.js
// The bill's money lives on its first room (2026-11-07): payments whole, discounts off every stay.
import { settleBill, onLead } from '../src/utils/bookingBalance'
import { payOnBill } from '../src/utils/billPayment'
import { buildStatement } from '../src/utils/statement'
import type { Booking, PaymentRecord, Room } from '../src/types/booking'

const rooms = [1, 2, 3].map(n => ({ id: 'room-' + n, room_number: n, base_price: 1000 })) as Room[]
const o = { rooms, venues: [] }
const rec = (n: string, amount: number, share?: number) => ({ id: n, receipt_number: n, amount, share, method: 'Cash', paid_at: '2026-11-0' + n.length }) as PaymentRecord
const row = (n: number, paid: number, owed: number, recs: PaymentRecord[], disc?: Booking['applied_discount']) => ({
  id: 'b' + n, room_id: 'room-' + n, check_in: '2026-11-10', check_out: '2026-11-12', status: 'confirmed', guest_email: '',
  downpayment_paid: paid, balance_due: owed, payment_records: recs, applied_discount: disc, created_at: '2026-11-0' + n,
}) as unknown as Booking
const sum = (rs: Booking[], f: (b: Booking) => number) => rs.reduce((t, b) => t + f(b), 0)

// James Hermosada's shape: room 1 paid 2,500 alone, then rooms 2 and 3 joined. Each room costs 2,000.
const old = [row(1, 2500, 0, [rec('A', 2500)]), row(2, 300, 1700, [rec('BB', 600, 300)]), row(3, 300, 1700, [rec('BB', 600, 300)])]
const s = settleBill(old, o)
console.assert(s[0].downpayment_paid === 3100 && s[0].balance_due === 2900, 'lead holds the bill: ' + s[0].downpayment_paid + ' / ' + s[0].balance_due)
console.assert(s[1].balance_due === 0 && s[1].downpayment_paid === 0 && s[1].payment_records!.length === 0, 'others hold nothing')
console.assert(s[0].payment_records!.length === 2 && s[0].payment_records!.every(r => r.share === undefined), 'each receipt once, whole')
console.assert(s.every(b => b.payment_status === 'downpayment'), 'one status')

// A flat 2,500 off a bill of three 2,000 stays: more than the first room costs, still all of it.
const flat = settleBill([row(1, 0, 0, [], [{ type: 'flat', value: 2500 }]), row(2, 0, 0, []), row(3, 0, 0, [])], o)
console.assert(flat[0].balance_due === 3500, 'flat off the bill: ' + flat[0].balance_due)
// 10% of the whole bill; an old bill's slices of a flat amount are joined into one.
const pct = settleBill([row(1, 0, 0, [], [{ type: 'percent', value: 10 }]), row(2, 0, 0, []), row(3, 0, 0, [])], o)
console.assert(pct[0].balance_due === 5400, 'percent: ' + pct[0].balance_due)
const joined = onLead([row(1, 0, 0, [], [{ type: 'flat', value: 700 }]), row(2, 0, 0, [], [{ type: 'flat', value: 800 }])])
console.assert((joined[0].applied_discount as { value: number }[])[0].value === 1500, 'slices joined')

// A payment goes on the first room whole; the paper and the bill agree.
const paid = payOnBill(flat, { amount: 1000, method: 'Cash', paidAt: '2026-11-07', number: 'PR-1' })
console.assert(paid[0].balance_due === 2500 && paid[0].payment_records!.length === 1 && paid[1].payment_records!.length === 0, 'payment on the lead')
const st = buildStatement({ primaryBooking: paid[0], relatedBookings: paid, rooms, venues: [], bookingsList: paid })
console.assert(st.subTotal === 3500 && st.payments[0].amount === 1000 && st.subTotal - 1000 === sum(paid, b => Number(b.balance_due)), 'paper = bill: ' + st.subTotal)
const block = { ...old[0], status: 'blocked' } as Booking
console.assert(settleBill([block], o)[0] === block, 'a block is left alone')
console.log('ok')
process.exit(0) // the connection watcher's timer would keep node running

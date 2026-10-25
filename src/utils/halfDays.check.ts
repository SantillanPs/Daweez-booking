// Run: npx tsx src/utils/halfDays.check.ts — the same cases as `booking_halves` in the database.
import { bookingHalves, dayHalf } from './halfDays'
const eq = (a: number[], b: number[], what: string) => { if (a.join() !== b.join()) throw new Error(what + ': ' + a + ' ≠ ' + b) }
const d = dayHalf('2026-10-25')
const day = { check_in: '2026-10-25', check_out: '2026-10-26' }
eq(bookingHalves({ check_in: '2026-10-25', check_out: '2026-10-27' }), [d + 1, d + 5], 'two nights')
eq(bookingHalves({ ...day, stay_hours: 3, stay_half: 0 }), [d, d + 1], '3h morning')
eq(bookingHalves({ ...day, stay_hours: 12, stay_half: 0 }), [d, d + 2], '12h morning: all day')
eq(bookingHalves({ ...day, stay_hours: 12, stay_half: 1 }), [d + 1, d + 3], '12h afternoon: into the night')
eq(bookingHalves({ ...day, stay_hours: 12, stay_half: 0, actual_check_in: new Date(2026, 9, 25, 16).toISOString() }), [d, d + 3], '12h morning, in at 4 PM: the next morning too')
eq(bookingHalves({ ...day, stay_hours: 6, stay_half: 1, actual_check_in: new Date(2026, 9, 25, 14).toISOString() }), [d + 1, d + 2], '6h afternoon, on time')
eq(bookingHalves({ ...day, stay_hours: 6 }), [d + 1, d + 2], 'no half saved: the afternoon')
console.log('ok')

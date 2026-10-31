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
const three = { check_in: '2026-10-25', check_out: '2026-10-28' }
eq(bookingHalves({ ...three, actual_check_out: new Date(2026, 9, 27, 9).toISOString() }), [d + 1, d + 5], 'left a day early: to that morning')
eq(bookingHalves({ ...three, actual_check_out: new Date(2026, 9, 27, 15).toISOString() }), [d + 1, d + 5], 'left a day early, after noon: the same')
eq(bookingHalves({ ...three, actual_check_out: new Date(2026, 9, 25, 19).toISOString() }), [d + 1, d + 2], 'left the day they came: the arrival afternoon')
eq(bookingHalves({ ...three, actual_check_out: new Date(2026, 9, 28, 11).toISOString() }), [d + 1, d + 7], 'left on the day: as booked')
eq(bookingHalves({ ...three, actual_check_out: new Date(2026, 9, 29, 11).toISOString() }), [d + 1, d + 7], 'noted a day late: as booked')
console.log('ok')

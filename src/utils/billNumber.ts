import type { Booking } from '../types/booking'
import { dateToString } from './helpers'

/**
 * The next bill number: year and month it was booked, then how many bookings so far this
 * year and this month, counting this one — `202610-137-12` (Sebastian, 2026-10-24, note #12;
 * it was `GRF-2026-10-0137`, counted by the check-in month). Every numbered booking made in
 * the period counts, cancelled ones and the old-style numbers too. A count never falls
 * below the highest new-style number already given, so a deleted booking cannot hand out
 * a number twice.
 */
export function billNumber(bookings: Booking[], today = new Date()): string {
  const day = dateToString(today)
  const ym = day.slice(0, 4) + day.slice(5, 7)
  let year = 0, month = 0
  for (const b of bookings) {
    if (!b.invoice_number || !b.created_at) continue
    const made = dateToString(new Date(b.created_at))
    if (made.slice(0, 4) === day.slice(0, 4)) year++
    if (made.slice(0, 7) === day.slice(0, 7)) month++
    const m = /^(\d{4})(\d{2})-(\d+)-(\d+)$/.exec(b.invoice_number)
    if (m && m[1] === day.slice(0, 4)) year = Math.max(year, +m[3])
    if (m && m[1] + m[2] === ym) month = Math.max(month, +m[4])
  }
  return `${ym}-${year + 1}-${month + 1}`
}

import { Booking } from '../types/booking'

// ONE BOOKING, SEVERAL ROOMS.
//
// A booking of several rooms is one row per room, and each row has its own invoice
// number (the database requires them to be unique). What ties the rows together is
// `group_id` — the same value on every row made in one sitting. The bill, the edit form
// and the booking panel all ask this one function which rooms belong together, so a
// family's two rooms (or an agency's five) are one booking everywhere.

/**
 * Every room of the booking `booking` belongs to, itself included, in the order the
 * rooms were booked. A one-room booking is a list of one.
 *
 * The copy of `booking` that was handed in is the one returned for its own row — a
 * panel passes its freshest copy, and the list may be a moment behind it.
 */
export function groupOf(booking: Booking, list: Booking[]): Booking[] {
  const together = booking.group_id
    ? list.filter(b => b.group_id === booking.group_id && b.status !== 'cancelled')
    // Rows saved before the group mark existed could only ever be matched by a shared
    // invoice number; kept so nothing that worked before stops working.
    : booking.invoice_number
      ? list.filter(b => !b.group_id && b.invoice_number === booking.invoice_number)
      : []
  const rows = together.some(b => b.id === booking.id) ? together : [booking, ...together]
  return rows
    .map(b => (b.id === booking.id ? booking : b))
    .sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || '') || a.created_at.localeCompare(b.created_at))
}

/** True when the booking is one of several rooms booked together. */
export function isGrouped(booking: Booking, list: Booking[]): boolean {
  return groupOf(booking, list).length > 1
}

/**
 * **The booking as its bill sees its money** (Sebastian, 2026-10-20: *"if a group of
 * reservations share a single guest billing, then it should share amount due … every single
 * reservation in the calendar related to the guest billing should have"* the bill's figure).
 *
 * Each room still stores its own balance and its own share of every payment, which is what
 * the reports add up. What a pill, its hover card and the booking panel SHOW is the whole
 * bill's: what is owed and what was paid on every room of it. Only for showing — a booking
 * built here is never saved.
 */
export function asBill(booking: Booking, list: Booking[]): Booking {
  const rows = groupOf(booking, list)
  if (rows.length < 2) return booking
  const owed = rows.reduce((t, b) => t + Number(b.balance_due || 0), 0)
  const paid = rows.reduce((t, b) => t + Number(b.downpayment_paid || 0), 0)
  // One payment for several rooms sits on each of them: listed once.
  const records = rows.flatMap(b => b.payment_records || [])
    .filter((r, i, all) => !r.receipt_number || all.findIndex(x => x.receipt_number === r.receipt_number) === i)
  return { ...booking, balance_due: owed, downpayment_paid: paid, payment_status: owed <= 0 ? 'paid' : paid > 0 ? 'downpayment' : 'unpaid', payment_records: records }
}

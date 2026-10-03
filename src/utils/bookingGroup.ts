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

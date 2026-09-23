import { Booking, Room, Venue } from '../../types/booking'

/**
 * A guest who is in the hotel right now: checked in and not yet checked out.
 *
 * Food can only be charged after check-in (the owner's rule — people order when
 * they are here), so this is exactly the list the restaurant may charge to. In the
 * Restaurant screen this list IS the strip across the top, together with the
 * diners who have no room behind their tab.
 */
export function inHouseGuests(bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => !!b.actual_check_in && !b.actual_check_out)
    .sort((a, b) => (a.actual_check_in || '').localeCompare(b.actual_check_in || ''))
}

/** Where a guest is: "Room 3", or the venue they booked. */
export function guestPlace(b: Booking, rooms: Room[], venues: Venue[]): string {
  if (b.room_id) {
    const room = rooms.find(r => r.id === b.room_id)
    return room ? 'Room ' + room.room_number : 'Room'
  }
  return venues.find(v => v.id === b.venue_id)?.name || 'Venue'
}

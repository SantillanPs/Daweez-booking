import { Booking } from '../types/booking'
import { normalizeVenueId } from './helpers'

// 6. Availability Collision Vectors (Bilateral safety)
export function isRoomAvailable(roomId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  const checkIn = new Date(checkInStr)
  const checkOut = new Date(checkOutStr)
  if (checkIn >= checkOut) return false

  return !bookingsList.some(booking => {
    if (booking.room_id !== roomId) return false
    if (booking.id === skipBookingId) return false

    const bStart = new Date(booking.check_in)
    const bEnd = new Date(booking.check_out)
    return checkIn < bEnd && checkOut > bStart
  })
}

export function isVenueAvailable(venueId: string, eventDateStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  return !bookingsList.some(booking => {
    if (booking.venue_id !== venueId) return false
    if (booking.id === skipBookingId) return false
    return booking.check_in === eventDateStr
  })
}

export function isVenueRangeAvailable(venueId: string, checkInStr: string, checkOutStr: string, bookingsList: Booking[] = [], skipBookingId?: string): boolean {
  const checkIn = new Date(checkInStr)
  const checkOut = new Date(checkOutStr)
  if (checkIn >= checkOut) return false

  return !bookingsList.some(booking => {
    if (normalizeVenueId(booking.venue_id) !== normalizeVenueId(venueId)) return false
    if (booking.id === skipBookingId) return false

    const bStart = new Date(booking.check_in)
    const bEnd = new Date(booking.check_out)
    return checkIn < bEnd && checkOut > bStart
  })
}

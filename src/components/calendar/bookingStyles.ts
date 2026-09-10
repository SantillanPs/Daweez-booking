import { Booking, Room } from '../../types/booking'

// Show the real room name (e.g. "Full Double Deluxe") instead of a bare
// number, with "Room N" as the fallback when no name is set.
export const roomDisplayName = (room?: Room): string =>
  room ? (room.name || 'Room ' + room.room_number) : 'Room'

// For dropdowns where several rooms can share a name (e.g. three "Full
// Double" rooms), include the number so staff can tell them apart.
export const roomOptionLabel = (room: Room): string =>
  room.name ? 'Room ' + room.room_number + ' · ' + room.name : 'Room ' + room.room_number

// Source colors on the calendar grid. Soft pastel fills with dark readable
// text so bookings are easy to tell apart without shouting.
export const getBookingStyle = (b: Booking): string => {
  if (b.status === 'pending') return 'bg-amber-50 text-amber-800 border-amber-200 border-dashed'
  if (b.status === 'blocked') return 'bg-paper-200/60 text-muted border-paper-300 line-through'
  switch (b.source) {
    case 'airbnb':      return 'bg-emerald-50 text-emerald-800 border-emerald-200'
    case 'booking_com': return 'bg-sky-50 text-sky-800 border-sky-200'
    case 'facebook':    return 'bg-indigo-50 text-indigo-800 border-indigo-200'
    case 'google_maps': return 'bg-orange-50 text-orange-800 border-orange-200'
    case 'website':     return 'bg-violet-50 text-violet-800 border-violet-200'
    default:            return 'bg-gold-100 text-gold-800 border-gold-200' // manual / walk-in
  }
}

// Event venues use a warm gold tint so they read as "celebration space".
export const getVenueBookingStyle = (b: Booking): string => {
  if (b.status === 'pending') return 'bg-amber-50 text-amber-800 border-amber-200 border-dashed'
  if (b.status === 'blocked') return 'bg-paper-200/60 text-muted border-paper-300 line-through'
  return 'bg-gold-100 text-gold-700 border-gold-200'
}

// Small payment dot shown on every booking block.
export const getPaymentDotClass = (b: Booking): string => {
  const s = b.payment_status
  if (s === 'paid') return 'bg-emerald-500'
  if (s === 'downpayment') return 'bg-amber-400'
  return 'bg-danger-500'
}

// Plain-language payment label (no accounting jargon).
export const getPaymentLabel = (b: Booking): string => {
  const s = b.payment_status
  if (s === 'paid') return 'Paid'
  if (s === 'downpayment') return 'Deposit paid'
  return 'Owes'
}

export const SOURCE_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking_com: 'Booking.com',
  facebook: 'Facebook',
  google_maps: 'Google Maps',
  website: 'Website',
  manual: 'Walk-in'
}

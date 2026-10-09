import { Booking, Room } from '../../types/booking'
import { getPaymentView, hasPaymentRecorded, PaymentTone } from '../../utils/bookingMoney'

// Show the real room name (e.g. "Full Double Deluxe") instead of a bare
// number, with "Room N" as the fallback when no name is set.
export const roomDisplayName = (room?: Room): string =>
  room ? (room.name || 'Room ' + room.room_number) : 'Room'

// For dropdowns where several rooms can share a name (e.g. three "Full
// Double" rooms), include the number so staff can tell them apart.
export const roomOptionLabel = (room: Room): string =>
  room.name ? 'Room ' + room.room_number + ' · ' + room.name : 'Room ' + room.room_number

/** Where a stay stands: nobody has arrived, the guest is in the hotel, or they have left. */
export type BookingStage = 'booked' | 'in' | 'out'

export const bookingStage = (b: Booking): BookingStage =>
  b.actual_check_out ? 'out' : b.actual_check_in ? 'in' : 'booked'

// **The pill's colour is the stage** (the staff's feedback, 2026-10-04: they could not
// tell from the calendar which rooms were checked in and which had checked out). It used
// to be where the booking came from — nine colours for the one thing the desk never acts
// on — and the owner took that off while the booking sites are not in use.
//
// The house colours carry it, so red and green stay free to mean money and nothing else:
// white while nobody has arrived, gold while the guest is in the hotel, grey once they
// have left. A booking nobody had paid for used to wear a dashed edge as well; Sebastian had
// it taken off (2026-10-08) — the blue corner says that now, and nobody knew what the dashes meant.
export const getBookingStyle = (b: Booking): string => {
  if (b.status === 'blocked') return 'bg-paper-200/60 text-muted border-paper-300'
  const stage = bookingStage(b)
  if (stage === 'out') return 'bg-ink-100 text-ink-500 border-ink-200'
  // **A guest in the hotel is green** (Sebastian, 2026-10-09: *"when a guest checks in, the
  // pill should turn green"*; he picked the soft green of five). It was gold, the colour
  // of today's column and of every button, so it said nothing of its own.
  //
  // The pill itself stays white: its green is a wash laid inside it (`TimelineCell`), so
  // it can cross the pill from the left as the guest checks in and drain off as they leave.
  if (stage === 'in') return 'bg-card text-ink-900 border-emerald-600'
  return 'bg-card text-main border-paper-400'
}

/** The two letters a stay wears on its last morning, where half a day is too narrow for a
 *  name (the staff, 2026-10-08: they wanted to know who is leaving without opening it). */
export const pillInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return ((words[0]?.[0] || '') + (words[1]?.[0] || '')).toUpperCase()
}

/** What the desk still has to do with a stay today: check the guest in, or check them out.
 *  A day that has already passed still counts — the guest is late, not gone. A short stay
 *  leaves on the day it came. */
export const dueToday = (b: Booking, todayIso: string): 'in' | 'out' | null => {
  if (b.status === 'blocked' || b.actual_check_out) return null
  if (!b.actual_check_in) return b.check_in <= todayIso ? 'in' : null
  return (b.stay_hours ? b.check_in : b.check_out) <= todayIso ? 'out' : null
}

// The money on the pill, in words (the staff: they want to look at the calendar and know
// what every room still has to pay, before and after check-in, without opening it). The
// amount comes first so a narrow one-night pill cuts the word, never the figure.
//
// A reservation whose guest has not arrived is never in red: it is a promise, not a debt
// (the owner's ruling, 2026-09-28). Money an agency will send later is expected, not
// chased, so it is not red either — and it has no colour of its own (Sebastian, 2026-10-06).
//
// **A reservation made with No deposit says so and shows no amount** (Sebastian,
// 2026-10-06 — an agency booking made with No deposit included). Nothing is owed until the
// guest arrives, so there is no figure to show. An agency's stay nothing has been paid on
// says the same. For a few hours on 2026-10-08 the words were a blue corner instead;
// Sebastian had the words back the same day — the corner on a rounded pill looked like a
// skullcap — so `noDeposit` now only tells a half-day pill to turn its initials blue.
export const pillMoney = (b: Booking): { text: string; className: string; noDeposit?: boolean } => {
  const view = getPaymentView(b)
  const due = Number(b.balance_due || 0)
  const peso = '₱' + due.toLocaleString()
  if (view.tone === 'paid') return { text: 'Paid', className: PILL_MONEY.paid }
  if (view.tone === 'reserved') {
    if (!hasPaymentRecorded(b)) return { text: 'No deposit', className: PILL_NO_DEPOSIT, noDeposit: true }
    return { text: due > 0 ? peso + ' reserved' : 'Reserved', className: PILL_MONEY.reserved }
  }
  if (view.tone === 'billed') return hasPaymentRecorded(b)
    ? { text: peso + ' agency', className: PILL_MONEY.billed }
    : { text: 'No deposit', className: PILL_NO_DEPOSIT, noDeposit: true }
  return { text: due > 0 ? peso + ' to pay' : 'Not paid', className: PILL_MONEY.owes }
}

/** Blue is the colour of "no deposit" and of nothing else on the calendar — red is money owed,
 *  green is paid. */
const PILL_NO_DEPOSIT = 'text-blue-700'

const PILL_MONEY: Record<PaymentTone, string> = {
  paid: 'text-emerald-700',
  partial: 'text-danger-600',
  owes: 'text-danger-600',
  reserved: 'text-ink-600',
  billed: 'text-ink-700',
}

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
// have left. A walk-in nobody has paid for yet keeps its dashed edge.
export const getBookingStyle = (b: Booking): string => {
  if (b.status === 'blocked') return 'bg-paper-200/60 text-muted border-paper-300'
  const stage = bookingStage(b)
  if (stage === 'out') return 'bg-ink-100 text-ink-500 border-ink-200'
  if (stage === 'in') return 'bg-gold-100 text-ink-900 border-gold-500'
  if (b.status === 'pending') return 'bg-card text-main border-paper-400 border-dashed'
  return 'bg-card text-main border-paper-400'
}

/** The word on the pill for a guest who is in the hotel or has left. Nothing before arrival. */
export const stageTag = (b: Booking): string => {
  const stage = bookingStage(b)
  return stage === 'in' ? 'IN' : stage === 'out' ? 'OUT' : ''
}

/** The same, as a sentence, for the pill's tooltip. */
export const stageWords = (b: Booking): string => {
  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''
  if (b.actual_check_out) return 'Checked out ' + when(b.actual_check_out)
  if (b.actual_check_in) return 'Checked in ' + when(b.actual_check_in)
  return 'Not checked in'
}

// The money on the pill, in words (the staff: they want to look at the calendar and know
// what every room still has to pay, before and after check-in, without opening it). The
// amount comes first so a narrow one-night pill cuts the word, never the figure.
//
// A reservation whose guest has not arrived is never in red: it is a promise, not a debt
// (the owner's ruling, 2026-09-28). Money an agency will send later is expected, not
// chased, so it is not red either — and it has no colour of its own (Sebastian, 2026-10-06).
//
// **A reservation made with No deposit says exactly that, in blue, and no amount**:
// `Reserved · No Deposit` (Sebastian, 2026-10-06 — an agency booking made with No deposit
// included, since it is the same reservation). Nothing is owed until the guest arrives, so
// there is no figure to show. Once any money has been recorded against it, it is no longer
// one and keeps the old wording.
export const pillMoney = (b: Booking): { text: string; className: string } => {
  const view = getPaymentView(b)
  const due = Number(b.balance_due || 0)
  const peso = '₱' + due.toLocaleString()
  if (view.tone === 'paid') return { text: 'Paid', className: PILL_MONEY.paid }
  if (view.tone === 'reserved') {
    if (!hasPaymentRecorded(b)) return { text: 'Reserved · No Deposit', className: PILL_NO_DEPOSIT }
    return { text: due > 0 ? peso + ' reserved' : 'Reserved', className: PILL_MONEY.reserved }
  }
  if (view.tone === 'billed') return { text: peso + ' agency', className: PILL_MONEY.billed }
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

import { Booking, PartnerDeal, Room, Venue } from '../types/booking'
import { recomputeBalance } from './bookingBalance'
import { breakfastSellable } from './breakfast'

// MOVING A BOOKING to another room or other dates (Sebastian, 2026-10-06: an agency
// wanted to reschedule and change rooms, and the only way was to cancel the booking and
// type a new one — new invoice number, guest retyped, receipts left behind on the
// cancelled one). It is the same booking, in a new place.

/** Where the booking goes. A room stays a room and a venue stays a venue. */
export interface MoveTarget {
  unitId: string
  type: 'room' | 'venue'
  checkIn: string
  checkOut: string
}

/**
 * A booking can be moved until the guest has arrived. After that the stay is happening
 * (extend it, or check them out); a short stay takes a whole day and is rebooked, not
 * moved; a block has its own dates pane.
 */
export function canMoveBooking(b: Booking): boolean {
  return b.status !== 'blocked' && b.status !== 'cancelled' && !b.actual_check_in && !b.stay_hours
}

/**
 * The booking as it stands once it is in its new room and dates, priced by the one pricing
 * rule (`recomputeBalance`): the new bill + the food tab − the money already received.
 *
 * Everything else the booking collected — the guest, the agency, the payments and receipts,
 * the notes, the invoice number, the group mark — is carried over because the booking is the
 * same row.
 *
 * What does NOT follow it to a different room:
 *  - **the agency's rate**, which is the agency's own price *for that room*
 *    (`contracted_rates[room]`): the new room gets the agency's rate for it, or the room's
 *    ordinary price when the agency has none. A rate fixed onto a booking some other way is
 *    dropped as well — it was the old room's figure.
 *  - **breakfast**, when the new room has no breakfast price (a room that sells none).
 */
export function moveBooking(
  base: Booking,
  to: MoveTarget,
  opts: { rooms: Room[]; venues: Venue[]; deals: PartnerDeal[]; tabTotal?: number },
): Booking {
  const sameUnit = to.type === 'room' ? base.room_id === to.unitId : base.venue_id === to.unitId
  const moved: Booking = {
    ...base,
    room_id: to.type === 'room' ? to.unitId : undefined,
    venue_id: to.type === 'venue' ? to.unitId : undefined,
    check_in: to.checkIn,
    check_out: to.checkOut,
  }
  if (!sameUnit) {
    const deal = base.partner_deal_id ? opts.deals.find(d => d.id === base.partner_deal_id) : undefined
    moved.contract_rate_override = deal?.contracted_rates[to.unitId] || undefined
    if (to.type === 'room') {
      const room = opts.rooms.find(r => r.id === to.unitId)
      if (room && !breakfastSellable(room)) moved.breakfast_included = false
    }
  }
  return recomputeBalance(moved, { rooms: opts.rooms, venues: opts.venues, tabTotal: opts.tabTotal })
}

/**
 * What the moved stay comes to in all (the food tab included), for the line that tells the
 * desk a guest has already paid more than the new stay costs.
 */
export function stayTotalAfterMove(moved: Booking, opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number }): number {
  return Number(recomputeBalance({ ...moved, downpayment_paid: 0 }, opts).balance_due || 0)
}

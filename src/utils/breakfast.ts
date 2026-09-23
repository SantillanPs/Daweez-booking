import { Room } from '../types/booking'

/** The room's own breakfast price, typed by the desk in Settings (card k140). */
export function roomBreakfastPrice(room: Room): number {
  return Number(room.breakfast_price || 0)
}

/**
 * The one rule for "this room can sell breakfast": the desk has priced it.
 * A room with no price sells nothing, so the booking form does not let it be
 * ticked — a tappable chip that charged ₱0 only looked like it had worked.
 */
export function breakfastSellable(room: Room): boolean {
  return roomBreakfastPrice(room) > 0
}

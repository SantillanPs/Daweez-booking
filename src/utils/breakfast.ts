import { Room } from '../types/booking'
import { dateToString } from './helpers'

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

const dayAfter = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return dateToString(new Date(y, m - 1, d + 1)) }

/** Every morning of a stay: the day after check-in through the check-out day. */
export function stayMornings(checkIn: string, checkOut: string): string[] {
  const out: string[] = []
  for (let d = dayAfter(checkIn); d <= checkOut && out.length < 400; d = dayAfter(d)) out.push(d)
  return out
}

/**
 * The mornings a room's breakfast is billed for. The bill's breakfast dates can be changed
 * (Sebastian, 2026-10-29: "make the breakfast date editable"), and the mornings chosen are kept
 * in `bookings.breakfast_days`. Those outside the stay do not count; none chosen, or none left
 * after the stay moved, is every morning of the stay.
 */
export function breakfastMornings(checkIn: string, checkOut: string, days?: string[] | null): string[] {
  const all = stayMornings(checkIn, checkOut)
  const kept = days?.length ? all.filter(d => days.includes(d)) : []
  return kept.length > 0 ? kept : all
}

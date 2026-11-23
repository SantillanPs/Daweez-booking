import { Room } from '../types/booking'
import { addDays } from './helpers'

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

const dayAfter = (iso: string) => addDays(iso, 1)

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

/**
 * Mornings that skip a day, the way the bill writes them: `11/24, 26–27` (Sebastian, 2026-11-23:
 * "one day breakfast, then another day none"). '' when they run on without a gap, so the bill
 * keeps its first and last date.
 */
export function morningsWithGaps(days: string[]): string {
  const runs: string[][] = []
  ;[...new Set(days)].sort().forEach(d => {
    const last = runs[runs.length - 1]
    if (last && addDays(last[last.length - 1], 1) === d) last.push(d); else runs.push([d])
  })
  if (runs.length < 2) return ''
  let month = ''
  const day = (d: string) => {
    const m = d.slice(5, 7)
    if (m === month) return d.slice(8)
    month = m
    return m + '/' + d.slice(8)
  }
  return runs.map(r => r.length === 1 ? day(r[0]) : day(r[0]) + '–' + day(r[r.length - 1])).join(', ')
}

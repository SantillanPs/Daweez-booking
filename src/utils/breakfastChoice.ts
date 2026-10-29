import { Booking, BreakfastChoice } from '../types/booking'
import { breakfastMornings } from './breakfast'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// BREAKFAST, EVERY MORNING (the owner, 2026-10-04): a guest who booked breakfast is
// asked each morning what they want. This records the answer for the kitchen and for
// the record. It is not a charge — breakfast is charged once a night.

/** Breakfast is asked until 11 AM. After that an unasked morning counts as nothing for that
 *  day (Sebastian, 2026-10-20: it was still asking after 11). */
export const BREAKFAST_ASK_UNTIL = 11
export function breakfastAskOpen(now: Date = new Date()): boolean {
  return now.getHours() < BREAKFAST_ASK_UNTIL
}

/** Asking rooms about breakfast each morning is switched off for now (Sebastian, 2026-10-22).
 *  Breakfast on a booking is still added and charged; only the morning ask is gone — the cup
 *  on the calendar and the breakfast lines in the booking panel. Set to true to bring it back. */
export const BREAKFAST_ASK_ON = false

/** A guest the desk should ask today: in a room that has breakfast, with a night already
 *  slept there (arrived before today, leaving today or later) — read from the dates, since
 *  there is no check-in any more (Sebastian, 2026-10-20). */
export function wantsBreakfastToday(b: Booking, today: string): boolean {
  if (!BREAKFAST_ASK_ON) return false
  const inHotel = b.check_in < today && today <= b.check_out
  return !!b.room_id && b.breakfast_included === true && inHotel &&
    !b.stay_hours && b.status !== 'blocked' && b.status !== 'cancelled' &&
    // Only the mornings the bill charges for (2026-10-29).
    breakfastMornings(b.check_in, b.check_out, b.breakfast_days).includes(today)
}

/** What was written down for this booking on `date`, or undefined when nobody has asked yet. */
export function breakfastOn(b: Booking, date: string): BreakfastChoice | undefined {
  return (b.breakfast_choices || []).find(c => c.date === date)
}

/** `2 Bangsilog, 1 Hot Coffee` — or `Nothing today` when the guest skipped it. */
export function breakfastSummary(choice: BreakfastChoice): string {
  const items = choice.items.filter(i => i.qty > 0)
  if (items.length === 0) return 'Nothing today'
  return items.map(i => i.qty + ' ' + i.name).join(', ')
}

/** The booking's choices with `date` set to `items` (replacing that day's earlier answer). */
export function withBreakfastChoice(b: Booking, date: string, items: BreakfastChoice['items']): BreakfastChoice[] {
  const others = (b.breakfast_choices || []).filter(c => c.date !== date)
  // A new answer is a new order: it is stamped now and it is not ready, so the kitchen's
  // screen shows it (again, if the desk changed an answer the kitchen had already cooked).
  return [...others, { date, items: items.filter(i => i.qty > 0), sent_at: new Date().toISOString() }].sort((x, y) => x.date.localeCompare(y.date))
}

/** Saves the choices through their own small writer, so no other booking field is touched. */
export async function saveBreakfastChoices(bookingId: string, choices: BreakfastChoice[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so the breakfast choice was not saved.')
  const { error } = await supabase.rpc('set_booking_breakfast_choices', { p_booking_id: bookingId, p_choices: choices })
  if (error) throw error
}

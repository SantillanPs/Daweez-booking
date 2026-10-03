import { Booking, BreakfastChoice } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// BREAKFAST, EVERY MORNING (the owner, 2026-10-04): a guest who booked breakfast is
// asked each morning what they want. This records the answer for the kitchen and for
// the record. It is not a charge — breakfast is one price for the stay.

/** A guest the desk should ask today: in the hotel, in a room that has breakfast. */
export function wantsBreakfastToday(b: Booking): boolean {
  return !!b.room_id && b.breakfast_included === true && !!b.actual_check_in && !b.actual_check_out &&
    !b.stay_hours && b.status !== 'blocked' && b.status !== 'cancelled'
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
  return [...others, { date, items: items.filter(i => i.qty > 0) }].sort((x, y) => x.date.localeCompare(y.date))
}

/** Saves the choices through their own small writer, so no other booking field is touched. */
export async function saveBreakfastChoices(bookingId: string, choices: BreakfastChoice[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so the breakfast choice was not saved.')
  const { error } = await supabase.rpc('set_booking_breakfast_choices', { p_booking_id: bookingId, p_choices: choices })
  if (error) throw error
}

import { Booking, BreakfastChoice, BreakfastPlan } from '../types/booking'
import { breakfastMornings } from './breakfast'
import { dateToString } from './helpers'
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

/** A guest the desk should ask today: in a room that has breakfast, with a night already
 *  slept there (arrived before today, leaving today or later) — read from the dates, since
 *  there is no check-in any more (Sebastian, 2026-10-20). Off from 2026-10-22, back on 2026-10-31.
 *  A guest noted as gone is not asked: the early check-out came while the ask was off, and its
 *  room may already be sold to someone else. */
export function wantsBreakfastToday(b: Booking, today: string): boolean {
  if (b.actual_check_out && dateToString(new Date(b.actual_check_out)) <= today) return false
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
  // A new answer is a new order, once the guest has confirmed it: it is stamped now and it is not ready, so the kitchen's
  // screen shows it (again, if the desk changed an answer the kitchen had already cooked).
  return [...others, { date, items: items.filter(i => i.qty > 0), sent_at: new Date().toISOString() }].sort((x, y) => x.date.localeCompare(y.date))
}

/** The usual breakfast time: 8 AM. The first press of a time's stepper lands here. */
export const USUAL_BREAKFAST = 8 * 60

export const breakfastPlanOf = (b: Booking): BreakfastPlan | undefined => b.event_addons?.breakfast_plan

/** The guest said yes (or no) to this morning. **The kitchen does not cook until they have**
 *  (Sebastian, 2026-11-01: "they don't usually cook unless it's confirmed"). */
export const isConfirmed = (c?: BreakfastChoice): boolean => !!c?.sent_at

/** What a morning holds: its own answer, or else what the guest said for the stay. */
export function morningItems(b: Booking, date: string): BreakfastChoice['items'] {
  return breakfastOn(b, date)?.items ?? breakfastPlanOf(b)?.items ?? []
}

/** `choices` with these later mornings changed ahead of time and not confirmed: each is asked on its day. */
export function withLaterMornings(choices: BreakfastChoice[], dates: string[], items: BreakfastChoice['items']): BreakfastChoice[] {
  const others = choices.filter(c => !dates.includes(c.date))
  return [...others, ...dates.map(date => ({ date, items: items.filter(i => i.qty > 0) }))].sort((x, y) => x.date.localeCompare(y.date))
}

/** The row with the stay's breakfast time set. Its food stays as it is. */
export function withBreakfastTime(b: Booking, time: number): Booking {
  return { ...b, event_addons: { ...b.event_addons, breakfast_plan: { items: breakfastPlanOf(b)?.items || [], time } } }
}

/** Saves the choices through their own small writer, so no other booking field is touched. */
export async function saveBreakfastChoices(bookingId: string, choices: BreakfastChoice[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so the breakfast choice was not saved.')
  const { error } = await supabase.rpc('set_booking_breakfast_choices', { p_booking_id: bookingId, p_choices: choices })
  if (error) throw error
}

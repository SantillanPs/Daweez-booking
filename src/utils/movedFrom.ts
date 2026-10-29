import { Booking, MovedFrom } from '../types/booking'
import { supabase, isSupabaseConfigured } from './supabaseClient'
import { dateToString } from './helpers'

// RESCHEDULED (Sebastian, 2026-10-29: "I forgot to add 'rescheduled'" to Bills & receipts' Show
// menu). The bill overwrites a booking's dates, so a moved booking keeps the dates it was first
// booked for in `moved_from`. Only a new check-in day counts: a stay made longer or shorter is the
// same booking on the same day. A booking moved on the day it was made is still being written
// (the bill saves as the desk types), so that is a correction, not a reschedule. Moved back to the
// day it was booked for, it is not rescheduled any more.

/** What `moved_from` should be after `saved` is given these dates; undefined when it is not moved. */
export function movedFrom(saved: Booking, checkIn: string): MovedFrom | undefined {
  const first = saved.moved_from || { check_in: saved.check_in, check_out: saved.check_out }
  if (checkIn === first.check_in) return undefined
  if (saved.status === 'blocked' || saved.status === 'cancelled') return saved.moved_from
  if (!saved.moved_from && saved.created_at && dateToString(new Date(saved.created_at)) === dateToString(new Date())) return undefined
  if (checkIn === saved.check_in) return saved.moved_from
  return { check_in: first.check_in, check_out: first.check_out, at: new Date().toISOString() }
}

/** Saves the move after the bill's dates were saved; returns what the booking now holds. */
export async function noteMove(saved: Booking, checkIn: string): Promise<MovedFrom | undefined> {
  const next = movedFrom(saved, checkIn)
  if (JSON.stringify(next) === JSON.stringify(saved.moved_from) || !isSupabaseConfigured) return saved.moved_from
  const { error } = await supabase.rpc('set_booking_moved_from', { p_booking_id: saved.id, p_moved: next ?? null })
  // The dates are saved already; a lost note only leaves the booking out of "Rescheduled".
  if (error) { console.error('Could not note the reschedule:', error); return saved.moved_from }
  return next
}

import { supabase } from './supabaseClient'

/**
 * Asks the `sync-ical` edge function to read the booking sites' calendar links now, and
 * returns how many stays it added. The function does all the work (and runs by itself every
 * 15 minutes from the database); this is only the Sync button's and the 5-minute nudge.
 * The fake Airbnb and Booking.com feeds that used to live here were deleted on 2026-11-06.
 * A failure throws, so the button says "Sync failed" — it said "added 0 bookings" while the
 * connection band said there was no connection (2026-11-06).
 */
export async function runCalendarSync(): Promise<number> {
  const { data, error } = await supabase.functions.invoke('sync-ical')
  if (error) throw error
  return data?.syncedCount ?? 0
}

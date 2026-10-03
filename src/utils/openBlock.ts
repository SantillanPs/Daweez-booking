import { Booking } from '../types/booking'

// A BLOCK WITH NO END DATE (the owner, 2026-10-04): his family sometimes use a room for
// days or weeks and nobody knows when they will leave. The block is stored as an ordinary
// block whose check-out is this one far date, so the database's own no-double-booking
// rule keeps the room closed with nothing new to maintain. "They have left" ends it.

/** The check-out that means "no end date yet". */
export const OPEN_END = '2099-12-31'

/** A block that runs until somebody ends it. */
export function isOpenEnded(b: Pick<Booking, 'status' | 'check_out'>): boolean {
  return b.status === 'blocked' && b.check_out === OPEN_END
}

/** Why the dates are blocked — `Owner use — family`, `Cleaning` — as the desk chose it. */
export function blockReason(b: Pick<Booking, 'notes'>): string {
  return (b.notes || '').trim() || 'Blocked'
}

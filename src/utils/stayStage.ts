import { Booking } from '../types/booking'

/**
 * **Where a stay is, read from its dates** (Sebastian, 2026-10-20). The desk no longer checks
 * guests in or out: on paper they only ever wrote down the booking, the guest and the money
 * (*"we're forcing them to do something they never did"*), and the app must not change a
 * booking by itself either. So the stage is not stored — it is the booking's dates against
 * today: before its first day, during it (the arrival day counts as during), and after it (the
 * leaving day counts as after). A short stay is during on its one day.
 *
 * **A check-out the desk noted ends the stay at once** (Sebastian, 2026-10-25: "when a
 * reservation is checked out, it should immediately turn into a checked out state") — a
 * short stay, or a guest who left before their dates ran out, no longer reads as in the
 * hotel until the dates catch up. The dates themselves are not changed.
 */
export type StayStage = 'before' | 'during' | 'after'

export function stayStage(b: Pick<Booking, 'check_in' | 'check_out' | 'stay_hours'> & { actual_check_out?: string }, todayIso: string): StayStage {
  if (b.actual_check_out) return 'after'
  if (todayIso < b.check_in) return 'before'
  if (b.stay_hours ? todayIso > b.check_in : todayIso >= b.check_out) return 'after'
  return 'during'
}

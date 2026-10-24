// The short-stay clock — the ONE place that works out when a room sold for hours is
// free again.
//
// The owner's ruling (2026-09): **the clock starts when the desk presses Check in**, and
// the app never shows a countdown. It shows the TIME the room is free, and when that
// time arrives the booking's panel opens by itself so the desk can check the guest out.
//
// Kept in `utils/` rather than next to the paper because three screens need the same
// answer: the calendar block, the booking panel and the printed Guest Billing Statement.

/** The hours a room was sold for, or 0 for an ordinary overnight stay. */
export const stayHoursOf = (b: { stay_hours?: number }): number => Number(b.stay_hours || 0)

/**
 * When the bought hours run out: the recorded arrival plus those hours. `null` while the
 * guest has not been checked in — there is no clock yet, and guessing one from the
 * planned check-in time would put a time on the bill that nobody agreed to.
 */
export function shortStayEnd(actualCheckIn: string | undefined, hours: number): Date | null {
  if (!hours || !actualCheckIn) return null
  const end = new Date(actualCheckIn)
  if (isNaN(end.getTime())) return null
  end.setHours(end.getHours() + hours)
  return end
}

/** `1:12 PM` — the way the desk says it out loud. */
export const clockLabel = (d: Date) =>
  d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

/**
 * **When a short stay should leave** (the owner's note #7, 2026-10-24, the "Short Stay Out"
 * mock): the check-in the desk noted plus the hours bought plus any hour added since ("+1 hr"
 * on the time's-up alert writes `late_check_out_hours`). `null` until the check-in is noted.
 */
export const shortStayOut = (b: { actual_check_in?: string; stay_hours?: number; late_check_out_hours?: number }): Date | null =>
  shortStayEnd(b.actual_check_in, stayHoursOf(b) ? stayHoursOf(b) + Number(b.late_check_out_hours || 0) : 0)

/** A short stay whose time has run out and whose check-out is not noted yet. */
export const shortStayTimeUp = (b: { actual_check_in?: string; actual_check_out?: string; stay_hours?: number; late_check_out_hours?: number; status?: string }, now: number): boolean => {
  if (b.actual_check_out || b.status === 'cancelled' || b.status === 'blocked') return false
  const out = shortStayOut(b)
  return !!out && out.getTime() <= now
}

/** `3 hours from arrival` before the guest is in, `3 hours · ends 1:12 PM` after. `extra` is
 *  hours added since, which move the end and not the hours bought. */
export function shortStayLine(actualCheckIn: string | undefined, hours: number, extra = 0): string {
  const end = shortStayEnd(actualCheckIn, hours + extra)
  return hours + ' hour' + (hours === 1 ? '' : 's') + (end ? ' · ends ' + clockLabel(end) : ' from arrival')
}

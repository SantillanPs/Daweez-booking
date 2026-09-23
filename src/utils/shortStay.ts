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

/** `3 hours from arrival` before the guest is in, `3 hours · ends 1:12 PM` after. */
export function shortStayLine(actualCheckIn: string | undefined, hours: number): string {
  const end = shortStayEnd(actualCheckIn, hours)
  return hours + ' hour' + (hours === 1 ? '' : 's') + (end ? ' · ends ' + clockLabel(end) : ' from arrival')
}

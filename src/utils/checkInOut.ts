// Early check-in and late check-out hours. Since 2026-10-20 the desk says them (they are rare);
// they are no longer worked out from when the Check in / Check out button was pressed.

/**
 * The early check-in hours that are **chargeable right now** (card k154 follow-up).
 *
 * The hours are recorded the moment the guest arrives — that is what makes the arrival
 * time honest — but the desk collects them **at check-out**, which is the owner's rule:
 * *"just add it to their bill for when they checkout"*. Until the stay has actually
 * been checked out they are therefore left out of the balance and off the printed bill.
 *
 * Without this gate, checking a fully-paid guest in flipped the booking to *Partly
 * paid* on the spot (the owner pressed Check in at 1 AM = 13 hours early = one extra
 * night), and merely adding a plate of food mid-stay would have done the same thing
 * through the same recompute.
 */
export function chargeableEarlyHours(b: { early_check_in_hours?: number; actual_check_out?: string; stay_hours?: number }): number {
  // A SHORT STAY has no "early": a guest who takes a room for three hours at 10am
  // is not four hours early for a 2pm check-in, and charging them a whole night for
  // it would be nonsense.
  if (b.stay_hours) return 0
  return b.actual_check_out ? Number(b.early_check_in_hours || 0) : 0
}

/** A day's standard door time ('HH:MM') as a local Date. */
export const standardDoor = (date: string, time: string): Date => new Date(date + 'T' + time + ':00')

/**
 * The time a check-in or check-out is recorded at (Sebastian, 2026-10-20). The staff are
 * rarely at the desk — they are with the guests — and press the door when they get back,
 * so the moment of the press is not when it happened, and it must never charge anyone.
 * The desk says the early or late hours itself (`hours`, usually 0 — it rarely happens);
 * with none, the guest is taken to have come or gone on time.
 *
 * - Check-out on time: the standard time, or the press itself when that is earlier
 *   (a guest who left before noon left when the desk says).
 * - Check-in on time: the press — any time on or after the standard is on time.
 * - With hours: that many hours after (out) or before (in) the standard time.
 */
export function doorTime(kind: 'in' | 'out', standard: Date, hours: number, now = new Date()): string {
  const h = 3600000
  if (kind === 'out') return new Date(hours > 0 ? standard.getTime() + hours * h : Math.min(now.getTime(), standard.getTime())).toISOString()
  return new Date(hours > 0 ? standard.getTime() - hours * h : now.getTime()).toISOString()
}

/** How many hours late a check-out pressed now could be: none before the standard time. */
export const hoursPast = (standard: Date, now = new Date()): number =>
  Math.max(0, Math.ceil((now.getTime() - standard.getTime()) / 3600000))

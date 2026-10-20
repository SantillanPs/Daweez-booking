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

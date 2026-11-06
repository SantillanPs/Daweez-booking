// Whether the desk has a panel or a form open, which the calendar tells the update check
// (an update waits for it to close, `appUpdate.ts`).
// A plain module singleton, the same shape as `bookingFocus.ts`: no provider.

let busy = false

/** The calendar says whether the desk has a panel or a form open. */
export function setDeskBusy(now: boolean): void {
  busy = now
}

export function isDeskBusy(): boolean {
  return busy
}

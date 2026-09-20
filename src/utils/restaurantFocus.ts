// Which guest the Restaurant screen should open (k69).
//
// The till lives in the Restaurant screen — the owner did not want a menu board
// crammed into the narrow booking slide-over — so the booking's Guest tab hands
// staff over to the restaurant with the right guest ready. A plain module
// singleton, the same shape as toast.ts and confirm.ts: no provider, no prop
// drilled through three components.
let focusedBookingId: string | null = null

/** Remembers the guest whose tab should be waiting on the Restaurant screen. */
export function focusGuestTab(bookingId: string): void {
  focusedBookingId = bookingId
}

/** Reads it once, so the Restaurant screen only jumps when it was actually asked to. */
export function takeFocusedGuestTab(): string | null {
  const id = focusedBookingId
  focusedBookingId = null
  return id
}

// Which booking the calendar should open once the form is finished (card k134).
//
// The owner's flow ends with the guest holding a printed billing statement, and
// asks for the booking they just made to open itself in the quick view when that
// statement is closed — so nobody has to go hunting for it on the calendar. A
// plain module singleton, the same shape as `restaurantFocus.ts`: no provider and
// no prop drilled through the calendar, the form and the statement panel.
let focusedBookingId: string | null = null

/** Remembers the booking the desk will want next. */
export function focusBookingAfterCreate(bookingId?: string): void {
  focusedBookingId = bookingId || null
}

/** Reads it once, so the calendar only jumps when the form actually asked it to. */
export function takeFocusedBooking(): string | null {
  const id = focusedBookingId
  focusedBookingId = null
  return id
}

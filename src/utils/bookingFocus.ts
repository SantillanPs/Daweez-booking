// Which booking the calendar should open once the form is finished (card k134).
//
// After an edit, closing the printed statement opens the booking's quick view again,
// where the edit began. A NEW booking no longer does (Sebastian, 2026-10-17: the panel
// popping up after a reservation was made was in the way). A
// plain module singleton: no provider and no prop drilled through the calendar, the form
// and the statement panel.
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

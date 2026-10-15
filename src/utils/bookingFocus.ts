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

// Where on screen the desk picked the stay, so the booking form grows out of the pick
// (the booking moments mock, Sebastian, 2026-10-16). Read without clearing — React runs a
// state initialiser twice while developing — and only trusted for a moment, so a form opened
// later from somewhere else (the edit pencil) opens in the ordinary way.
type Rect = { x: number; y: number; w: number; h: number }
let formOrigin: { rect: Rect; at: number } | null = null

export function rememberFormOrigin(rect: Rect): void {
  formOrigin = { rect, at: Date.now() }
}

export function readFormOrigin(): Rect | null {
  return formOrigin && Date.now() - formOrigin.at < 2000 ? formOrigin.rect : null
}

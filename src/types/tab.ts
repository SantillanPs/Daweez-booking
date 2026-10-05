// A guest tab (board card k69): the running bill for a stay, or for a walk-in
// diner with no room. Food and bar lines live on the tab, never on the booking,
// so adding a charge never rewrites a booking row.
import { PaymentRecord } from './booking'

export type TabLineKind = 'charge' | 'correction'

// One line on a tab. A wrong line is simply deleted — the same rule the app
// already uses for a wrong payment, so removing it puts the bill back on its
// own. (`correction` and its two fields are kept only because the database
// columns exist; nothing in the app writes them any more.)
export interface TabLine {
  id: string
  tab_id: string
  description: string
  qty: number
  unit_price: number
  /** Signed: positive for a charge, negative for a correction. */
  amount: number
  kind: TabLineKind
  /**
   * The menu item this line came from, when it came off the menu card.
   *
   * **This is what lets a sale take stock off the shelf** (the owner's ruling, 2026-09-30, from the code trace):
   * the line used to keep only the dish's name and price, so nothing could point back at the dish — and a dish
   * is what points at the ingredients. Blank for a written line the menu does not carry, which correctly
   * deducts nothing.
   */
  menu_item_id?: string | null
  /** Set on a correction: the line it is fixing. */
  corrects_line_id?: string
  /** Set on a correction: why it was needed. */
  reason?: string
  /**
   * How many of this line the kitchen has been given. Anything above it is new, and goes
   * with the next "Send to kitchen" (the staff's feedback, 2026-10-04).
   *
   * The order reaches the kitchen on a screen, so a line counts four things in a row:
   * ordered (`qty`) → given to the kitchen (`sent_qty`) → cooked (`ready_qty`) → on the
   * table (`served_qty`). Each is never more than the one before it.
   */
  sent_qty?: number
  /** How many the kitchen has cooked. */
  ready_qty?: number
  /** How many have been carried to the guest. */
  served_qty?: number
  /** When the kitchen was given what it is still cooking — the kitchen's list is oldest first. */
  sent_at?: string | null
  created_by?: string
  created_at: string
}

// The staff call this an ORDER SLIP (their feedback, 2026-10-04): the paper an order is
// written on and handed to the kitchen. It is opened by the first order and stays open
// until it is paid; the next order after that starts a new slip, so a stay can hold
// several. It belongs to a booking when the guest is staying, and to a name/table when
// they are not — the restaurant is most of this trade.
export interface Tab {
  id: string
  /** The slip's number, given when its first order lands. Shown as `OS-0001`. */
  os_number?: number | null
  /** When the slip was paid — at the front desk: from the booking for a guest, from "Diners to pay" for a diner. */
  paid_at?: string | null
  /** The receipt that paid it. Taking that payment back makes the slip unpaid again. */
  paid_receipt_number?: string | null
  /**
   * When the bill was sent to the front desk (Sebastian, 2026-10-05). The slip is closed
   * to more orders from then on, and the front desk has it: a diner pays it there, a room
   * guest's goes on their room.
   */
  billed_at?: string | null
  /** The booking this tab belongs to, or absent for a walk-in diner. */
  booking_id?: string
  /** The walk-in's name, when there is no booking. */
  label?: string
  /** Optional table or seating, for the restaurant. */
  table_label?: string
  status: 'open' | 'closed'
  opened_at: string
  closed_at?: string
  opened_by?: string
  created_at: string
  /**
   * One numbered receipt per payment taken for this tab (k69, part C). A walk-in
   * diner has no booking, so the money has to live here — same shape as a
   * booking's `payment_records` so a receipt stays one kind of thing.
   */
  payment_records?: PaymentRecord[]
  /** Loaded alongside the tab when the caller wants the running list. */
  lines?: TabLine[]
}

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
  /** Set on a correction: the line it is fixing. */
  corrects_line_id?: string
  /** Set on a correction: why it was needed. */
  reason?: string
  created_by?: string
  created_at: string
}

// A tab is opened when the first food is ordered and closed when it is settled.
// It belongs to a booking when the guest is staying, and to a name/table when
// they are not — the restaurant is most of this trade.
export interface Tab {
  id: string
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

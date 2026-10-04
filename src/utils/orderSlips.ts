import { supabase, isSupabaseConfigured } from './supabaseClient'
import { Tab, TabLine } from '../types/tab'
import { Booking, Room, Venue } from '../types/booking'
import { tabTotal } from './tabs'
import { recomputeBalance } from './bookingBalance'
import { normalizeVenueId } from './helpers'

// A stay's order slips (the staff's feedback, 2026-10-04).
//
// The staff take an order on a paper ORDER SLIP and hand it to the kitchen, so that is
// what the app calls it. A slip stays open until it is paid; the next order after that
// starts a new slip with its own number. So a stay holds several slips, and the bill
// shows each one as its number, its total and whether it is paid — never the dishes.

const NO_DB = 'No database is connected, so this was not saved.'

/** One order slip as the bill and the booking panel show it. */
export interface OrderSlip {
  tab: Tab
  lines: TabLine[]
  total: number
  paid: boolean
}

/** `OS-0007` — or nothing for a slip that has no order on it yet. */
export function slipNumber(tab?: Pick<Tab, 'os_number'> | null): string {
  return tab?.os_number ? 'OS-' + String(tab.os_number).padStart(4, '0') : ''
}

/** How many of a line the kitchen has not been given yet. */
export function newCount(line: TabLine): number {
  return Math.max(0, Number(line.qty || 0) - Number(line.sent_qty || 0))
}

/** What the slips add to the bill, paid or not. */
export function slipsTotal(slips: OrderSlip[]): number {
  return Math.round(slips.reduce((sum, s) => sum + s.total, 0) * 100) / 100
}

export function unpaidSlips(slips: OrderSlip[]): OrderSlip[] {
  return slips.filter(s => !s.paid)
}

/**
 * Every slip of several bookings at once, oldest first, keyed by booking id.
 *
 * **Thrown on failure**, never answered with an empty list: the callers write the
 * total into a booking's balance, and an empty answer there would take the guest's
 * food off their bill. A slip nobody ordered on is left out — it has no number and
 * adds nothing.
 */
export async function getSlipsByBooking(bookingIds: string[]): Promise<Record<string, OrderSlip[]>> {
  const out: Record<string, OrderSlip[]> = {}
  if (bookingIds.length === 0 || !isSupabaseConfigured) return out

  const tabs = await supabase.from('tabs').select('*').in('booking_id', bookingIds).order('created_at', { ascending: true })
  if (tabs.error) throw tabs.error
  const found = (tabs.data || []) as Tab[]
  if (found.length === 0) return out

  const lines = await supabase.from('tab_lines').select('*').in('tab_id', found.map(t => t.id)).order('created_at', { ascending: true })
  if (lines.error) throw lines.error
  const allLines = (lines.data || []) as TabLine[]

  for (const tab of found) {
    const own = allLines.filter(l => l.tab_id === tab.id)
    if (own.length === 0 || !tab.booking_id) continue
    const list = out[tab.booking_id] || (out[tab.booking_id] = [])
    list.push({ tab, lines: own, total: tabTotal(own), paid: !!tab.paid_at })
  }
  return out
}

export async function getSlipsForBooking(bookingId: string): Promise<OrderSlip[]> {
  return (await getSlipsByBooking([bookingId]))[bookingId] || []
}

/** What a stay's food comes to across all its slips, read fresh. Thrown on failure. */
export async function readBookingFoodTotal(bookingId: string): Promise<number> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  return slipsTotal(await getSlipsForBooking(bookingId))
}

/**
 * Marks slips as paid, by the receipt that paid them, and closes any still open — so
 * the next order starts a new slip instead of joining food that is already paid for.
 */
export async function markSlipsPaid(tabIds: string[], receiptNumber?: string): Promise<void> {
  if (tabIds.length === 0) return
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const now = new Date().toISOString()

  const closed = await supabase.from('tabs').update({ status: 'closed', closed_at: now }).in('id', tabIds).eq('status', 'open')
  if (closed.error) throw closed.error
  const paid = await supabase.from('tabs').update({ paid_at: now, paid_receipt_number: receiptNumber || null }).in('id', tabIds)
  if (paid.error) throw paid.error
}

/** A payment was taken back: the slips it paid are unpaid again. They stay closed. */
export async function unpaySlipsOfReceipt(receiptNumber: string): Promise<void> {
  if (!receiptNumber || !isSupabaseConfigured) return
  const { error } = await supabase.from('tabs')
    .update({ paid_at: null, paid_receipt_number: null })
    .eq('paid_receipt_number', receiptNumber)
    .not('booking_id', 'is', null)
  if (error) throw error
}

/**
 * A stay with nothing left to pay has paid for its food.
 *
 * Called wherever slips are read, so a slip can never sit unpaid on a settled stay —
 * which is what the staff saw: a guest paid at the desk and the Restaurant screen went
 * on showing the same food. What is owed is worked out here from the slips just read,
 * never taken from the stored balance, which is a moment behind right after an order.
 *
 * Returns true when it marked something, so the caller reads the slips again.
 */
export async function settleSlipsOfPaidStay(
  booking: Booking,
  slips: OrderSlip[],
  opts: { rooms: Room[]; venues: Venue[] },
): Promise<boolean> {
  const open = unpaidSlips(slips)
  if (open.length === 0) return false
  if (booking.status === 'blocked' || booking.status === 'cancelled') return false
  // The page is still loading its rooms: nothing can be priced yet, so nothing is decided.
  const unitKnown = booking.room_id
    ? opts.rooms.some(r => r.id === booking.room_id)
    : opts.venues.some(v => v.id === normalizeVenueId(booking.venue_id))
  if (!unitKnown) return false

  const owed = Number(recomputeBalance(booking, { ...opts, tabTotal: slipsTotal(slips) }).balance_due || 0)
  if (owed > 0) return false
  const records = booking.payment_records || []
  await markSlipsPaid(open.map(s => s.tab.id), records[records.length - 1]?.receipt_number)
  return true
}

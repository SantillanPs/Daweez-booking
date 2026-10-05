import { supabase, isSupabaseConfigured } from './supabaseClient'
import { randomUUID } from './helpers'
import { Tab, TabLine } from '../types/tab'
import { PaymentRecord } from '../types/booking'
import { nextTabReceiptNumber } from './receiptNumber'

// Order slips — the tables are still named `tabs` and `tab_lines` (board card k69);
// what a stay's slips add up to, and paying them, is in `orderSlips.ts`.
// The database is the only home: the browser stores
// that used to mirror tabs and their lines (`l_etoile_tabs_db`,
// `l_etoile_tab_lines_db`) are gone (2026-09-28). A refused write — an order, a
// removed line, a settlement — now throws, so the till says so instead of
// showing food on a tab the database never received.

const NO_DB = 'No database is connected, so this was not saved.'

// Money is kept to whole centavos so a long tab never drifts.
function money(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export async function getTabs(): Promise<Tab[]> {
  if (!isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase.from('tabs').select('*').order('created_at', { ascending: false })
    if (error) throw error
    if (data) return data as Tab[]
  } catch (err) {
    console.error('Supabase getTabs Error:', err)
  }

  return []
}

/**
 * The guest's open order slip for a booking. A booking has at most one open slip.
 *
 * The database is asked for that one slip. This used to read every slip the hotel has
 * ever had and pick one out, which got slower with every slip written.
 */
export async function getOpenTabForBooking(bookingId: string): Promise<Tab | null> {
  if (!isSupabaseConfigured) return null

  try {
    const { data, error } = await supabase.from('tabs').select('*')
      .eq('booking_id', bookingId).eq('status', 'open').limit(1)
    if (error) throw error
    return (data?.[0] as Tab | undefined) || null
  } catch (err) {
    console.error('Supabase getOpenTabForBooking Error:', err)
    return null
  }
}

/**
 * Every open slip with its lines, a stay's and a diner's alike, in ONE read.
 *
 * The Restaurant screen lists everyone the desk may charge — the guests who are
 * in the hotel and the diners with no room behind them (the trade the owner said
 * is most of it); the diner slips are the ones with no `booking_id`. It used to read
 * every slip ever written and then make one more trip per open slip for its lines,
 * and it does this again after every change on any tablet.
 *
 * **Thrown on failure**, so the screen keeps what it had instead of emptying.
 */
export async function readOpenSlips(): Promise<{ tabs: Tab[]; lines: Record<string, TabLine[]> }> {
  if (!isSupabaseConfigured) return { tabs: [], lines: {} }

  const { data, error } = await supabase.from('tabs').select('*, tab_lines(*)')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'tab_lines', ascending: true })
  if (error) throw error
  return slipsApart(data)
}

// A slip read together with its lines, taken apart into the two the screens keep.
function slipsApart(data: unknown): { tabs: Tab[]; lines: Record<string, TabLine[]> } {
  const tabs: Tab[] = []
  const lines: Record<string, TabLine[]> = {}
  for (const row of (data || []) as (Tab & { tab_lines?: TabLine[] })[]) {
    const { tab_lines, ...tab } = row
    tabs.push(tab)
    lines[tab.id] = tab_lines || []
  }
  return { tabs, lines }
}

/**
 * The diners with no room who have not paid, for the front desk: the ones still at their
 * table, and the ones whose bill has been sent over — a billed slip is closed, so it is
 * found by its bill, not by being open. In one read. **Thrown on failure.**
 */
export async function readDinerSlips(): Promise<{ tabs: Tab[]; lines: Record<string, TabLine[]> }> {
  if (!isSupabaseConfigured) return { tabs: [], lines: {} }

  const { data, error } = await supabase.from('tabs').select('*, tab_lines(*)')
    .is('booking_id', null)
    .is('paid_at', null)
    .or('status.eq.open,billed_at.not.is.null')
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'tab_lines', ascending: true })
  if (error) throw error
  return slipsApart(data)
}

/**
 * Opens an order slip, or hands back the one already open for that booking.
 *
 * **A stay holds several slips, one open at a time** (the staff's feedback, 2026-10-04):
 * a slip stays open until it is paid, and the next order after that starts a new one
 * with its own number. A closed slip is never opened again — it used to be, which is
 * why food a guest had already paid for stayed on the Restaurant screen.
 */
export async function openTab(input: {
  bookingId?: string
  label?: string
  tableLabel?: string
  openedBy?: string
}): Promise<Tab> {
  if (input.bookingId) {
    const existing = await getOpenTabForBooking(input.bookingId)
    if (existing) return existing
  }
  const now = new Date().toISOString()
  const tab: Tab = {
    id: randomUUID(),
    booking_id: input.bookingId,
    label: input.label?.trim() || undefined,
    table_label: input.tableLabel?.trim() || undefined,
    status: 'open',
    opened_at: now,
    opened_by: input.openedBy?.trim() || undefined,
    created_at: now,
  }
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { data, error } = await supabase.from('tabs').insert(tab).select().single()
  if (error) throw error
  return data as Tab
}

export async function closeTab(tabId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const closed_at = new Date().toISOString()
  const { error } = await supabase.from('tabs').update({ status: 'closed', closed_at }).eq('id', tabId)
  if (error) throw error
}

/**
 * The bill goes to the front desk (Sebastian, 2026-10-05: "send bill to front desk maybe
 * after the guests finish eating or asks for a bill").
 *
 * It is how tills work wherever guests pay at a cashier: the bill being asked for is a
 * step of its own. The slip is stamped, closed to more orders and off the Restaurant
 * screen, and the front desk has it — under "Diners to pay" for a diner, on the room's
 * bill for a guest, whose next order starts a new slip. The kitchen still cooks anything
 * it was given: its list does not look at whether a slip is open.
 */
export async function billOutTab(tabId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const now = new Date().toISOString()
  const { error } = await supabase.from('tabs')
    .update({ status: 'closed', closed_at: now, billed_at: now })
    .eq('id', tabId).eq('status', 'open')
  if (error) throw error
}

/**
 * A table's bill goes onto a room (Sebastian, 2026-10-05: "not all guests want their bills
 * added to the rooms"). A guest with a room sits at a table like anybody else, so a table
 * is not tied to a room while the order is taken; the room is given here, when the bill
 * comes and the guest asks for it. The slip is closed and joins that stay's slips, to be
 * paid at the front desk any time before check-out.
 */
export async function billToRoom(tabId: string, bookingId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const now = new Date().toISOString()
  const { error } = await supabase.from('tabs')
    .update({ booking_id: bookingId, status: 'closed', closed_at: now, billed_at: now })
    .eq('id', tabId).eq('status', 'open')
  if (error) throw error
}

/** A bill sent by mistake: the slip goes back to the restaurant, open for more orders. Never a paid one. */
export async function sendBackTab(tabId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { error } = await supabase.from('tabs')
    .update({ status: 'open', closed_at: null, billed_at: null })
    .eq('id', tabId).is('paid_at', null)
  if (error) throw error
}

// ── Lines ────────────────────────────────────────────────────────────────────

// A line is put on a slip, counted up or down, and taken off again by the database
// function `apply_order_changes` — see `orderChanges.ts`. The tablet used to do each
// step itself, one trip at a time.

/**
 * Every line on every tab, read once (k69, part E).
 *
 * The Earnings Report needs the food money for a period across the whole hotel —
 * the stay tabs and the walk-in tabs together — and reading them tab by tab would
 * be one query per table on every filter change.
 */
export async function getAllTabLines(): Promise<TabLine[]> {
  if (!isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase.from('tab_lines').select('*').order('created_at', { ascending: true })
    if (error) throw error
    if (data) return data as TabLine[]
  } catch (err) {
    console.error('Supabase getAllTabLines Error:', err)
  }

  return []
}

/**
 * "Send to kitchen" was tapped: everything on these lines has now been given to it, and
 * shows on the kitchen's screen.
 *
 * One trip for the whole slip, as the lines stood when it was tapped — a dish another
 * tablet added a moment later stays new.
 */
export async function markLinesSent(lines: TabLine[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const fresh = lines.filter(l => Number(l.sent_qty || 0) < Number(l.qty || 0))
  if (fresh.length === 0) return
  const { error } = await supabase.rpc('mark_order_lines_sent', {
    p_lines: fresh.map(l => ({ id: l.id, qty: Number(l.qty || 0) })),
  })
  if (error) throw error
}

/**
 * The cook has cooked these: each line's cooked count becomes `qty`. It can be lowered
 * again, which is how a wrong tap on the kitchen's screen is put back — but never below
 * what has already been served, and never above what the kitchen was given.
 */
export async function markLinesReady(lines: { id: string; qty: number }[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  if (lines.length === 0) return
  const { error } = await supabase.rpc('mark_order_lines_ready', { p_lines: lines })
  if (error) throw error
}

/** The cooked food on these lines has been carried to the guest. */
export async function markLinesServed(lines: TabLine[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const waiting = lines.filter(l => Number(l.served_qty || 0) < Number(l.ready_qty || 0))
  if (waiting.length === 0) return
  const { error } = await supabase.rpc('mark_order_lines_served', {
    p_lines: waiting.map(l => ({ id: l.id, qty: Number(l.ready_qty || 0) })),
  })
  if (error) throw error
}

// ── Money ────────────────────────────────────────────────────────────────────

/** What the tab adds to the guest's bill, summed across its lines. */
export function tabTotal(lines: TabLine[]): number {
  return money(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
}

// ── Settling a tab (k69, part C) ─────────────────────────────────────────────

/**
 * A tab's total, read fresh and **thrown on failure** — for the one caller that
 * writes the figure into a booking's balance. `getTabLines` answers `[]` when the
 * read fails, and an empty answer there would take the guest's food off their bill.
 */
export async function readTabTotal(tabId: string): Promise<number> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const { data, error } = await supabase.from('tab_lines').select('amount').eq('tab_id', tabId)
  if (error) throw error
  return money((data || []).reduce((sum, l) => sum + Number(l.amount || 0), 0))
}

/**
 * Every receipt number already handed out — on every tab AND every booking, because
 * both print `PR-YYYYMM-NNN`. Settling used to look only at the tab being settled,
 * and a fresh tab has no payments, so every walk-in came out as `…-001`. Read
 * straight from the database and thrown on failure: a number guessed from an empty
 * list is exactly the duplicate this exists to stop. `payment_records` is JSON
 * `null` on most rows.
 */
async function usedReceiptNumbers(): Promise<string[]> {
  const [tabs, bookings] = await Promise.all([
    supabase.from('tabs').select('payment_records'),
    supabase.from('bookings').select('payment_records'),
  ])
  if (tabs.error) throw tabs.error
  if (bookings.error) throw bookings.error
  return [...(tabs.data || []), ...(bookings.data || [])]
    .flatMap(row => (row.payment_records as PaymentRecord[] | null) || [])
    .map(r => r.receipt_number || '')
}

/**
 * Takes the money for a tab and closes it: one numbered receipt, and the tab
 * leaves the open list. A walk-in settles what they ran up, so the amount is the
 * tab's own total, never typed.
 *
 * The receipt number comes from `nextTabReceiptNumber` — a diner with no booking
 * has no check-in month to borrow.
 */
export async function settleTab(input: {
  tab: Tab
  amount: number
  method: string
  reference?: string
  preparedBy?: string
}): Promise<PaymentRecord> {
  if (!isSupabaseConfigured) {
    throw new Error('No database is connected, so this tab was not settled.')
  }
  const record: PaymentRecord = {
    id: randomUUID(),
    amount: money(input.amount),
    method: input.method,
    reference: input.reference?.trim() || undefined,
    paid_at: new Date().toISOString(),
    prepared_by: input.preparedBy?.trim() || undefined,
    receipt_number: nextTabReceiptNumber(await usedReceiptNumbers()),
  }
  const records = [...(input.tab.payment_records || []), record]
  const closed_at = new Date().toISOString()

  const { error } = await supabase
    .from('tabs')
    .update({
      payment_records: records, status: 'closed', closed_at,
      paid_at: record.paid_at, paid_receipt_number: record.receipt_number,
    })
    .eq('id', input.tab.id)
  if (error) throw error
  return record
}

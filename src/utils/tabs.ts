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

/** The guest's open order slip for a booking. A booking has at most one open slip. */
export async function getOpenTabForBooking(bookingId: string): Promise<Tab | null> {
  const tabs = await getTabs()
  return tabs.find(t => t.booking_id === bookingId && t.status === 'open') || null
}

/**
 * Every open slip, a stay's and a diner's alike, in one read.
 *
 * The Restaurant screen lists everyone the desk may charge — the guests who are
 * in the hotel and the diners with no room behind them (the trade the owner said
 * is most of it), so it needs both kinds at once instead of one query per guest;
 * the diner slips are the ones with no `booking_id`.
 */
export async function getOpenTabs(): Promise<Tab[]> {
  const tabs = await getTabs()
  return tabs.filter(t => t.status === 'open')
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

// ── Lines ────────────────────────────────────────────────────────────────────

export async function getTabLines(tabId: string): Promise<TabLine[]> {
  if (!isSupabaseConfigured) return []

  try {
    const { data, error } = await supabase.from('tab_lines').select('*').eq('tab_id', tabId).order('created_at', { ascending: true })
    if (error) throw error
    if (data) return data as TabLine[]
  } catch (err) {
    console.error('Supabase getTabLines Error:', err)
  }

  return []
}

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

async function insertLine(line: TabLine): Promise<TabLine> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { data, error } = await supabase.from('tab_lines').insert(line).select().single()
  if (error) throw error
  return data as TabLine
}

/** Adds a charge. `amount` is worked out here so every caller agrees on it. */
export async function addTabLine(input: {
  tabId: string
  description: string
  qty?: number
  unitPrice: number
  createdBy?: string
  /** The menu item behind the line, so a sale can take its stock (k71). Blank for a written line. */
  menuItemId?: string
}): Promise<TabLine> {
  const qty = input.qty && input.qty > 0 ? input.qty : 1
  return insertLine({
    id: randomUUID(),
    tab_id: input.tabId,
    description: input.description.trim(),
    qty,
    unit_price: money(input.unitPrice),
    amount: money(qty * input.unitPrice),
    kind: 'charge',
    menu_item_id: input.menuItemId || null,
    created_by: input.createdBy?.trim() || undefined,
    created_at: new Date().toISOString(),
  })
}

/**
 * Changes how many of a line there are — `2 ×` on one row instead of a second row (the
 * staff's feedback, 2026-10-04). The amount is worked out here, and the count the kitchen
 * has already been given never stays above what is left on the slip.
 */
export async function setTabLineQty(line: TabLine, qty: number): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const { error } = await supabase.from('tab_lines')
    .update({
      qty,
      amount: money(qty * Number(line.unit_price || 0)),
      sent_qty: Math.min(Number(line.sent_qty || 0), qty),
    })
    .eq('id', line.id)
  if (error) throw error
}

/** The kitchen's copy was printed: everything on these lines has now been given to it. */
export async function markLinesSent(lines: TabLine[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  for (const line of lines) {
    if (Number(line.sent_qty || 0) >= Number(line.qty || 0)) continue
    const { error } = await supabase.from('tab_lines').update({ sent_qty: line.qty }).eq('id', line.id)
    if (error) throw error
  }
}

/**
 * Removes a line the guest never ordered.
 *
 * The owner changed the rule here: a mistake is now simply deleted, exactly the
 * way a wrong payment is removed, rather than answered with a correction line.
 * The caller recomputes the bill afterwards.
 */
export async function deleteTabLine(lineId: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this line was not removed.')

  const { error } = await supabase.from('tab_lines').delete().eq('id', lineId)
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

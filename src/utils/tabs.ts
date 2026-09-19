import { supabase, isSupabaseConfigured } from './supabaseClient'
import { randomUUID } from './helpers'
import { Tab, TabLine } from '../types/tab'
import { PaymentRecord } from '../types/booking'
import { nextTabReceiptNumber } from './receiptNumber'

// Guest tabs (board card k69). Supabase is primary; the browser store is the
// offline fallback, the same way bookings, inventory and cleaning work.
const TABS_KEY = 'l_etoile_tabs_db'
const LINES_KEY = 'l_etoile_tab_lines_db'

function readLocal<T>(key: string): T[] {
  const raw = localStorage.getItem(key)
  if (!raw) return []
  try { return JSON.parse(raw) as T[] } catch { return [] }
}

function writeLocal<T>(key: string, rows: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(rows))
  } catch (err) {
    // The browser store is only an offline cache, and it can be full or blocked.
    // A failure here must never break a save that already reached the database.
    console.error('Could not write the tab cache:', err)
  }
}

// Money is kept to whole centavos so a long tab never drifts.
function money(value: number): number {
  return Math.round(Number(value || 0) * 100) / 100
}

// ── Tabs ─────────────────────────────────────────────────────────────────────

export async function getTabs(): Promise<Tab[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('tabs').select('*').order('created_at', { ascending: false })
      if (error) throw error
      if (data) return data as Tab[]
    } catch (err) {
      console.error('getTabs fell back to the browser store:', err)
    }
  }
  return readLocal<Tab>(TABS_KEY)
}

/** The guest's own tab for a booking. A booking has at most one open tab. */
export async function getOpenTabForBooking(bookingId: string): Promise<Tab | null> {
  const tabs = await getTabs()
  return tabs.find(t => t.booking_id === bookingId && t.status === 'open') || null
}

/**
 * Tabs with no booking behind them — the restaurant's walk-in diners. These are
 * the ones the owner said are most of the trade, so they are a first-class thing
 * rather than a fallback.
 */
export async function getOpenWalkInTabs(): Promise<Tab[]> {
  const tabs = await getTabs()
  return tabs.filter(t => !t.booking_id && t.status === 'open')
}

/**
 * The open tab's lines for several bookings at once, keyed by booking id.
 *
 * A printed bill covers a booking plus any other booking sharing its invoice
 * number, and each of those can carry its own food tab — so the statement needs
 * them all. This reads the tabs table once, not once per booking.
 */
export async function getOpenTabLinesByBooking(bookingIds: string[]): Promise<Record<string, TabLine[]>> {
  const out: Record<string, TabLine[]> = {}
  if (bookingIds.length === 0) return out
  const tabs = await getTabs()
  for (const id of bookingIds) {
    const open = tabs.find(t => t.booking_id === id && t.status === 'open')
    if (open) out[id] = await getTabLines(open.id)
  }
  return out
}

/**
 * Opens a tab, or hands back the one already open for that booking so the same
 * stay never collects two tabs.
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
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('tabs').insert(tab).select().single()
      if (error) throw error
      if (data) return data as Tab
    } catch (err) {
      console.error('openTab fell back to the browser store:', err)
    }
  }
  writeLocal(TABS_KEY, [tab, ...readLocal<Tab>(TABS_KEY)])
  return tab
}

export async function closeTab(tabId: string): Promise<void> {
  const closed_at = new Date().toISOString()
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('tabs').update({ status: 'closed', closed_at }).eq('id', tabId)
      if (error) throw error
      return
    } catch (err) {
      console.error('closeTab fell back to the browser store:', err)
    }
  }
  writeLocal(TABS_KEY, readLocal<Tab>(TABS_KEY).map(t => t.id === tabId ? { ...t, status: 'closed', closed_at } : t))
}

// ── Lines ────────────────────────────────────────────────────────────────────

export async function getTabLines(tabId: string): Promise<TabLine[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('tab_lines').select('*').eq('tab_id', tabId).order('created_at', { ascending: true })
      if (error) throw error
      if (data) return data as TabLine[]
    } catch (err) {
      console.error('getTabLines fell back to the browser store:', err)
    }
  }
  return readLocal<TabLine>(LINES_KEY).filter(l => l.tab_id === tabId)
}

async function insertLine(line: TabLine): Promise<TabLine> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('tab_lines').insert(line).select().single()
      if (error) throw error
      if (data) return data as TabLine
    } catch (err) {
      console.error('addTabLine fell back to the browser store:', err)
    }
  }
  writeLocal(LINES_KEY, [...readLocal<TabLine>(LINES_KEY), line])
  return line
}

/** Adds a charge. `amount` is worked out here so every caller agrees on it. */
export async function addTabLine(input: {
  tabId: string
  description: string
  qty?: number
  unitPrice: number
  createdBy?: string
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
    created_by: input.createdBy?.trim() || undefined,
    created_at: new Date().toISOString(),
  })
}

/**
 * Removes a line the guest never ordered.
 *
 * The owner changed the rule here: a mistake is now simply deleted, exactly the
 * way a wrong payment is removed, rather than answered with a correction line.
 * The caller recomputes the bill afterwards.
 */
export async function deleteTabLine(lineId: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('tab_lines').delete().eq('id', lineId)
      if (error) throw error
      return
    } catch (err) {
      console.error('deleteTabLine fell back to the browser store:', err)
    }
  }
  writeLocal(LINES_KEY, readLocal<TabLine>(LINES_KEY).filter(l => l.id !== lineId))
}

// ── Money ────────────────────────────────────────────────────────────────────

/** What the tab adds to the guest's bill, summed across its lines. */
export function tabTotal(lines: TabLine[]): number {
  return money(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0))
}

// ── Settling a tab (k69, part C) ─────────────────────────────────────────────

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
  const record: PaymentRecord = {
    id: randomUUID(),
    amount: money(input.amount),
    method: input.method,
    reference: input.reference?.trim() || undefined,
    paid_at: new Date().toISOString(),
    prepared_by: input.preparedBy?.trim() || undefined,
    receipt_number: nextTabReceiptNumber(
      (input.tab.payment_records || []).map(r => r.receipt_number || ''),
    ),
  }
  const records = [...(input.tab.payment_records || []), record]
  const closed_at = new Date().toISOString()

  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase
        .from('tabs')
        .update({ payment_records: records, status: 'closed', closed_at })
        .eq('id', input.tab.id)
      if (error) throw error
      return record
    } catch (err) {
      console.error('settleTab fell back to the browser store:', err)
    }
  }
  writeLocal(TABS_KEY, readLocal<Tab>(TABS_KEY).map(t =>
    t.id === input.tab.id ? { ...t, payment_records: records, status: 'closed', closed_at } : t,
  ))
  return record
}

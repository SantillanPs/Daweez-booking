import { supabase, isSupabaseConfigured } from './supabaseClient'
import { Tab, TabLine } from '../types/tab'

// An order reaches the database in one trip (the developer's report, 2026-10-04:
// "every time I add an order it has to load and wait for the server before I can add
// another"). One tap used to be about seventeen trips with the menu locked until the
// last came back.
//
// A tap is now a CHANGE: the slip on screen shows it at once (`withChanges`), and the
// changes made close together are handed to the database together (`saveOrderChanges`),
// where one function opens the slip, writes the rows and moves the stock.

const NO_DB = 'No database is connected, so this was not saved.'

// Money is kept to whole centavos so a long slip never drifts.
const money = (value: number) => Math.round(Number(value || 0) * 100) / 100

/** One change to an order slip: more or fewer of a row, or the row taken off. */
export interface OrderChange {
  /** The row it is for. A row not on the slip yet gets its id here, on the tablet. */
  lineId: string
  /** The dish behind the row, so the sale can take its stock. Blank for a written row. */
  menuItemId?: string | null
  description: string
  unitPrice: number
  /** How many more, or fewer. */
  delta: number
  /** The whole row comes off, whatever its count. */
  remove?: boolean
  /** When it was tapped: a row not saved yet is listed where it was tapped. */
  at: string
}

/** The slip as the database left it after a save. */
export interface SavedSlip {
  tab: Tab
  lines: TabLine[]
  /** The order is on the slip, but its stock did not come off the shelf. */
  stockProblem: boolean
}

// The row a change is for: by its own id, then by its dish — another tablet may have put
// the same dish on the slip a moment ago. A changed price is a different row.
function rowOf(lines: TabLine[], change: OrderChange): number {
  const byId = lines.findIndex(l => l.id === change.lineId)
  if (byId >= 0 || !change.menuItemId) return byId
  return lines.findIndex(l =>
    l.kind === 'charge' && l.menu_item_id === change.menuItemId && Number(l.unit_price) === Number(change.unitPrice))
}

/**
 * The slip with changes laid over it — what the desk sees while a save is on its way.
 *
 * **This is the same rule the database function applies** (`apply_order_changes`): the
 * same dish is one row with a count, a row taken down to nothing is gone, and what the
 * kitchen was given, has cooked and what was served never stay above what is left.
 */
export function withChanges(lines: TabLine[], changes: OrderChange[], tabId = ''): TabLine[] {
  if (changes.length === 0) return lines
  const out = [...lines]
  for (const change of changes) {
    const at = rowOf(out, change)
    if (at < 0) {
      if (change.remove || change.delta <= 0) continue
      out.push({
        id: change.lineId,
        tab_id: tabId,
        description: change.description,
        qty: change.delta,
        unit_price: money(change.unitPrice),
        amount: money(change.delta * change.unitPrice),
        kind: 'charge',
        menu_item_id: change.menuItemId || null,
        sent_qty: 0,
        created_at: change.at,
      })
      continue
    }
    const row = out[at]
    const qty = Number(row.qty || 0) + change.delta
    if (change.remove || qty <= 0) { out.splice(at, 1); continue }
    out[at] = {
      ...row, qty, amount: money(qty * Number(row.unit_price || 0)),
      sent_qty: Math.min(Number(row.sent_qty || 0), qty),
      ready_qty: Math.min(Number(row.ready_qty || 0), qty),
      served_qty: Math.min(Number(row.served_qty || 0), qty),
    }
  }
  return out
}

/**
 * Taps made close together, added up: five taps on one dish go as one change of five.
 *
 * A dish tapped and taken off again before it was ever saved is no change at all — sent
 * as "remove", it could take the same dish off the slip that another tablet had put there.
 */
export function squash(changes: OrderChange[], saved: TabLine[]): OrderChange[] {
  const rows = new Map<string, OrderChange>()
  const madeHere = new Set<string>()
  for (const change of changes) {
    const row = rows.get(change.lineId)
    if (!row) {
      rows.set(change.lineId, { ...change })
      if (!change.remove && change.delta > 0 && !saved.some(l => l.id === change.lineId)) madeHere.add(change.lineId)
      continue
    }
    row.delta += change.delta
    row.remove = row.remove || change.remove
  }
  return [...rows.values()].filter(c => (c.remove ? !madeHere.has(c.lineId) : c.delta !== 0))
}

/**
 * Hands the changes to one order slip over in a single trip.
 *
 * A stay's slip is opened by its first order, so `tabId` may be an id the tablet has just
 * made for a slip that is not there yet; the answer carries the slip that was really
 * written to. Thrown on failure, so the till says so.
 */
export async function saveOrderChanges(input: {
  tabId: string
  changes: OrderChange[]
  /** The stay the slip belongs to, when the guest has a room. */
  bookingId?: string
  /** The name on a slip this order opens. */
  label?: string
  /** Whoever is at the till. Written on the stock movement, so the log says who sold it. */
  movedBy?: string
}): Promise<SavedSlip> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { data, error } = await supabase.rpc('apply_order_changes', {
    p_tab_id: input.tabId,
    p_changes: input.changes.map(c => ({
      line_id: c.lineId,
      menu_item_id: c.menuItemId || null,
      description: c.description.trim(),
      unit_price: money(c.unitPrice),
      delta: c.delta,
      remove: !!c.remove,
    })),
    p_booking_id: input.bookingId || null,
    p_label: input.label?.trim() || null,
    p_moved_by: input.movedBy?.trim() || null,
  })
  if (error) throw error
  const saved = data as { tab: Tab; lines: TabLine[] | null; stock_problem: boolean }
  return { tab: saved.tab, lines: saved.lines || [], stockProblem: !!saved.stock_problem }
}

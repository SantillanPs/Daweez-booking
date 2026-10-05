import { supabase, isSupabaseConfigured } from './supabaseClient'
import { randomUUID } from './helpers'

/**
 * The stock room (board card k71, part 1).
 *
 * The owner's design: **one stock room for the kitchen and the hotel**, every movement logged with who and when,
 * and **the shelf goes down by itself when the till sells something** — so the only movement a person types is
 * stock arriving.
 *
 * Two tables carry it:
 *   * `inventory_items` — the hotel's supplies list, grown up: a unit, a price the staff set, a par level and
 *     the on-hand figure. Its `quantity` is kept in step by every movement, and the log explains how it got
 *     there.
 *   * `stock_movements` — every movement, in and out, with the reason and the name.
 *
 * `menu_item_stock` is the recipe: what one dish takes off the shelf. A drink is one line; a cooked dish is four
 * or five.
 *
 * **The log and the count are written together, in one function** (`apply_stock_movement`), so the two can never
 * disagree — which is the whole point of keeping a log at all.
 */

export const STOCK_GROUPS = ['Food', 'Drinks', 'Linen', 'Toiletries', 'Other']

/** Why stock moved. A short list, and the field that makes the log readable a month later. */
export const STOCK_REASONS = ['Delivery', 'Used', 'Sold', 'Lost', 'Damaged', 'Count correction', 'Other']

export interface StockItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string
  price: number
  par_level: number
  active: boolean
  created_at: string
}

export interface StockMovement {
  id: string
  item_id: string
  direction: 'in' | 'out'
  quantity: number
  reason: string
  moved_by: string | null
  note: string | null
  /** What caused it: `delivery` when the desk received it, `tab_line` when a sale took it. */
  source: string | null
  source_id: string | null
  created_at: string
}

/** One line of a dish's recipe: how much of one stock item the dish uses. */
export interface DishStockLine {
  id: string
  menu_item_id: string
  item_id: string
  quantity: number
}

export interface StockMoveInput {
  itemId: string
  direction: 'in' | 'out'
  quantity: number
  reason: string
  movedBy?: string
  note?: string
  source?: string
  sourceId?: string
}

const NO_DB = 'No database is connected, so the stock room was not changed.'

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const toItem = (r: Record<string, unknown>): StockItem => ({
  id: String(r.id),
  name: String(r.name || ''),
  category: String(r.category || 'Other'),
  quantity: num(r.quantity),
  unit: String(r.unit || ''),
  price: num(r.price),
  par_level: num(r.par_level),
  active: r.active !== false,
  created_at: String(r.created_at || ''),
})

/** Every stock item, by name. The screen filters; this reads the whole list once. */
export async function getStockItems(): Promise<StockItem[]> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const { data, error } = await supabase.from('inventory_items').select('*').order('name')
  if (error) throw error
  return (data || []).map(toItem)
}

/**
 * Adds an item or corrects one. The name is the only field that must be there.
 *
 * **Correcting an item never writes its count.** This used to upsert the whole row,
 * `quantity` included, from the copy the screen was holding — so renaming an item or
 * changing its price put the old count back and silently undid every sale and
 * delivery made in between, with nothing in the log. The count moves only through
 * `applyStockMovement`; a new item starts at 0.
 */
export async function saveStockItem(item: Partial<StockItem> & { name: string }): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const fields = {
    name: item.name.trim(),
    category: item.category || 'Other',
    unit: (item.unit || '').trim(),
    price: item.price === undefined ? null : num(item.price),
    par_level: item.par_level === undefined ? null : num(item.par_level),
    active: item.active !== false,
  }
  const { error } = item.id
    ? await supabase.from('inventory_items').update(fields).eq('id', item.id)
    : await supabase.from('inventory_items').insert({ id: randomUUID(), quantity: 0, ...fields })
  if (error) throw error
}

/** The movements log, newest first. */
export async function getStockMovements(limit = 200): Promise<StockMovement[]> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const { data, error } = await supabase
    .from('stock_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data || []) as StockMovement[]
}

/**
 * Moves stock and writes the movement, together.
 *
 * The database function does both, so a failure writes neither: one call per line, and the log can never
 * disagree with the count.
 */
export async function moveStock(input: StockMoveInput): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const { error } = await supabase.rpc('apply_stock_movement', {
    p_item_id: input.itemId,
    p_direction: input.direction,
    p_quantity: num(input.quantity),
    p_reason: input.reason,
    p_moved_by: input.movedBy || null,
    p_note: input.note || null,
    p_source: input.source || null,
    p_source_id: input.sourceId || null,
  })
  if (error) throw error
}

// ── What a dish uses (the recipe) ─────────────────────────────────────────────

/** Every dish's recipe, read once for the whole menu. */
export async function getAllDishStock(): Promise<DishStockLine[]> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)
  const { data, error } = await supabase.from('menu_item_stock').select('*')
  if (error) throw error
  return (data || []) as DishStockLine[]
}

/** Replaces one dish's recipe with the lines given. */
export async function saveDishStock(menuItemId: string, lines: { item_id: string; quantity: number }[]): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { error: clearError } = await supabase.from('menu_item_stock').delete().eq('menu_item_id', menuItemId)
  if (clearError) throw clearError

  const rows = lines
    .filter(l => l.item_id && num(l.quantity) > 0)
    .map(l => ({ id: randomUUID(), menu_item_id: menuItemId, item_id: l.item_id, quantity: num(l.quantity) }))
  if (rows.length === 0) return

  const { error } = await supabase.from('menu_item_stock').insert(rows)
  if (error) throw error
}

// A sale takes its dish's recipe off the shelf inside the database, in the same trip that
// writes the order (`apply_order_changes`, called from `orderChanges.ts`): one `out`
// movement for each ingredient, stamped with the slip's row that caused it, so taking that
// row off the slip puts every gram back. The tablet used to read the recipe and make one
// trip per ingredient itself. A dish with no recipe deducts nothing, which is why the stock
// room shows the dishes that still need one.

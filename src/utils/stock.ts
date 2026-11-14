import { supabase } from './supabaseClient'
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

/** One line of a dish's recipe: how much of one stock item the dish uses. */
export interface DishStockLine {
  id: string
  menu_item_id: string
  item_id: string
  quantity: number
}

const num = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

/**
 * A quantity as the staff read it. The count may be a fraction (2.5 kg), and adding two fractions in the
 * browser leaves tails like 12.299999999999999 — so every screen that shows a quantity rounds it here.
 */
export const fmtQty = (n: number): string => (Math.round(n * 100) / 100).toLocaleString()

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
  const { data, error } = await supabase.from('inventory_items').select('*').order('name')
  if (error) throw error
  return (data || []).map(toItem)
}

// ── What a dish uses (the recipe) ─────────────────────────────────────────────

/** Every dish's recipe, read once for the whole menu. */
export async function getAllDishStock(): Promise<DishStockLine[]> {
  const { data, error } = await supabase.from('menu_item_stock').select('*')
  if (error) throw error
  return (data || []) as DishStockLine[]
}

/** Replaces one dish's recipe with the lines given. */
export async function saveDishStock(menuItemId: string, lines: { item_id: string; quantity: number }[]): Promise<void> {
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

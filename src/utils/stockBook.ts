import { supabase } from './supabaseClient'
import { readAppSetting } from './appSettings'

/**
 * The inventory logbook (Sebastian, 2026-11-12; `docs/why/stock.md`, "The logbook").
 *
 * Two books, the kitchen's and the hotel's, which never share an item. A stock-in line is copied from the
 * receipt later: the item, the total spent, how many and the day it was bought. Each item is counted in one
 * unit, kilos or pieces; typing an amount over is the check. Every write goes through a database function
 * (`20261114120000_inventory_logbook.sql`), which keeps the count, the log and Today's money together.
 */

export type Book = 'kitchen' | 'hotel'
export type StockUnit = 'kg' | 'pcs'

export interface BookItem {
  id: string
  name: string
  book: Book
  quantity: number
  unit: StockUnit
  checked_at: string | null
  created_at: string
}

export interface StockInLine {
  id: string
  book: Book
  item_id: string
  bought_on: string
  total: number
  amount: number
  unit: StockUnit
  /** It went onto the item's count (bought in the unit the item is counted in). */
  counted: boolean
  /** It put an expense in Today's money. */
  has_expense: boolean
  removed_at: string | null
  created_at: string
}

export interface StockInInput { item: string; total: number; amount: number; unit: StockUnit }

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const unitOf = (u: unknown): StockUnit => (u === 'kg' ? 'kg' : 'pcs')

export async function getBookItems(): Promise<BookItem[]> {
  const { data, error } = await supabase.from('inventory_items').select('*').eq('active', true).order('name')
  if (error) throw error
  return (data || []).map(r => ({
    id: String(r.id), name: String(r.name || ''), book: r.book === 'hotel' ? 'hotel' : 'kitchen',
    quantity: num(r.quantity), unit: unitOf(r.unit), checked_at: r.checked_at ?? null, created_at: String(r.created_at || ''),
  }))
}

const toLine = (r: Record<string, unknown>): StockInLine => ({
  id: String(r.id), book: r.book === 'hotel' ? 'hotel' : 'kitchen', item_id: String(r.item_id),
  bought_on: String(r.bought_on), total: num(r.total), amount: num(r.amount), unit: unitOf(r.unit),
  counted: r.counted === true, has_expense: !!r.expense_id, removed_at: (r.removed_at as string) ?? null, created_at: String(r.created_at || ''),
})

// ponytail: the newest 500 lines; page by day if the log ever outgrows that.
export async function getStockIn(): Promise<StockInLine[]> {
  const { data, error } = await supabase.from('stock_in').select('*')
    .order('bought_on', { ascending: false }).order('created_at', { ascending: false }).limit(500)
  if (error) throw error
  return (data || []).map(toLine)
}

const call = async <T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> => {
  const { data, error } = await supabase.rpc(fn, args)
  if (error) throw error
  return data as T
}

/** A receipt's lines, written together. An item not in the book yet is added to it. */
export const writeStockIn = async (book: Book, boughtOn: string, lines: StockInInput[]) =>
  ((await call<Record<string, unknown>[]>('write_stock_in', { p_book: book, p_bought_on: boughtOn, p_lines: lines })) || []).map(toLine)

export const removeStockIn = (id: string) => call('remove_stock_in', { p_id: id })
export const restoreStockIn = (id: string) => call('restore_stock_in', { p_id: id })
export const fixStockIn = (id: string, f: { total: number; amount: number; unit: StockUnit; bought_on: string }) =>
  call('fix_stock_in', { p_id: id, p_total: f.total, p_amount: f.amount, p_unit: f.unit, p_bought_on: f.bought_on })

/** The check: what is there now. Returns the count's movement when it came out different, for its note. */
export const setStockCount = (itemId: string, quantity: number, unit: StockUnit, checkedAt?: string | null) =>
  call<string | null>('set_stock_count', { p_item_id: itemId, p_quantity: quantity, p_unit: unit, ...(checkedAt !== undefined ? { p_checked_at: checkedAt } : {}) })

export const setCountNote = (movementId: string, note: string) => call('set_count_note', { p_movement_id: movementId, p_note: note })

/** Whether stock in also goes to Today's money. Off until someone turns it on. */
export const readStockInExpenses = async () => (await readAppSetting<{ expenses?: boolean }>('stock_in'))?.expenses === true

/** Off takes back every expense it added; on puts those back. Returns how many. */
export const setStockInExpenses = (on: boolean) => call<number>('set_stock_in_expenses', { p_on: on })

/** Bought in the other unit since it was last checked: a count typed now is not a loss. */
export const boughtOtherSince = (item: BookItem, lines: StockInLine[]) =>
  lines.some(l => l.item_id === item.id && !l.counted && !l.removed_at && l.created_at > (item.checked_at || ''))

/** Whole days since the item was last checked; null when it never was. */
export function daysSinceCheck(item: BookItem, now = new Date()): number | null {
  if (!item.checked_at) return null
  const c = new Date(item.checked_at)
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((day(now) - day(c)) / 864e5)
}

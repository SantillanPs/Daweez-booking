import React, { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { NumInput } from '../NumInput'
import { getMenu, type MenuCategory, type MenuItem } from '../../utils/restaurantMenu'
import type { StockItem, DishStockLine } from '../../utils/stock'

/**
 * **What a dish uses** (k71 part 1) — the recipe, and the piece the owner called the important one.
 *
 * You open a dish and add its stock lines, one time. After that the dish takes its own stock every time it is
 * sold, so nobody deducts by hand. A drink is one line; a cooked dish is four or five.
 *
 * **A dish with no lines deducts nothing**, so the list says which dishes still need them — that count is the
 * only warning the desk gets, and it is the reason this screen exists as its own view.
 */
export function DishStockEditor({ items, dishStock, onSave }: {
  items: StockItem[]
  dishStock: DishStockLine[]
  onSave: (menuItemId: string, lines: { item_id: string; quantity: number }[]) => Promise<void>
}) {
  const [menu, setMenu] = useState<MenuCategory[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState<MenuItem | null>(null)
  const [lines, setLines] = useState<{ item_id: string; quantity: number }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { getMenu().then(setMenu).catch(() => {}) }, [])

  const dishes = useMemo(() => menu.flatMap(c => c.items), [menu])
  const countFor = (id: string) => dishStock.filter(l => l.menu_item_id === id).length
  const missing = dishes.filter(d => countFor(d.id) === 0).length

  const openDish = (dish: MenuItem) => {
    setOpen(dish)
    setError('')
    setLines(dishStock.filter(l => l.menu_item_id === dish.id).map(l => ({ item_id: l.item_id, quantity: l.quantity })))
  }

  const save = async () => {
    if (!open) return
    setBusy(true); setError('')
    try {
      await onSave(open.id, lines)
      setOpen(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That recipe was not saved.')
    } finally {
      setBusy(false)
    }
  }

  const shown = dishes.filter(d => !search.trim() || d.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-4 border-b border-soft">
        <h3 className="text-sm font-semibold text-main">What a dish uses</h3>
        <p className="text-xs text-muted mt-1">
          {dishes.length} dishes · {dishes.length - missing} with stock lines
          {missing > 0 ? ' · ' + missing + ' deduct nothing yet' : ''}
        </p>
      </div>

      {open ? (
        <div className="p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold text-main">{open.name}</p>
            <p className="text-xs text-muted">₱{open.price.toLocaleString()}</p>
          </div>

          <div className="space-y-2">
            {lines.length === 0 && (
              <p className="text-xs text-muted">
                No stock lines yet — this dish deducts nothing when it is sold.
              </p>
            )}
            {lines.map((line, index) => (
              <div key={index} className="flex flex-wrap items-center gap-2">
                <select value={line.item_id}
                  onChange={e => setLines(lines.map((l, i) => i === index ? { ...l, item_id: e.target.value } : l))}
                  className="flex-1 min-w-[180px] bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500">
                  <option value="">Choose a stock item…</option>
                  {items.map(i => <option key={i.id} value={i.id}>{i.name}{i.unit ? ' (' + i.unit + ')' : ''}</option>)}
                </select>
                <NumInput value={line.quantity} allowDecimal
                  onChange={v => setLines(lines.map((l, i) => i === index ? { ...l, quantity: v } : l))}
                  className="w-24 bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
                <button onClick={() => setLines(lines.filter((_, i) => i !== index))}
                  className="text-muted/50 hover:text-rose-500 p-1.5 cursor-pointer" aria-label="Remove this line">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={() => setLines([...lines, { item_id: '', quantity: 1 }])}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-soft text-muted text-sm hover:bg-softbg cursor-pointer">
            <Plus className="w-4 h-4" /> Add a stock item
          </button>

          {error && <p className="text-xs text-danger-600 font-medium">{error}</p>}

          <div className="flex items-center gap-2">
            <button onClick={() => void save()} disabled={busy}
              className="px-4 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
              Save the list
            </button>
            <button onClick={() => setOpen(null)}
              className="px-4 py-2 rounded-lg border border-soft text-muted text-sm hover:bg-softbg cursor-pointer">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="p-4 border-b border-soft">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a dish"
              className="w-full bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
          </div>
          <div className="divide-y divide-soft max-h-[60vh] overflow-y-auto">
            {shown.map(d => {
              const count = countFor(d.id)
              return (
                <button key={d.id} onClick={() => openDish(d)}
                  className="w-full flex items-center justify-between px-5 py-2.5 text-left hover:bg-page cursor-pointer">
                  <span className="text-sm text-main">{d.name}</span>
                  <span className={'text-xs font-medium ' + (count === 0 ? 'text-amber-600' : 'text-muted')}>
                    {count === 0 ? 'no stock lines' : count + (count === 1 ? ' stock line' : ' stock lines')}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

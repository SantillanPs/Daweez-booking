import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { STOCK_GROUPS, type StockItem, type StockMovement } from '../../utils/stock'
import { ReceiveStockForm } from './ReceiveStockForm'
import { StockItemForm } from './StockItemForm'
import { StockMovementsLog } from './StockMovementsLog'

const fmtMoney = (n: number) => '₱' + (Math.round(n * 100) / 100).toLocaleString()
const fmtQty = (n: number) => (Math.round(n * 100) / 100).toLocaleString()

/**
 * **The stock room** (board card k71, part 1) — one shelf for the kitchen and the hotel.
 *
 * One row for each item: its unit, what is on hand, its par level, its price and what that much is worth. The
 * par column is the only colour that matters — red means the shelf is below the line.
 *
 * There is **no “use stock” button**: everything that leaves the shelf leaves it because something was sold, so
 * the only movement a person types is a delivery arriving. The movements log is one press away, because that is
 * where “where did it all go?” is answered.
 */
export function StockRoom({ items, movements, loading, error, onReceive, onSaveItem }: {
  items: StockItem[]
  movements: StockMovement[]
  loading: boolean
  error: string
  onReceive: (itemId: string, quantity: number, receivedBy: string, note: string) => Promise<void>
  onSaveItem: (values: Partial<StockItem> & { name: string }) => Promise<void>
}) {
  const [view, setView] = useState<'items' | 'movements'>('items')
  const [group, setGroup] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [receiving, setReceiving] = useState<StockItem | null>(null)
  const [editing, setEditing] = useState<StockItem | null>(null)
  const [adding, setAdding] = useState(false)

  const isLow = (i: StockItem) => i.par_level > 0 && i.quantity < i.par_level
  const shown = items.filter(i => {
    if (!i.active && !editing) return false
    if (group && i.category !== group) return false
    if (lowOnly && !isLow(i)) return false
    if (!search.trim()) return true
    return i.name.toLowerCase().includes(search.trim().toLowerCase())
  })

  const worth = items.reduce((sum, i) => sum + i.quantity * i.price, 0)
  const lowCount = items.filter(isLow).length

  return (
    <div className="bg-card border border-soft rounded-lg overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-4 border-b border-soft flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-main">Stock room</h3>
          <p className="text-xs text-muted mt-1">
            {items.length} items · shelf worth {fmtMoney(worth)}
            {lowCount > 0 ? ' · ' + lowCount + ' below par' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => { setView('items'); setAdding(true); setEditing(null); setReceiving(null) }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer">
            <Plus className="w-4 h-4" /> New item
          </button>
          <button onClick={() => setView(view === 'movements' ? 'items' : 'movements')}
            className={'px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ' +
              (view === 'movements' ? 'border-gold-400 bg-gold-100 text-gold-800' : 'border-soft text-muted hover:bg-softbg')}>
            Movements
          </button>
        </div>
      </div>

      {error && <p className="px-5 py-3 text-xs text-danger-600 font-medium border-b border-soft">{error}</p>}

      {view === 'movements' ? (
        <div className="p-4"><StockMovementsLog movements={movements} items={items} /></div>
      ) : (
        <>
          {(adding || editing) && (
            <div className="p-4 border-b border-soft">
              <StockItemForm
                item={editing || undefined}
                onCancel={() => { setAdding(false); setEditing(null) }}
                onSave={async values => { await onSaveItem(values); setAdding(false); setEditing(null) }}
              />
            </div>
          )}

          {receiving && (
            <div className="p-4 border-b border-soft">
              <ReceiveStockForm
                item={receiving}
                onCancel={() => setReceiving(null)}
                onSave={async (quantity, receivedBy, note) => {
                  await onReceive(receiving.id, quantity, receivedBy, note)
                  setReceiving(null)
                }}
              />
            </div>
          )}

          <div className="p-4 border-b border-soft flex flex-wrap items-center gap-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an item"
              className="flex-1 min-w-[160px] bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
            <select value={group} onChange={e => setGroup(e.target.value)}
              className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500">
              <option value="">Every group</option>
              {STOCK_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            <button onClick={() => setLowOnly(!lowOnly)}
              className={'px-3 py-2 rounded-lg border text-sm font-medium transition-colors cursor-pointer ' +
                (lowOnly ? 'border-danger-400 bg-danger-50 text-danger-600' : 'border-soft text-muted hover:bg-softbg')}>
              Below par
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-page">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
                  <th className="px-4 py-2 font-bold">Item</th>
                  <th className="px-3 py-2 font-bold">Unit</th>
                  <th className="px-3 py-2 font-bold text-right">On hand</th>
                  <th className="px-3 py-2 font-bold text-right">Par</th>
                  <th className="px-3 py-2 font-bold text-right">Price</th>
                  <th className="px-3 py-2 font-bold text-right">Worth</th>
                  <th className="px-3 py-2 font-bold"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {loading && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">Reading the stock room…</td></tr>}
                {!loading && shown.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted">No items match.</td></tr>
                )}
                {shown.map(i => (
                  <tr key={i.id} className="hover:bg-page">
                    <td className="px-4 py-2">
                      <button onClick={() => { setEditing(i); setAdding(false); setReceiving(null) }}
                        className="text-main font-medium hover:text-gold-700 cursor-pointer text-left">
                        {i.name}
                      </button>
                      <span className="block text-[10px] uppercase text-muted">{i.category}</span>
                    </td>
                    <td className="px-3 py-2 text-muted">{i.unit || '—'}</td>
                    <td className="px-3 py-2 text-right font-mono text-main">{fmtQty(i.quantity)}</td>
                    <td className={'px-3 py-2 text-right font-mono ' + (isLow(i) ? 'text-rose-500 font-bold' : 'text-muted')}>
                      {i.par_level > 0 ? fmtQty(i.par_level) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-muted">{fmtMoney(i.price)}</td>
                    <td className="px-3 py-2 text-right font-mono text-main">{fmtMoney(i.quantity * i.price)}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => { setReceiving(i); setEditing(null); setAdding(false) }}
                        className="px-2.5 py-1 rounded-md border border-soft text-xs font-medium text-muted hover:bg-softbg hover:text-main cursor-pointer">
                        Receive
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="px-4 py-3 text-xs text-muted border-t border-soft">
            Stock goes down by itself when the till sells something. This screen only puts stock in.
          </p>
        </>
      )}
    </div>
  )
}

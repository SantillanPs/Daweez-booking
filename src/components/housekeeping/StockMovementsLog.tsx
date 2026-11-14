import React, { useState } from 'react'
import { fmtQty, type StockItem, type StockMovement } from '../../utils/stock'

const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-US',
  { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

/**
 * The movements log (k71 part 1) — **the screen that makes the rest possible**.
 *
 * Every line says what moved, how much, in or out, why, and who moved it. A month from now, “where did the 40
 * bottles go?” is answered here and nowhere else. One sale writes several lines, so a dish shows each of its
 * ingredients on its own row.
 */
export function StockMovementsLog({ movements, items }: {
  movements: StockMovement[]
  items: StockItem[]
}) {
  const [reason, setReason] = useState('')
  const [search, setSearch] = useState('')

  const nameOf = (id: string) => items.find(i => i.id === id)?.name || 'Removed item'
  const reasons = Array.from(new Set(movements.map(m => m.reason))).sort()

  const shown = movements.filter(m => {
    if (reason && m.reason !== reason) return false
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return nameOf(m.item_id).toLowerCase().includes(q)
      || (m.moved_by || '').toLowerCase().includes(q)
      || (m.note || '').toLowerCase().includes(q)
  })

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Find an item or a name"
          className="flex-1 min-w-[160px] bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        <select value={reason} onChange={e => setReason(e.target.value)}
          className="bg-page border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500">
          <option value="">Every reason</option>
          {reasons.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="text-xs text-muted">{shown.length} of {movements.length}</span>
      </div>

      <div className="border border-soft rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-page">
            <tr className="text-left text-[10px] uppercase tracking-wide text-muted">
              <th className="px-3 py-2 font-bold">When</th>
              <th className="px-3 py-2 font-bold">Item</th>
              <th className="px-3 py-2 font-bold">In / out</th>
              <th className="px-3 py-2 font-bold text-right">How many</th>
              <th className="px-3 py-2 font-bold">Why</th>
              <th className="px-3 py-2 font-bold">Who</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-soft">
            {shown.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-muted">
                No movements yet. A delivery, or a sale, will show here.
              </td></tr>
            )}
            {shown.map(m => (
              <tr key={m.id}>
                <td className="px-3 py-2 text-muted whitespace-nowrap">{fmtWhen(m.created_at)}</td>
                <td className="px-3 py-2 text-main font-medium">{nameOf(m.item_id)}</td>
                <td className={'px-3 py-2 font-semibold ' + (m.direction === 'in' ? 'text-emerald-600' : 'text-rose-500')}>
                  {m.direction === 'in' ? 'In' : 'Out'}
                </td>
                <td className="px-3 py-2 text-right font-mono text-main">{fmtQty(Number(m.quantity))}</td>
                <td className="px-3 py-2 text-muted">{m.reason}{m.note ? ' · ' + m.note : ''}</td>
                <td className="px-3 py-2 text-muted">{m.moved_by || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

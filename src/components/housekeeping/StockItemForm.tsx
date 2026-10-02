import React, { useState } from 'react'
import { NumInput } from '../NumInput'
import { STOCK_GROUPS, type StockItem } from '../../utils/stock'

/**
 * Adding an item, or correcting one (k71 part 1).
 *
 * The fields are the owner's list: a **unit** (the small one — two cases of beer are 48 bottles), a **price the
 * staff set** so the stock room can say what the shelf is worth, and a **par level** that turns the row red when
 * the shelf runs low.
 */
export function StockItemForm({ item, onSave, onCancel }: {
  item?: StockItem
  onSave: (values: Partial<StockItem> & { name: string }) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(item?.name || '')
  const [unit, setUnit] = useState(item?.unit || '')
  const [group, setGroup] = useState(item?.category || STOCK_GROUPS[0])
  const [price, setPrice] = useState(item?.price || 0)
  const [par, setPar] = useState(item?.par_level || 0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!name.trim()) { setError('What is the item called?'); return }
    setError(''); setBusy(true)
    try {
      await onSave({
        id: item?.id, name: name.trim(), unit: unit.trim(), category: group,
        price, par_level: par, quantity: item?.quantity || 0, active: item?.active !== false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That item was not saved.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-soft bg-page rounded-lg p-4 space-y-3">
      <p className="text-sm font-semibold text-main">{item ? 'Correct ' + item.name : 'New item'}</p>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted flex-1 min-w-[180px]">
          <span className="block mb-1">Item</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Beer, Red Horse"
            className="w-full bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
        <label className="text-xs text-muted">
          <span className="block mb-1">Unit</span>
          <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="bottle"
            className="w-28 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
        <label className="text-xs text-muted">
          <span className="block mb-1">Group</span>
          <select value={group} onChange={e => setGroup(e.target.value)}
            className="bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500">
            {STOCK_GROUPS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="text-xs text-muted">
          <span className="block mb-1">Price</span>
          <NumInput value={price} onChange={setPrice} allowDecimal
            className="w-24 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
        <label className="text-xs text-muted">
          <span className="block mb-1">Par level</span>
          <NumInput value={par} onChange={setPar} allowDecimal
            className="w-24 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
      </div>

      <p className="text-xs text-muted">
        The par level is where the row turns red. Leave it at zero for an item nobody counts down.
      </p>

      {error && <p className="text-xs text-danger-600 font-medium">{error}</p>}

      <div className="flex items-center gap-2">
        <button onClick={() => void submit()} disabled={busy}
          className="px-4 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
          Save the item
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-soft text-muted text-sm hover:bg-softbg cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  )
}

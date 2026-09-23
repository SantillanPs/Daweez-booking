import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { NumInput } from '../NumInput'

interface OffMenuOrderProps {
  /** True while the written row is showing; the caller owns that choice. */
  open: boolean
  onOpen: () => void
  busy?: boolean
  /** The reason the last add failed, shown under the row. */
  error?: string
  /** Writes the line. Returns true when it landed, so the boxes can be cleared. */
  onAdd: (description: string, qty: number, unitPrice: number) => Promise<boolean>
}

// The rare dish the menu does not carry (k70).
//
// Hidden behind a link on purpose: an order is tapped off the menu card, never
// typed, so the till opens as the card and this row only appears when a dish
// really is missing from it.
export function OffMenuOrder({ open, onOpen, busy = false, error = '', onAdd }: OffMenuOrderProps) {
  const [description, setDescription] = useState('')
  const [qty, setQty] = useState(1)
  const [unitPrice, setUnitPrice] = useState(0)

  const box = 'w-full bg-card border border-soft text-main px-2.5 py-2.5 rounded-lg text-sm focus:outline-none focus:border-gold-500'
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-muted'

  if (!open) {
    return (
      <button type="button" onClick={onOpen}
        className="inline-flex items-center min-h-[44px] text-[12px] font-semibold text-muted hover:text-gold-700 transition-colors cursor-pointer">
        + Something not on the menu
      </button>
    )
  }

  const add = async () => {
    if (await onAdd(description, qty, unitPrice)) {
      setDescription(''); setQty(1); setUnitPrice(0)
    }
  }

  return (
    <div className="border border-soft rounded-lg p-2.5 space-y-2 bg-card">
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex-1 min-w-[140px]">
          <span className={label}>Order</span>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Hotsilog"
            className={box} />
        </label>
        <label className="w-[62px]">
          <span className={label}>Qty</span>
          <NumInput value={qty} onChange={setQty} allowDecimal={false} className={box} />
        </label>
        <label className="w-[92px]">
          <span className={label}>Price</span>
          <NumInput value={unitPrice} onChange={setUnitPrice} className={box} />
        </label>
        <button type="button" onClick={() => void add()} disabled={busy}
          className="inline-flex items-center gap-1.5 min-h-[44px] text-[12.5px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      {error && <p className="text-[11px] font-semibold text-danger-600">{error}</p>}
      <p className="text-[10.5px] text-muted">
        Anything the menu does not carry can be written here and priced by hand.
      </p>
    </div>
  )
}

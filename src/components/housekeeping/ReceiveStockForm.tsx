import React, { useState } from 'react'
import { NumInput } from '../NumInput'
import { fmtQty, type StockItem } from '../../utils/stock'

/**
 * Receiving stock (k71 part 1) — **the only movement a person types**.
 *
 * Everything that leaves the shelf leaves it because something was sold, so this form has one direction only.
 * It shows what the count becomes **before** the movement is recorded, because a stock figure nobody can check
 * is a figure nobody trusts.
 */
export function ReceiveStockForm({ item, onSave, onCancel }: {
  item: StockItem
  onSave: (quantity: number, receivedBy: string, note: string) => Promise<void>
  onCancel: () => void
}) {
  const [quantity, setQuantity] = useState(1)
  const [receivedBy, setReceivedBy] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (quantity <= 0) { setError('How many arrived?'); return }
    setError(''); setBusy(true)
    try {
      await onSave(quantity, receivedBy.trim(), note.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That delivery was not recorded.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-gold-200 bg-gold-100/40 rounded-lg p-4 space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-semibold text-main">Receive stock</p>
        <p className="text-xs text-muted">{item.name} · {fmtQty(item.quantity)} {item.unit || 'on hand'}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-muted">
          <span className="block mb-1">How many</span>
          <NumInput value={quantity} onChange={setQuantity} allowDecimal
            className="w-24 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
        <label className="text-xs text-muted">
          <span className="block mb-1">Received by</span>
          <input value={receivedBy} onChange={e => setReceivedBy(e.target.value)} placeholder="Name"
            className="w-40 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
        <label className="text-xs text-muted flex-1 min-w-[140px]">
          <span className="block mb-1">Note <span className="text-muted/70">optional</span></span>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Supplier, receipt no…"
            className="w-full bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500" />
        </label>
      </div>

      <p className="text-xs text-muted">
        After this delivery: <span className="font-mono font-semibold text-main">{fmtQty(item.quantity + quantity)}</span>
      </p>

      {error && <p className="text-xs text-danger-600 font-medium">{error}</p>}

      <div className="flex items-center gap-2">
        <button onClick={() => void submit()} disabled={busy}
          className="px-4 py-2 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50">
          Record the delivery
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-soft text-muted text-sm hover:bg-softbg cursor-pointer">
          Cancel
        </button>
      </div>
    </div>
  )
}

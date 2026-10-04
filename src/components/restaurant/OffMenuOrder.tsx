import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { NumInput } from '../NumInput'
import { Field } from '../walk-in/Field'
import { FIELD } from '../walk-in/formStyles'

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

  if (!open) {
    return (
      <button type="button" onClick={onOpen}
        className="inline-flex items-center gap-1.5 min-h-[44px] text-[14px] font-semibold text-brand-text hover:underline cursor-pointer">
        <Plus className="w-4 h-4" /> Something not on the menu
      </button>
    )
  }

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (await onAdd(description, qty, unitPrice)) {
      setDescription(''); setQty(1); setUnitPrice(0)
    }
  }

  return (
    <form onSubmit={add} className="flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
      <Field label="Order" className="flex-1 min-w-[160px]">
        <input value={description} onChange={e => setDescription(e.target.value)} autoFocus autoComplete="off" className={FIELD} />
      </Field>
      <Field label="How many" className="w-24">
        <NumInput value={qty} onChange={setQty} allowDecimal={false} className={FIELD + ' text-right tabular-nums'} />
      </Field>
      <Field label="Price each (₱)" className="w-32">
        <NumInput value={unitPrice} onChange={setUnitPrice} className={FIELD + ' text-right tabular-nums'} />
      </Field>
      <button type="submit" disabled={busy}
        className="h-11 px-4 inline-flex items-center gap-1.5 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold shadow-sm transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50">
        <Plus className="w-4 h-4" /> Add
      </button>
      {error && <p role="alert" className="basis-full text-[13px] font-medium text-danger-600">{error}</p>}
    </form>
  )
}

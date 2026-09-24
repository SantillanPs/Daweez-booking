import React from 'react'
import { Plus, X } from 'lucide-react'
import { RateConfig } from '../../types/booking'
import { NumInput } from '../NumInput'

/**
 * The breakfast menu — WHAT the daily breakfast board offers (the owner's ruling,
 * 2026-09: the board asks each room what it wants, and this is the list it asks from).
 *
 * It is NOT the price. Breakfast is charged ONCE at booking, at the room's own
 * breakfast price (card k140) — these figures are what a dish would cost if it were
 * ever sold on its own, and the daily record never charges anything.
 */
export function BreakfastMenuEditor({ items, onChange }: { items: RateConfig['breakfastMenu']; onChange: (items: RateConfig['breakfastMenu']) => void }) {
  const setAt = (i: number, patch: Partial<{ name: string; price: number }>) =>
    onChange(items.map((m, idx) => idx === i ? { ...m, ...patch } : m))

  return (
    <div className="bg-card border border-soft rounded-xl overflow-hidden font-sans shadow-sm">
      <div className="px-5 py-3.5 border-b border-soft">
        <h3 className="text-sm font-semibold text-main">Breakfast menu</h3>
        <p className="text-xs text-muted mt-1">What the breakfast board offers each morning. Breakfast itself is paid once, at booking — nothing here is charged again.</p>
      </div>
      <div className="p-5 space-y-2">
        {items.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={m.name} onChange={e => setAt(i, { name: e.target.value })} placeholder="Dish (e.g. Bangsilog)"
              className="flex-1 bg-page border border-soft text-main px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-brand-primary" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-muted font-bold">₱</span>
              <NumInput value={m.price} onChange={v => setAt(i, { price: v })}
                className="w-24 bg-card border border-soft text-main px-2 py-2 rounded-md text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
            </div>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="text-muted hover:text-danger-600 p-1.5 cursor-pointer" aria-label="Remove dish">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { name: '', price: 0 }])}
          className="text-[11px] font-bold text-gold-800 bg-gold-100 border border-gold-200 hover:bg-gold-100 rounded-md px-2.5 py-1.5 transition-colors cursor-pointer inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add a dish
        </button>
      </div>
    </div>
  )
}

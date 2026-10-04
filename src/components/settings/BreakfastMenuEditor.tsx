import React from 'react'
import { Plus, X } from 'lucide-react'
import { RateConfig } from '../../types/booking'
import { FIELD_IN_ROW, TEXT_ACTION } from '../walk-in/formStyles'
import { FigureBox, Section } from './parts'

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
    <Section title="Breakfast menu" fact="Breakfast is paid once, at booking. Nothing here is charged again.">
      <div className="max-w-[560px] space-y-2">
        {items.length === 0 && <p className="py-2 text-[15px] text-muted">No dishes on the board yet.</p>}
        {items.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={m.name} onChange={e => setAt(i, { name: e.target.value })} placeholder="Dish (e.g. Bangsilog)"
              aria-label="Dish" className={FIELD_IN_ROW} />
            <span className="block w-28 shrink-0">
              <FigureBox value={m.price} onChange={v => setAt(i, { price: v })} label="Price" />
            </span>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:bg-softbg hover:text-danger-600 transition-colors duration-150 active:scale-95 cursor-pointer" aria-label="Remove dish">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { name: '', price: 0 }])} className={TEXT_ACTION}>
          <Plus className="w-4 h-4" /> Add a dish
        </button>
      </div>
    </Section>
  )
}

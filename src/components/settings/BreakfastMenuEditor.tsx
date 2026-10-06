import React from 'react'
import { Plus, X } from 'lucide-react'
import { RateConfig } from '../../types/booking'
import { FIELD_IN_ROW, TEXT_ACTION } from '../walk-in/formStyles'
import { Section } from './parts'

/**
 * The breakfast menu — WHAT the daily breakfast board offers (the owner's ruling,
 * 2026-09: the board asks each room what it wants, and this is the list it asks from).
 *
 * **It is a list of dishes and nothing else.** Breakfast is charged ONCE at booking, at
 * the room's own breakfast price (card k140), and the daily record never charges anything.
 * Each dish used to have a price box beside it (₱150, ₱40): nothing in the system read
 * those figures, they sat one scroll under the room's real breakfast price, and a line of
 * small print had to say that nothing here is charged. They were a trace of the ₱150 a
 * head the owner asked to have removed everywhere — so the boxes are gone, and the line
 * that explained them with them. A dish still stores a price (0 for a new one), unread.
 */
export function BreakfastMenuEditor({ items, onChange }: { items: RateConfig['breakfastMenu']; onChange: (items: RateConfig['breakfastMenu']) => void }) {
  const setAt = (i: number, name: string) =>
    onChange(items.map((m, idx) => idx === i ? { ...m, name } : m))

  return (
    <Section title="Breakfast menu">
      <div className="max-w-[440px] space-y-2">
        {items.length === 0 && <p className="py-2 text-[15px] text-muted">No dishes on the board yet.</p>}
        {items.map((m, i) => (
          <div key={i} className="flex items-center gap-2">
            <input value={m.name} onChange={e => setAt(i, e.target.value)} placeholder="Dish (e.g. Bangsilog)"
              aria-label="Dish" className={FIELD_IN_ROW} />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))}
              className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-muted hover:bg-softbg hover:text-danger-600 transition-colors duration-150 active:scale-95 cursor-pointer"
              aria-label={'Remove ' + (m.name || 'this dish')} title="Remove">
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

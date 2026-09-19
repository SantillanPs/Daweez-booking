import React, { useEffect, useState } from 'react'
import {
  BadgePercent, Beer, Beef, Coffee, Cookie, CupSoda, Drumstick, Fish, Ham,
  IceCreamCone, Salad, Sandwich, Soup, Utensils, Wheat,
} from 'lucide-react'
import { MenuCategory, MenuItem, getMenu } from '../../utils/restaurantMenu'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// One icon per food group. The icon carries the meaning: a hand finds "Drinks"
// by the cup long before it reads the word, and a till has to be read at a glance
// while the guest is standing there.
const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  breakfast: Coffee,
  'value-meals': BadgePercent,
  rice: Wheat,
  appetizers: Cookie,
  chicken: Drumstick,
  pork: Ham,
  beef: Beef,
  seafood: Fish,
  noodles: Soup,
  vegetables: Salad,
  salad: Salad,
  snacks: Sandwich,
  'desserts-shakes': IceCreamCone,
  drinks: CupSoda,
  'beer-spirits': Beer,
}

interface MenuPickerProps {
  /** Called once per tap. The caller writes the line onto the tab. */
  onPick: (item: MenuItem) => void
  busy?: boolean
  /** How many of each dish are already on the tab, keyed by dish name. */
  counts?: Record<string, number>
}

// The menu board (board card k70).
//
// Built for a staff member taking an order at the counter, never for a guest
// holding the tablet: big targets, the food group shown by an icon, and the PRICE
// as the loudest thing on the tile, because the price is what gets said out loud.
// A dish already on the tab lights up with a count, so the same order cannot
// quietly land twice.
export function MenuPicker({ onPick, busy = false, counts = {} }: MenuPickerProps) {
  // The menu is read from the database so every tablet shows the same one, so it
  // arrives a moment after the first render.
  const [menu, setMenu] = useState<MenuCategory[] | null>(null)
  const [categoryId, setCategoryId] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const loaded = await getMenu()
      if (!cancelled) setMenu(loaded)
    })()
    return () => { cancelled = true }
  }, [])

  if (!menu) {
    return (
      <div className="border border-soft rounded-lg bg-card px-3 py-6 text-center">
        <p className="text-[12.5px] text-muted">Reading the menu…</p>
      </div>
    )
  }

  const category = menu.find(c => c.id === categoryId) || menu[0]
  const GroupIcon = ICONS[category?.id || ''] || Utensils

  return (
    <div className="border border-soft rounded-lg overflow-hidden bg-card">
      {/* Food groups. Icon first, word second, so the row is scanned, not read. */}
      <div className="flex gap-1.5 px-2.5 py-2 bg-paper-50 border-b border-soft overflow-x-auto no-scrollbar">
        {menu.map(c => {
          const CatIcon = ICONS[c.id] || Utensils
          const on = c.id === category?.id
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              title={c.name}
              className={'shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-bold px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer ' +
                (on ? 'bg-gold-400 text-ink-900' : 'bg-card border border-soft text-ink-600 hover:bg-gold-100')}
            >
              <CatIcon className={'w-3.5 h-3.5 ' + (on ? 'text-ink-900' : 'text-gold-700')} />
              {c.name}
            </button>
          )
        })}
      </div>

      <div className="p-2.5">
        <p className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-muted mb-2">
          <GroupIcon className="w-3.5 h-3.5 text-gold-600" />
          {category?.name}{category?.note ? ' · ' + category.note : ''}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {(category?.items || []).map(item => {
            const alreadyOn = counts[item.name] || 0
            return (
              <button
                key={item.id}
                type="button"
                disabled={busy}
                onClick={() => onPick(item)}
                title={item.note ? item.name + ' — ' + item.note : item.name}
                className={'relative text-left rounded-lg pl-2.5 pr-2 py-2.5 min-h-[64px] flex flex-col justify-between border transition-colors cursor-pointer disabled:opacity-50 ' +
                  (alreadyOn > 0 ? 'border-gold-400 bg-gold-100' : 'border-soft bg-card hover:border-gold-400 hover:bg-gold-100')}
              >
                {alreadyOn > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-400 text-ink-900 text-[10px] font-bold flex items-center justify-center">
                    {alreadyOn}
                  </span>
                )}
                <span className="flex items-start gap-1.5">
                  <GroupIcon className="w-3.5 h-3.5 text-muted shrink-0 mt-0.5" />
                  <span className="text-[12.5px] font-bold text-main leading-tight">{item.name}</span>
                </span>
                <span className="font-display text-[16px] font-extrabold text-brand-text leading-none mt-1.5">
                  {fmtPeso(item.price)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

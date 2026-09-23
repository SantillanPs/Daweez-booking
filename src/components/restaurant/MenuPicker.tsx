import React, { useEffect, useMemo, useState } from 'react'
import {
  BadgePercent, Beer, Beef, Coffee, Cookie, CupSoda, Drumstick, Fish, Ham,
  IceCreamCone, Salad, Sandwich, Search, Soup, Utensils, Wheat, X,
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

// A printed menu reads in two columns, so the card keeps them: the categories are
// cut in half by item count — never through a category — so the two halves stay
// level AND the order still reads straight down the left column first, then the
// right, the way a real menu is read.
function splitColumns(menu: MenuCategory[]): [MenuCategory[], MenuCategory[]] {
  const total = menu.reduce((n, c) => n + c.items.length + 1, 0)
  const left: MenuCategory[] = []
  let count = 0
  for (const category of menu) {
    const weight = category.items.length + 1
    if (left.length > 0 && count + weight > total / 2) break
    left.push(category)
    count += weight
  }
  const onTheLeft = new Set(left.map(c => c.id))
  return [left, menu.filter(c => !onTheLeft.has(c.id))]
}

function MenuColumn({ categories, onPick, busy, counts }: {
  categories: MenuCategory[]
  onPick: (item: MenuItem) => void
  busy: boolean
  counts: Record<string, number>
}) {
  return (
    <div>
      {categories.map(category => {
        const GroupIcon = ICONS[category.id] || Utensils
        return (
          <section key={category.id}>
            {/* The category sits centred between its own thin rules, the way it is
                printed on the laminated card the staff already know. */}
            <p className="sticky top-0 z-10 bg-paper-50 flex items-center gap-2 pt-4 pb-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-brand-text">
              <span className="flex-1 border-t border-paper-300" />
              <GroupIcon className="w-4 h-4" />
              <span className="whitespace-nowrap">
                {category.name}
                {category.note && <span className="ml-1.5 font-semibold tracking-normal normal-case text-muted">{category.note}</span>}
              </span>
              <span className="flex-1 border-t border-paper-300" />
            </p>

            {category.items.map(item => {
              const alreadyOn = counts[item.name] || 0
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick(item)}
                  title={item.note ? item.name + ' — ' + item.note : item.name}
                  // A finger, not a mouse: every dish is a 48px row whatever its
                  // text, because the staff hold the tablet in front of the guest.
                  className={'flex w-full flex-col justify-center text-left min-h-[48px] px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ' +
                    (alreadyOn > 0 ? 'bg-gold-100' : 'hover:bg-paper-100')}
                >
                  <span className="flex items-baseline gap-2">
                    <span className="text-[13.5px] font-bold text-main">{item.name}</span>
                    <span className="flex-1 border-b border-dotted border-paper-400 translate-y-[-4px]" />
                    <span className="font-display text-[14px] font-bold text-main">{fmtPeso(item.price)}</span>
                    {alreadyOn > 0 && (
                      <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-gold-400 text-ink-900 text-[10.5px] font-bold inline-flex items-center justify-center self-center">
                        {alreadyOn}
                      </span>
                    )}
                  </span>
                  {item.note && <span className="block text-[10.5px] italic text-muted mt-0.5">{item.note}</span>}
                </button>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

// The menu board (board card k70).
//
// The owner's correction after the first two builds: it must look like the menu
// the hotel actually uses — a paper card, the house name across the top, each
// category between its own rules, dishes on the left and prices on the right
// joined by dotted leaders — and it must be ONE scroll with nothing to choose
// first, so a hand just runs down it.
//
// It is still a till, never a poster: the whole line is the tap target (a finger
// never aims at an 8px price), the row lifts under the cursor, and a dish already
// on the bill has its count written on its own line, so the same order cannot
// quietly land twice.
export function MenuPicker({ onPick, busy = false, counts = {} }: MenuPickerProps) {
  // The menu is read from the database so every tablet shows the same one, so it
  // arrives a moment after the first render.
  const [menu, setMenu] = useState<MenuCategory[] | null>(null)
  // Finding one dish on a 61-item card is slow by scrolling, so there is a box for
  // it. It narrows the CARD — the paper look, the categories and the count badges
  // all stay — and empties back to the whole menu in one tap.
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const loaded = await getMenu()
      if (!cancelled) setMenu(loaded)
    })()
    return () => { cancelled = true }
  }, [])

  const found = useMemo(() => {
    if (!menu) return []
    const q = query.trim().toLowerCase()
    if (!q) return menu
    return menu
      .map(c => ({ ...c, items: c.items.filter(i => (i.name + ' ' + (i.note || '')).toLowerCase().includes(q)) }))
      .filter(c => c.items.length > 0)
  }, [menu, query])

  if (!menu) {
    return (
      <div className="border border-soft rounded-lg bg-card px-3 py-6 text-center">
        <p className="text-[12.5px] text-muted">Reading the menu…</p>
      </div>
    )
  }

  const [left, right] = splitColumns(found)

  return (
    <div className="space-y-2">
      {/* The search sits ABOVE the card on purpose: the card itself stays a paper
          menu, and this is the till's own tool. */}
      <div className="flex items-center gap-2 bg-card border border-soft focus-within:border-gold-500 rounded-lg px-3 min-h-[44px]">
        <Search className="w-4 h-4 text-muted shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Find a dish"
          aria-label="Find a dish on the menu"
          className="w-full bg-transparent text-[13px] text-main py-2 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear the search"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 -mr-1.5 rounded-lg text-muted hover:text-main transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="rounded-lg border border-paper-300 bg-paper-50 overflow-hidden">
        <div className="px-4 pt-3 pb-2 text-center border-b-2 border-ink-900">
          <p className="font-display font-extrabold uppercase tracking-[0.16em] text-[13.5px] text-main">
            Daweez Restaurant &amp; Bar
          </p>
          <p className="text-[9.5px] uppercase tracking-[0.1em] text-muted mt-0.5">
            {query ? `${found.reduce((n, c) => n + c.items.length, 0)} dish(es) match “${query.trim()}”` : 'Tap a dish to put it on the bill'}
          </p>
        </div>

        <div className="max-h-[62vh] overflow-y-auto px-3 py-1.5">
          {found.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted">
              Nothing on the menu matches “{query.trim()}”.
              <span className="block mt-1 text-[12px]">If the kitchen can make it, write it under the card.</span>
            </p>
          ) : (
            <div className="grid gap-x-7 sm:grid-cols-2">
              <MenuColumn categories={left} onPick={onPick} busy={busy} counts={counts} />
              <MenuColumn categories={right} onPick={onPick} busy={busy} counts={counts} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

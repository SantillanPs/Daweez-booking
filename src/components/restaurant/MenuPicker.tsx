import React, { useEffect, useMemo, useState } from 'react'
import {
  BadgePercent, Beer, Beef, Coffee, Cookie, CupSoda, Drumstick, Fish, Ham,
  IceCreamCone, Salad, Sandwich, Search, Soup, Utensils, Wheat, X,
} from 'lucide-react'
import { MenuCategory, MenuItem, getMenu } from '../../utils/restaurantMenu'
import { getAllTabLines } from '../../utils/tabs'

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
  /** Called once per tap, with where the dish is on screen. The caller writes the line onto the tab. */
  onPick: (item: MenuItem, from: DOMRect) => void
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

function MenuColumn({ categories, onPick, busy, counts, best }: {
  categories: MenuCategory[]
  onPick: (item: MenuItem, from: DOMRect) => void
  busy: boolean
  counts: Record<string, number>
  best: Best | null
}) {
  return (
    <div>
      {categories.map(category => {
        const GroupIcon = ICONS[category.id] || Utensils
        return (
          <section key={category.id}>
            {/* The category sits centred between its own thin rules, the way it is
                printed on the laminated card the staff already know. */}
            <p className="sticky top-0 z-10 bg-paper-50 flex items-center gap-2 pt-4 pb-1.5 text-[12px] font-bold uppercase tracking-[0.13em] text-brand-text">
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
              const isBest = best?.name === item.name
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={busy}
                  onClick={e => onPick(item, e.currentTarget.getBoundingClientRect())}
                  title={isBest ? item.name + ' — ordered ' + best.count + ' times' : item.note ? item.name + ' — ' + item.note : item.name}
                  // A finger, not a mouse: every dish is a 48px row whatever its
                  // text, because the staff hold the tablet in front of the guest.
                  // **A gold bar** is a dish on this order, as the gold bar on a room is a
                  // guest in it; the count is on the slip, not here (it used to be both).
                  className={'relative flex w-full flex-col justify-center text-left min-h-[48px] px-2.5 py-1.5 transition-[background-color,transform] duration-200 active:scale-[0.99] cursor-pointer disabled:opacity-50 ' +
                    (isBest ? 'menu-best my-1.5 py-2.5 gap-0.5 border-y border-gold-400 ' : 'rounded-lg ') +
                    (alreadyOn > 0 ? 'bg-gold-100 shadow-[inset_4px_0_0_#D0AB60]' : 'hover:bg-paper-100')}
                >
                  {isBest && <span aria-hidden="true" className="menu-best-mark" />}
                  <span className="flex items-baseline gap-2">
                    <span className={isBest ? 'font-display text-[15.5px] font-bold tracking-tight text-main' : 'text-[15px] font-bold text-main'}>{item.name}</span>
                    <span className="flex-1 border-b border-dotted border-paper-400 translate-y-[-4px]" />
                    <span className="font-display text-[15px] font-bold tabular-nums text-main">{fmtPeso(item.price)}</span>
                  </span>
                  {isBest && <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-gold-800">Best seller</span>}
                  {item.note && <span className="block text-[12px] italic text-muted mt-0.5">{item.note}</span>}
                </button>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}

/** The dish ordered most, and how many times. */
interface Best { name: string; count: number }

/**
 * The best seller: the dish on today's menu that has been ordered the most, over every
 * order slip there has ever been (Sebastian, 2026-10-08: *"keep track of how many times
 * each item has been ordered and add an indicator of which item is the most popular"*).
 * Nothing new is stored — every order line is already kept. One dish on the whole menu,
 * not one per section; he saw it per section and asked why there were three.
 */
// ponytail: reads every order line once when the menu opens and adds them up here.
// Move the sum into a database view when the table is big enough to feel.
async function readBest(menu: MenuCategory[]): Promise<Best | null> {
  const onMenu = new Set(menu.flatMap(c => c.items.map(i => i.name)))
  const counts: Record<string, number> = {}
  for (const l of await getAllTabLines()) {
    if (l.kind === 'charge' && onMenu.has(l.description)) counts[l.description] = (counts[l.description] || 0) + Number(l.qty || 1)
  }
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  return top ? { name: top[0], count: top[1] } : null
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
// on the bill wears a gold bar, so the same order cannot quietly land twice.
//
// **The best seller is set like a signature dish** — fine double gold rules above and
// below, a diamond in the top one, its name in the heading face, "Best seller" under it
// (`menu-best` in `index.css`). Sebastian chose it over medals, stars and a crown: the
// crown "made it look less like a food item".
export function MenuPicker({ onPick, busy = false, counts = {} }: MenuPickerProps) {
  // The menu is read from the database so every tablet shows the same one, so it
  // arrives a moment after the first render.
  const [menu, setMenu] = useState<MenuCategory[] | null>(null)
  // Finding one dish on a 61-item card is slow by scrolling, so there is a box for
  // it. It narrows the CARD — the paper look, the categories and the count badges
  // all stay — and empties back to the whole menu in one tap.
  const [query, setQuery] = useState('')
  const [best, setBest] = useState<Best | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const loaded = await getMenu()
      if (cancelled) return
      setMenu(loaded)
      // The menu does not wait for this: the best seller's rules are drawn when it lands.
      const top = await readBest(loaded)
      if (!cancelled) setBest(top)
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

  // The card takes whatever height the screen has left and scrolls inside it, so the
  // search above it and the order under it stay where they are. On a screen too short for
  // that, it is simply as long as the menu and the page scrolls.
  return (
    <div className="min-h-0 flex flex-col gap-2 tall:flex-1">
      {/* The search sits ABOVE the card on purpose: the card itself stays a paper
          menu, and this is the till's own tool. */}
      <div className="shrink-0 flex items-center gap-2 bg-card border border-soft rounded-lg px-3 min-h-[44px] transition-[border-color,box-shadow] duration-200 focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-400/30">
        <Search className="w-4 h-4 text-muted shrink-0" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Find a dish"
          aria-label="Find a dish on the menu"
          className="w-full bg-transparent text-base text-main py-2 focus:outline-none"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} aria-label="Clear the search"
            className="shrink-0 inline-flex items-center justify-center w-8 h-8 -mr-1.5 rounded-lg text-muted hover:text-main transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="min-h-0 flex flex-col tall:flex-1 rounded-lg border border-paper-300 bg-paper-50 overflow-hidden">
        <div className="shrink-0 px-4 pt-3 pb-2 text-center border-b-2 border-ink-900">
          <p className="font-display font-extrabold uppercase tracking-[0.16em] text-[13.5px] text-main">
            Daweez Restaurant &amp; Bar
          </p>
          {query && (
            <p className="text-[11px] uppercase tracking-[0.1em] text-muted mt-0.5">
              {found.reduce((n, c) => n + c.items.length, 0)} dish(es) match “{query.trim()}”
            </p>
          )}
        </div>

        <div className="tall:flex-1 tall:min-h-0 tall:overflow-y-auto overscroll-contain px-3 py-1.5">
          {found.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-muted">
              Nothing on the menu matches “{query.trim()}”.
              <span className="block mt-1 text-[12px]">If the kitchen can make it, write it under the card.</span>
            </p>
          ) : (
            <div className="grid gap-x-7 sm:grid-cols-2">
              <MenuColumn categories={left} onPick={onPick} busy={busy} counts={counts} best={best} />
              <MenuColumn categories={right} onPick={onPick} busy={busy} counts={counts} best={best} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

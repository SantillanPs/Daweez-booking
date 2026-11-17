import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'
import { Tab, TabLine } from '../../types/tab'
import { MenuItem, getMenu } from '../../utils/restaurantMenu'
import { OrderChange, saveOrderChanges, withChanges } from '../../utils/orderChanges'
import { readTabLines, tabTotal } from '../../utils/tabs'
import { resettleWith } from '../../utils/billPayment'
import { changedRows } from '../../utils/bookingBalance'
import { useDashboardData } from '../DashboardContext'
import { peso, randomUUID } from '../../utils/helpers'
import { showToast } from '../../utils/toast'

// FIX A ROOM'S ORDER (Sebastian, 2026-11-17: "the staff want to be able to edit orders that are already
// served. because of the chance of making a mistake with the orders"; where they get stuck is a bill sent
// to a room). Chosen from the mock: the slip opens where it is — under its row on the bill, and under its
// row in Restaurant → History ("make it also editable in the restaurant history"). A dish's − takes one
// off and its bin takes it all off (stock back, a "taken off" step); "+ Dish" adds the right one already
// served, so it never goes to the kitchen. Each change saves by itself, behind the screen, and the room's
// bill is priced again. Only a slip not paid yet opens here.

/** "2 ado" → two of whatever matches "ado" — the paper slip's way of writing a dish. */
function parseDish(text: string): { qty: number; query: string } {
  const m = text.match(/^\s*(\d+)\s*x?\s*(.*)$/i)
  return { qty: m ? Math.max(1, Number(m[1])) : 1, query: (m ? m[2] : text).trim() }
}

export function RoomSlipFix({ tab, lines: start, onSaved }: {
  tab: Tab
  lines: TabLine[]
  /** After each save, with the slip as the database left it. */
  onSaved?: (lines: TabLine[]) => void
}) {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()
  const [lines, setLines] = useState(() => start.filter(l => l.kind === 'charge'))
  const [first] = useState(() => tabTotal(start))
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [dish, setDish] = useState('')
  const [bump, setBump] = useState('')
  const [saved, setSaved] = useState(0)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const live = useRef({ bookings, rooms, venues, updateBooking })
  useEffect(() => { live.current = { bookings, rooms, venues, updateBooking } })

  useEffect(() => {
    let alive = true
    void getMenu().then(c => { if (alive) setMenu(c.flatMap(x => x.items)) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // One save at a time, in the order tapped. The slip on screen is never locked while it saves.
  const change = (c: Omit<OrderChange, 'at' | 'served'>) => {
    const one: OrderChange = { ...c, served: true, at: new Date().toISOString() }
    setLines(ls => withChanges(ls, [one], tab.id))
    queue.current = queue.current.then(async () => {
      try {
        const done = await saveOrderChanges({ tabId: tab.id, changes: [one] })
        onSaved?.(done.lines)
        setSaved(n => n + 1)
        if (done.stockProblem) showToast('Saved, but the stock did not follow. Check the stock room.', 'error')
      } catch {
        showToast('That change was not saved. The slip shows what is saved.', 'error')
        await readTabLines(tab.id).then(ls => setLines(ls.filter(l => l.kind === 'charge'))).catch(() => {})
        return
      }
      // The room's bill is priced again with the slip as it is now.
      const now = live.current
      const booking = now.bookings.find(b => b.id === tab.booking_id)
      if (!booking) return
      try {
        const rows = await resettleWith(booking, {}, now.bookings, { rooms: now.rooms, venues: now.venues })
        for (const b of rows) if (b.id !== booking.id || changedRows([booking], [b]).length > 0) await now.updateBooking(b)
      } catch {
        showToast('The slip is saved, but the room’s bill was not updated. Open the booking to put it right.', 'error')
      }
    })
  }

  const step = (l: TabLine, by: number) => {
    setBump(by > 0 || l.qty > 1 ? l.id : '')
    change({ lineId: l.id, menuItemId: l.menu_item_id, description: l.description, unitPrice: Number(l.unit_price || 0), delta: by, other: !!l.other_charge })
  }
  const drop = (l: TabLine) =>
    change({ lineId: l.id, menuItemId: l.menu_item_id, description: l.description, unitPrice: Number(l.unit_price || 0), delta: -Number(l.qty), remove: true, other: !!l.other_charge })

  const hits = useMemo(() => {
    const q = parseDish(dish).query.toLowerCase()
    if (!q) return []
    // "ice" is Iced Tea before Plain Rice: a word that starts with it comes first.
    const word = (i: MenuItem) => i.name.toLowerCase().split(/[\s-]/).some(w => w.startsWith(q))
    return menu.filter(i => i.name.toLowerCase().includes(q)).sort((a, b) => Number(word(b)) - Number(word(a))).slice(0, 4)
  }, [menu, dish])

  const add = (item: MenuItem) => {
    const { qty } = parseDish(dish)
    const same = lines.find(l => l.menu_item_id === item.id && Number(l.unit_price) === Number(item.price))
    setBump(same?.id || '')
    change({ lineId: same?.id || randomUUID(), menuItemId: item.id, description: item.name, unitPrice: Number(item.price), delta: qty })
    setDish('')
  }

  const total = tabTotal(lines)
  return (
    <div className="font-sans">
      {lines.length === 0 && <p className="py-3 text-center text-[13px] text-muted">Nothing on this slip.</p>}
      {lines.map(l => (
        <div key={l.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-2.5 h-11 border-b border-soft animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none">
          <span className="inline-flex items-center h-8 rounded-full bg-softbg">
            <button type="button" onClick={() => step(l, -1)} aria-label={'One fewer ' + l.description}
              className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-main text-[16px] font-bold cursor-pointer active:scale-90 transition-transform">−</button>
            <b key={l.qty} className={'min-w-[14px] text-center font-display text-[14px] font-extrabold text-gold-800 tabular-nums ' + (bump === l.id ? 'bp-up' : '')}>{l.qty}</b>
            <button type="button" onClick={() => step(l, 1)} aria-label={'One more ' + l.description}
              className="w-8 h-8 grid place-items-center rounded-full text-muted hover:text-main text-[16px] font-bold cursor-pointer active:scale-90 transition-transform">+</button>
          </span>
          <span className="flex items-baseline gap-2 min-w-0 text-[14px] font-semibold text-main">
            <span className="truncate">{l.description}</span>
            <span className="flex-1 min-w-3 border-b border-dotted border-paper-400 -translate-y-1" />
          </span>
          <span className="font-display text-[14px] font-semibold tabular-nums text-main min-w-[52px] text-right">{peso(Number(l.amount || 0))}</span>
          <button type="button" onClick={() => drop(l)} aria-label={'Take ' + l.description + ' off'}
            className="w-9 h-9 -mr-1.5 grid place-items-center rounded-lg text-paper-400 hover:text-danger-600 hover:bg-danger-50 cursor-pointer active:scale-90 transition">
            <Trash2 className="w-[15px] h-[15px]" />
          </button>
        </div>
      ))}

      <div>
        <label className="grid grid-cols-[92px_1fr] items-center h-11">
          <Plus aria-hidden="true" className="w-4 h-4 justify-self-center text-gold-800" />
          <input value={dish} onChange={e => setDish(e.target.value)} autoComplete="off" placeholder="Dish, e.g. 2 sisig"
            onKeyDown={e => { if (e.key === 'Enter' && hits[0]) { e.preventDefault(); add(hits[0]) } if (e.key === 'Escape') setDish('') }}
            className="w-full bg-transparent outline-none text-base font-semibold text-main placeholder:text-paper-400 placeholder:font-medium" />
        </label>
        {hits.length > 0 && (
          <ul className="mb-1 bg-card border border-soft rounded-xl shadow-lg py-1 animate-in fade-in zoom-in-95 duration-150 motion-reduce:animate-none">
            {hits.map(i => (
              <li key={i.id}>
                <button type="button" onClick={() => add(i)} className="w-full flex items-baseline gap-2 px-3 min-h-11 text-left text-[14px] font-semibold text-main hover:bg-softbg cursor-pointer">
                  {parseDish(dish).qty > 1 && <span className="text-gold-800 font-bold">{parseDish(dish).qty} ×</span>}
                  <span className="truncate">{i.name}</span>
                  <span className="flex-1 border-b border-dotted border-paper-400 -translate-y-1" />
                  <span className="font-display tabular-nums">{peso(Number(i.price))}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2 pt-2.5 mt-0.5 border-t-[1.5px] border-ink-900 text-[12px] font-semibold text-muted">
        {saved > 0 && <span key={saved} className="bp-up shrink-0 whitespace-nowrap text-emerald-700"><Check className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Saved</span>}
        {total !== first && <s className="ml-auto font-display text-[12px] text-paper-400 tabular-nums">{peso(first)}</s>}
        <b className={(total !== first ? '' : 'ml-auto ') + 'font-display text-[16px] font-extrabold text-main tabular-nums'}>{peso(total)}</b>
      </div>
    </div>
  )
}

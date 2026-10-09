import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { MenuCategory, MenuItem, getMenu, newMenuItemId, removeMenuItem, saveMenuItem } from '../utils/restaurantMenu'
import { NumInput } from './NumInput'
import { getAllTabLines } from '../utils/tabs'
import { askConfirm } from '../utils/confirm'
import { showToast } from '../utils/toast'

// A box that reads as the printed menu until it is touched: no border at rest, the
// gold line under it while it is being typed in. 16px so a phone does not zoom in.
const BOX = 'h-11 min-w-0 bg-transparent rounded-md px-2 text-[16px] font-bold text-main placeholder:font-medium placeholder:text-muted outline-none border border-transparent hover:border-soft focus:border-gold-500 focus:bg-card transition-colors duration-150'

/**
 * Restaurant → Menu: the restaurant changes its own menu (Sebastian, 2026-10-09: *"allow
 * the restaurant to add new items on the menu and edit the prices"*). Until now a new dish
 * or a new price meant asking for the database to be changed.
 *
 * It is the menu itself, typed into — there is no Save button. A row is saved when the
 * staff leave it, shown at once and taken back if the save fails, like every other button
 * in the restaurant. A dish taken off is hidden, never deleted: the slips and the kitchen
 * that already hold it keep its name and the price it was sold at.
 */
export function MenuTab() {
  const [menu, setMenu] = useState<MenuCategory[] | null>(null)
  // What the database holds, to tell a changed row from one only looked at.
  const saved = useRef<Record<string, MenuItem>>({})
  // The dish just added, so its name box takes the cursor.
  const [fresh, setFresh] = useState<string | null>(null)
  // How many of each dish have ever been ordered, by name — the same sum the Orders
  // screen picks its "Best seller" from (Sebastian, 2026-10-09: "show how many times the
  // item has been ordered... make it obvious that that's what it means"), so it is said
  // in words on every row, not left as a bare number.
  const [ordered, setOrdered] = useState<Record<string, number> | null>(null)
  useEffect(() => {
    let alive = true
    getAllTabLines().then(lines => {
      if (!alive) return
      const n: Record<string, number> = {}
      lines.forEach(l => { if (l.kind === 'charge') n[l.description] = (n[l.description] || 0) + Number(l.qty || 1) })
      setOrdered(n)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    getMenu().then(m => {
      if (!alive) return
      m.forEach(c => c.items.forEach(i => { saved.current[i.id] = i }))
      setMenu(m)
    })
    return () => { alive = false }
  }, [])

  const patch = (catId: string, itemId: string, change: Partial<MenuItem>) =>
    setMenu(m => m && m.map(c => c.id !== catId ? c : { ...c, items: c.items.map(i => i.id === itemId ? { ...i, ...change } : i) }))
  const drop = (catId: string, itemId: string) =>
    setMenu(m => m && m.map(c => c.id !== catId ? c : { ...c, items: c.items.filter(i => i.id !== itemId) }))

  const leave = async (cat: MenuCategory, item: MenuItem) => {
    const name = item.name.trim()
    const was = saved.current[item.id]
    // A new row left empty was never a dish.
    if (!name) { if (was) patch(cat.id, item.id, { name: was.name }); else drop(cat.id, item.id); return }
    if (was && was.name === name && was.price === item.price) return
    const next = { ...item, name }
    saved.current[item.id] = next
    try {
      await saveMenuItem(cat.id, next, cat.items.findIndex(i => i.id === item.id) + 1)
      if (!was) showToast(name + ' is on the menu.')
    } catch {
      if (was) { saved.current[item.id] = was; patch(cat.id, item.id, was) }
      else { delete saved.current[item.id]; drop(cat.id, item.id) }
      showToast('Could not save ' + name + '. Please try again.', 'error')
    }
  }

  const add = (cat: MenuCategory) => {
    const id = newMenuItemId(cat.id)
    setFresh(id)
    setMenu(m => m && m.map(c => c.id !== cat.id ? c : { ...c, items: [...c.items, { id, name: '', price: 0 }] }))
  }

  const remove = async (cat: MenuCategory, item: MenuItem) => {
    const was = saved.current[item.id]
    if (!was) { drop(cat.id, item.id); return }
    const ok = await askConfirm({
      title: 'Take ' + was.name + ' off the menu?',
      message: 'It will no longer be offered. Orders already taken keep it.',
      confirmLabel: 'Take it off',
    })
    if (!ok) return
    const at = cat.items.findIndex(i => i.id === item.id)
    drop(cat.id, item.id)
    try { await removeMenuItem(item.id) }
    catch {
      setMenu(m => m && m.map(c => c.id !== cat.id ? c : { ...c, items: [...c.items.slice(0, at), was, ...c.items.slice(at)] }))
      showToast('Could not take ' + was.name + ' off the menu. Please try again.', 'error')
    }
  }

  if (!menu) {
    return (
      <div className="max-w-[1100px] columns-1 md:columns-2 gap-x-10" aria-busy="true">
        {[7, 5, 6, 4].map((n, i) => (
          <div key={i} className="break-inside-avoid pb-6 space-y-3">
            <div className="h-4 w-32 rounded bg-paper-200 animate-pulse" />
            {Array.from({ length: n }, (_, j) => <div key={j} className="h-9 rounded bg-paper-100 animate-pulse" />)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="max-w-[1100px] columns-1 md:columns-2 gap-x-10 font-sans">
      {menu.map(cat => (
        <section key={cat.id} className="break-inside-avoid pb-5">
          <p className="flex items-center gap-2 pb-1.5 text-[12px] font-bold uppercase tracking-[0.13em] text-brand-text">
            <span className="whitespace-nowrap">
              {cat.name}
              {cat.note && <span className="ml-1.5 font-semibold tracking-normal normal-case text-muted">{cat.note}</span>}
            </span>
            <span className="flex-1 border-t border-paper-300" />
          </p>
          {cat.items.map(item => (
            <div key={item.id} className="group flex items-center gap-1 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
              <input
                value={item.name}
                autoFocus={fresh === item.id}
                onChange={e => patch(cat.id, item.id, { name: e.target.value })}
                onBlur={() => leave(cat, item)}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                placeholder="Name of the dish"
                aria-label="Dish"
                className={BOX + ' flex-1'}
              />
              {ordered && item.name.trim() && (() => {
                const n = ordered[item.name.trim()] || 0
                return (
                  <span className={'shrink-0 w-[104px] text-right text-[12px] leading-4 tabular-nums animate-in fade-in duration-300 ' + (n ? 'font-semibold text-ink-700' : 'text-muted')}>
                    {n ? <>Ordered <b className="font-display text-[14px] text-main">{n.toLocaleString()}</b> {n === 1 ? 'time' : 'times'}</> : 'Not ordered yet'}
                  </span>
                )
              })()}
              <span className="text-[15px] font-bold text-muted" aria-hidden="true">₱</span>
              <NumInput
                value={item.price}
                onChange={n => patch(cat.id, item.id, { price: n })}
                onFocus={e => e.currentTarget.select()}
                onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
                onBlur={() => leave(cat, item)}
                aria-label={'Price of ' + (item.name || 'this dish')}
                className={BOX + ' w-20 text-right font-display tabular-nums'}
              />
              <button type="button" onClick={() => remove(cat, item)}
                title={'Take ' + (item.name || 'this dish') + ' off the menu'}
                aria-label={'Take ' + (item.name || 'this dish') + ' off the menu'}
                className="w-11 h-11 shrink-0 inline-flex items-center justify-center rounded-md text-paper-400 hover:bg-softbg hover:text-danger-600 transition-[background-color,color,transform] duration-150 active:scale-95 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => add(cat)}
            className="inline-flex items-center gap-1 h-11 px-2 text-[14px] font-semibold text-brand-text hover:underline active:scale-[0.98] transition-transform cursor-pointer">
            <Plus className="w-4 h-4" /> Add to {cat.name}
          </button>
        </section>
      ))}
    </div>
  )
}

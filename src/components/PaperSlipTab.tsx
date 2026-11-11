import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BedDouble, Banknote, Check, Plus, Search, User } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { Booking } from '../types/booking'
import { MenuItem, getMenu } from '../utils/restaurantMenu'
import { getAllTabLines, savePaperSlip } from '../utils/tabs'
import { OrderSlip, getSlipsByBooking } from '../utils/orderSlips'
import { SlipStory, getSlipHistory } from '../utils/slipHistory'
import { groupOf } from '../utils/bookingGroup'
import { stayStage } from '../utils/stayStage'
import { resettleWith } from '../utils/billPayment'
import { changedRows } from '../utils/bookingBalance'
import { useRealtimeTabs } from '../hooks/useRealtimeTabs'
import { dateToString, peso, randomUUID } from '../utils/helpers'
import { showToast } from '../utils/toast'
import { AnimatedNumber } from './AnimatedNumber'

// RESTAURANT → PAPER SLIP (Sebastian, 2026-11-11). The restaurant takes orders on paper and the staff copy
// them in later, so the tablet's flow (table, kitchen, serve, send bill) is steps they never take. This is
// the paper copied line for line: who, what they ate, and how it was settled.
//
// **The name first, the dishes second, the rest last** (his comment on the mock: "the primary should be
// name/search, 2nd is the orders, 3rd is the rest"). The switch beside the name is two icons with a sliding
// thumb ("a bit more subtle and visual"): cash, paid now — the usual — or a bed, onto a guest's bill.
//
// **On a guest's bill, the name box becomes the search**, by name only ("no need for rooms since there will
// be more than 1 reservations that are booked at the same room, just different dates"), over every stay not
// over yet: in the hotel or still to arrive. Once picked, what is already on their bill shows under the name,
// so the same paper slip is not logged twice.
//
// A dish is typed the way it is written: "2 adobo" is two Chicken Adobo. A dish not on the menu is still
// taken, with its price typed on its line.

const METHODS = [['Cash', 'bg-emerald-700'], ['GCash', 'bg-blue-700'], ['Bank transfer', 'bg-gold-800']] as const

interface Line { key: string; item?: MenuItem; name: string; price: number; qty: number }
interface Pending { key: string; who: string; room: boolean; how: string; items: string; total: number; at: string }

const today = () => dateToString(new Date())
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const dayOf = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const focusOn = (id: string) => document.getElementById(id)?.focus()
const slipItems = (lines: { qty: number; description: string }[]) => lines.map(l => Number(l.qty) + ' ' + l.description).join(' · ')

/** "2 ado" → two of whatever matches "ado". */
function parseDish(text: string): { qty: number; query: string } {
  const m = text.match(/^\s*(\d+)\s*x?\s*(.*)$/i)
  return { qty: m ? Math.max(1, Number(m[1])) : 1, query: (m ? m[2] : text).trim() }
}

export function PaperSlipTab() {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [often, setOften] = useState<MenuItem[]>([])
  const [room, setRoom] = useState(false)
  const [name, setName] = useState('')
  const [guest, setGuest] = useState<Booking | null>(null)
  const [billOf, setBillOf] = useState<{ id: string; slips: OrderSlip[] }>({ id: '', slips: [] })
  const [lines, setLines] = useState<Line[]>([])
  const [dish, setDish] = useState('')
  const [method, setMethod] = useState('Cash')
  const [day, setDay] = useState(today())
  const [open, setOpen] = useState<'' | 'name' | 'dish'>('')
  const [hint, setHint] = useState('')
  const [slips, setSlips] = useState<SlipStory[]>([])
  const [pending, setPending] = useState<Pending[]>([])
  const dayRef = useRef<HTMLInputElement>(null)

  // The menu, and the four dishes ordered most, summed from every order line (as the menu's Best seller is).
  useEffect(() => {
    let alive = true
    void (async () => {
      const items = (await getMenu()).flatMap(c => c.items)
      if (!alive) return
      setMenu(items)
      const counts = new Map<string, number>()
      for (const l of await getAllTabLines()) counts.set(l.description, (counts.get(l.description) || 0) + Number(l.qty || 1))
      if (alive) setOften(items.filter(i => counts.has(i.name)).sort((a, b) => counts.get(b.name)! - counts.get(a.name)!).slice(0, 4))
    })()
    return () => { alive = false }
  }, [])

  // Today's slips, from the same story Restaurant → History reads; it follows the other tablets live.
  const loadToday = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    try { setSlips((await getSlipHistory(start)).filter(s => s.at >= start.toISOString())) } catch { /* the list keeps what it had */ }
  }, [])
  useEffect(() => { queueMicrotask(() => void loadToday()) }, [loadToday])
  useRealtimeTabs(() => void loadToday())

  // A guest's bill: one entry per bill, not per room — a booking of three rooms is one name.
  const stays = useMemo(() => {
    const t = today(), seen = new Set<string>(), out: { booking: Booking; note: string; arriving: boolean }[] = []
    for (const b of [...bookings].sort((a, z) => a.check_in.localeCompare(z.check_in))) {
      if (b.status === 'blocked' || !b.guest_name?.trim() || stayStage(b, t) === 'after') continue
      const first = groupOf(b, bookings)[0] || b
      if (seen.has(first.id)) continue
      seen.add(first.id)
      const arriving = b.check_in >= t
      out.push({ booking: first, arriving, note: !arriving ? 'In the hotel' : b.check_in === t ? 'Arrives today' : 'Arrives ' + dayOf(b.check_in) })
    }
    return out
  }, [bookings])

  // What is already on the picked guest's bill.
  useEffect(() => {
    if (!guest) return
    let alive = true
    const ids = groupOf(guest, bookings).map(b => b.id)
    void getSlipsByBooking(ids).then(r => { if (alive) setBillOf({ id: guest.id, slips: ids.flatMap(id => r[id] || []) }) }).catch(() => {})
    return () => { alive = false }
  }, [guest, bookings, slips])

  const { qty, query } = parseDish(dish)
  const onBill = guest && billOf.id === guest.id ? billOf.slips : []
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)

  const switchTo = (toRoom: boolean) => {
    if (toRoom === room) return
    setRoom(toRoom); setGuest(null); setName(''); setHint('')
    focusOn('paper-name')
    setOpen(toRoom ? 'name' : '')
  }

  const pickGuest = (b: Booking) => {
    setGuest(b); setName(b.guest_name); setOpen(''); setHint('')
    focusOn('paper-dish')
  }

  const addDish = (item: MenuItem | null, label: string, qty: number) => {
    const n = item ? item.name : label.replace(/^./, c => c.toUpperCase())
    const at = lines.findIndex(l => l.name === n)
    if (at >= 0) {
      setLines(ls => ls.map((l, i) => (i === at ? { ...l, qty: l.qty + qty } : l)))
    } else {
      setLines(ls => [...ls, { key: randomUUID(), item: item || undefined, name: n, price: item ? Number(item.price) : 0, qty }])
    }
    setDish(''); setOpen(''); setHint('')
    // A dish not on the menu waits for its price; anything else goes straight back to the next dish.
    // (its price box takes the focus as it appears: `autoFocus`).
    if (item || at >= 0) focusOn('paper-dish')
  }

  const step = (key: string, by: number) => setLines(ls => ls.flatMap(l => (l.key !== key ? [l] : l.qty + by > 0 ? [{ ...l, qty: l.qty + by }] : [])))

  const nameHits = useMemo(() => {
    const q = name.trim().toLowerCase()
    return stays.filter(s => s.booking.guest_name.toLowerCase().includes(q)).slice(0, 6)
  }, [stays, name])

  const dishHits = useMemo(() => {
    const { query } = parseDish(dish)
    const q = query.toLowerCase()
    if (!q) return []
    // "ice" is Iced Tea before Plain Rice: a word that starts with it comes first.
    const word = (i: MenuItem) => i.name.toLowerCase().split(/[\s-]/).some(w => w.startsWith(q))
    return menu.filter(i => i.name.toLowerCase().includes(q)).sort((a, b) => Number(word(b)) - Number(word(a))).slice(0, 4)
  }, [menu, dish])

  const log = () => {
    if (!lines.length) { setHint('Add what they ordered.'); focusOn('paper-dish'); return }
    if (lines.some(l => !l.price)) { setHint('Type the price.'); document.querySelector<HTMLInputElement>('[data-price=""]')?.focus(); return }
    if (room && !guest) { setHint('Pick the guest.'); focusOn('paper-name'); setOpen('name'); return }
    const who = name.trim() || 'Walk-in'
    const kept = { lines, name, guest, room, method }
    // The slip lands in today's list at once and is saved behind it; a failed save puts the form back.
    const key = randomUUID()
    const paidAt = day === today() ? new Date().toISOString() : new Date(day + 'T12:00').toISOString()
    setPending(p => [{ key, who, room, how: room ? 'On bill' : method, items: slipItems(lines.map(l => ({ qty: l.qty, description: l.name }))), total, at: new Date().toISOString() }, ...p])
    setLines([]); setName(''); setGuest(null); setRoom(false); setMethod('Cash'); setHint(''); setDay(today())
    focusOn('paper-name')
    void (async () => {
      try {
        const bookingId = kept.room ? kept.guest!.id : undefined
        const saved = await savePaperSlip({
          label: who,
          dishes: kept.lines.map(l => ({ menuItemId: l.item?.id, name: l.name, price: l.price, qty: l.qty })),
          ...(bookingId ? { bookingId } : { paid: { method: kept.method, at: paidAt } }),
        })
        showToast(kept.room ? peso(saved.total) + ' on ' + who + '’s bill' : peso(saved.total) + ' · ' + kept.method)
        if (bookingId) {
          // The bill is priced again with the food on it, as when a table's bill goes on a room.
          const booking = bookings.find(b => b.id === bookingId)
          if (booking) {
            try {
              const rows = await resettleWith(booking, {}, bookings, { rooms, venues })
              for (const b of rows) if (b.id !== booking.id || changedRows([booking], [b]).length > 0) await updateBooking(b)
            } catch {
              showToast('The slip is on the bill, but the room’s balance was not updated. Open the booking to put it right.', 'error')
            }
          }
        }
        await loadToday()
      } catch {
        setLines(kept.lines); setName(kept.name); setGuest(kept.guest); setRoom(kept.room); setMethod(kept.method)
        showToast('The slip was not saved. It is back in the form — try again.', 'error')
      } finally {
        setPending(p => p.filter(x => x.key !== key))
      }
    })()
  }

  const rows = [
    ...pending.map(p => ({ ...p, fresh: true })),
    ...slips.map(s => ({
      key: s.tab.id, fresh: false, who: s.tab.label || 'Walk-in', room: !!s.tab.booking_id,
      how: s.tab.booking_id ? 'On bill' : s.tab.paid_at ? (s.tab.payment_records?.[0]?.method || 'Paid') : 'Not paid',
      items: s.steps.filter(e => e.kind === 'order').flatMap(e => e.items).map(i => i.qty + ' ' + i.name).join(' · '),
      total: s.total, at: s.at,
    })),
  ]
  const dayTotal = rows.reduce((s, r) => s + r.total, 0)

  const opt = 'w-full min-h-[46px] flex items-center gap-2.5 px-2 py-1.5 rounded-[10px] text-left text-[14px] font-semibold text-main hover:bg-gold-100 cursor-pointer'

  return (
    <div className="max-w-[640px] mx-auto px-4 py-5 grid gap-4 font-sans">
      <div className="bg-card border border-soft rounded-[18px] p-[18px] grid gap-3.5">

        {/* 1 · Who */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <label className={'flex-1 min-w-0 flex items-center gap-2 border-b-2 py-1 transition-colors focus-within:border-gold-400 ' + (room ? 'border-gold-400' : 'border-paper-200')}>
              {room ? <Search className="w-5 h-5 shrink-0 text-gold-800 animate-in zoom-in-50 duration-300" /> : <User className="w-5 h-5 shrink-0 text-muted" />}
              <input id="paper-name" value={name} autoComplete="off" aria-label={room ? 'Find the guest' : 'Name on the slip'}
                placeholder={room ? 'Guest’s name, e.g. Reyes' : 'Name, e.g. Mang Ben'}
                onFocus={() => room && !guest && setOpen('name')}
                onChange={e => { setName(e.target.value); if (guest) setGuest(null); if (room) setOpen('name') }}
                onKeyDown={e => {
                  if (e.key === 'Escape') setOpen('')
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (room && !guest && name.trim() && nameHits[0]) pickGuest(nameHits[0].booking)
                  else { setOpen(''); focusOn('paper-dish') }
                }}
                className="flex-1 min-w-0 bg-transparent outline-none py-1 font-display text-[26px] font-bold tracking-tight text-main placeholder:text-paper-400 placeholder:font-semibold" />
              {guest && <Check className="w-5 h-5 shrink-0 text-emerald-700 animate-in zoom-in-50 duration-300" strokeWidth={3} />}
            </label>
            {/* Paid now, or on a guest's bill: two icons and a thumb that slides between them. */}
            <div role="group" aria-label="Paid now or on a guest's bill" className="relative shrink-0 inline-flex p-[3px] rounded-full bg-softbg">
              <span aria-hidden className={'absolute left-[3px] top-[3px] w-10 h-10 rounded-full shadow-[0_1px_2px_rgba(28,28,28,.12)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(.3,1.4,.5,1)] motion-reduce:transition-none ' + (room ? 'translate-x-10 bg-gold-400' : 'bg-card')} />
              <button type="button" title="Paid now" aria-label="Paid now" aria-pressed={!room} onClick={() => switchTo(false)}
                className={'relative w-10 h-10 grid place-items-center rounded-full cursor-pointer active:scale-[.88] transition-[color,transform] ' + (room ? 'text-paper-400' : 'text-main')}>
                <Banknote className="w-[18px] h-[18px]" />
              </button>
              <button type="button" title="On a guest's bill" aria-label="On a guest's bill" aria-pressed={room} onClick={() => switchTo(true)}
                className={'relative w-10 h-10 grid place-items-center rounded-full cursor-pointer active:scale-[.88] transition-[color,transform] ' + (room ? 'text-main' : 'text-paper-400')}>
                <BedDouble className="w-[18px] h-[18px]" />
              </button>
            </div>
          </div>

          {open === 'name' && room && !guest && (
            <div role="listbox" className="absolute left-0 right-0 top-full mt-1.5 z-10 bg-card border border-soft rounded-[14px] shadow-softLg p-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              {nameHits.length ? nameHits.map((s, i) => (
                <button key={s.booking.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickGuest(s.booking)}
                  className={opt + (i === 0 && name.trim() ? ' bg-gold-100' : '')}>
                  <User className="w-4 h-4 shrink-0 text-muted" />
                  <span className="flex-1 min-w-0">
                    <span className="block truncate">{s.booking.guest_name}</span>
                    <small className="flex items-center gap-1.5 text-[12px] font-medium text-muted">
                      <i className={'w-[7px] h-[7px] rounded-full ' + (s.arriving ? 'bg-gold-400' : 'bg-emerald-700')} />{s.note}
                    </small>
                  </span>
                </button>
              )) : <p className="m-2.5 text-[12.5px] text-muted">No guest by that name.</p>}
            </div>
          )}

          {guest && onBill.length > 0 && (
            <div className="mt-2 grid gap-0.5 px-2.5 py-2 rounded-xl bg-page animate-in fade-in slide-in-from-top-1 duration-200">
              <span className="text-[10.5px] font-bold tracking-[0.08em] text-muted">ALREADY ON THE BILL</span>
              {onBill.map(s => (
                <div key={s.tab.id} className="grid grid-cols-[52px_minmax(0,1fr)_auto] gap-2 text-[12.5px] text-muted">
                  <span>{dayOf(dateToString(new Date(s.tab.created_at)))}</span>
                  <span className="truncate text-main">{slipItems(s.lines)}</span>
                  <b className="font-bold text-main tabular-nums">{peso(s.total)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2 · What they ordered */}
        <div>
          {lines.map(l => (
            <div key={l.key} className={'grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 items-center min-h-[52px] border-b border-soft animate-in fade-in slide-in-from-top-2 duration-300 '}>
              <span className="inline-flex items-center rounded-xl bg-softbg">
                <button type="button" aria-label="One less" onClick={() => step(l.key, -1)} className="w-9 h-11 text-[18px] font-bold text-muted cursor-pointer active:scale-90">−</button>
                <b key={l.qty} className="min-w-5 text-center font-display text-[15px] font-extrabold animate-in zoom-in-125 duration-300">{l.qty}</b>
                <button type="button" aria-label="One more" onClick={() => step(l.key, 1)} className="w-9 h-11 text-[18px] font-bold text-muted cursor-pointer active:scale-90">+</button>
              </span>
              <span className="min-w-0 truncate text-[14.5px] font-semibold text-main">
                {l.name}
                {l.item && <small className="block text-[11.5px] font-medium text-muted">{peso(l.price)}</small>}
              </span>
              {l.item
                ? <span className="text-[14.5px] font-bold tabular-nums">{peso(l.price * l.qty)}</span>
                : <input autoFocus data-price={l.price ? l.key : ''} inputMode="decimal" placeholder="₱ 150" aria-label={'Price of ' + l.name}
                    defaultValue={l.price || ''} onChange={e => { const p = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; setLines(ls => ls.map(x => (x.key === l.key ? { ...x, price: p } : x))) }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusOn('paper-dish') } }}
                    className="w-[84px] bg-transparent border-b-[1.5px] border-gold-400 py-1 text-right text-[16px] font-bold outline-none placeholder:text-paper-400" />}
            </div>
          ))}
          <div className="relative">
            <label className="flex items-center gap-2 border-b-[1.5px] border-paper-200 py-1.5 transition-colors focus-within:border-gold-400">
              <Plus className="w-4 h-4 shrink-0 text-gold-800" />
              <input id="paper-dish" value={dish} autoComplete="off" aria-label="Add a dish" placeholder="Dish, e.g. 2 adobo"
                onChange={e => { setDish(e.target.value); setOpen('dish') }}
                onKeyDown={e => {
                  if (e.key === 'Escape') setOpen('')
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (query) addDish(dishHits[0] || null, query, qty)
                }}
                className="flex-1 min-w-0 bg-transparent outline-none py-1 text-[16px] font-semibold text-main placeholder:text-paper-400 placeholder:font-medium" />
            </label>
            {open === 'dish' && query && (
                <div role="listbox" className="absolute left-0 right-0 top-full mt-1.5 z-10 bg-card border border-soft rounded-[14px] shadow-softLg p-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                  {dishHits.map((d, i) => (
                    <button key={d.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => addDish(d, d.name, qty)} className={opt + (i === 0 ? ' bg-gold-100' : '')}>
                      <span className="min-w-7 font-display text-[13px] font-extrabold text-gold-800">{qty}×</span>
                      <span className="flex-1 min-w-0 truncate">{d.name}</span>
                      <em className="not-italic text-[13px] text-muted">{peso(d.price)}</em>
                    </button>
                  ))}
                  <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => addDish(null, query, qty)} className={opt + ' text-muted' + (dishHits.length ? '' : ' bg-gold-100')}>
                    <span className="min-w-7 font-display text-[13px] font-extrabold text-gold-800">{qty}×</span>
                    <span className="flex-1 min-w-0 truncate">“{query}”, not on the menu</span>
                  </button>
                </div>
            )}
          </div>
          {!dish.trim() && often.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {often.map(d => (
                <button key={d.id} type="button" onClick={() => addDish(d, d.name, 1)}
                  className="min-h-9 px-3 rounded-full bg-softbg text-[12.5px] font-semibold text-main cursor-pointer active:scale-[.93] transition-transform">
                  {d.name}<em className="not-italic font-medium text-muted ml-1">{peso(d.price)}</em>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3 · The rest */}
        <div className="grid gap-3 pt-3 border-t border-soft">
          <div className="flex justify-between items-center gap-2.5 flex-wrap">
            {room
              ? <span className="inline-flex items-center gap-1.5 min-h-10 text-[12.5px] font-bold text-gold-800">
                  <BedDouble className="w-[15px] h-[15px]" />{guest ? 'On ' + guest.guest_name.split(' ')[0] + '’s bill' : 'Pick the guest ↑'}
                </span>
              : <div className="flex flex-wrap gap-1">
                  {METHODS.map(([m, dot]) => (
                    <button key={m} type="button" aria-pressed={method === m} onClick={() => setMethod(m)}
                      className={'inline-flex items-center gap-1.5 min-h-10 px-3 rounded-full text-[12.5px] font-bold cursor-pointer active:scale-[.94] transition-[background-color,color,transform] ' + (method === m ? 'bg-softbg text-main' : 'text-muted')}>
                      <i className={'w-2 h-2 rounded-full ' + dot} />{m === 'Bank transfer' ? 'Bank' : m}
                    </button>
                  ))}
                </div>}
            <div className="flex items-baseline gap-2">
              {/* The day it was paid, for a slip copied in the next morning; a guest's bill needs no day. */}
              {!room && (
                <label className="relative text-[12.5px] font-semibold text-main border-b-[1.5px] border-dashed border-gold-400 cursor-pointer">
                  {dayOf(day)}
                  <input ref={dayRef} type="date" value={day} max={today()} aria-label="Day it was paid" onChange={e => e.target.value && setDay(e.target.value)}
                    onClick={() => dayRef.current?.showPicker?.()} className="absolute inset-0 opacity-0 cursor-pointer" />
                </label>
              )}
              <span className="text-[12px] text-muted">·</span>
              <b className="font-display text-[20px] font-extrabold tabular-nums"><AnimatedNumber value={total} prefix="₱" duration={450} /></b>
            </div>
          </div>
          {hint && <p role="alert" className="-mt-1.5 text-[12px] font-semibold text-red-700">{hint}</p>}
          <button type="button" onClick={log}
            className="h-12 rounded-[14px] bg-ink-900 hover:bg-ink-700 text-white text-[15px] font-bold flex items-center justify-center gap-2 cursor-pointer active:scale-[.97] transition-[transform,background-color]">
            <Check className="w-[18px] h-[18px]" />Log slip
          </button>
        </div>
      </div>

      {/* Today's slips */}
      <div className="bg-card border border-soft rounded-[18px] px-4 py-1.5">
        <div className="flex justify-between items-baseline pt-2.5 pb-2 text-[12.5px] font-semibold text-muted">
          <span>Today · {rows.length} {rows.length === 1 ? 'slip' : 'slips'}</span>
          <b className="font-display text-[16px] font-extrabold text-main tabular-nums"><AnimatedNumber value={dayTotal} prefix="₱" duration={450} /></b>
        </div>
        {rows.length === 0 && <p className="py-3 border-t border-soft text-[13px] text-muted">No slips yet today.</p>}
        {rows.map(r => (
          <div key={r.key} className={'grid grid-cols-[62px_minmax(0,1fr)_auto] gap-2.5 items-center py-2.5 border-t border-soft ' + (r.fresh ? 'animate-in fade-in slide-in-from-top-3 duration-500' : '')}>
            <span className="font-mono text-[11.5px] text-muted">{timeOf(r.at)}</span>
            <span className="min-w-0">
              <b className="text-[14px]">{r.who}</b>
              <span className="inline-flex items-center gap-1 ml-1.5 text-[11px] font-bold text-muted">
                {r.room ? <BedDouble className="w-3 h-3" /> : <Banknote className="w-3 h-3" />}{r.how}
              </span>
              <span className="block truncate text-[12px] text-muted">{r.items}</span>
            </span>
            <span className="text-[14.5px] font-bold tabular-nums">{peso(r.total)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

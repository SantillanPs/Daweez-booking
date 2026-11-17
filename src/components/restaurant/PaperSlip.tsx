import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BedDouble, Banknote, Check, ChevronDown, Clock, FileText, Plus, Receipt, X } from 'lucide-react'
import { useDashboardData } from '../DashboardContext'
import { Booking } from '../../types/booking'
import { MenuItem, getMenu } from '../../utils/restaurantMenu'
import { readPayLaterNames, savePaperSlip } from '../../utils/tabs'
import { OrderSlip, getSlipsByBooking } from '../../utils/orderSlips'
import { groupOf } from '../../utils/bookingGroup'
import { stayStage } from '../../utils/stayStage'
import { resettleWith } from '../../utils/billPayment'
import { changedRows } from '../../utils/bookingBalance'
import { dateToString, peso, randomUUID } from '../../utils/helpers'
import { showToast } from '../../utils/toast'
import { AnimatedNumber } from '../AnimatedNumber'
import { NewTag } from '../NewMark'

// THE PAPER SLIP (Sebastian, 2026-11-11). The restaurant takes orders on paper and the staff copy
// them in later, so the tablet's flow (table, kitchen, serve, send bill) is steps they never take. This is
// the paper copied line for line: who, what they ate, and how it was settled.
//
// **A popup over Restaurant → Orders, opened from the top right of the empty slip** (2026-11-12). It was
// its own sub-tab first; he asked for it to be "part of the restaurant orders", then, of it folded into
// the slip panel, "this is bugging out. so just make it into a popup". A logged slip is in Restaurant →
// History and Today's money.
//
// **Redrawn as the paper it copies** (2026-11-17, from the mock; he found the old one "really zoomed in and
// chaotic"): one type scale (12 / 14 / 16 / 20), the slip only as tall as what is on it — no blank lines —
// dishes on ruled lines with the menu's dotted leaders, and the total riding on Log, so the end of the slip
// is one row. The name reads first, the dishes second, the rest steps back.
//
// **The day is a desk-calendar leaf in the corner**, where the staff write it on the paper ("find a place for
// the date. feel free to get creative"); the whole leaf opens the date. A day gone by turns it gold, so a slip
// copied in the next morning is never logged as today's by mistake. It is the day the money came in.
//
// **The switch beside it is two icons with a sliding thumb**: cash, settled at the restaurant — the usual —
// or a bed, onto a guest's bill. On a guest's bill the name box becomes the search, by name only ("no need for
// rooms since there will be more than 1 reservations that are booked at the same room, just different dates"),
// over every stay not over yet. Once picked, what is already on their bill shows under the name, so the same
// paper slip is not logged twice.
//
// **How they paid is one quiet word with a chevron** ("make this a bit more subtle or contextual", then "make
// it into a popup"); the ways open above it. **Later is one of them** ("add a pay later for the paper slip",
// "it would make sense for the pay later to be ... near the payment methods"): the slip goes on the front
// desk's Pay later list under the name, and names already there come up as it is typed, with what they owe.
//
// A dish is typed the way it is written: "2 adobo" is two Chicken Adobo. A dish not on the menu is still
// taken, with its price typed on its line. Only ✕ closes it: a tap outside would lose a half-copied slip.

const WAYS = [['Cash', 'bg-emerald-700'], ['GCash', 'bg-blue-700'], ['Bank transfer', 'bg-gold-800']] as const
const LATER = 'Later'

interface Line { key: string; item?: MenuItem; name: string; price: number; qty: number }

const today = () => dateToString(new Date())
const dayOf = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const focusOn = (id: string) => document.getElementById(id)?.focus()
const slipItems = (lines: { qty: number; description: string }[]) => lines.map(l => Number(l.qty) + ' ' + l.description).join(' · ')

/** "2 ado" → two of whatever matches "ado". */
function parseDish(text: string): { qty: number; query: string } {
  const m = text.match(/^\s*(\d+)\s*x?\s*(.*)$/i)
  return { qty: m ? Math.max(1, Number(m[1])) : 1, query: (m ? m[2] : text).trim() }
}

function Way({ m }: { m: string }) {
  if (m === LATER) return <><Clock className="w-[13px] h-[13px]" strokeWidth={2.5} />Later</>
  const dot = WAYS.find(w => w[0] === m)?.[1] || ''
  return <><i className={'w-[7px] h-[7px] rounded-full ' + dot} />{m === 'Bank transfer' ? 'Bank' : m}</>
}

export function PaperSlip({ onClose }: { onClose: () => void }) {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [owing, setOwing] = useState<{ name: string; owed: number }[]>([])
  const [room, setRoom] = useState(false)
  const [name, setName] = useState('')
  const [guest, setGuest] = useState<Booking | null>(null)
  const [billOf, setBillOf] = useState<{ id: string; slips: OrderSlip[] }>({ id: '', slips: [] })
  const [lines, setLines] = useState<Line[]>([])
  const [dish, setDish] = useState('')
  const [method, setMethod] = useState('Cash')
  const [ways, setWays] = useState(false)
  const [day, setDay] = useState(today())
  const [open, setOpen] = useState<'' | 'name' | 'dish'>('')
  const [hint, setHint] = useState('')
  const [logged, setLogged] = useState(0)
  const dayRef = useRef<HTMLInputElement>(null)
  const later = method === LATER && !room

  useEffect(() => {
    let alive = true
    void getMenu().then(c => { if (alive) setMenu(c.flatMap(x => x.items)) }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    void readPayLaterNames().then(n => { if (alive) setOwing(n) }).catch(() => {})
    return () => { alive = false }
  }, [logged])

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

  // What is already on the picked guest's bill (read again after each slip logged).
  useEffect(() => {
    if (!guest) return
    let alive = true
    const ids = groupOf(guest, bookings).map(b => b.id)
    void getSlipsByBooking(ids).then(r => { if (alive) setBillOf({ id: guest.id, slips: ids.flatMap(id => r[id] || []) }) }).catch(() => {})
    return () => { alive = false }
  }, [guest, bookings, logged])

  const { qty, query } = parseDish(dish)
  const onBill = guest && billOf.id === guest.id ? billOf.slips : []
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0)
  const guestStay = guest && stays.find(s => s.booking.id === guest.id)
  const where = guest && (rooms.find(r => r.id === guest.room_id)?.name || venues.find(v => v.id === guest.venue_id)?.name || '')
  const owes = later ? owing.find(o => o.name.toLowerCase() === name.trim().toLowerCase()) : undefined

  const switchTo = (toRoom: boolean) => {
    if (toRoom === room) return
    setRoom(toRoom); setGuest(null); setName(''); setHint(''); setWays(false)
    focusOn('paper-name')
    setOpen(toRoom ? 'name' : '')
  }

  const pickGuest = (b: Booking) => {
    setGuest(b); setName(b.guest_name); setOpen(''); setHint('')
    focusOn('paper-dish')
  }

  const pickWay = (m: string) => {
    setMethod(m); setWays(false); setHint('')
    if (m === LATER && !name.trim()) { focusOn('paper-name'); setOpen('name') }
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

  // Pay later: the names already on the list that fit what is typed — not the one already typed in full.
  const laterHits = useMemo(() => {
    const q = name.trim().toLowerCase()
    return owing.filter(o => o.name.toLowerCase().includes(q) && o.name.toLowerCase() !== q).slice(0, 6)
  }, [owing, name])

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
    if (later && !name.trim()) { setHint('Who pays later?'); focusOn('paper-name'); setOpen('name'); return }
    const who = name.trim() || 'Walk-in'
    const kept = { lines, name, guest, room, method }
    // The form clears at once for the next paper slip and the save runs behind it; a failed save puts it back.
    const paidAt = day === today() ? new Date().toISOString() : new Date(day + 'T12:00').toISOString()
    setLines([]); setName(''); setGuest(null); setRoom(false); setMethod('Cash'); setHint(''); setDay(today()); setWays(false)
    focusOn('paper-name')
    void (async () => {
      try {
        const bookingId = kept.room ? kept.guest!.id : undefined
        const saved = await savePaperSlip({
          label: who,
          dishes: kept.lines.map(l => ({ menuItemId: l.item?.id, name: l.name, price: l.price, qty: l.qty })),
          ...(bookingId ? { bookingId } : kept.method === LATER ? { later: true } : { paid: { method: kept.method, at: paidAt } }),
        })
        showToast(kept.room ? peso(saved.total) + ' on ' + who + '’s bill'
          : kept.method === LATER ? peso(saved.total) + ' · ' + who + ' pays later'
          : peso(saved.total) + ' · ' + kept.method, 'success')
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
        setLogged(n => n + 1)
      } catch {
        setLines(kept.lines); setName(kept.name); setGuest(kept.guest); setRoom(kept.room); setMethod(kept.method)
        showToast('The slip was not saved. It is back in the form — try again.', 'error')
      }
    })()
  }

  const pop = 'absolute -left-2 -right-2 top-full mt-1 z-20 max-h-[220px] overflow-y-auto overscroll-contain bg-card border border-soft rounded-[10px] shadow-softLg p-1 animate-in fade-in slide-in-from-top-1 duration-200'
  const opt = 'w-full min-h-10 flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-[14px] font-semibold text-main hover:bg-gold-100 cursor-pointer'
  const past = day !== today()

  return createPortal(
    <div className="fixed inset-0 z-[70] grid place-items-center p-4 bg-ink-900/35 font-sans animate-in fade-in duration-200 motion-reduce:animate-none">
      <div role="dialog" aria-modal="true" aria-label="Paper slip"
        className="w-[400px] max-w-full bg-card rounded-[18px] px-4 pt-3 pb-4 grid gap-3 content-start shadow-softLg animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">

        <div className="flex items-center gap-2">
          {/* The day: a calendar leaf; anywhere on it opens the date (Sebastian: "the entire ui of the date should be clickable"). */}
          <button type="button" title="Day on the slip" aria-label={'Day on the slip: ' + dayOf(day)}
            onClick={() => { try { dayRef.current?.showPicker() } catch { dayRef.current?.focus() } }}
            className={'relative w-9 h-10 shrink-0 grid grid-rows-[16px_1fr] overflow-hidden rounded-[10px] border bg-card text-center cursor-pointer hover:-rotate-[4deg] transition-[transform,border-color] motion-reduce:transition-none ' + (past ? 'border-gold-400' : 'border-paper-300')}>
            <small className={'text-[12px] leading-4 font-bold transition-colors ' + (past ? 'bg-gold-400 text-ink-900' : 'bg-softbg text-muted')}>
              {new Date(day + 'T12:00').toLocaleDateString('en-US', { month: 'short' })}
            </small>
            <b key={day} className="font-display text-[16px] leading-[22px] font-extrabold text-main animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none">
              {new Date(day + 'T12:00').getDate()}
            </b>
            <input ref={dayRef} type="date" value={day} max={today()} tabIndex={-1} aria-hidden onChange={e => e.target.value && setDay(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 pointer-events-none" />
          </button>
          <span className="flex-1 inline-flex items-center gap-2 text-[14px] font-semibold text-muted">
            <FileText className="w-4 h-4 text-gold-800" />Paper slip
          </span>
          {/* Settled at the restaurant, or on a guest's bill: two icons and a thumb that slides between them. */}
          <div role="group" aria-label="Paid at the restaurant or on a guest's bill" className="relative shrink-0 inline-flex p-[3px] rounded-full bg-softbg">
            <span aria-hidden className={'absolute left-[3px] top-[3px] w-[34px] h-[34px] rounded-full shadow-[0_1px_2px_rgba(28,28,28,.12)] transition-[transform,background-color] duration-300 ease-[cubic-bezier(.3,1.4,.5,1)] motion-reduce:transition-none ' + (room ? 'translate-x-[34px] bg-gold-400' : 'bg-card')} />
            <button type="button" title="Paid at the restaurant" aria-label="Paid at the restaurant" aria-pressed={!room} onClick={() => switchTo(false)}
              className={'relative w-[34px] h-[34px] grid place-items-center rounded-full cursor-pointer active:scale-[.88] transition-[color,transform] ' + (room ? 'text-paper-400' : 'text-main')}>
              <Banknote className="w-4 h-4" />
            </button>
            <button type="button" title="On a guest's bill" aria-label="On a guest's bill" aria-pressed={room} onClick={() => switchTo(true)}
              className={'relative w-[34px] h-[34px] grid place-items-center rounded-full cursor-pointer active:scale-[.88] transition-[color,transform] ' + (room ? 'text-main' : 'text-paper-400')}>
              <BedDouble className="w-4 h-4" />
            </button>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}
            className="w-9 h-9 -mr-2 grid place-items-center rounded-[10px] text-muted hover:bg-softbg hover:text-main cursor-pointer active:scale-90 transition-transform">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Who */}
        <div className="relative">
          <label className="flex items-center gap-2 border-b-[1.5px] border-paper-300 py-1 transition-colors focus-within:border-gold-400">
            <input id="paper-name" autoFocus value={name} autoComplete="off" aria-label={room ? 'Find the guest' : later ? 'Who pays later' : 'Name on the slip'}
              placeholder={room ? 'Guest’s name, e.g. Reyes' : later ? 'Who pays, e.g. Sir James' : 'Name, e.g. Mang Ben'}
              onFocus={() => ((room && !guest) || later) && setOpen('name')}
              onBlur={() => setOpen(o => (o === 'name' ? '' : o))}
              onChange={e => { setName(e.target.value); if (guest) setGuest(null); if (room || later) setOpen('name') }}
              onKeyDown={e => {
                if (e.key === 'Escape') setOpen('')
                if (e.key !== 'Enter') return
                e.preventDefault()
                if (room && !guest && name.trim() && nameHits[0]) pickGuest(nameHits[0].booking)
                else { setOpen(''); focusOn('paper-dish') }
              }}
              className="flex-1 min-w-0 bg-transparent outline-none py-1 font-display text-[20px] font-bold tracking-tight text-main placeholder:text-paper-400 placeholder:font-semibold" />
            {guest && (
              <span title={guestStay?.note} className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted whitespace-nowrap animate-in fade-in duration-300">
                <i className={'w-[7px] h-[7px] rounded-full ' + (guestStay?.arriving ? 'bg-gold-400' : 'bg-emerald-700')} />{where}
              </span>
            )}
            {owes && <span className="text-[12px] font-semibold text-muted whitespace-nowrap animate-in fade-in duration-300">owes {peso(owes.owed)}</span>}
            {guest && <Check className="w-4 h-4 shrink-0 text-emerald-700 animate-in zoom-in-50 duration-300" strokeWidth={3} />}
          </label>

          {/* The lists float over the slip (Sebastian, 2026-11-17: "it shouldn't occupy space in the slip"). */}
          {open === 'name' && room && !guest && (
            <div role="listbox" className={pop}>
              {nameHits.length ? nameHits.map((s, i) => (
                <button key={s.booking.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => pickGuest(s.booking)}
                  className={opt + (i === 0 && name.trim() ? ' bg-gold-100' : '')}>
                  <span className="flex-1 min-w-0 truncate">{s.booking.guest_name}</span>
                  <small className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted whitespace-nowrap">
                    <i className={'w-[7px] h-[7px] rounded-full ' + (s.arriving ? 'bg-gold-400' : 'bg-emerald-700')} />{s.note}
                  </small>
                </button>
              )) : <p className="m-2.5 text-[12px] text-muted">No guest by that name.</p>}
            </div>
          )}
          {open === 'name' && later && laterHits.length > 0 && (
            <div role="listbox" className={pop}>
              {laterHits.map(o => (
                <button key={o.name} type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setName(o.name); setOpen(''); focusOn('paper-dish') }} className={opt}>
                  <span className="flex-1 min-w-0 truncate">{o.name}</span>
                  <small className="text-[12px] font-medium text-muted whitespace-nowrap">owes {peso(o.owed)}</small>
                </button>
              ))}
            </div>
          )}

          {guest && onBill.length > 0 && (
            <div title={onBill.map(s => dayOf(dateToString(new Date(s.tab.created_at))) + ' · ' + slipItems(s.lines)).join('\n')}
              className="mt-2 flex items-center gap-2 px-3 py-2 rounded-[10px] bg-page text-[12px] font-semibold text-muted animate-in fade-in slide-in-from-top-1 duration-200">
              <Receipt className="w-3.5 h-3.5 shrink-0 text-gold-800" />
              <span className="flex-1">{onBill.length} {onBill.length === 1 ? 'slip' : 'slips'} already on the bill</span>
              <b className="font-bold text-main tabular-nums">{peso(onBill.reduce((s, x) => s + x.total, 0))}</b>
            </div>
          )}
        </div>

        {/* What they ordered: ruled lines with the menu's dotted leaders. */}
        <div>
          <div className="max-h-[34dvh] overflow-y-auto overscroll-contain">
            {lines.map(l => (
              <div key={l.key} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2.5 items-center h-9 border-b border-paper-200 animate-in fade-in slide-in-from-top-1 duration-300">
                {/* − + show on hover; a tablet has no hover, so they always show there. */}
                <span className="inline-flex items-center h-7 rounded-full transition-colors group-hover:bg-softbg group-focus-within:bg-softbg [@media(hover:none)]:bg-softbg">
                  <button type="button" aria-label="One less" onClick={() => step(l.key, -1)}
                    className="w-6 h-7 text-[15px] font-bold text-muted cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 active:scale-90">−</button>
                  <b key={l.qty} className="min-w-[14px] text-center font-display text-[14px] font-extrabold text-gold-800 animate-in zoom-in-125 duration-300">{l.qty}</b>
                  <button type="button" aria-label="One more" onClick={() => step(l.key, 1)}
                    className="w-6 h-7 text-[15px] font-bold text-muted cursor-pointer opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 [@media(hover:none)]:opacity-100 active:scale-90">+</button>
                </span>
                <span className="flex items-baseline gap-2 min-w-0 text-[14px] font-semibold text-main">
                  <span className="truncate">{l.name}</span>
                  <span className="flex-1 min-w-3 border-b border-dotted border-paper-400 -translate-y-1" />
                </span>
                {l.item
                  ? <span className="min-w-14 text-right font-display text-[14px] font-semibold tabular-nums">{peso(l.price * l.qty)}</span>
                  : <input autoFocus data-price={l.price ? l.key : ''} inputMode="decimal" placeholder="₱ 150" aria-label={'Price of ' + l.name}
                      defaultValue={l.price || ''} onChange={e => { const p = parseFloat(e.target.value.replace(/[^\d.]/g, '')) || 0; setLines(ls => ls.map(x => (x.key === l.key ? { ...x, price: p } : x))) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); focusOn('paper-dish') } }}
                      className="w-[72px] bg-transparent border-b-[1.5px] border-gold-400 py-0.5 text-right text-[16px] font-semibold outline-none placeholder:text-paper-400" />}
              </div>
            ))}
          </div>
          <div className="relative">
            <label className="flex items-center gap-2.5 h-9">
              <span className="w-[62px] grid place-items-center text-gold-800"><Plus className="w-4 h-4" /></span>
              <input id="paper-dish" value={dish} autoComplete="off" aria-label="Add a dish" placeholder="Dish, e.g. 2 adobo"
                onChange={e => { setDish(e.target.value); setOpen('dish') }}
                onBlur={() => setOpen(o => (o === 'dish' ? '' : o))}
                onKeyDown={e => {
                  if (e.key === 'Escape') setOpen('')
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (query) addDish(dishHits[0] || null, query, qty)
                }}
                className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-semibold text-main placeholder:text-paper-400 placeholder:font-medium" />
            </label>
            {open === 'dish' && query && (
              <div role="listbox" className={pop}>
                {dishHits.map((d, i) => (
                  <button key={d.id} type="button" onMouseDown={e => e.preventDefault()} onClick={() => addDish(d, d.name, qty)} className={opt + (i === 0 ? ' bg-gold-100' : '')}>
                    <span className="min-w-6 font-display text-[12px] font-extrabold text-gold-800">{qty}×</span>
                    <span className="flex-1 min-w-0 truncate">{d.name}</span>
                    <small className="text-[12px] font-medium text-muted">{peso(d.price)}</small>
                  </button>
                ))}
                <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => addDish(null, query, qty)} className={opt + ' text-muted' + (dishHits.length ? '' : ' bg-gold-100')}>
                  <span className="min-w-6 font-display text-[12px] font-extrabold text-gold-800">{qty}×</span>
                  <span className="flex-1 min-w-0 truncate">“{query}”, not on the menu</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* The end of the slip: how it was settled, and Log with the total on it. */}
        <div className="grid gap-2">
          {hint && <p role="alert" className="text-right text-[12px] font-semibold text-red-700">{hint}</p>}
          <div className="flex items-center gap-2 pt-3 border-t-[1.5px] border-ink-900">
            {room
              ? <span className="flex-1 inline-flex items-center gap-1.5 text-[12px] font-bold text-gold-800">
                  <BedDouble className="w-4 h-4" />{guest ? where || 'On ' + guest.guest_name.split(' ')[0] + '’s bill' : 'Pick the guest ↑'}
                </span>
              : <div className="flex-1 relative">
                  {ways && <div className="fixed inset-0 z-10" onClick={() => setWays(false)} />}
                  <button type="button" aria-haspopup="menu" aria-expanded={ways} onClick={() => setWays(w => !w)}
                    className={'relative inline-flex items-center gap-1.5 h-9 pl-1 pr-2 rounded-full text-[12px] font-bold hover:bg-softbg cursor-pointer active:scale-[.96] transition-[background-color,transform] ' + (later ? 'text-gold-800' : 'text-main')}>
                    <Way m={method} />
                    <ChevronDown className={'w-3 h-3 opacity-60 transition-transform duration-200 ' + (ways ? 'rotate-180' : '')} strokeWidth={3} />
                    <NewTag id="paper-slip-later" at="-top-1.5 -right-2" />
                  </button>
                  <div role="menu" className={'absolute left-0 bottom-full mb-1.5 z-20 min-w-[148px] grid gap-0.5 p-1.5 bg-card border border-paper-300 rounded-[14px] shadow-softLg origin-bottom-left transition-[opacity,transform] duration-200 ease-[cubic-bezier(.2,.9,.3,1.2)] motion-reduce:transition-none ' + (ways ? 'opacity-100 scale-100' : 'opacity-0 scale-[.92] translate-y-1 pointer-events-none')}>
                    {[...WAYS.map(w => w[0] as string), LATER].map(m => (
                      <React.Fragment key={m}>
                        {m === LATER && <i className="block h-px mx-1.5 my-1 bg-paper-300" />}
                        <button type="button" role="menuitemradio" aria-checked={method === m} tabIndex={ways ? 0 : -1} onClick={() => pickWay(m)}
                          className={'w-full inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-[12px] font-bold cursor-pointer transition-colors ' + (method === m ? (m === LATER ? 'bg-gold-100 text-gold-800' : 'bg-softbg text-main') : 'text-muted hover:bg-softbg')}>
                          <Way m={m} />
                        </button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>}
            <button type="button" onClick={log}
              className="h-11 px-5 rounded-[10px] bg-ink-900 hover:bg-ink-700 text-white text-[14px] font-bold inline-flex items-center gap-2 cursor-pointer active:scale-[.97] transition-[transform,background-color]">
              <Check className="w-4 h-4" />Log
              <b className="font-display text-[16px] font-extrabold tabular-nums"><AnimatedNumber value={total} prefix="₱" duration={450} /></b>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

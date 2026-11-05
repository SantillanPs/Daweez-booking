import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRightToLine, BedDouble, Check, Minus, ReceiptText, Undo2, UtensilsCrossed } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { TabEvent } from '../types/tab'
import { SlipStory, getSlipHistory } from '../utils/slipHistory'
import { slipNumber } from '../utils/orderSlips'
import { useRealtimeTabs } from '../hooks/useRealtimeTabs'
import { guestPlace } from './restaurant/served'
import { dateToString } from '../utils/helpers'
import { AnimatedNumber } from './AnimatedNumber'

// RESTAURANT → HISTORY (Sebastian, 2026-11-05, task #2: "track orders, and serves, the sent to front desk,
// and sent to room"). Chosen from the mock as "E · Slip steps": one line for each order slip, which opens to
// what happened to it, latest first ("latest should be at the top, not bottom").
//
// **The table and the action do not look alike** ("make the table and actions more distinguishable"): the
// table is a square like the tables popup, the action a pill with its icon and word.
//
// **No colour of its own** (his ruling on the mock: "I want to keep a consistent color signal meaning"). Gold
// already says chosen or in the kitchen and green says ready or paid, so every step here is the same ink on
// paper, told apart by its icon — the same icons the order slip uses (a tick for served, a minus for one off).
//
// Nothing here is typed in: the steps are written by the database as they happen (`tab_events`), and the
// screen follows the other tablets live. Slips from before 2026-11-05 have no serve times: they were never kept.

const PAGE_DAYS = 14

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

const ICON: Record<TabEvent['kind'], typeof Check> = {
  order: ReceiptText,
  served: Check,
  removed: Minus,
  desk: ArrowRightToLine,
  room: BedDouble,
  back: Undo2,
}

const dishes = (items: TabEvent['items']) =>
  items.map(i => (Number(i.qty) > 1 ? i.name + ' ×' + Number(i.qty) : i.name)).join(', ')

export function RestaurantHistory() {
  const { allBookings, rooms, venues } = useDashboardData()
  const [days, setDays] = useState(PAGE_DAYS)
  const [slips, setSlips] = useState<SlipStory[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')

  // Read again whenever a slip or a line changes on any tablet.
  const [tick, setTick] = useState(0)
  const reread = useCallback(() => setTick(t => t + 1), [])
  useRealtimeTabs(reread)
  useEffect(() => {
    let alive = true
    const since = new Date()
    since.setHours(0, 0, 0, 0)
    since.setDate(since.getDate() - (days - 1))
    getSlipHistory(since)
      .then(list => { if (alive) { setSlips(list); setFailed(false) } })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [days, tick])

  /** The room a slip's bill went on, as the staff call it. */
  const roomOf = (bookingId?: string) => {
    const b = bookingId ? allBookings.find(x => x.id === bookingId) : undefined
    return b ? guestPlace(b, rooms, venues) : 'Room'
  }

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (slips || []).filter(s => {
    if (!q) return true
    const hay = [slipNumber(s.tab), String(s.tab.os_number || ''), 'table ' + (s.tab.table_label || ''), s.tab.label,
      s.tab.booking_id ? roomOf(s.tab.booking_id) : '', ...s.steps.flatMap(e => e.items.map(i => i.name))]
      .join(' ').toLowerCase()
    return hay.includes(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [slips, q, allBookings, rooms, venues])

  const byDay = new Map<string, SlipStory[]>()
  for (const s of shown) {
    const day = dateToString(new Date(s.at))
    byDay.set(day, [...(byDay.get(day) || []), s])
  }
  const today = dateToString(new Date())
  const before = new Date()
  before.setDate(before.getDate() - 1)
  const yesterday = dateToString(before)
  const dayName = (day: string) => {
    const long = new Date(day + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return day === today ? 'Today · ' + long : day === yesterday ? 'Yesterday · ' + long : long
  }

  const stepWord = (e: TabEvent, s: SlipStory) =>
    e.kind === 'order' ? 'Ordered' : e.kind === 'served' ? 'Served' : e.kind === 'removed' ? 'Taken off'
      : e.kind === 'desk' ? 'Sent to front desk' : e.kind === 'room' ? 'Sent to ' + roomOf(s.tab.booking_id) : 'Sent back'

  /** The table, as a square like the tables popup. A slip started for a room shows the room. */
  const square = (s: SlipStory) => {
    const typed = (s.tab.table_label || '').trim().replace(/^table\s*/i, '')
    const [top, big] = typed ? ['TABLE', typed] : s.tab.booking_id ? ['ROOM', roomOf(s.tab.booking_id).replace(/^Room\s*/, '')] : ['', s.tab.label || '—']
    return (
      <span aria-label={(top ? top.toLowerCase() + ' ' : '') + big}
        className="w-[46px] h-[46px] shrink-0 grid place-content-center justify-items-center gap-0.5 rounded-xl border-[1.5px] border-ink-900/35 bg-card leading-none">
        {top && <small className="text-[8.5px] font-bold tracking-[0.1em] text-muted">{top}</small>}
        <b className={'font-display font-bold text-ink-900 tabular-nums max-w-[40px] truncate ' + (big.length > 3 ? 'text-[11px]' : 'text-[19px]')}>{big}</b>
      </span>
    )
  }

  /** The most-ordered dish and how many others, from what is still on the slip. */
  const gist = (s: SlipStory) => {
    const count = new Map<string, number>()
    for (const e of s.steps) {
      if (e.kind !== 'order' && e.kind !== 'removed') continue
      for (const i of e.items) count.set(i.name, (count.get(i.name) || 0) + (e.kind === 'order' ? 1 : -1) * Number(i.qty))
    }
    const left = [...count].filter(([, n]) => n > 0)
    if (!left.length) return 'Nothing on it'
    return left[0][0] + (left.length > 1 ? ' +' + (left.length - 1) : '')
  }

  /** Where the bill went, while it is there: a slip sent back is the restaurant's again and shows none. */
  const destination = (s: SlipStory) => {
    const last = [...s.steps].reverse().find(e => e.kind === 'desk' || e.kind === 'room' || e.kind === 'back')
    if (!last || last.kind === 'back') return null
    const Icon = ICON[last.kind]
    return (
      <span className="inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 rounded-full bg-page ring-1 ring-inset ring-soft text-[13px] font-bold text-main whitespace-nowrap">
        <Icon className="w-[15px] h-[15px]" strokeWidth={2} />
        {last.kind === 'room' ? roomOf(s.tab.booking_id) : 'Front desk'}
      </span>
    )
  }

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold text-xl text-main">History</h2>
        <input
          type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="OS-0106, Table 6 or Chopsuey" aria-label="Find a slip"
          className="min-h-11 w-72 max-w-full px-3 rounded-lg border border-soft bg-card text-main text-base outline-none focus:border-gold-500"
        />
      </div>

      {failed && !slips && <p className="bg-card border border-soft rounded-2xl py-10 text-center text-[13px] text-muted">The history could not be read. It will try again when something changes.</p>}
      {slips && byDay.size === 0 && (
        <div className="bg-card border border-soft rounded-2xl py-12 grid justify-items-center gap-2 text-[14px] text-muted">
          <UtensilsCrossed className="w-11 h-11 text-paper-400" strokeWidth={1.2} />
          {q ? 'Nothing matches.' : 'No orders yet.'}
        </div>
      )}

      {[...byDay].map(([day, list]) => (
        <section key={day} className="bg-card border border-soft rounded-2xl overflow-hidden">
          <div className="flex items-baseline justify-between gap-3 px-4 py-3 bg-page border-b border-soft">
            <b className="text-[14px] text-main">{dayName(day)}</b>
            <span className="text-[13px] text-muted tabular-nums">
              {list.length} slip{list.length === 1 ? '' : 's'} · <b className="text-main"><AnimatedNumber value={list.reduce((n, s) => n + s.total, 0)} duration={600} prefix="₱" /></b>
            </span>
          </div>
          {list.map(s => {
            const isOpen = open === s.tab.id
            const latestFirst = [...s.steps].reverse()
            return (
              <div key={s.tab.id} className="border-t border-soft first:border-t-0">
                <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : s.tab.id)}
                  className={'w-full text-left grid grid-cols-[46px_minmax(0,1fr)_auto] sm:grid-cols-[4.5rem_46px_minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-1 px-4 py-2.5 min-h-[66px] cursor-pointer transition-colors hover:bg-page ' + (isOpen ? 'bg-page' : '')}>
                  <span className="hidden sm:block font-mono text-[12px] text-muted">{timeOf(s.at)}</span>
                  {square(s)}
                  <span className="min-w-0 flex flex-col">
                    <span className="text-[14.5px] font-semibold text-main truncate">{gist(s)}</span>
                    <span className="flex items-center gap-2 text-[12.5px] text-muted">
                      <span className="tabular-nums">{slipNumber(s.tab)}</span>
                      <span className="sm:hidden">{timeOf(s.at)}</span>
                      <span className="inline-flex gap-[3px]" aria-hidden="true">
                        {s.steps.map(e => { const Icon = ICON[e.kind]; return <Icon key={e.id} className="w-3 h-3" strokeWidth={2.2} /> })}
                      </span>
                    </span>
                  </span>
                  <span className="col-start-2 sm:col-start-auto justify-self-start sm:justify-self-auto empty:hidden sm:empty:block">{destination(s)}</span>
                  <span className="row-start-1 col-start-3 sm:row-start-auto sm:col-start-auto text-right font-bold text-[14.5px] tabular-nums min-w-[4.5rem]">{fmtPeso(s.total)}</span>
                </button>
                {/* It grows open from its own row rather than appearing (a grid row from 0fr to 1fr). */}
                <div className={'grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ' + (isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <ol className="px-4 sm:pl-[calc(1rem+4.5rem+0.75rem)] pt-1 pb-3.5 grid">
                      {latestFirst.map((e, i) => {
                        const Icon = ICON[e.kind]
                        return (
                          <li key={e.id} style={{ '--d': isOpen ? 50 + i * 40 + 'ms' : '0ms' } as React.CSSProperties}
                            className={'relative grid grid-cols-[4rem_18px_minmax(0,1fr)_auto] gap-2 items-start py-[5px] text-[13.5px] transition-[opacity,transform] [transition-delay:var(--d)] duration-300 motion-reduce:transition-none ' + (isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1')}>
                            <span className="text-[12.5px] text-muted tabular-nums pt-px">{timeOf(e.at)}</span>
                            <span className="relative w-[18px] h-[18px] grid place-items-center text-muted">
                              <Icon className="w-[15px] h-[15px]" strokeWidth={2} />
                              {i < latestFirst.length - 1 && <span aria-hidden="true" className="absolute left-[8px] top-[20px] w-0.5 h-[14px] bg-softbg" />}
                            </span>
                            <span className="min-w-0">
                              <b className="font-bold text-main">{stepWord(e, s)}</b>
                              {e.items.length > 0 && <span className={'text-muted ' + (e.kind === 'removed' ? 'line-through' : '')}> {dishes(e.items)}</span>}
                            </span>
                            <span className="tabular-nums text-main">{e.kind !== 'served' && e.kind !== 'back' && e.amount ? fmtPeso(Math.abs(e.amount)) : ''}</span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>
                </div>
              </div>
            )
          })}
        </section>
      ))}

      {slips && (
        <div className="flex justify-center">
          <button type="button" onClick={() => setDays(d => d + PAGE_DAYS)} className="min-h-11 px-4 rounded-lg border border-soft bg-card text-[13px] font-semibold text-main cursor-pointer hover:border-ink-900/30">
            Show earlier days
          </button>
        </div>
      )}
    </div>
  )
}

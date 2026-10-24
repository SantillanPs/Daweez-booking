import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, FileText, ReceiptText, Search } from 'lucide-react'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { asBill } from '../../utils/bookingGroup'
import { dateToString, normalizeVenueId } from '../../utils/helpers'
import { paymentMethodLabel } from '../../utils/paymentMethod'
import { pillMoney } from './bookingStyles'

type Hit =
  | { kind: 'booking'; key: string; booking: Booking }
  | { kind: 'bill'; key: string; booking: Booking }
  | { kind: 'receipt'; key: string; booking: Booking; record: PaymentRecord; covered: Booking[] }

/** At most this many under each heading; the count beside it says how many matched. */
const SHOW = 6

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
const peso = (n: number) => '₱' + n.toLocaleString()

/**
 * **Find a bill, a receipt or a booking from the calendar** (Sebastian's todo "Search by
 * billing/receipt no.", the calendar search mock, 2026-10-24). A search button on the top line
 * opens a field over it; what matches drops under it in three groups. A booking opens its
 * panel on the calendar, a billing statement opens the statement, a receipt opens the slip.
 * Part of a number is enough ("137" finds 202610-137-12). Cancelled bookings are found too,
 * so an old receipt is never lost; they open their bill, since the calendar no longer shows them.
 */
export function CalendarSearch({ allBookings, rooms, venues, onBooking, onBill, onReceipt }: {
  allBookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  onBooking: (b: Booking) => void
  onBill: (b: Booking) => void
  onReceipt: (b: Booking, record: PaymentRecord, covered: Booking[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const box = useRef<HTMLDivElement>(null)

  const unit = (b: Booking) => {
    if (b.room_id) {
      const r = rooms.find(x => x.id === b.room_id)
      return r ? 'Room ' + r.room_number + ' ' + r.name : b.room_id
    }
    return venues.find(v => v.id === normalizeVenueId(b.venue_id))?.name || b.venue_id || ''
  }
  const dates = (b: Booking) => b.stay_hours ? fmtDay(b.check_in) + ' · ' + b.stay_hours + ' hrs' : fmtDay(b.check_in) + ' – ' + fmtDay(b.check_out)
  const who = (b: Booking) => b.company_name || b.guest_name || 'Guest'

  // Everything there is to find, built once per change to the bookings.
  const index = useMemo(() => {
    const groups = new Map<string, Booking[]>()
    const receipts = new Map<string, { record: PaymentRecord; holders: Booking[] }>()
    for (const b of allBookings) {
      if (b.status === 'blocked') continue
      const g = b.group_id || b.id
      groups.set(g, [...(groups.get(g) || []), b])
      for (const rec of b.payment_records || []) {
        if (!rec.receipt_number) continue
        const found = receipts.get(rec.receipt_number)
        if (found) found.holders.push(b)
        else receipts.set(rec.receipt_number, { record: rec, holders: [b] })
      }
    }
    return { groups: [...groups.values()], receipts: [...receipts.entries()] }
  }, [allBookings])

  const q = query.trim().toLowerCase()
  const today = dateToString(new Date())
  // The stays nearest today come first: the desk mostly looks for what is happening now.
  const near = (b: Booking) => Math.abs(new Date(b.check_in).getTime() - new Date(today).getTime())
  const found = useMemo(() => {
    if (!q) return { bookings: [], bills: [], receipts: [] }
    const bookings = index.groups
      .filter(list => list.some(b => (who(b) + ' ' + b.guest_name + ' ' + unit(b)).toLowerCase().includes(q)))
      .map(list => list[0])
      .sort((a, b) => Number(a.status === 'cancelled') - Number(b.status === 'cancelled') || near(a) - near(b))
    const bills = allBookings
      .filter(b => b.status !== 'blocked' && b.invoice_number?.toLowerCase().includes(q))
      .sort((a, b) => near(a) - near(b))
    const receipts = index.receipts
      .filter(([no]) => no.toLowerCase().includes(q))
      .sort((a, b) => (b[1].record.paid_at || '').localeCompare(a[1].record.paid_at || ''))
    return { bookings, bills, receipts }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, index, allBookings, rooms, venues])

  const hits: Hit[] = [
    ...found.bookings.slice(0, SHOW).map(b => ({ kind: 'booking' as const, key: 'b-' + b.id, booking: b })),
    ...found.bills.slice(0, SHOW).map(b => ({ kind: 'bill' as const, key: 'i-' + b.id, booking: b })),
    ...found.receipts.slice(0, SHOW).map(([no, r]) => ({ kind: 'receipt' as const, key: 'r-' + no, booking: r.holders[0], record: r.record, covered: r.holders })),
  ]

  const close = () => { setOpen(false); setQuery(''); setAt(0) }
  const choose = (h: Hit) => {
    close()
    if (h.kind === 'receipt') onReceipt(h.booking, h.record, h.covered)
    else if (h.kind === 'bill' || h.booking.status === 'cancelled') onBill(h.booking)
    else onBooking(h.booking)
  }

  // "/" opens the search from anywhere on the calendar, unless the desk is typing somewhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest('input, textarea, select, [contenteditable]'))
      if (e.key === '/' && !typing && !open) { e.preventDefault(); setOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])
  useEffect(() => { if (open) input.current?.focus() }, [open])
  // A tap anywhere else puts it away. Not on blur: a tap on a result blurs the field first,
  // and the result would be gone before the tap landed on it.
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close() }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') close()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setAt(i => Math.min(i + 1, hits.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && hits[at]) { e.preventDefault(); choose(hits[at]) }
  }

  const mark = (text: string) => {
    const i = q ? text.toLowerCase().indexOf(q) : -1
    if (i < 0) return text
    return <>{text.slice(0, i)}<mark className="bg-gold-200 text-inherit rounded-[3px] px-px">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
  }
  const moneyOf = (b: Booking) => {
    if (b.status === 'cancelled') return { text: 'Cancelled', className: 'text-muted' }
    const m = pillMoney(asBill(b, allBookings))
    return { text: m.pill, className: m.className }
  }

  let n = -1
  const row = (h: Hit, icon: React.ReactNode, main: React.ReactNode, sub: string, end: { text: string; className: string }) => {
    n += 1
    const i = n
    return (
      <button key={h.key} type="button" role="option" aria-selected={i === at} onClick={() => choose(h)} onMouseMove={() => setAt(i)}
        style={{ '--i': i } as React.CSSProperties}
        className={'bw-rise w-full grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-left cursor-pointer transition-colors active:scale-[0.99] ' + (i === at ? 'bg-gold-100' : '')}>
        <span className="w-[34px] h-[34px] rounded-[9px] grid place-items-center bg-softbg text-main">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] font-bold text-main">{main}</span>
          <span className="block truncate text-[12.5px] text-muted">{sub}</span>
        </span>
        <span className={'text-[12.5px] font-bold whitespace-nowrap ' + end.className}>{end.text}</span>
      </button>
    )
  }
  const head = (title: string, count: number) => (
    <div className="flex justify-between px-2.5 pt-2 pb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-muted">
      {title}<span>{count > SHOW ? SHOW + ' of ' + count : count}</span>
    </div>
  )

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Search (/)" aria-label="Search bills, receipts and bookings"
        className="w-9 h-9 mr-1 inline-flex items-center justify-center rounded-md bg-ink-900 text-white hover:bg-ink-700 transition-[background-color,transform] duration-150 active:scale-95 cursor-pointer">
        <Search className="w-4 h-4" strokeWidth={2.4} />
      </button>
      {open && (
        <div ref={box} className="absolute inset-x-2.5 top-1.5 z-40" onKeyDown={onKeyDown}>
          <div className="cs-open flex items-center gap-2 h-10 pl-3 pr-1.5 rounded-[11px] bg-card shadow-[inset_0_0_0_2px_#1C1C1C]">
            <Search className="w-4 h-4 shrink-0 text-main" strokeWidth={2.4} aria-hidden="true" />
            <input ref={input} type="search" value={query} autoComplete="off"
              onChange={e => { setQuery(e.target.value); setAt(0) }}
              placeholder="Bill no., receipt no., guest or room" aria-label="Search bills, receipts and bookings"
              className="flex-1 min-w-0 h-full bg-transparent outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden text-base font-semibold text-main placeholder:font-medium placeholder:text-muted" />
            <button type="button" onClick={close} className="px-2 py-1.5 rounded-lg text-[13px] font-semibold text-muted hover:text-main hover:bg-softbg cursor-pointer">Close</button>
          </div>
          {q && (
            <div role="listbox" className="cs-list mt-1.5 max-h-[min(440px,70vh)] overflow-y-auto rounded-[14px] bg-card p-1.5 shadow-[0_0_0_1px_#E6DFD0,0_18px_40px_-18px_rgba(60,45,20,0.28)]">
              {hits.length === 0 && <div className="px-3 py-6 text-center text-[13.5px] text-muted">Nothing matches “{query.trim()}”.</div>}
              {found.bookings.length > 0 && head('Bookings', found.bookings.length)}
              {hits.filter(h => h.kind === 'booking').map(h => row(h, <CalendarDays className="w-4 h-4" />, mark(who(h.booking)), mark(unit(h.booking)) + ' · ' + dates(h.booking), moneyOf(h.booking)))}
              {found.bills.length > 0 && head('Billing statements', found.bills.length)}
              {hits.filter(h => h.kind === 'bill').map(h => row(h, <FileText className="w-4 h-4" />, mark(h.booking.invoice_number || ''), who(h.booking) + ' · ' + unit(h.booking) + ' · ' + dates(h.booking), moneyOf(h.booking)))}
              {found.receipts.length > 0 && head('Receipts', found.receipts.length)}
              {hits.map(h => h.kind === 'receipt' && row(h, <ReceiptText className="w-4 h-4" />, mark(h.record.receipt_number || ''),
                who(h.booking) + ' · ' + (h.record.paid_at ? fmtDay(dateToString(new Date(h.record.paid_at))) + ' · ' : '') + paymentMethodLabel(h.record.method),
                { text: peso(Number(h.record.amount || 0)), className: 'text-emerald-700' }))}
            </div>
          )}
        </div>
      )}
    </>
  )
}

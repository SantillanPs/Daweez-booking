import React, { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarPlus, LogIn, LogOut, PenLine, PhilippinePeso, Trash2, X } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { Booking, PaymentRecord } from '../types/booking'
import { getTabs, readTabLines } from '../utils/tabs'
import { Tab, TabLine } from '../types/tab'
import { PrintPaymentReceiptModal } from './billing/PrintPaymentReceiptModal'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { slipNumber } from '../utils/orderSlips'
import { paymentMethodLabel } from '../utils/paymentMethod'
import { getRemovedPayments, takeBackPayment } from '../utils/removedPayments'
import { getPaymentView, isOwed } from '../utils/bookingMoney'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { dateToString } from '../utils/helpers'
import { showToast } from '../utils/toast'

// THE FRONT DESK'S HISTORY (Sebastian, 2026-10-14: "turn the bookings page into a history of whatever
// happened in the front desk … and a way to remove data like a payment received"). It replaced the
// Bookings list, which had become a history page anyway. Nothing here is stored for it: every row is read
// from what the desk already records — a payment's `paid_at`, a booking's `created_at`, `actual_check_in`,
// `actual_check_out`, `cancelled_at` — plus `removed_payments`, the one trace a removed payment leaves.

type Kind = 'pay' | 'book' | 'in' | 'out' | 'cancel' | 'removed' | 'fixed'
type Filter = 'all' | 'pay' | 'book' | 'inout' | 'cancel' | 'owed'

interface Event {
  key: string
  at: string
  kind: Kind
  title: string
  detail: string
  /** A fixed payment: what it said before, struck through ahead of the title. */
  was?: string
  amount?: number
  booking?: Booking
  /** A payment on bookings, so it can be removed: the record and every booking that holds it. */
  payment?: { rec: PaymentRecord; holders: Booking[] }
  /** A diner's payment on an order slip, for its receipt. */
  slip?: { tab: Tab; rec: PaymentRecord }
}

const peso = (n: number) => '₱' + Math.round(n).toLocaleString()
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
const shortDay = (day: string) => new Date(day + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const span = (b: Booking) => (b.stay_hours ? b.stay_hours + '-hour stay · ' + shortDay(b.check_in) : shortDay(b.check_in) + '–' + shortDay(b.check_out))
const join = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(' · ')

const ICON: Record<Kind, { Icon: typeof LogIn; tone: string }> = {
  pay: { Icon: PhilippinePeso, tone: 'bg-emerald-50 text-emerald-700' },
  book: { Icon: CalendarPlus, tone: 'bg-gold-100 text-gold-800' },
  in: { Icon: LogIn, tone: 'bg-emerald-50 text-emerald-700' },
  out: { Icon: LogOut, tone: 'bg-page text-main border border-soft' },
  cancel: { Icon: X, tone: 'bg-danger-50 text-danger-600' },
  removed: { Icon: Trash2, tone: 'bg-page text-muted border border-soft' },
  fixed: { Icon: PenLine, tone: 'bg-gold-100 text-gold-800' },
}
const FILTERS: [Filter, string][] = [['all', 'All'], ['pay', 'Payments'], ['book', 'Bookings'], ['inout', 'Check-ins & outs'], ['cancel', 'Cancelled'], ['owed', 'Still to pay']]
const PAGE = 14

export function DeskHistory() {
  const { allBookings, rooms, venues, updateBooking } = useDashboardData()
  const { data: tabs = [] } = useQuery({ queryKey: ['tabs'], queryFn: getTabs })
  const { data: removed = [] } = useQuery({ queryKey: ['removed-payments'], queryFn: getRemovedPayments })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [days, setDays] = useState(PAGE)
  const [asking, setAsking] = useState<string | null>(null)
  // Struck through at once and saved behind it; put back if the save fails.
  const [removing, setRemoving] = useState<string[]>([])
  // **A payment's receipt, opened from History** (the owner's note #6, 2026-10-24): the same 58 mm slip
  // the desk printed, to print again or email.
  const [receipt, setReceipt] = useState<{ rec: PaymentRecord; holders: Booking[] } | { rec: PaymentRecord; tab: Tab; lines: TabLine[] } | null>(null)

  const unit = (b: Booking) => {
    if (b.room_id) {
      const r = rooms.find(x => x.id === b.room_id)
      return r ? 'Room ' + r.room_number + ' ' + r.name : b.room_id
    }
    return venues.find(v => v.id === b.venue_id)?.name || b.venue_id || ''
  }
  const roomsOf = (list: Booking[]) => {
    const nums = list.map(b => rooms.find(r => r.id === b.room_id)?.room_number).filter((n): n is number => n !== undefined).sort((a, b) => a - b)
    if (list.length === 1) return unit(list[0])
    return nums.length ? (nums.length === 1 ? 'Room ' : 'Rooms ') + nums.join(', ') : list.map(unit).join(', ')
  }
  const who = (b: Booking) => b.company_name || b.guest_name || 'Guest'

  const events = useMemo(() => {
    const out: Event[] = []
    // One payment for several rooms sits on every room with the whole amount (the owner's ruling,
    // 2026-09-30), so a receipt number is one payment however many rooms hold it.
    const payments = new Map<string, { rec: PaymentRecord; holders: Booking[] }>()
    const groups = new Map<string, Booking[]>()
    for (const b of allBookings) {
      if (b.status === 'blocked') continue
      for (const rec of b.payment_records || []) {
        if (!rec.paid_at) continue
        const key = rec.receipt_number || rec.id
        const found = payments.get(key)
        if (found) found.holders.push(b)
        else payments.set(key, { rec, holders: [b] })
      }
      const g = b.group_id || b.id
      groups.set(g, [...(groups.get(g) || []), b])
      if (b.actual_check_in) out.push({ key: 'in-' + b.id, at: b.actual_check_in, kind: 'in', title: 'Checked in · ' + unit(b), detail: join(who(b), span(b)), booking: b })
      if (b.actual_check_out) out.push({ key: 'out-' + b.id, at: b.actual_check_out, kind: 'out', title: 'Checked out · ' + unit(b), detail: who(b), booking: b })
      if (b.status === 'cancelled' && b.cancelled_at) out.push({ key: 'x-' + b.id, at: b.cancelled_at, kind: 'cancel', title: 'Cancelled · ' + unit(b), detail: join(who(b), span(b)), booking: b })
    }
    // A booking of several rooms is one booking (`group_id`), made at one time.
    for (const list of groups.values()) {
      const b = list[0]
      if (!b.created_at) continue
      out.push({ key: 'new-' + b.id, at: b.created_at, kind: 'book', title: 'New booking · ' + roomsOf(list), detail: join(who(b), span(b), b.payment_plan === 'reservation' && 'No deposit'), booking: b })
    }
    for (const [key, p] of payments) {
      out.push({
        key: 'pay-' + key, at: p.rec.paid_at, kind: 'pay', amount: Number(p.rec.amount || 0),
        title: peso(Number(p.rec.amount || 0)) + ' received · ' + roomsOf(p.holders),
        detail: join(who(p.holders[0]), paymentMethodLabel(p.rec.method), p.rec.receipt_number, p.rec.prepared_by && 'by ' + p.rec.prepared_by),
        booking: p.holders[0], payment: p,
      })
      // Each fix of a typed-wrong payment (the mock's B, 2026-10-24): what it said, then what it says.
      const fixes = p.rec.fixes || []
      fixes.forEach((f, i) => {
        const now = fixes[i + 1] || p.rec
        out.push({
          key: 'fix-' + key + '-' + i, at: f.at, kind: 'fixed', booking: p.holders[0],
          was: peso(f.amount) + ' ' + paymentMethodLabel(f.method) + (f.purpose ? ' ' + f.purpose : ''),
          title: peso(Number(now.amount || 0)) + ' ' + paymentMethodLabel(now.method) + (now.purpose ? ' ' + now.purpose : ''),
          detail: join('Payment fixed', who(p.holders[0]), p.rec.receipt_number, 'paid ' + shortDay(dateToString(new Date(p.rec.paid_at)))),
        })
      })
    }
    // A diner pays at the desk on the order slip itself; a room guest's slip is paid by a booking's receipt.
    for (const t of tabs) {
      for (const rec of t.payment_records || []) {
        const key = rec.receipt_number || rec.id
        if (!rec.paid_at || payments.has(key)) continue
        out.push({
          key: 'slip-' + key, at: rec.paid_at, kind: 'pay', amount: Number(rec.amount || 0),
          title: peso(Number(rec.amount || 0)) + ' received · ' + (slipNumber(t) || 'Order slip'),
          detail: join(t.label || t.table_label || 'Diner', paymentMethodLabel(rec.method), rec.receipt_number, rec.prepared_by && 'by ' + rec.prepared_by),
          slip: { tab: t, rec },
        })
      }
    }
    for (const r of removed) {
      out.push({
        key: 'rm-' + r.id, at: r.removed_at, kind: 'removed', amount: r.amount,
        title: peso(r.amount) + ' removed' + (r.rooms ? ' · ' + r.rooms : ''),
        detail: join(r.guest_name, r.method && paymentMethodLabel(r.method), r.receipt_number, r.paid_at && 'paid ' + shortDay(dateToString(new Date(r.paid_at)))),
      })
    }
    return out.sort((a, b) => b.at.localeCompare(a.at))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allBookings, tabs, removed, rooms, venues])

  const q = query.trim().toLowerCase()
  const shown = events.filter(e =>
    (filter === 'all' || (filter === 'inout' ? e.kind === 'in' || e.kind === 'out' : filter === 'pay' ? e.kind === 'pay' || e.kind === 'removed' || e.kind === 'fixed' : e.kind === filter)) &&
    (!q || (e.title + ' ' + e.detail).toLowerCase().includes(q)))
  const byDay = new Map<string, Event[]>()
  for (const e of shown) {
    const day = dateToString(new Date(e.at))
    byDay.set(day, [...(byDay.get(day) || []), e])
  }
  const allDays = [...byDay.keys()]
  const today = dateToString(new Date())
  const before = new Date()
  before.setDate(before.getDate() - 1)
  const yesterday = dateToString(before)
  const dayName = (day: string) => {
    const long = new Date(day + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return day === today ? 'Today · ' + long : day === yesterday ? 'Yesterday · ' + long : long
  }

  const owed = allBookings
    .filter(b => isOwed(b) && (!q || (who(b) + ' ' + unit(b) + ' ' + (b.invoice_number || '')).toLowerCase().includes(q)))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))

  const open = (b?: Booking) => {
    if (!b) return
    focusBookingAfterCreate(b.id)
    void navigate({ to: '/calendar' })
  }

  const showReceipt = async (e: Event) => {
    if (e.payment) return setReceipt(e.payment)
    if (!e.slip) return
    try {
      setReceipt({ ...e.slip, lines: await readTabLines(e.slip.tab.id) })
    } catch {
      showToast('Could not open the receipt. Please try again.', 'error')
    }
  }

  const remove = async (e: Event) => {
    if (!e.payment) return
    setAsking(null)
    setRemoving(list => [...list, e.key])
    try {
      await takeBackPayment(e.payment.rec, e.payment.holders, updateBooking, { guest: who(e.payment.holders[0]), rooms: roomsOf(e.payment.holders) })
      await queryClient.invalidateQueries({ queryKey: ['removed-payments'] })
      await queryClient.invalidateQueries({ queryKey: ['tabs'] })
    } catch {
      showToast('Could not remove the payment. Please try again.', 'error')
    }
    setRemoving(list => list.filter(k => k !== e.key))
  }

  const act = 'min-h-9 px-2.5 rounded-lg border border-transparent text-[12.5px] font-semibold text-muted cursor-pointer transition-colors hover:bg-card hover:border-soft hover:text-main lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100'

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold text-xl text-main">History</h2>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <input
            type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search a guest, room or receipt" aria-label="Search"
            className="min-h-10 w-64 max-w-full px-3 rounded-lg border border-soft bg-card text-main text-base outline-none focus:border-gold-500"
          />
          <div role="group" aria-label="Show" className="flex gap-1 p-1 bg-card border border-soft rounded-xl max-w-full overflow-x-auto">
            {FILTERS.map(([key, label]) => (
              <button
                key={key} type="button" aria-pressed={filter === key} onClick={() => { setFilter(key); setDays(PAGE) }}
                className={`min-h-9 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer transition-colors ${filter === key ? 'bg-brand-primary text-ink-900 font-bold' : 'text-muted font-semibold hover:text-main'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filter === 'owed' ? (
        <section className="bg-card border border-soft rounded-2xl overflow-hidden">
          {owed.length === 0 && <p className="py-10 text-center text-[13px] text-muted">Nobody owes anything.</p>}
          {owed.map(b => {
            const pay = getPaymentView(b)
            return (
              <div key={b.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 min-h-14 border-t border-soft first:border-t-0 hover:bg-page">
                <span className="min-w-0 flex flex-col">
                  <span className="text-[14px] font-semibold text-main truncate">{who(b)} · {unit(b)}</span>
                  <span className="text-[12.5px] text-muted truncate">{join(span(b), b.invoice_number)}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-bold text-danger-600 whitespace-nowrap">{pay.label}</span>
                  <button type="button" onClick={() => open(b)} className={act}>Open</button>
                </span>
              </div>
            )
          })}
        </section>
      ) : (
        <>
          {allDays.length === 0 && <p className="bg-card border border-soft rounded-2xl py-10 text-center text-[13px] text-muted">{q ? 'Nothing matches.' : 'Nothing has happened yet.'}</p>}
          {allDays.slice(0, days).map(day => {
            const list = byDay.get(day) || []
            const received = list.filter(e => e.kind === 'pay' && !removing.includes(e.key)).reduce((s, e) => s + (e.amount || 0), 0)
            return (
              <section key={day} className="bg-card border border-soft rounded-2xl overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-4 py-3 bg-page border-b border-soft">
                  <b className="text-[14px] text-main">{dayName(day)}</b>
                  {received > 0 && <span className="text-[12.5px] text-muted">Received <span className="font-mono font-bold text-emerald-600">{peso(received)}</span></span>}
                </div>
                {list.map(e => {
                  const { Icon, tone } = ICON[e.kind]
                  const gone = e.kind === 'removed' || removing.includes(e.key)
                  const ask = asking === e.key
                  return (
                    <div key={e.key} className={`group grid grid-cols-[32px_minmax(0,1fr)_auto] sm:grid-cols-[4.5rem_32px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 min-h-14 border-t border-soft first:border-t-0 transition-colors ${ask ? 'bg-danger-50' : 'hover:bg-page'}`}>
                      <span className="hidden sm:block font-mono text-[12px] text-muted">{timeOf(e.at)}</span>
                      <span className={`w-8 h-8 rounded-full grid place-items-center ${tone}`}><Icon className="w-4 h-4" strokeWidth={2} /></span>
                      <span className={`min-w-0 flex flex-col ${gone ? 'line-through opacity-50' : ''}`}>
                        <span className="text-[14px] text-main truncate">{e.was && <><s className="text-muted">{e.was}</s> → </>}{e.title}{gone && e.kind !== 'removed' ? ' · Removed' : ''}</span>
                        <span className="text-[12.5px] text-muted truncate">{e.detail}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        {(e.payment || e.slip) && !gone && !ask && (
                          <button type="button" onClick={() => void showReceipt(e)} className={act}>Receipt</button>
                        )}
                        {/* only a payment on a booking can be removed, and not while it is being removed */}
                        {e.payment && !gone && !ask && (
                          <button type="button" onClick={() => setAsking(e.key)} className={act + ' hover:!text-danger-600'}>Remove</button>
                        )}
                        {e.booking && !ask && <button type="button" onClick={() => open(e.booking)} className={act}>Open</button>}
                      </span>
                      {ask && e.payment && (
                        <div className="col-span-full flex flex-wrap items-center justify-end gap-2 text-[13px]">
                          <span className="mr-auto text-main">
                            Remove {peso(e.amount || 0)}?{' '}
                            {e.payment.holders.length > 1 ? 'It paid for ' + e.payment.holders.length + ' rooms; each amount to pay goes back up.' : 'The amount to pay goes back up.'}
                          </span>
                          <button type="button" onClick={() => setAsking(null)} className="min-h-9 px-3.5 rounded-lg border border-soft bg-card text-main font-bold cursor-pointer">Keep</button>
                          <button type="button" onClick={() => void remove(e)} className="min-h-9 px-3.5 rounded-lg bg-danger-600 text-white font-bold cursor-pointer active:translate-y-px">Remove</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )
          })}
          {allDays.length > days && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setDays(d => d + PAGE)} className="min-h-10 px-4 rounded-lg border border-soft bg-card text-[13px] font-semibold text-main cursor-pointer hover:border-ink-900/30">
                Show earlier days
              </button>
            </div>
          )}
        </>
      )}
      {receipt && ('tab' in receipt
        ? <TabReceiptModal tab={receipt.tab} lines={receipt.lines} record={receipt.rec} onClose={() => setReceipt(null)} />
        : <PrintPaymentReceiptModal booking={receipt.holders[0]} record={receipt.rec} rooms={rooms} venues={venues}
            covered={receipt.holders.length > 1 ? receipt.holders : undefined} onClose={() => setReceipt(null)} />)}
    </div>
  )
}

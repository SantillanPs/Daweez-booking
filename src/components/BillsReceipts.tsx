import React, { CSSProperties, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, PenLine, PhilippinePeso, Trash2, X } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { Booking, PaymentRecord } from '../types/booking'
import { getTabs, readTabLines } from '../utils/tabs'
import { Tab, TabLine } from '../types/tab'
import { PrintPaymentReceiptModal } from './billing/PrintPaymentReceiptModal'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { WorkingBill } from './calendar/WorkingBill'
import { slipNumber } from '../utils/orderSlips'
import { paymentMethodLabel } from '../utils/paymentMethod'
import { getRemovedPayments, takeBackPayment } from '../utils/removedPayments'
import { asBill } from '../utils/bookingGroup'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { dateToString, normalizeVenueId } from '../utils/helpers'
import { showToast } from '../utils/toast'

// BILLS & RECEIPTS (Sebastian, 2026-10-29: "a page specifically for billing statements, and receipts.
// that's also where we will store everything involving the two"; then "remove in history what contains
// here"). Every billing statement and every payment receipt, with what used to sit in History beside
// them: a payment's receipt, its fixes, its removal, and who still owes ("To pay" became the
// statements' status filter, "similar to a 'sort by'"). Nothing here is stored for it: it is read
// from the bookings, the order slips and `removed_payments`, as History was.

type View = 'bills' | 'receipts'
type Status = 'All' | 'Paid' | 'Part paid' | 'Not paid' | 'Cancelled' | 'Rescheduled'
type Kind = 'pay' | 'removed' | 'fixed'

interface Bill { key: string; rows: Booking[]; first: Booking; status: Exclude<Status, 'All' | 'Rescheduled'>; total: number; made: string; moved?: Booking }
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
const longDay = (day: string) => new Date(day + 'T00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
// A fix that changed the day it was paid says both days.
const dayMoved = (f: { paid_at?: string }, now: { paid_at?: string }) => !!f.paid_at && !!now.paid_at && dateToString(new Date(f.paid_at)) !== dateToString(new Date(now.paid_at))
const span = (b: Booking) => (b.stay_hours ? b.stay_hours + '-hour stay · ' + shortDay(b.check_in) : shortDay(b.check_in) + '–' + shortDay(b.check_out))
const join = (...parts: (string | undefined | null | false)[]) => parts.filter(Boolean).join(' · ')

const ICON: Record<Kind, { Icon: typeof X; tone: string }> = {
  pay: { Icon: PhilippinePeso, tone: 'bg-emerald-50 text-emerald-700' },
  removed: { Icon: Trash2, tone: 'bg-page text-muted border border-soft' },
  fixed: { Icon: PenLine, tone: 'bg-gold-100 text-gold-800' },
}
const STATUSES: Status[] = ['All', 'Paid', 'Part paid', 'Not paid', 'Cancelled', 'Rescheduled']
const STATUS_TONE: Record<Bill['status'], string> = {
  'Paid': 'bg-emerald-50 text-emerald-700',
  'Part paid': 'bg-gold-100 text-gold-800',
  'Not paid': 'bg-danger-50 text-danger-600',
  'Cancelled': 'text-danger-600 ring-1 ring-inset ring-danger-300',
}
const PAGE = 14

export function BillsReceipts() {
  const { allBookings, rooms, venues, updateBooking } = useDashboardData()
  const { data: tabs = [] } = useQuery({ queryKey: ['tabs'], queryFn: getTabs })
  const { data: removed = [] } = useQuery({ queryKey: ['removed-payments'], queryFn: getRemovedPayments })
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [view, setView] = useState<View>('bills')
  const [status, setStatus] = useState<Status>('All')
  const [day, setDay] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [asking, setAsking] = useState<string | null>(null)
  // Struck through at once and saved behind it; put back if the save fails.
  const [removing, setRemoving] = useState<string[]>([])
  const [receipt, setReceipt] = useState<{ rec: PaymentRecord; holders: Booking[] } | { rec: PaymentRecord; tab: Tab; lines: TabLine[] } | null>(null)
  // The bill opens here, being worked on, as it does from Today's money (`WorkingBill`).
  const [billOf, setBillOf] = useState<{ id: string; receipt?: string } | null>(null)
  const billBooking = billOf ? allBookings.find(b => b.id === billOf.id) : undefined

  const unit = (b: Booking) => {
    if (b.room_id) {
      const r = rooms.find(x => x.id === b.room_id)
      return r ? 'Room ' + r.room_number + ' ' + r.name : b.room_id
    }
    return venues.find(v => v.id === normalizeVenueId(b.venue_id))?.name || b.venue_id || ''
  }
  const roomsOf = (list: Booking[]) => {
    const nums = list.map(b => rooms.find(r => r.id === b.room_id)?.room_number).filter((n): n is number => n !== undefined).sort((a, b) => a - b)
    if (list.length === 1) return unit(list[0])
    return nums.length ? (nums.length === 1 ? 'Room ' : 'Rooms ') + nums.join(', ') : list.map(unit).join(', ')
  }
  const who = (b: Booking) => b.company_name || b.guest_name || 'Guest'

  // One statement per bill: a booking of several rooms is one bill (`group_id`), carrying the first room's number.
  const bills = useMemo(() => {
    const groups = new Map<string, Booking[]>()
    for (const b of allBookings) {
      if (b.status === 'blocked') continue
      const g = b.group_id || b.id
      groups.set(g, [...(groups.get(g) || []), b])
    }
    const out: Bill[] = []
    for (const [key, list] of groups) {
      const rows = [...list].sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''))
      const first = rows[0]
      const bill = asBill(first, allBookings)
      const paid = rows.reduce((t, b) => t + Number(b.downpayment_paid || 0), 0)
      const owed = rows.reduce((t, b) => t + Number(b.balance_due || 0), 0)
      const st: Bill['status'] = first.status === 'cancelled' ? 'Cancelled'
        : bill.payment_status === 'paid' || (owed <= 0 && paid > 0) ? 'Paid'
        : paid > 0 ? 'Part paid' : 'Not paid'
      out.push({ key, rows, first, status: st, total: paid + owed, made: first.created_at || first.check_in, moved: rows.find(r => r.moved_from) })
    }
    return out.sort((a, b) => b.made.localeCompare(a.made))
  }, [allBookings])

  const events = useMemo(() => {
    const out: Event[] = []
    // One payment for several rooms sits on every room with the whole amount (the owner's ruling,
    // 2026-09-30), so a receipt number is one payment however many rooms hold it.
    const payments = new Map<string, { rec: PaymentRecord; holders: Booking[] }>()
    for (const b of allBookings) {
      if (b.status === 'blocked') continue
      for (const rec of b.payment_records || []) {
        if (!rec.paid_at) continue
        const key = rec.receipt_number || rec.id
        const found = payments.get(key)
        if (found) found.holders.push(b)
        else payments.set(key, { rec, holders: [b] })
      }
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
          was: peso(f.amount) + ' ' + paymentMethodLabel(f.method) + (f.purpose ? ' ' + f.purpose : '') + (dayMoved(f, now) ? ' ' + shortDay(dateToString(new Date(f.paid_at!))) : ''),
          title: peso(Number(now.amount || 0)) + ' ' + paymentMethodLabel(now.method) + (now.purpose ? ' ' + now.purpose : '') + (dayMoved(f, now) ? ' ' + shortDay(dateToString(new Date(now.paid_at!))) : ''),
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
  // Rescheduled is not a money state: a moved bill is also Paid or Not paid, and shows in both.
  const inStatus = (b: Bill, s: Status) => s === 'All' || (s === 'Rescheduled' ? !!b.moved : b.status === s)
  const billText = (b: Bill) => (b.rows.map(r => r.invoice_number || '').join(' ') + ' ' + who(b.first) + ' ' + b.first.guest_name + ' ' + roomsOf(b.rows)).toLowerCase()
  const onDay = (iso: string) => !day || dateToString(new Date(iso)) === day
  const billsFound = bills.filter(b => onDay(b.made) && (!q || billText(b).includes(q)))
  const billsShown = billsFound.filter(b => inStatus(b, status))
  const eventsShown = events.filter(e => onDay(e.at) && (!q || (e.title + ' ' + e.detail).toLowerCase().includes(q)))

  const byDay = new Map<string, Event[]>()
  for (const e of eventsShown) {
    const d = dateToString(new Date(e.at))
    byDay.set(d, [...(byDay.get(d) || []), e])
  }
  const allDays = [...byDay.keys()]
  const today = dateToString(new Date())
  const before = new Date()
  before.setDate(before.getDate() - 1)
  const yesterday = dateToString(before)
  const dayName = (d: string) => {
    const long = new Date(d + 'T00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    return d === today ? 'Today · ' + long : d === yesterday ? 'Yesterday · ' + long : long
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
  const pick = (v: View) => { setView(v); setShown(PAGE); setAsking(null) }

  return (
    <div className="space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display font-bold text-xl text-main">Bills &amp; receipts</h2>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
          <input
            type="search" value={query} onChange={e => { setQuery(e.target.value); setShown(PAGE) }} placeholder="Search a name, INV-0219 or PR-202610-121" aria-label="Search"
            className="min-h-10 w-72 max-w-full px-3 rounded-lg border border-soft bg-card text-main text-base outline-none focus:border-gold-500"
          />
          <DaySelect day={day} today={today} onPick={d => { setDay(d); setShown(PAGE) }} />
          {/* The status filter is only for statements: it shows where it can be used. */}
          {view === 'bills' && (
            <StatusMenu status={status} counts={s => billsFound.filter(b => inStatus(b, s)).length} onPick={s => { setStatus(s); setShown(PAGE) }} />
          )}
          <div role="group" aria-label="Show" className="flex gap-1 p-1 bg-card border border-soft rounded-xl max-w-full overflow-x-auto">
            {([['bills', 'Billing statements'], ['receipts', 'Receipts']] as [View, string][]).map(([key, label]) => (
              <button
                key={key} type="button" aria-pressed={view === key} onClick={() => pick(key)}
                className={`min-h-9 px-3 rounded-lg text-[13px] whitespace-nowrap cursor-pointer transition-colors ${view === key ? 'bg-brand-primary text-ink-900 font-bold' : 'text-muted font-semibold hover:text-main'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'bills' ? (
        <>
          <section className="bg-card border border-soft rounded-2xl overflow-hidden">
            {billsShown.length === 0 && (
              <p className="py-10 text-center text-[13px] text-muted">
                {q || day ? 'Nothing matches.' : status === 'All' ? 'No billing statements yet.' : 'No statements are ' + status.toLowerCase() + '.'}
              </p>
            )}
            {billsShown.slice(0, shown * 4).map(b => (
              <div key={b.key} className="group grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 min-h-14 border-t border-soft first:border-t-0 hover:bg-page">
                <span className="hidden sm:block font-mono text-[12.5px] font-medium text-main truncate">{b.first.invoice_number || '—'}</span>
                <span className="min-w-0 flex flex-col">
                  <span className="text-[14px] text-main truncate">{who(b.first)} · {roomsOf(b.rows)}</span>
                  <span className="text-[12.5px] text-muted truncate">
                    {b.first.invoice_number && <span className="sm:hidden font-mono">{b.first.invoice_number} · </span>}
                    {join(span(b.first), b.moved?.moved_from && 'moved from ' + shortDay(b.moved.moved_from.check_in) + '–' + shortDay(b.moved.moved_from.check_out), 'made ' + longDay(dateToString(new Date(b.made))))}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex flex-col items-end gap-0.5">
                    <span className="font-mono text-[13px] font-medium text-main whitespace-nowrap">{peso(b.total)}</span>
                    <span className={`px-2 py-px rounded-full text-[11.5px] font-bold whitespace-nowrap ${STATUS_TONE[b.status]}`}>{b.status}</span>
                  </span>
                  <button type="button" onClick={() => setBillOf({ id: b.first.id })} className={act}>Open</button>
                </span>
              </div>
            ))}
          </section>
          {billsShown.length > shown * 4 && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setShown(d => d + PAGE)} className="min-h-10 px-4 rounded-lg border border-soft bg-card text-[13px] font-semibold text-main cursor-pointer hover:border-ink-900/30">
                Show more
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          {allDays.length === 0 && <p className="bg-card border border-soft rounded-2xl py-10 text-center text-[13px] text-muted">{q || day ? 'Nothing matches.' : 'No payments yet.'}</p>}
          {allDays.slice(0, shown).map(d => {
            const list = byDay.get(d) || []
            const received = list.filter(e => e.kind === 'pay' && !removing.includes(e.key)).reduce((s, e) => s + (e.amount || 0), 0)
            return (
              <section key={d} className="bg-card border border-soft rounded-2xl overflow-hidden">
                <div className="flex items-baseline justify-between gap-3 px-4 py-3 bg-page border-b border-soft">
                  <b className="text-[14px] text-main">{dayName(d)}</b>
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
                        {e.booking && !ask && <button type="button" onClick={() => setBillOf({ id: e.booking!.id, receipt: e.payment?.rec.receipt_number })} className={act}>Bill</button>}
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
          {allDays.length > shown && (
            <div className="flex justify-center">
              <button type="button" onClick={() => setShown(d => d + PAGE)} className="min-h-10 px-4 rounded-lg border border-soft bg-card text-[13px] font-semibold text-main cursor-pointer hover:border-ink-900/30">
                Show earlier days
              </button>
            </div>
          )}
        </>
      )}

      {billBooking && <WorkingBill booking={billBooking} mark={billOf?.receipt} onClose={() => setBillOf(null)}
        // The bill's Booking: the Front desk opens on the stay, its panel open, as from Today's money.
        onBooking={b => { focusBookingAfterCreate(b.id); setBillOf(null); void navigate({ to: '/calendar' }) }} />}
      {receipt && ('tab' in receipt
        ? <TabReceiptModal tab={receipt.tab} lines={receipt.lines} record={receipt.rec} onClose={() => setReceipt(null)} />
        : <PrintPaymentReceiptModal booking={receipt.holders[0]} record={receipt.rec} rooms={rooms} venues={venues}
            covered={receipt.holders.length > 1 ? receipt.holders : undefined} onClose={() => setReceipt(null)} />)}
    </div>
  )
}

const STEP = 'w-7 h-7 grid place-items-center rounded-lg text-muted hover:bg-page hover:text-main active:scale-90 disabled:opacity-25 disabled:pointer-events-none transition-[background-color,color,transform] cursor-pointer'

/** Closes a popover on a tap outside it or on Escape. */
function useAway(open: boolean, box: React.RefObject<HTMLDivElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) close() }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc) }
  }, [open, box, close])
}

// Just a date selector (Sebastian's comment on the mock, 2026-10-28): the month, one tap for a day,
// and × to show every day again. Today's money has its own (`expenses/DayPicker`), which always holds a day.
function DaySelect({ day, today, onPick }: { day: string | null; today: string; onPick: (day: string | null) => void }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState((day || today).slice(0, 7))
  const box = useRef<HTMLDivElement>(null)
  useAway(open, box, () => setOpen(false))

  const [y, m] = month.split('-').map(Number)
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7
  const count = new Date(y, m, 0).getDate()
  const turn = (by: number) => setMonth(dateToString(new Date(y, m - 1 + by, 1)).slice(0, 7))

  return (
    <div ref={box} className="relative">
      <div className={`min-h-10 flex items-center rounded-lg border transition-colors ${day ? 'border-gold-400 bg-gold-100 text-gold-800' : 'border-soft bg-card text-main'}`}>
        <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => { setMonth((day || today).slice(0, 7)); setOpen(o => !o) }}
          className="min-h-10 flex items-center gap-2 pl-3 pr-3 text-[13px] font-semibold cursor-pointer">
          <CalendarDays className={`w-4 h-4 ${day ? 'text-gold-800' : 'text-muted'}`} />
          <span key={day || 'any'} className="inline-block [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">{day ? (day === today ? 'Today' : longDay(day)) : 'Any day'}</span>
        </button>
        {day && (
          <button type="button" onClick={() => onPick(null)} aria-label="Show every day"
            className="mr-1.5 w-6 h-6 grid place-items-center rounded-full bg-gold-800/10 hover:bg-gold-800/20 cursor-pointer [animation:bp-ready_.3s_cubic-bezier(.34,1.56,.64,1)]">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {open && (
        <div role="dialog" aria-label="Pick a day"
          className="absolute right-0 sm:left-0 sm:right-auto top-full mt-1.5 z-30 w-[272px] p-2.5 bg-card rounded-xl shadow-softLg ring-1 ring-gold-100 [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]">
          <div className="flex items-center justify-between mb-1">
            <button type="button" onClick={() => turn(-1)} aria-label="Month before" className={STEP}><ChevronLeft className="w-4 h-4" /></button>
            <span key={month} className="font-display text-[13px] font-bold text-main inline-block [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">
              {new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </span>
            <button type="button" onClick={() => turn(1)} disabled={month >= today.slice(0, 7)} aria-label="Next month" className={STEP}><ChevronRight className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(w => (
              <span key={w} className="py-1 text-center text-[9.5px] font-extrabold tracking-[0.06em] text-muted">{w}</span>
            ))}
            {Array.from({ length: lead }, (_, i) => <span key={'x' + i} />)}
            {Array.from({ length: count }, (_, i) => {
              const iso = month + '-' + String(i + 1).padStart(2, '0')
              const later = iso > today
              return (
                <button key={iso} type="button" disabled={later} onClick={() => { setOpen(false); onPick(iso) }}
                  aria-pressed={iso === day} style={{ '--i': i + 1 } as CSSProperties}
                  className={'h-[34px] grid place-items-center rounded-lg text-[12.5px] active:scale-90 transition-[background-color,transform] cursor-pointer disabled:text-paper-400 disabled:cursor-default disabled:bg-transparent [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)_both] [animation-delay:calc(var(--i)*8ms)] ' +
                    (iso === day ? 'bg-gold-400 text-ink-900 font-extrabold' : 'text-main font-semibold hover:bg-gold-100') +
                    (iso === today && iso !== day ? ' ring-[1.5px] ring-inset ring-ink-900 font-extrabold' : '')}>
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// The statements' status, "similar to a 'sort by' design" (Sebastian, 2026-10-29): Show: All ▾, with
// how many are in each. It turns gold while it is narrowing the list, so a short list is never a surprise.
function StatusMenu({ status, counts, onPick }: { status: Status; counts: (s: Status) => number; onPick: (s: Status) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useAway(open, box, () => setOpen(false))
  const on = status !== 'All'
  return (
    <div ref={box} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}
        className={`min-h-10 px-3 flex items-center gap-1.5 rounded-lg border text-[13px] font-semibold cursor-pointer transition-colors ${on ? 'border-gold-400 bg-gold-100 text-gold-800' : 'border-soft bg-card text-main'}`}>
        <span className={on ? 'text-gold-800 font-medium' : 'text-muted font-medium'}>Show:</span>
        <span key={status} className="inline-block [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">{status}</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''} ${on ? 'text-gold-800' : 'text-muted'}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full mt-1.5 z-30 min-w-[200px] p-1.5 bg-card rounded-xl shadow-softLg ring-1 ring-gold-100 origin-top-right [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]">
          {STATUSES.map(s => (
            <button key={s} type="button" role="menuitemradio" aria-checked={s === status} onClick={() => { onPick(s); setOpen(false) }}
              className={`w-full min-h-10 px-2.5 flex items-center gap-2.5 rounded-lg text-left text-[13.5px] text-main cursor-pointer hover:bg-page ${s === status ? 'font-bold' : ''}`}>
              <span className="w-4 h-4 grid place-items-center">{s === status && <Check className="w-4 h-4 text-gold-800 [animation:bp-ready_.3s_cubic-bezier(.34,1.56,.64,1)]" strokeWidth={2.5} />}</span>
              {s}
              <span className="ml-auto font-mono text-[12px] text-muted">{counts(s)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

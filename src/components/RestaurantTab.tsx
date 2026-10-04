import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Utensils, X } from 'lucide-react'
import { Tab, TabLine } from '../types/tab'
import { Booking, PaymentRecord } from '../types/booking'
import { guestPlace, inHouseGuests } from './restaurant/served'
import { MenuPicker } from './restaurant/MenuPicker'
import { OffMenuOrder } from './restaurant/OffMenuOrder'
import { RunningTabSlip } from './restaurant/RunningTabSlip'
import { KitchenSlip } from './restaurant/KitchenSlip'
import { TabBill } from './restaurant/TabBill'
import { TabSettlePanel } from './restaurant/TabSettlePanel'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { Served, ServedStrip } from './restaurant/ServedStrip'
import { useTabOrder } from './restaurant/useTabOrder'
import { closeTab, getOpenTabs, getTabLines, markLinesSent, openTab, tabTotal } from '../utils/tabs'
import { OrderSlip, getSlipsByBooking, getSlipsForBooking, newCount, readBookingFoodTotal, settleSlipsOfPaidStay, slipNumber } from '../utils/orderSlips'
import { recomputeBalance } from '../utils/bookingBalance'
import { takeFocusedGuestTab } from '../utils/restaurantFocus'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { useRealtimeTabs } from '../hooks/useRealtimeTabs'
import { useDashboardData } from './DashboardContext'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// The restaurant and bar (board cards k69 + k70), in the shape the owner picked.
//
// Three things on one screen, in the order the counter works:
//   1. the strip across the top — everyone the desk may charge, each with what their
//      open order slip comes to, so switching tables is one tap;
//   2. the order slip on the left — what that person has ordered, and its two papers;
//   3. the menu card on the right — one scroll, every line tappable.
//
// **An order slip stays open until it is paid** (the staff's feedback, 2026-10-04). A
// diner with no room pays here, at the counter. A room guest pays at the front desk,
// from their booking — and once they have, the slip leaves this screen and their next
// order starts a new one with its own number.
export function RestaurantTab() {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()
  const navigate = useNavigate()

  const [tabs, setTabs] = useState<Tab[]>([])
  const [lines, setLines] = useState<Record<string, TabLine[]>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // The picked guest's slips that are already closed — paid, or left with the stay.
  const [earlier, setEarlier] = useState<OrderSlip[]>([])
  // The paper on screen. The lines are kept as they stood when it was opened: the
  // kitchen's copy marks them as given, and its NEW list must not empty while it shows.
  const [paper, setPaper] = useState<{ kind: 'kitchen' | 'guest'; lines: TabLine[] } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  // A guest sent here from their booking, picked once the bookings are loaded.
  const [wantedGuest, setWantedGuest] = useState<string | null>(null)
  // The slip just paid, kept with its lines so its receipt can be printed after
  // it has already left the open list.
  const [settled, setSettled] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)

  // The loader reads the latest bookings without being rebuilt every time one changes.
  const live = useRef({ bookings, rooms, venues })
  useEffect(() => { live.current = { bookings, rooms, venues } })

  /** Reads every open slip and its lines — a stay's and a diner's alike. */
  const load = useCallback(async () => {
    const open = await getOpenTabs()
    const map: Record<string, TabLine[]> = {}
    for (const t of open) map[t.id] = await getTabLines(t.id)

    // A stay that has nothing left to pay has paid for its food: its slip is closed
    // here, so food the guest already paid for never stays on this screen.
    const paidStays = new Set<string>()
    const stays = open.filter(t => t.booking_id && (map[t.id] || []).length > 0)
    if (stays.length > 0) {
      try {
        const now = live.current
        const byBooking = await getSlipsByBooking(stays.map(t => t.booking_id as string))
        for (const t of stays) {
          const booking = now.bookings.find(b => b.id === t.booking_id)
          if (booking && await settleSlipsOfPaidStay(booking, byBooking[booking.id] || [], now)) paidStays.add(booking.id)
        }
      } catch (err) {
        console.error('Could not check which order slips are paid:', err)
      }
    }

    setTabs(open.filter(t => !(t.booking_id && paidStays.has(t.booking_id))))
    setLines(map)
    setLoading(false)
  }, [])

  // The first read, then again whenever a slip changes on any tablet.
  useEffect(() => { queueMicrotask(() => void load()) }, [load])
  useRealtimeTabs(() => void load())

  // …and whenever a guest in the hotel pays: the money is taken at the front desk.
  const moneyKey = inHouseGuests(bookings).map(b => b.id + ':' + b.downpayment_paid + ':' + b.balance_due).join('|')
  const firstMoney = useRef(true)
  useEffect(() => {
    if (firstMoney.current) { firstMoney.current = false; return }
    queueMicrotask(() => void load())
  }, [moneyKey, load])

  // The booking panel's "Take orders" lands here. Read once, off the effect body: the
  // hand-off is consumed exactly once, so a second render can never swallow it.
  useEffect(() => {
    queueMicrotask(() => {
      const id = takeFocusedGuestTab()
      if (id) setWantedGuest(id)
    })
  }, [])
  useEffect(() => {
    if (!wantedGuest || !bookings.some(b => b.id === wantedGuest)) return
    queueMicrotask(() => {
      setSelectedKey('booking:' + wantedGuest)
      setWantedGuest(null)
    })
  }, [wantedGuest, bookings])

  // Everyone who can be charged, in the order the strip shows them: the diners
  // at the tables first, then the guests who are in the hotel right now.
  const served = useMemo<Served[]>(() => {
    const diners: Served[] = tabs
      .filter(t => !t.booking_id)
      .map(t => ({ key: 'tab:' + t.id, name: t.label || 'Walk-in', place: t.table_label || '', tab: t, booking: null }))
    const guests: Served[] = inHouseGuests(bookings).map(b => ({
      key: 'booking:' + b.id,
      name: b.guest_name || 'Guest',
      place: guestPlace(b, rooms, venues),
      tab: tabs.find(t => t.booking_id === b.id) || null,
      booking: b,
    }))
    return [...diners, ...guests]
  }, [tabs, bookings, rooms, venues])

  const selected = served.find(p => p.key === selectedKey) || null
  const selectedLines = selected?.tab ? (lines[selected.tab.id] || []) : []
  const selectedTotal = tabTotal(selectedLines)
  const selectedBookingId = selected?.booking?.id || ''
  const number = slipNumber(selected?.tab)

  // The picked guest's earlier slips, read again whenever the open ones change.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      let slips: OrderSlip[] = []
      try {
        if (selectedBookingId) slips = (await getSlipsForBooking(selectedBookingId)).filter(s => s.tab.status === 'closed')
      } catch (err) {
        console.error('Could not read the earlier order slips:', err)
      }
      if (!cancelled) setEarlier(slips)
    })()
    return () => { cancelled = true }
  }, [selectedBookingId, tabs])

  // Writing onto whichever slip is in front of the desk, opening one on the first
  // order. Resolved by key, not by the slip object, so a slip opened a moment ago
  // still gets the next line.
  const resolveTabId = async (): Promise<string> => {
    const person = served.find(p => p.key === selectedKey)
    if (!person) throw new Error('Nobody is being served.')
    if (person.tab) return person.tab.id
    const tab = await openTab({ bookingId: person.booking?.id, label: person.name })
    return tab.id
  }
  // A room guest's food joins their bill the moment it is ordered: the booking's
  // stored balance is put right here, so the calendar and "Who owes" do not wait
  // for somebody to open that booking.
  const afterOrder = async () => {
    const person = served.find(p => p.key === selectedKey)
    await load()
    if (!person?.booking) return
    try {
      const synced = recomputeBalance(person.booking, { rooms, venues, tabTotal: await readBookingFoodTotal(person.booking.id) })
      if (Math.abs(Number(synced.balance_due || 0) - Number(person.booking.balance_due || 0)) > 0.005) {
        await updateBooking(synced)
      }
    } catch {
      setError('The order is on the slip, but the room’s balance was not updated. Open the booking to put it right.')
    }
  }
  const order = useTabOrder(resolveTabId, afterOrder)

  const openDiner = async (name: string, table: string): Promise<string> => {
    setBusy(true)
    try {
      const tab = await openTab({ label: name, tableLabel: table })
      setSelectedKey('tab:' + tab.id)
      await load()
      return ''
    } catch {
      return 'Could not open that order slip. Please try again.'
    } finally {
      setBusy(false)
    }
  }

  /** A diner who sat down and ordered nothing: the empty slip is taken off the strip. */
  const dropEmptySlip = async (tab: Tab) => {
    try {
      await closeTab(tab.id)
      setSelectedKey(null)
      await load()
    } catch {
      setError('Could not remove that order slip. Please try again.')
    }
  }

  const goToBooking = (booking: Booking) => {
    focusBookingAfterCreate(booking.id)
    void navigate({ to: '/calendar' })
  }

  const dinerTabs = tabs.filter(t => !t.booking_id)
  const onTheTables = tabTotal(dinerTabs.flatMap(t => lines[t.id] || []))
  const guestsInHouse = served.length - dinerTabs.length
  const totals = Object.fromEntries(served.map(p => [p.key, p.tab ? tabTotal(lines[p.tab.id] || []) : 0]))
  // How many of each dish are on the slip, so the menu card shows the count on its line.
  const pickedCounts = selectedLines.reduce<Record<string, number>>((acc, l) => {
    if (l.kind === 'charge') acc[l.description] = (acc[l.description] || 0) + Number(l.qty || 1)
    return acc
  }, {})
  const place = selected?.booking
    ? { label: selected.booking.room_id ? 'Room' : 'Venue', value: selected.place }
    : (selected?.place ? { label: 'Table', value: selected.place } : undefined)

  return (
    <div className="space-y-4 font-sans">
      <div>
        <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
          <Utensils className="w-5 h-5 text-gold-600" />
          Restaurant &amp; bar
        </h2>
        <p className="text-[13px] text-muted mt-1">
          Walk-in order slips open: <b className="text-main">{dinerTabs.length}</b> · <b className="text-main">{fmtPeso(onTheTables)}</b>
          <span> · </span>
          <b className="text-main">{guestsInHouse}</b> guest{guestsInHouse === 1 ? '' : 's'} in the hotel
        </p>
      </div>

      <ServedStrip
        served={served}
        selectedKey={selectedKey}
        totals={totals}
        busy={busy}
        loading={loading}
        onPick={person => { setSelectedKey(person.key); setError('') }}
        onOpenDiner={openDiner}
      />

      {/* The order slip on the left, the menu card on the right. */}
      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="bg-card border border-soft rounded-lg p-4 space-y-3 self-start">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-display text-[17px] font-bold text-main leading-tight">
                    {number ? 'Order slip ' + number : 'New order slip'}
                  </p>
                  <p className="text-[13px] text-muted mt-0.5">
                    {selected.name}{selected.place ? ' · ' + selected.place : ''}
                  </p>
                </div>
                <button type="button" onClick={() => setSelectedKey(null)} aria-label="Close this order slip"
                  className="w-10 h-10 -mr-2 -mt-2 inline-flex items-center justify-center text-muted hover:text-main transition-colors cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <TabBill
                lines={selectedLines}
                total={selectedTotal}
                busy={order.busy}
                onQty={(line, delta) => void order.changeQty(line, delta)}
                onPrintKitchen={() => setPaper({ kind: 'kitchen', lines: selectedLines })}
                onPrintGuest={() => setPaper({ kind: 'guest', lines: selectedLines })}
                emptyText="Nothing ordered yet."
              />
              {order.removeError && <p className="text-[12px] font-semibold text-danger-600">{order.removeError}</p>}
              {error && <p className="text-[12px] font-semibold text-danger-600">{error}</p>}

              {/* Where the money is taken. A room guest pays at the front desk, from the
                  booking; a diner with no room pays here. */}
              {selected.booking && selectedLines.length > 0 && (
                <button type="button" onClick={() => goToBooking(selected.booking as Booking)}
                  className="w-full min-h-12 inline-flex items-center justify-center px-3 rounded-lg border border-soft bg-card text-[13px] font-bold text-main hover:border-gold-400 hover:bg-gold-100 transition-colors cursor-pointer">
                  Receive {fmtPeso(selectedTotal)} at the front desk
                </button>
              )}
              {!selected.booking && selected.tab && selectedLines.length > 0 && (
                <TabSettlePanel
                  tab={selected.tab}
                  total={selectedTotal}
                  quiet={selectedLines.some(l => newCount(l) > 0)}
                  onSettled={async receipt => {
                    setSettled({ tab: selected.tab as Tab, lines: selectedLines, record: receipt })
                    setSelectedKey(null)
                    await load()
                  }}
                />
              )}
              {!selected.booking && selected.tab && selectedLines.length === 0 && (
                <button type="button" onClick={() => void dropEmptySlip(selected.tab as Tab)}
                  className="min-h-11 text-[13px] font-semibold text-muted hover:text-danger-600 transition-colors cursor-pointer">
                  Remove this order slip
                </button>
              )}

              {earlier.length > 0 && (
                <div className="pt-3 border-t border-soft">
                  <p className="text-[12px] font-semibold text-muted mb-1">Earlier order slips</p>
                  <ul className="text-[13px]">
                    {earlier.map(s => (
                      <li key={s.tab.id} className="flex items-baseline justify-between gap-3 py-1">
                        <span className="font-semibold text-main">{slipNumber(s.tab)}</span>
                        <span className="flex items-baseline gap-3">
                          <span className="text-main">{fmtPeso(s.total)}</span>
                          <span className={'w-16 text-right font-semibold ' + (s.paid ? 'text-emerald-700' : 'text-danger-600')}>
                            {s.paid ? 'Paid' : 'Not paid'}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted">Choose who is ordering.</p>
          )}
        </div>

        <div className="space-y-2.5">
          {selected ? (
            <>
              <MenuPicker onPick={item => void order.pickItem(item)} busy={order.busy} counts={pickedCounts} />
              <OffMenuOrder
                open={order.showOther}
                onOpen={() => order.setShowOther(true)}
                busy={order.busy}
                error={order.error}
                onAdd={order.addWritten}
              />
              {!order.showOther && order.error && <p className="text-[12px] font-semibold text-danger-600">{order.error}</p>}
            </>
          ) : (
            <div className="bg-card border border-soft rounded-lg px-4 py-10 text-center">
              <p className="text-[13px] text-muted">The menu opens once somebody is chosen.</p>
            </div>
          )}
        </div>
      </div>

      {paper?.kind === 'kitchen' && selected && (
        <KitchenSlip
          number={number}
          who={selected.name}
          place={place}
          lines={paper.lines}
          onPrinted={() => void markLinesSent(paper.lines).then(load).catch(() => setError('The kitchen copy printed, but its orders were not marked as given.'))}
          onClose={() => setPaper(null)}
        />
      )}
      {paper?.kind === 'guest' && selected && (
        <RunningTabSlip
          number={number}
          who={selected.name}
          place={place}
          lines={paper.lines}
          total={tabTotal(paper.lines)}
          note={selected.booking ? 'To be paid at the front desk.' : 'Please pay at the counter.'}
          onClose={() => setPaper(null)}
        />
      )}

      {settled && (
        <TabReceiptModal
          tab={settled.tab}
          lines={settled.lines}
          record={settled.record}
          onClose={() => setSettled(null)}
        />
      )}
    </div>
  )
}

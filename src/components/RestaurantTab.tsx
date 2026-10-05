import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Tab, TabLine } from '../types/tab'
import { Booking } from '../types/booking'
import { guestPlace, inHouseGuests, tableName } from './restaurant/served'
import { MenuPicker } from './restaurant/MenuPicker'
import { OffMenuOrder } from './restaurant/OffMenuOrder'
import { OrderSlipPanel } from './restaurant/OrderSlipPanel'
import { OrderDock, OrderSheet } from './restaurant/OrderDock'
import { BillPicker } from './restaurant/BillPicker'
import { Served, ServedStrip } from './restaurant/ServedStrip'
import { useTabOrder } from './restaurant/useTabOrder'
import { useOpenSlips } from './restaurant/useOpenSlips'
import { billOutTab, billToRoom, closeTab, markLinesSent, markLinesServed, openTab, tabTotal } from '../utils/tabs'
import { withChanges } from '../utils/orderChanges'
import { OrderSlip, cookingCount, getSlipsForBooking, newCount, readBookingFoodTotal, readyCount, slipNumber } from '../utils/orderSlips'
import { recomputeBalance } from '../utils/bookingBalance'
import { takeFocusedGuestTab } from '../utils/restaurantFocus'
import { askConfirm } from '../utils/confirm'
import { useDashboardData } from './DashboardContext'
import { showToast } from '../utils/toast'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// The restaurant and bar (board cards k69 + k70), in the shape the owner picked.
//
// Three things on one screen, in the order the counter works:
//   1. the strip across the top — the tables with an order open, each with what its
//      slip comes to, so switching tables is one tap. The staff start a table;
//   2. the order slip on the left — what that person has ordered, where each dish has
//      got to (new, cooking, ready, served), and the bill going to the front desk;
//   3. the menu card on the right — one scroll, every line tappable.
//
// **It is used on a tablet or a phone most of the time** (Sebastian, 2026-10-04), held
// upright or sideways. The screen is filled and only the menu scrolls, so who is being
// served and the order itself never leave a thumb's reach. Where there is room for both
// (a PC, a tablet held sideways) the slip sits beside the menu; where there is not (a
// phone, a tablet held upright) the menu has the screen and the order is a bar docked
// under it, which opens into the whole slip. The slip used to sit above the menu there:
// on a phone the first dish was a whole screen down.
//
// **The order reaches the kitchen on a screen, not on paper** (Sebastian, 2026-10-04).
// One member of staff takes orders here while another cooks and a third is at the front
// desk, all at once. The only printer is at the front desk, so the printed kitchen copy
// meant a walk there and back for every order. "Send to kitchen" puts the order on the
// Kitchen screen instead; the cook taps what is cooked and it shows here as ready.
//
// **An order slip stays open until it is paid** (the staff's feedback, 2026-10-04).
// **No money is taken on this screen** (Sebastian, 2026-10-04: "the guests actually
// always pay at the front desk, not at the restaurant"). A room guest pays from their
// booking and a diner with no room from the calendar's "Diners to pay"; this screen only
// sends the bill over ("Send bill to front desk"). That closes the slip and takes it off
// this screen, and the next order starts a new one with its own number.
export function RestaurantTab() {
  const { bookings, rooms, venues, updateBooking } = useDashboardData()

  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // The picked guest's slips that are already closed — paid, or left with the stay.
  const [earlier, setEarlier] = useState<OrderSlip[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  // True while an order is on its way to the kitchen, or being marked as served.
  const [working, setWorking] = useState(false)
  // The whole slip, slid up from the order bar — only where the slip has no room beside the menu.
  const [sheetOpen, setSheetOpen] = useState(false)
  // A table's bill, waiting to be told where it goes: the front desk, or a room.
  const [billFor, setBillFor] = useState<{ person: Served; tab: Tab; total: number } | null>(null)
  // A guest sent here from their booking, picked once the bookings are loaded.
  const [wantedGuest, setWantedGuest] = useState<string | null>(null)

  // The loader reads the latest bookings without being rebuilt every time one changes.
  const live = useRef({ bookings, rooms, venues, updateBooking })
  useEffect(() => { live.current = { bookings, rooms, venues, updateBooking } })

  // Every open slip and its lines, read again whenever a slip changes on any tablet.
  const slips = useOpenSlips(live)
  const { tabs, lines, loading, load } = slips

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

  // Every open slip, and the room being served while it has none yet — handed over from
  // its booking's "Take orders". Which of them stand in the strip is `served`, below.
  const people = useMemo<Served[]>(() => {
    const tables: Served[] = tabs
      .filter(t => !t.booking_id)
      .map(t => {
        const table = tableName(t.table_label)
        return { key: 'tab:' + t.id, name: table || t.label || 'Walk-in', place: table ? t.label || '' : '', tab: t, booking: null }
      })
    // Room guests go in room order — the staff look for the room, not for who arrived first.
    const guests: Served[] = inHouseGuests(bookings).map(b => ({
      key: 'booking:' + b.id,
      name: b.guest_name || 'Guest',
      place: guestPlace(b, rooms, venues),
      tab: tabs.find(t => t.booking_id === b.id) || null,
      booking: b,
      room: rooms.find(r => r.id === b.room_id)?.room_number,
    })).filter(g => g.tab || g.key === selectedKey).sort((a, b) => (a.room ?? 999) - (b.room ?? 999))
    return [...tables, ...guests]
  }, [tabs, bookings, rooms, venues, selectedKey])

  const selected = people.find(p => p.key === selectedKey) || null
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

  // A room guest's food joins their bill the moment it is ordered: the booking's
  // stored balance is put right here, so the calendar and "Who owes" do not wait
  // for somebody to open that booking. It follows the save and never holds the till
  // up; one balance is put right at a time, so the last order is the one that counts.
  const balances = useRef<Promise<void>>(Promise.resolve())
  const syncRoomBalance = (bookingId?: string) => {
    if (!bookingId) return
    balances.current = balances.current.then(async () => {
      const hotel = live.current
      const booking = hotel.bookings.find(b => b.id === bookingId)
      if (!booking) return
      try {
        const synced = recomputeBalance(booking, { rooms: hotel.rooms, venues: hotel.venues, tabTotal: await readBookingFoodTotal(bookingId) })
        if (Math.abs(Number(synced.balance_due || 0) - Number(booking.balance_due || 0)) > 0.005) {
          await hotel.updateBooking(synced)
        }
      } catch {
        setError('The order is on the slip, but the room’s balance was not updated. Open the booking to put it right.')
      }
    })
  }
  const order = useTabOrder(slips, selected, syncRoomBalance)

  // Each slip as the desk sees it: what is saved, with what was tapped a moment ago
  // and is still on its way laid over it. A stay's first order shows before its slip exists.
  const shown = useMemo(() => {
    const out: Record<string, TabLine[]> = {}
    for (const p of people) {
      const mine = order.waiting.filter(w => w.key === p.key).map(w => w.change)
      out[p.key] = withChanges(p.tab ? lines[p.tab.id] || [] : [], mine, p.tab?.id)
    }
    return out
  }, [people, lines, order.waiting])
  const selectedLines = selected ? shown[selected.key] || [] : []
  const selectedTotal = tabTotal(selectedLines)

  // The strip: only what the restaurant still has something to do with (Sebastian,
  // 2026-10-05). Every guest in the hotel used to stand in it whether or not they had
  // ordered, which "feels like you're supposed to do something with them even when they
  // don't yet". Then it was every open slip — and rooms still stood there with nothing on
  // their slip, or with food served days before: "there's nothing to do so why are they
  // showing up?" So:
  //
  //   * a table is here from its first dish until its bill is sent. With everything
  //     served, the bill is still to send;
  //   * a slip that belongs to a room is on that room's bill already, so it is here only
  //     while a dish on it has not been carried out — not sent, cooking, or ready;
  //   * a slip with nothing on it is not here at all;
  //   * whoever is being served right now is always here.
  const served = useMemo(() => people.filter(p => {
    if (p.key === selectedKey) return true
    const own = shown[p.key] || []
    if (!p.booking) return own.length > 0
    return own.some(l => newCount(l) + cookingCount(l) + readyCount(l) > 0)
  }), [people, shown, selectedKey])

  // The slip as the database holds it: anything tapped a moment ago is saved first, so
  // the kitchen is given — and the front desk is billed for — exactly the rows that are
  // really there. Null when that save failed, which has already been said on screen.
  const savedSlipOf = async (person: Served | null): Promise<{ tab: Tab | null; lines: TabLine[] } | null> => {
    if (!person || !(await order.finish())) return null
    const now = slips.latest()
    const tab = (person.booking ? now.tabs.find(t => t.booking_id === person.booking?.id) : person.tab) || null
    return { tab, lines: tab ? now.lines[tab.id] || [] : [] }
  }

  // "Send to kitchen" and "Served": one tap for the whole slip. The slips are read again
  // when it lands, and a read that was already on its way is not allowed to overtake it.
  const kitchenStep = async (step: 'send' | 'served') => {
    const saved = await savedSlipOf(selected)
    if (!saved) return
    setError(''); setWorking(true)
    slips.beginSave()
    try {
      if (step === 'send') {
        await markLinesSent(saved.lines)
        showToast('Sent to the kitchen.', 'success')
      } else {
        await markLinesServed(saved.lines)
      }
    } catch {
      setError(step === 'send'
        ? 'The order was not sent to the kitchen. Please try again.'
        : 'Could not mark that as served. Please try again.')
    } finally {
      slips.endSave()
      setWorking(false)
    }
  }

  // A table that was started and left with nothing ordered is closed again, so no slip
  // sits open with nothing on it. Anything tapped a moment ago is saved first: a slip is
  // only empty if it is empty in the database.
  const tidyAway = (person: Served | null) => {
    const tab = person?.tab
    if (!tab || person.booking) return
    void (async () => {
      if (!(await order.finish())) return
      if ((slips.latest().lines[tab.id] || []).length > 0) return
      try {
        await closeTab(tab.id)
        await load()
      } catch (err) {
        // It is out of the strip either way; it only stays open in the database.
        console.error('Could not close the empty order slip:', err)
      }
    })()
  }

  /** Who is being served changes — to another table, or to nobody. */
  const pick = (key: string | null) => {
    if (selected && selected.key !== key) tidyAway(selected)
    setSelectedKey(key)
  }

  // …and the same when the staff leave this screen with an empty table still picked.
  const leaving = useRef(() => {})
  useEffect(() => { leaving.current = () => tidyAway(selected) })
  useEffect(() => () => leaving.current(), [])

  const openDiner = async (name: string, table: string): Promise<string> => {
    setBusy(true)
    try {
      const tab = await openTab({ label: name, tableLabel: table })
      pick('tab:' + tab.id)
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
      // A row taken off a moment ago is saved first, or it would land on a closed slip.
      if (!(await order.finish())) return
      await closeTab(tab.id)
      setSelectedKey(null)
      await load()
    } catch {
      setError('Could not remove that order slip. Please try again.')
    }
  }

  // The bill leaves the restaurant (Sebastian, 2026-10-05: "send bill to front desk maybe
  // after the guests finish eating or asks for a bill"). "Guest copy" and "Receive … at
  // the front desk" stood here before: the restaurant has no printer, and nobody pays in
  // it. This is the one step every till has between eating and paying — the bill has been
  // asked for. The slip is closed to more orders and leaves this screen.
  //
  // **Where it goes is asked now, not when the table is started.** A guest with a room
  // sits at a table like anybody else, and "not all guests want their bills added to the
  // rooms": they pay now at the front desk, or it goes on their room to be paid before
  // they check out.
  const askForBill = async (person: Served) => {
    const saved = await savedSlipOf(person)
    if (!saved || !saved.tab || saved.lines.length === 0) return
    // A dish the kitchen was never given would never be cooked.
    if (saved.lines.some(l => newCount(l) > 0)) {
      showToast('Send the new dishes to the kitchen first.', 'info')
      return
    }
    const bill = { person, tab: saved.tab, total: tabTotal(saved.lines) }
    if (!person.booking) { setBillFor(bill); return }

    // A slip that was started for a room already belongs to it.
    const ok = await askConfirm({
      title: 'Add this to ' + person.place + '’s bill?',
      message: [slipNumber(bill.tab), person.name].filter(Boolean).join(' · ') + ' — ' + fmtPeso(bill.total) +
        '. It is paid at the front desk, any time before check-out. Nothing more can be ordered on this slip.',
      confirmLabel: 'Add to the bill',
    })
    if (ok) await closeBill(() => billOutTab(bill.tab.id), 'Added to ' + person.place + '’s bill · ' + fmtPeso(bill.total))
  }

  const closeBill = async (write: () => Promise<void>, said: string) => {
    setError(''); setWorking(true)
    slips.beginSave()
    try {
      await write()
      setBillFor(null)
      setSheetOpen(false)
      setSelectedKey(null)
      showToast(said, 'success')
    } catch {
      setError('The bill was not sent. Please try again.')
    } finally {
      slips.endSave()
      setWorking(false)
    }
  }

  const billToFrontDesk = () => {
    if (!billFor) return
    const bill = billFor
    void closeBill(() => billOutTab(bill.tab.id), 'Bill sent to the front desk · ' + fmtPeso(bill.total))
  }

  // Onto a room: it asks first, by room and by name — a bill on the wrong guest's room is
  // a mistake nobody notices until that guest checks out.
  const billOntoRoom = async (guest: Booking, place: string) => {
    if (!billFor) return
    const bill = billFor
    const ok = await askConfirm({
      title: 'Add this to ' + place + '’s bill?',
      message: [bill.person.name, slipNumber(bill.tab)].filter(Boolean).join(' · ') + ' — ' + fmtPeso(bill.total) +
        ' goes on ' + (guest.guest_name || 'the guest') + '’s room. It is paid at the front desk, any time before check-out.',
      confirmLabel: 'Add to the bill',
    })
    if (!ok) return
    await closeBill(async () => {
      await billToRoom(bill.tab.id, guest.id)
      syncRoomBalance(guest.id)
    }, 'Added to ' + place + '’s bill · ' + fmtPeso(bill.total))
  }

  // The guests in the hotel, by room: the ones a bill may go on.
  const roomGuests = inHouseGuests(bookings)
    .map(booking => ({ booking, place: guestPlace(booking, rooms, venues), room: rooms.find(r => r.id === booking.room_id)?.room_number }))
    .sort((a, b) => (a.room ?? 999) - (b.room ?? 999))

  // Where each person's food has got to: how many dishes the kitchen has not been given,
  // how many it is still cooking, and how many are cooked and waiting to be carried out.
  const kitchen = useMemo(() => {
    const out: Record<string, { fresh: number; cooking: number; ready: number; cooked: number }> = {}
    for (const p of people) {
      const own = shown[p.key] || []
      out[p.key] = {
        fresh: own.reduce((n, l) => n + newCount(l), 0),
        cooking: own.reduce((n, l) => n + cookingCount(l), 0),
        ready: own.reduce((n, l) => n + readyCount(l), 0),
        cooked: own.reduce((n, l) => n + Number(l.ready_qty || 0), 0),
      }
    }
    return out
  }, [people, shown])

  // The cook finished something: whoever is taking orders is told, whichever slip they
  // happen to have open. Said once, when the cooked count goes up.
  const cookedBefore = useRef<Record<string, number> | null>(null)
  useEffect(() => {
    const before = cookedBefore.current
    const now: Record<string, number> = {}
    for (const p of people) {
      now[p.key] = kitchen[p.key]?.cooked || 0
      if (before && p.key in before && now[p.key] > before[p.key]) {
        showToast([slipNumber(p.tab) || 'Order', p.name, p.place].filter(Boolean).join(' · ') + ' — ready to serve.', 'success')
      }
    }
    // Nothing is said about the first read: that food was cooked before this screen opened.
    if (!loading) cookedBefore.current = now
  }, [people, kitchen, loading])

  const totals = Object.fromEntries(served.map(p => [p.key, tabTotal(shown[p.key] || [])]))
  // How many of each dish are on the slip, so the menu card shows the count on its line.
  const pickedCounts = selectedLines.reduce<Record<string, number>>((acc, l) => {
    if (l.kind === 'charge') acc[l.description] = (acc[l.description] || 0) + Number(l.qty || 1)
    return acc
  }, {})
  const slipPanel = (person: Served, onClose: () => void) => (
    <OrderSlipPanel
      person={person}
      number={number}
      lines={selectedLines}
      total={selectedTotal}
      earlier={earlier}
      errors={[order.saveError, error]}
      working={working}
      onClose={onClose}
      onQty={(line, delta) => void order.changeQty(line, delta)}
      onSendKitchen={() => void kitchenStep('send')}
      onServed={() => void kitchenStep('served')}
      onBill={() => void askForBill(person)}
      onDropEmpty={tab => void dropEmptySlip(tab)}
    />
  )

  return (
    <div className="flex flex-col gap-3 lg:gap-4 font-sans tall:flex-1 tall:min-h-0">
      {/* No heading row. It held "Diners still to pay", the money the counter used to chase
          when diners paid here; nobody pays in the restaurant any more (the front desk
          lists them), so it was a figure nobody on this screen could act on. And the tab
          bar already says where this is: on a tablet those lines belong to the menu. */}
      <ServedStrip
        served={served}
        selectedKey={selectedKey}
        totals={totals}
        kitchen={kitchen}
        busy={busy}
        loading={loading}
        onPick={person => { pick(person.key); setError(''); setSheetOpen(false) }}
        onOpenDiner={openDiner}
      />

      {/* Where there is room, the order slip beside the menu card; each keeps to its own
          height and scrolls inside it. Where there is not, the menu alone, with the order
          docked under it. */}
      <div className="grid gap-5 tall:flex-1 tall:min-h-0 tall:grid-rows-[minmax(0,1fr)] wide:grid-cols-[clamp(300px,34vw,380px)_minmax(0,1fr)]">
        <section className="hidden wide:flex flex-col gap-4 min-h-0 self-start tall:max-h-full wide:sticky wide:top-[114px] bg-card border border-soft rounded-xl p-5">
          {selected ? slipPanel(selected, () => pick(null)) : (
            <>
              <h3 className="font-display text-[19px] font-bold tracking-tight text-main leading-tight">Order slip</h3>
              <p className="text-[14px] text-muted">No table picked.</p>
            </>
          )}
        </section>

        {/* The menu is always on screen, so a price can be read out without choosing
            anybody. It used to be an empty box saying it would open later. A dish tapped
            with nobody chosen puts nothing anywhere and says who is missing. */}
        <div className="min-w-0 min-h-0 flex flex-col gap-2.5">
          <MenuPicker
            onPick={item => {
              if (!selected) { showToast('Pick a table first, or start a new one.', 'info'); return }
              order.pickItem(item)
            }}
            counts={pickedCounts}
          />
          {selected && (
            <OffMenuOrder
              open={order.showOther}
              onOpen={() => order.setShowOther(true)}
              error={order.error}
              onAdd={order.addWritten}
            />
          )}
          {selected && !order.showOther && order.error && <p role="alert" className="text-[13px] font-medium text-danger-600">{order.error}</p>}
          {/* The slip is out of sight here, so what went wrong with it is said by the menu. */}
          {(order.saveError || error) && !sheetOpen && (
            <p role="alert" className="wide:hidden text-[13px] font-medium text-danger-600">{order.saveError || error}</p>
          )}
        </div>
      </div>

      <OrderDock
        person={selected}
        number={number}
        lines={selectedLines}
        total={selectedTotal}
        working={working}
        onOpen={() => setSheetOpen(true)}
        onSendKitchen={() => void kitchenStep('send')}
        onServed={() => void kitchenStep('served')}
        onBill={() => { if (selected) void askForBill(selected) }}
      />
      {sheetOpen && selected && (
        <OrderSheet onClose={() => setSheetOpen(false)}>
          {slipPanel(selected, () => setSheetOpen(false))}
        </OrderSheet>
      )}

      {billFor && (
        <BillPicker
          title={[billFor.person.name, slipNumber(billFor.tab)].filter(Boolean).join(' · ')}
          total={billFor.total}
          guests={roomGuests}
          onFrontDesk={billToFrontDesk}
          onRoom={(guest, place) => void billOntoRoom(guest, place)}
          onClose={() => setBillFor(null)}
        />
      )}
    </div>
  )
}

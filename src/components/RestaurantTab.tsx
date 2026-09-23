import React, { useEffect, useMemo, useState } from 'react'
import { BedDouble, Plus, Utensils, X } from 'lucide-react'
import { Tab, TabLine } from '../types/tab'
import { Booking, PaymentRecord } from '../types/booking'
import { guestPlace, inHouseGuests } from './restaurant/served'
import { MenuPicker } from './restaurant/MenuPicker'
import { OffMenuOrder } from './restaurant/OffMenuOrder'
import { RunningTabSlip } from './restaurant/RunningTabSlip'
import { TabBill } from './restaurant/TabBill'
import { TabSettlePanel } from './restaurant/TabSettlePanel'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { useTabOrder } from './restaurant/useTabOrder'
import { getOpenTabs, getTabLines, openTab, tabTotal } from '../utils/tabs'
import { takeFocusedGuestTab } from '../utils/restaurantFocus'
import { useDashboardData } from './DashboardContext'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

/** One person the desk is serving: a guest in a room, or a diner with no room. */
interface Served {
  /** Stable: the tab, or the booking while its tab is not open yet. */
  key: string
  name: string
  place: string
  tab: Tab | null
  booking: Booking | null
}

// The restaurant and bar (board cards k69 + k70), in the shape the owner picked.
//
// Three things on one screen, in the order the counter works:
//   1. the strip across the top — everyone the desk may charge, each with what
//      they owe so far, so switching tables is one tap;
//   2. the bill on the left — what that person has run up, and the way to print it;
//   3. the menu card on the right — one scroll, every line tappable, no categories
//      to choose first.
// A guest's food joins the bill they already have and is received at check-out; a
// diner with no room settles at the counter, the only place a settle panel appears.
export function RestaurantTab() {
  const { bookings, rooms, venues } = useDashboardData()

  const [tabs, setTabs] = useState<Tab[]>([])
  const [lines, setLines] = useState<Record<string, TabLine[]>>({})
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  // The 58 mm running tab, shown while the guest is standing there asking for it.
  const [printing, setPrinting] = useState(false)
  // The open-a-tab form stays hidden until a diner actually walks in.
  const [newDiner, setNewDiner] = useState(false)
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  // A guest sent here from their booking's Guest tab, opened once the bookings are
  // loaded (the dashboard's list may still be arriving on first render). Read
  // inside an effect, never in a state initializer: that initializer runs twice
  // under StrictMode and would swallow the hand-off on the second run.
  const [wantedGuest, setWantedGuest] = useState<string | null>(null)
  // The tab just settled, kept with its lines so its receipt can be printed after
  // it has already left the open list.
  const [settled, setSettled] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)

  /** Reads every open tab and its lines — a stay's and a diner's alike. */
  const load = async () => {
    const open = await getOpenTabs()
    const map: Record<string, TabLine[]> = {}
    for (const t of open) map[t.id] = await getTabLines(t.id)
    setTabs(open)
    setLines(map)
    setLoading(false)
  }

  // The first read. The tabs land in state from the callbacks, never from the
  // effect body itself — a setState called straight from an effect renders twice
  // for nothing.
  useEffect(() => {
    getOpenTabs()
      .then(async open => {
        const map: Record<string, TabLine[]> = {}
        for (const t of open) map[t.id] = await getTabLines(t.id)
        setTabs(open)
        setLines(map)
        setLoading(false)
      })
      .catch(err => {
        console.error('Could not read the tabs:', err)
        setLoading(false)
      })
  }, [])

  // The booking quick view's "Take orders for this guest" lands here. Read once,
  // off the effect body: the hand-off is consumed exactly once, so a second render
  // can never swallow it.
  useEffect(() => {
    queueMicrotask(() => {
      const id = takeFocusedGuestTab()
      if (id) setWantedGuest(id)
    })
  }, [])

  // Everyone who can be charged, in the order the strip shows them: the diners
  // standing at the counter first, then the guests who are in the hotel right now.
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

  /** Opens a guest's own tab — the same one every time, never a second (k69). */
  const openGuestTab = async (booking: Booking) => {
    setError(''); setBusy(true)
    try {
      await openTab({ bookingId: booking.id, label: booking.guest_name })
      setSelectedKey('booking:' + booking.id)
      await load()
    } catch (err) {
      setError('Could not open that guest\'s tab — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  // The booking quick view sends staff here with the guest already in mind. The
  // opening happens off the effect body, so nothing is set while React is still
  // committing this render.
  useEffect(() => {
    if (!wantedGuest || bookings.length === 0) return
    const booking = bookings.find(b => b.id === wantedGuest)
    if (!booking) return
    queueMicrotask(() => {
      setWantedGuest(null)
      void openGuestTab(booking)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedGuest, bookings])

  /** Picking somebody opens their tab if it is not open yet. */
  const pick = (person: Served) => {
    setSelectedKey(person.key)
    setNewDiner(false)
    if (person.booking && !person.tab) void openGuestTab(person.booking)
  }

  // Writing lines onto whichever tab is in front of the desk. Resolved by key, not
  // by the tab object, so a guest whose tab was opened a moment ago still writes to
  // the right one.
  const resolveTabId = async (): Promise<string> => {
    const person = served.find(p => p.key === selectedKey)
    if (!person) throw new Error('Nobody is being served.')
    if (person.tab) return person.tab.id
    const tab = await openTab({ bookingId: person.booking?.id, label: person.name })
    return tab.id
  }
  const order = useTabOrder(resolveTabId, load)

  const openNew = async () => {
    if (!name.trim() && !table.trim()) { setError('Give the tab a name or a table.'); return }
    setError(''); setBusy(true)
    try {
      const tab = await openTab({ label: name, tableLabel: table })
      setName(''); setTable(''); setNewDiner(false)
      setSelectedKey('tab:' + tab.id)
      await load()
    } catch {
      setError('Could not open that tab. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const dinerTabs = tabs.filter(t => !t.booking_id)
  const onTheTables = tabTotal(dinerTabs.flatMap(t => lines[t.id] || []))
  const guestsInHouse = served.length - dinerTabs.length
  const box = 'w-full bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500'
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-muted'
  const pickedCounts = selectedLines.reduce<Record<string, number>>((acc, l) => {
    if (l.kind === 'charge') acc[l.description] = (acc[l.description] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-4 font-sans">
      <div>
        <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
          <Utensils className="w-5 h-5 text-gold-600" />
          Restaurant &amp; bar
        </h2>
        <p className="text-[13px] text-muted mt-1">
          Walk-in tabs open: <b className="text-main">{dinerTabs.length}</b> · <b className="text-emerald-600">{fmtPeso(onTheTables)}</b> on the tables
          <span> · </span>
          <b className="text-main">{guestsInHouse}</b> guest{guestsInHouse === 1 ? '' : 's'} in the hotel
        </p>
      </div>

      {/* 1 · Everyone the desk may charge, each with what they owe so far.
          Sized for a finger: the staff tap this on a tablet in front of the guest. */}
      <div className="bg-card border border-soft rounded-lg p-3">
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted">Being served</span>

          {served.map(person => {
            const on = person.key === selectedKey
            const total = person.tab ? tabTotal(lines[person.tab.id] || []) : 0
            return (
              <button
                key={person.key}
                type="button"
                disabled={busy}
                onClick={() => pick(person)}
                title={person.place ? person.name + ' · ' + person.place : person.name}
                className={'shrink-0 inline-flex items-center gap-1.5 min-h-[44px] text-[12.5px] font-bold px-3 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ' +
                  (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}
              >
                {person.booking && <BedDouble className={'w-4 h-4 ' + (on ? 'text-ink-900' : 'text-gold-700')} />}
                <span>{person.name}</span>
                {person.place && <span className={on ? 'text-ink-900/70' : 'text-muted'}>· {person.place}</span>}
                <span className={on ? 'text-ink-900' : 'text-brand-text'}>{total > 0 ? fmtPeso(total) : '—'}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setNewDiner(v => !v)}
            className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] text-[12.5px] font-bold text-ink-600 border border-dashed border-soft hover:border-gold-400 hover:text-gold-800 px-3 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" /> New diner
          </button>

          {loading && <span className="shrink-0 text-[11.5px] text-muted">Reading the tabs…</span>}
          {!loading && served.length === 0 && (
            <span className="shrink-0 text-[11.5px] text-muted">Nobody is here yet — open a tab for a diner.</span>
          )}
        </div>

        {/* The open-a-tab form only exists while a diner is actually being seated. */}
        {newDiner && (
          <div className="mt-2 pt-2 border-t border-soft flex flex-wrap items-end gap-2">
            <label className="w-[170px]">
              <span className={label}>Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mr. Cruz" className={box} />
            </label>
            <label className="w-[140px]">
              <span className={label}>Table</span>
              <input value={table} onChange={e => setTable(e.target.value)} placeholder="e.g. Table 2" className={box} />
            </label>
            <button type="button" onClick={() => void openNew()} disabled={busy}
              className="inline-flex items-center gap-1.5 min-h-[44px] text-[12.5px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-4 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
              <Plus className="w-4 h-4" /> Open tab
            </button>
            <button type="button" onClick={() => { setNewDiner(false); setError('') }}
              className="inline-flex items-center min-h-[44px] text-[12.5px] font-semibold text-muted hover:text-main px-3 py-2 transition-colors cursor-pointer">
              Cancel
            </button>
            <span className="text-[10.5px] text-muted w-full">A name or a table is enough — one of the two. They pay at the counter.</span>
            {error && <span className="text-[11px] font-semibold text-danger-600 w-full">{error}</span>}
          </div>
        )}
      </div>

      {/* 2 · the bill on the left, 3 · the menu card on the right. */}
      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="bg-card border border-soft rounded-lg p-3.5 space-y-3 self-start">
          {selected ? (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[13px] font-bold text-main flex flex-wrap items-center gap-1.5">
                    {selected.booking && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-gold-800 bg-gold-100 rounded px-1.5 py-0.5">
                        On the room
                      </span>
                    )}
                    {selected.name}
                  </p>
                  {selected.place && <p className="text-[11px] font-semibold text-muted mt-0.5">{selected.place}</p>}
                </div>
                <button type="button" onClick={() => setSelectedKey(null)} aria-label="Close this bill"
                  className="text-muted hover:text-main p-0.5 transition-colors cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <TabBill
                lines={selectedLines}
                total={tabTotal(selectedLines)}
                busy={order.busy}
                onRemove={line => void order.remove(line)}
                onPrint={() => setPrinting(true)}
                emptyText="Nothing on this bill yet. Tap the menu to add the first order."
              />

              {selected.booking ? (
                <p className="text-[12px] text-ink-600 bg-paper-50 border border-soft rounded-lg px-3 py-2.5">
                  <b className="text-ink-900">Goes on the room bill.</b> It is received with the rest of the stay at check-out — a diner with no room settles at the counter instead.
                </p>
              ) : selectedLines.length > 0 && selected.tab ? (
                <TabSettlePanel
                  tab={selected.tab}
                  total={tabTotal(selectedLines)}
                  onSettled={async receipt => {
                    setSettled({ tab: selected.tab as Tab, lines: selectedLines, record: receipt })
                    setSelectedKey(null)
                    await load()
                  }}
                />
              ) : (
                <p className="text-[12px] text-ink-600 bg-paper-50 border border-soft rounded-lg px-3 py-2.5">
                  <b className="text-ink-900">Pays at the counter.</b> The bill is settled here once something is on it.
                </p>
              )}
            </>
          ) : (
            <p className="text-[13px] text-muted">
              Tap who you are serving above — a guest with a room, or a diner at a table.
            </p>
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
              {order.removeError && <p className="text-[11px] font-semibold text-danger-600">{order.removeError}</p>}
            </>
          ) : (
            <div className="bg-card border border-soft rounded-lg px-4 py-10 text-center">
              <p className="text-[13px] text-muted">The menu opens as soon as you pick who you are serving.</p>
            </div>
          )}
        </div>
      </div>

      {printing && selected && (
        <RunningTabSlip
          who={selected.name}
          place={selected.booking
            ? { label: selected.booking.room_id ? 'Room' : 'Venue', value: selected.place }
            : (selected.place ? { label: 'Table', value: selected.place } : undefined)}
          lines={selectedLines}
          total={tabTotal(selectedLines)}
          note={selected.booking
            ? (selected.booking.room_id ? 'Settles with the room bill at check-out.' : 'Settles with the bill at check-out.')
            : 'Please settle this at the counter.'}
          onClose={() => setPrinting(false)}
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

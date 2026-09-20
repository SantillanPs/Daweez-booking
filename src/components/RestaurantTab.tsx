import React, { useEffect, useState } from 'react'
import { Plus, Utensils, X } from 'lucide-react'
import { Tab, TabLine } from '../types/tab'
import { Booking, PaymentRecord } from '../types/booking'
import { GuestTabPanel } from './calendar/GuestTabPanel'
import { GuestPicker, guestPlace } from './restaurant/GuestPicker'
import { TabSettlePanel } from './restaurant/TabSettlePanel'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { getOpenWalkInTabs, getTabLines, openTab, tabTotal } from '../utils/tabs'
import { takeFocusedGuestTab } from '../utils/restaurantFocus'
import { useDashboardData } from './DashboardContext'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// The restaurant and bar (board card k69).
//
// This is where orders are taken, for BOTH kinds of guest — the owner wanted it
// that way: a guest staying in a room is charged here, by finding them in the
// list of people who are in the hotel, and a diner with no room runs a tab that
// is settled at the counter. Nothing about a guest is edited on this screen, and
// nothing about the restaurant is edited in the booking slide-over.
export function RestaurantTab() {
  const { bookings, rooms, venues } = useDashboardData()

  const [tabs, setTabs] = useState<Tab[]>([])
  const [lines, setLines] = useState<Record<string, TabLine[]>>({})
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // The guest whose room is being charged right now (k69).
  const [roomTab, setRoomTab] = useState<{ tab: Tab; booking: Booking } | null>(null)
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  // A guest sent here from their booking's Guest tab, opened once the bookings
  // are loaded (the dashboard's list may still be arriving on first render). Read
  // inside an effect, never in a state initializer: that initializer runs twice
  // under StrictMode and would swallow the hand-off on the second run.
  const [wantedGuest, setWantedGuest] = useState<string | null>(null)
  // The tab just settled, kept with its lines so its receipt can be printed after
  // it has already left the open list.
  const [settled, setSettled] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)

  // Reads the open tabs and their lines. Keeps the selected tab while it is still
  // open, otherwise falls back to the first.
  const load = async (preferId?: string) => {
    const open = await getOpenWalkInTabs()
    const map: Record<string, TabLine[]> = {}
    for (const t of open) map[t.id] = await getTabLines(t.id)
    setTabs(open)
    setLines(prev => ({ ...prev, ...map }))
    setSelectedId(prev => {
      const wanted = preferId || prev
      return wanted && open.some(t => t.id === wanted) ? wanted : (open[0]?.id ?? null)
    })
    setLoading(false)
  }

  useEffect(() => { void load() }, [])

  // The booking quick view's "Take orders for this guest" lands here.
  useEffect(() => {
    const id = takeFocusedGuestTab()
    if (id) setWantedGuest(id)
  }, [])

  /** Re-reads one tab's lines, whichever kind of guest it belongs to. */
  const reloadLines = async (tabId: string) => {
    const rows = await getTabLines(tabId)
    setLines(prev => ({ ...prev, [tabId]: rows }))
  }

  // Charges a room: the guest's own tab, opened here and never settled here —
  // their food goes on the bill they already have.
  const openRoomTab = async (booking: Booking) => {
    setError(''); setBusy(true)
    try {
      const tab = await openTab({ bookingId: booking.id, label: booking.guest_name })
      setRoomTab({ tab, booking })
      setSelectedId(null)
      await reloadLines(tab.id)
    } catch (err) {
      setError('Could not open that guest\'s tab — ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setBusy(false)
    }
  }

  // The booking quick view sends staff here with the guest already in mind.
  useEffect(() => {
    if (!wantedGuest || bookings.length === 0) return
    const booking = bookings.find(b => b.id === wantedGuest)
    setWantedGuest(null)
    if (booking) void openRoomTab(booking)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedGuest, bookings])

  const selected = tabs.find(t => t.id === selectedId) || null
  const room = roomTab

  const openNew = async () => {
    if (!name.trim() && !table.trim()) { setError('Give the tab a name or a table.'); return }
    setError(''); setBusy(true)
    try {
      const tab = await openTab({ label: name, tableLabel: table })
      setName(''); setTable('')
      await load(tab.id)
    } catch {
      setError('Could not open that tab. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const onTheTables = tabTotal(tabs.flatMap(t => lines[t.id] || []))
  const box = 'w-full bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500'
  const label = 'block text-[10px] font-bold uppercase tracking-wider text-muted'

  return (
    <div className="space-y-4 font-sans">
      <div>
        <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
          <Utensils className="w-5 h-5 text-gold-600" />
          Restaurant &amp; bar
        </h2>
        <p className="text-[13px] text-muted mt-1">
          Walk-in tabs open: <b className="text-main">{tabs.length}</b> · <b className="text-emerald-600">{fmtPeso(onTheTables)}</b> on the tables
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/* Left: charge a room, open a walk-in tab, then the ones already running. */}
        <div className="space-y-3">
          <GuestPicker
            bookings={bookings}
            rooms={rooms}
            venues={venues}
            activeBookingId={room?.booking.id}
            onPick={b => void openRoomTab(b)}
            busy={busy}
          />

          <div className="bg-card border border-soft rounded-lg p-3.5 space-y-2">
            <p className="text-[13px] font-bold text-main">Open a tab for a diner</p>
            <label className="block">
              <span className={label}>Name</span>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mr. Cruz" className={box} />
            </label>
            <label className="block">
              <span className={label}>Table</span>
              <input value={table} onChange={e => setTable(e.target.value)} placeholder="e.g. Table 2" className={box} />
            </label>
            {error && <p className="text-[11px] font-semibold text-danger-600">{error}</p>}
            <button type="button" onClick={() => void openNew()} disabled={busy}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-3 py-2 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
              <Plus className="w-3.5 h-3.5" /> Open tab
            </button>
            <p className="text-[10.5px] text-muted">A name or a table is enough — one of the two. They pay at the counter.</p>
          </div>

          <div className="bg-card border border-soft rounded-lg overflow-hidden">
            <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-soft">Open now</p>
            {loading ? (
              <p className="px-3.5 py-4 text-[13px] text-muted">Reading the tabs…</p>
            ) : tabs.length === 0 ? (
              <p className="px-3.5 py-4 text-[13px] text-muted">No tabs open. Start one above.</p>
            ) : (
              <ul className="divide-y divide-soft">
                {tabs.map(t => {
                  const count = (lines[t.id] || []).length
                  return (
                    <li key={t.id}>
                      <button type="button" onClick={() => setSelectedId(t.id)}
                        className={'w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer ' + (t.id === selectedId ? 'bg-gold-100' : 'hover:bg-page')}>
                        <span className="flex items-center justify-between gap-2">
                          <span className="text-[13px] font-bold text-main truncate">{t.label || t.table_label || 'Walk-in'}</span>
                          <span className="text-[13px] font-bold text-main shrink-0">{fmtPeso(tabTotal(lines[t.id] || []))}</span>
                        </span>
                        <span className="block text-[10.5px] text-muted mt-0.5">
                          {count} line{count === 1 ? '' : 's'}
                          {t.label && t.table_label ? ' · ' + t.table_label : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right: whichever tab staff picked — a guest's room, or a diner's. */}
        <div className="bg-card border border-soft rounded-lg p-4">
          {selected ? (
            <>
              <p className="text-[13px] font-bold text-main mb-3">
                {selected.label || 'Walk-in'}{selected.table_label ? ' · ' + selected.table_label : ''}
              </p>
              <GuestTabPanel
                resolveTabId={async () => selected.id}
                lines={lines[selected.id] || []}
                tabTotal={tabTotal(lines[selected.id] || [])}
                onChanged={async () => { await reloadLines(selected.id) }}
                slip={{
                  who: selected.label || 'Walk-in diner',
                  place: selected.table_label ? { label: 'Table', value: selected.table_label } : undefined,
                  note: 'Please settle this at the counter.',
                }}
              />
              {/* Settling (k69, part C): only worth offering once something is on
                  the tab. The diner pays what they ran up and gets a receipt. */}
              {(lines[selected.id] || []).length > 0 && (
                <TabSettlePanel
                  tab={selected}
                  total={tabTotal(lines[selected.id] || [])}
                  onSettled={async receipt => {
                    setSettled({ tab: selected, lines: lines[selected.id] || [], record: receipt })
                    await load()
                  }}
                />
              )}
            </>
          ) : room ? (
            <>
              <div className="flex items-start justify-between gap-2 mb-3">
                <p className="text-[13px] font-bold text-main">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gold-800 bg-gold-100 rounded px-1.5 py-0.5">
                      On the room
                    </span>
                    {guestPlace(room.booking, rooms, venues)} · {room.booking.guest_name || 'Guest'}
                  </span>
                </p>
                <button type="button" onClick={() => setRoomTab(null)} aria-label="Close this guest's tab"
                  className="text-muted hover:text-main p-0.5 transition-colors cursor-pointer shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <GuestTabPanel
                resolveTabId={async () => room.tab.id}
                lines={lines[room.tab.id] || []}
                tabTotal={tabTotal(lines[room.tab.id] || [])}
                onChanged={async () => { await reloadLines(room.tab.id) }}
                slip={{
                  who: room.booking.guest_name || 'Guest',
                  place: {
                    label: room.booking.room_id ? 'Room' : 'Venue',
                    value: guestPlace(room.booking, rooms, venues),
                  },
                  note: room.booking.room_id ? 'Settles with the room bill at check-out.' : 'Settles with the bill at check-out.',
                }}
              />
              {/* No settle panel here on purpose: a guest's food joins the bill they
                  already have, and is received with the rest of the stay. */}
              <p className="mt-3 text-[12px] text-ink-600 bg-paper-50 border border-soft rounded-lg px-3 py-2.5">
                <b className="text-ink-900">Goes on the room bill.</b> It is received with the rest of the stay at check-out — a diner with no room settles at the counter instead.
              </p>
            </>
          ) : (
            <p className="text-[13px] text-muted">Charge a guest's room on the left, or open a tab for a diner.</p>
          )}
        </div>
      </div>

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

import React, { useState, useMemo, useCallback, useRef } from 'react'
import { useDashboardData } from './DashboardContext'
import { Booking } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { dateToString } from '../utils/helpers'
import { WalkInBookingForm } from './WalkInBookingForm'
import { shortStayEnd, stayHoursOf } from '../utils/shortStay'
import { takeFocusedBooking } from '../utils/bookingFocus'
import { ExtendStayModal } from './calendar/ExtendStayModal'
import { TimelineGrid } from './calendar/TimelineGrid'
import { TimelineDayInfo, buildTimelineDays, timelineHeader, sameMonth } from './calendar/timelineDays'
import { LogOldBookingModal } from './calendar/LogOldBookingModal'
import { CorporateBookingForm } from './corporate/CorporateBookingForm'
import { CalendarToolbar } from './calendar/CalendarToolbar'
import { CalendarLegend } from './calendar/CalendarLegend'
import { roomDisplayName } from './calendar/bookingStyles'
import { showToast } from '../utils/toast'

type Selection = { roomId?: string; venueId?: string; checkIn: Date }
type GroupSel = Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }>
type UnitSel = { checkIn: string; checkOut: string; type: 'room' | 'venue' }

export function CalendarTab() {
  const { rooms, venues, bookings, createManualBooking, cancelBooking, updateBooking } = useDashboardData()

  // ── Month / timeline state ──
  // The anchor IS the day the 31-day window starts on (card k154 follow-up): Today
  // sets today, ‹ › set the 1st of the month they step to, and the toolbar's date box
  // sets the day the desk picked.
  const [monthAnchor, setMonthAnchor] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d
  })
  const [timelineSelection, setTimelineSelection] = useState<Selection | null>(null); const [groupSelection, setGroupSelection] = useState<GroupSel | null>(null)

  // ── Booking detail / extension modal ──
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  const [showLogOld, setShowLogOld] = useState(false)
  const [logOldSelections, setLogOldSelections] = useState<Record<string, UnitSel>>({})
  const [showCorporate, setShowCorporate] = useState(false)
  const [corporateSelections, setCorporateSelections] = useState<Record<string, UnitSel>>({})
  const [extendCheckoutDate, setExtendCheckoutDate] = useState(''); const [extendError, setExtendError] = useState('')

  // ── Full wizard (editing + advanced) ──
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null); const [showManualForm, setShowManualForm] = useState(false); const [formSelections, setFormSelections] = useState<Record<string, UnitSel>>({}); const [manualBookingType, setManualBookingType] = useState<'individual' | 'partner'>('individual'); const [formStayHours, setFormStayHours] = useState<number | null>(null)

  // ── The short-stay clock (the owner's ruling) ────────────────────────────────
  // No countdown is ever printed: the calendar block shows the TIME the room is free,
  // and when that time arrives the booking's panel opens BY ITSELF so the desk can
  // check the guest out. It waits while the desk is mid-task (another panel or form
  // open) — the block simply stays red — and due rooms are opened ONE AFTER ANOTHER,
  // because only one panel is ever on screen.
  const [dueShortStayIds, setDueShortStayIds] = useState<string[]>([])
  const poppedDueRef = useRef<Set<string>>(new Set())
  const deskBusy = showManualForm || showCorporate || showLogOld || !!selectedExtendBooking

  // Latest-value refs keep the click handler stable so a date click never
  // re-renders the whole grid.
  const timelineSelectionRef = useRef(timelineSelection)
  const groupSelectionRef = useRef(groupSelection)
  const bookingsRef = useRef(bookings)
  const roomsRef = useRef(rooms)
  const venuesRef = useRef(venues)
  React.useEffect(() => {
    timelineSelectionRef.current = timelineSelection; groupSelectionRef.current = groupSelection; bookingsRef.current = bookings; roomsRef.current = rooms; venuesRef.current = venues
  })

  // The scan: which short stays are past their hours, and popping the panel for the
  // first one nobody has dealt with yet. A closed panel is never reopened — the desk
  // said "not now" — the block just stays red until they tap it.
  React.useEffect(() => {
    const scan = () => {
      const now = Date.now()
      const due = bookings.filter(b => {
        const end = shortStayEnd(b.actual_check_in, stayHoursOf(b))
        return !!end && end.getTime() <= now && !b.actual_check_out && b.status !== 'blocked'
      })
      setDueShortStayIds(prev => {
        const ids = due.map(b => b.id)
        return prev.length === ids.length && prev.every((found, i) => found === ids[i]) ? prev : ids
      })
      if (deskBusy) return
      const next = due.find(b => !poppedDueRef.current.has(b.id))
      if (!next) return
      poppedDueRef.current.add(next.id)
      setSelectedExtendBooking(next)
    }
    scan()
    const timer = window.setInterval(scan, 15000)
    return () => window.clearInterval(timer)
  }, [bookings, deskBusy])

  // Today's own key: the list is rebuilt if the app is left open past midnight.
  const todayKey = dateToString(new Date())
  const daysList = useMemo<TimelineDayInfo[]>(
    () => buildTimelineDays(monthAnchor),
    // todayKey is not read inside on purpose: it IS the midnight roll-over trigger,
    // so leaving the app open overnight rebuilds the day list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [monthAnchor, todayKey]
  )
  const monthHeader = useMemo(() => timelineHeader(daysList), [daysList])
  const startsToday = daysList[0]?.isToday === true

  // The slide-over opens on the LIVE row, never on the object the grid happened to
  // be holding when the pill was clicked. The grid is memoized, so a cell can keep
  // an older booking after a save that only changed the stage (check-in / check-out
  // are not part of the pill's own badge, so nothing forced it to re-render) — and
  // reopening the booking then showed "Check in" again for a guest already in.
  const liveExtendBooking = selectedExtendBooking
    ? bookings.find(b => b.id === selectedExtendBooking.id) || selectedExtendBooking
    : null

  const toDateKey = (y: number, m: number, d: number) => y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0')

  // Index bookings by Room/Venue+Date — numeric UTC timestamps, no string parsing in loop.
  const bookingByRoomAndDate = useMemo(() => {
    const map: Record<string, Booking> = {}
    const oneDay = 86400000
    bookings.forEach(b => {
      const keyId = b.room_id || syncEngine.normalizeVenueId(b.venue_id)
      if (!keyId) return
      const [y1, m1, d1] = b.check_in.split('-').map(Number)
      const [y2, m2, d2] = b.check_out.split('-').map(Number)
      let cur = Date.UTC(y1, m1 - 1, d1)
      const end = Date.UTC(y2, m2 - 1, d2)
      while (cur < end) {
        const dt = new Date(cur)
        map[keyId + '_' + toDateKey(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())] = b
        cur += oneDay
      }
    })
    return map
  }, [bookings])

  const handleCellClick = useCallback((id: string, type: 'room' | 'venue', date: Date) => {
    const curTimeline = timelineSelectionRef.current
    const curGroup = groupSelectionRef.current

    if (curGroup && curGroup[id]) {
      setGroupSelection(prev => {
        if (!prev) return null
        const next = { ...prev }
        delete next[id]
        return Object.keys(next).length === 0 ? null : next
      })
      return
    }

    const selIdKey = type === 'room' ? 'roomId' : 'venueId'
    if (curTimeline && curTimeline[selIdKey] === id && date.toDateString() === curTimeline.checkIn.toDateString()) {
      setTimelineSelection(null)
      return
    }

    if (!curTimeline || (curTimeline.roomId !== id && curTimeline.venueId !== id)) {
      setTimelineSelection({ [selIdKey]: id, checkIn: date })
    } else {
      if (date <= curTimeline.checkIn) {
        setTimelineSelection({ [selIdKey]: id, checkIn: date })
        return
      }
      const checkInStr = dateToString(curTimeline.checkIn)
      const checkOutStr = dateToString(date)
      const isAvailable = type === 'room'
        ? syncEngine.isRoomAvailable(id, checkInStr, checkOutStr, bookingsRef.current)
        : syncEngine.isVenueRangeAvailable(id, checkInStr, checkOutStr, bookingsRef.current)
      if (!isAvailable) {
        const unitName = type === 'room' ? roomDisplayName(roomsRef.current.find(r => r.id === id)) : (venuesRef.current.find(v => v.id === id)?.name ?? id)
        showToast((type === 'room' ? 'Room' : 'Venue') + ' ' + unitName + ' is already booked on some of those dates.', 'error')
        setTimelineSelection(null)
        return
      }
      setGroupSelection(prev => ({ ...(prev || {}), [id]: { checkIn: curTimeline.checkIn, checkOut: date, type } }))
      setTimelineSelection(null)
    }
  }, [])

  const handleExtendStaySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setExtendError('')
    if (!selectedExtendBooking || !extendCheckoutDate) return
    try {
      const isRoom = !!selectedExtendBooking.room_id
      const availOk = isRoom
        ? syncEngine.isRoomAvailable(selectedExtendBooking.room_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)
        : syncEngine.isVenueRangeAvailable(selectedExtendBooking.venue_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)
      if (!availOk) { setExtendError('Overlap collision — already reserved.'); return }
      const pricing = syncEngine.calculatePricing({
        roomId: selectedExtendBooking.room_id,
        venueId: selectedExtendBooking.venue_id,
        checkIn: selectedExtendBooking.check_in,
        checkOut: extendCheckoutDate,
        guestEmail: selectedExtendBooking.guest_email,
        breakfastOrders: selectedExtendBooking.breakfast_orders,
        bookingsList: bookings,
        contractRateOverride: selectedExtendBooking.contract_rate_override,
        usePromo: (selectedExtendBooking as { promo_applied?: boolean }).promo_applied === true,
        rooms, venues
      })
      const current = await syncEngine.getBookings()
      const target = current.find(b => b.id === selectedExtendBooking.id) || selectedExtendBooking
      await updateBooking({ ...target, check_out: extendCheckoutDate, balance_due: pricing.balanceDue })
      setSelectedExtendBooking(null)
    } catch (err) {
      setExtendError(err instanceof Error ? err.message : 'Unknown error during stay extension')
    }
  }

  /** Short stay: the SAME flow as New booking — pick on the grid first, then press the button — except a short stay needs ONE day rather than a range, because the room is taken for that whole day. Check-out is filled in as the next day for the desk, and the hours tapped on the bar (3, 6 or 12) travel into the form already chosen. */
  const confirmShortStay = (hours: number) => {
    const picked = timelineSelectionRef.current
    const roomId = picked?.roomId
    if (!roomId) return
    const checkIn = new Date(picked.checkIn)
    const checkOut = new Date(picked.checkIn)
    checkOut.setDate(checkOut.getDate() + 1)
    setTimelineSelection(null)
    setGroupSelection(null)
    setEditingBooking(null)
    setManualBookingType('individual')
    setFormStayHours(hours)
    setFormSelections({ [roomId]: { checkIn: dateToString(checkIn), checkOut: dateToString(checkOut), type: 'room' } })
    setShowManualForm(true)
  }

  const confirmGroup = () => {
    if (!groupSelection) return
    const serialized: Record<string, UnitSel> = {}
    Object.entries(groupSelection).forEach(([id, sel]) => {
      serialized[id] = { checkIn: dateToString(sel.checkIn), checkOut: dateToString(sel.checkOut), type: sel.type }
    })
    setGroupSelection(null)
    setTimelineSelection(null)
    setFormStayHours(null)
    setFormSelections(serialized)
    setEditingBooking(null)
    setManualBookingType('individual')
    setShowManualForm(true)
  }

  const confirmGroupCorporate = () => {
    if (!groupSelection) return
    const serialized: Record<string, UnitSel> = {}
    Object.entries(groupSelection).forEach(([id, sel]) => {
      serialized[id] = { checkIn: dateToString(sel.checkIn), checkOut: dateToString(sel.checkOut), type: sel.type }
    })
    setGroupSelection(null)
    setTimelineSelection(null)
    setCorporateSelections(serialized)
    setShowCorporate(true)
  }


  // What the toolbar's date box shows, and the three ways the window moves (card
  // k154 follow-up). Each control decides the day itself — nothing is guessed from
  // the date afterwards, because "the 1st of the current month" is exactly what the
  // desk types when they want the 1st: guessing sent 1 September back to today.
  const datePickerValue = dateToString(monthAnchor)
  const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d }
  const stepMonth = (delta: number) => {
    const target = new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + delta, 1)
    // Stepping back into the month we are living in opens on today, so arriving by
    // arrow never buries today off the right edge (that is the k154 rule).
    setMonthAnchor(sameMonth(target, new Date()) ? todayStart() : target)
  }
  const jumpToDay = (value: string) => {
    // Parsed by hand: `new Date('2026-12-15')` is UTC midnight, which is 15 Dec only
    // from 8am in UTC+8 — the desk would pick a day and land on the one before it.
    const [y, m, d] = value.split('-').map(Number)
    if (!y || !m || !d) return
    setMonthAnchor(new Date(y, m - 1, d))
  }
  return (
    <div className="space-y-3 font-sans flex-1 min-h-0 flex flex-col overflow-hidden">
      <CalendarToolbar
        monthHeader={monthHeader}
        startsToday={startsToday}
        datePickerValue={datePickerValue}
        onPrevMonth={() => stepMonth(-1)}
        onNextMonth={() => stepMonth(1)}
        onJumpToDate={jumpToDay}
        onToday={() => setMonthAnchor(todayStart())}
        logOldDisabled={!groupSelection || Object.keys(groupSelection).length === 0}
        onLogOldBooking={() => {
          const serialized: Record<string, UnitSel> = {}
          if (groupSelection) Object.entries(groupSelection).forEach(([id, sel]) => { serialized[id] = { checkIn: dateToString(sel.checkIn), checkOut: dateToString(sel.checkOut), type: sel.type } })
          setLogOldSelections(serialized)
          setGroupSelection(null)
          setTimelineSelection(null)
          setShowLogOld(true)
        }}
      />
      <div className="flex-grow min-h-0 flex flex-row gap-2 overflow-hidden">
        <CalendarLegend />
        <TimelineGrid
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          daysList={daysList}
          bookingByRoomAndDate={bookingByRoomAndDate}
          timelineSelection={timelineSelection}
          groupSelection={groupSelection}
          handleCellClick={handleCellClick}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
          onNewBooking={confirmGroup}
          onNewCorporate={confirmGroupCorporate}
          onNewShortStay={confirmShortStay}
          onClearSelection={() => { setTimelineSelection(null); setGroupSelection(null) }}
          dueShortStayIds={dueShortStayIds}
        />
      </div>


      {liveExtendBooking && (
        <ExtendStayModal
          key={liveExtendBooking.id}
          booking={liveExtendBooking}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          extendCheckoutDate={extendCheckoutDate}
          extendError={extendError}
          onClose={() => setSelectedExtendBooking(null)}
          onExtendStaySubmit={handleExtendStaySubmit}
          setExtendCheckoutDate={setExtendCheckoutDate}
          onCancelBooking={cancelBooking}
          onUpdateBooking={updateBooking}
          onEditBooking={() => { setEditingBooking(liveExtendBooking); setFormStayHours(null); setShowManualForm(true); setSelectedExtendBooking(null) }}
          shortStayDue={dueShortStayIds.indexOf(liveExtendBooking.id) !== -1}
        />
      )}

      {showManualForm && (
        <WalkInBookingForm
          key={editingBooking ? 'edit-' + editingBooking.id : Object.keys(formSelections).join(',') + (formStayHours ? '-h' + formStayHours : '')}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          createManualBooking={createManualBooking}
          cancelBooking={cancelBooking}
          initialSelections={editingBooking
            ? { [editingBooking.room_id || editingBooking.venue_id || '']: { checkIn: editingBooking.check_in, checkOut: editingBooking.check_out, type: editingBooking.room_id ? 'room' : 'venue' } }
            : formSelections}
          editingBookings={editingBooking
            ? (editingBooking.invoice_number ? bookings.filter(b => b.invoice_number === editingBooking.invoice_number) : [editingBooking])
            : undefined}
          initialBookingType={manualBookingType}
          initialStayHours={formStayHours ?? undefined}
          onClose={() => {
            setShowManualForm(false); setEditingBooking(null); setFormSelections({}); setFormStayHours(null)
            // Once the billing statement is closed, the booking just made opens
            // itself in the quick view (card k134).
            const created = takeFocusedBooking()
            const booking = created ? bookings.find(b => b.id === created) : undefined
            if (booking) setSelectedExtendBooking(booking)
          }}
        />
      )}

      {showCorporate && (
        <CorporateBookingForm
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          initialSelections={corporateSelections}
          createManualBooking={createManualBooking}
          onClose={() => setShowCorporate(false)}
        />
      )}

      {showLogOld && (
        <LogOldBookingModal
          rooms={rooms}
          venues={venues}
          createManualBooking={createManualBooking}
          initialSelections={logOldSelections}
          onClose={() => setShowLogOld(false)}
        />
      )}

    </div>
  )
}
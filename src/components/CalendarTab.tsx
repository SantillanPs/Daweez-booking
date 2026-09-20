import React, { useState, useMemo, useCallback, useRef } from 'react'
import { useDashboardData } from './DashboardContext'
import { Booking } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { dateToString } from '../utils/helpers'
import { WalkInBookingForm } from './WalkInBookingForm'
import { takeFocusedBooking } from '../utils/bookingFocus'
import { ExtendStayModal } from './calendar/ExtendStayModal'
import { TimelineGrid, TimelineDayInfo } from './calendar/TimelineGrid'
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
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d
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
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null); const [showManualForm, setShowManualForm] = useState(false); const [formSelections, setFormSelections] = useState<Record<string, UnitSel>>({}); const [manualBookingType, setManualBookingType] = useState<'individual' | 'partner'>('individual')

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

  const daysCount = useMemo(() => new Date(schedulerStartDate.getFullYear(), schedulerStartDate.getMonth() + 1, 0).getDate(), [schedulerStartDate])

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

  const daysList = useMemo(() => {
    const list: TimelineDayInfo[] = []
    const todayStr = new Date().toDateString()
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(schedulerStartDate)
      d.setDate(schedulerStartDate.getDate() + i)
      list.push({
        date: d,
        isoStr: dateToString(d),
        time: d.getTime(),
        dayNum: d.getDate(),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1),
        isToday: d.toDateString() === todayStr,
        isWeekend: d.getDay() === 0 || d.getDay() === 6
      })
    }
    return list
  }, [schedulerStartDate, daysCount])

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

  const confirmGroup = () => {
    if (!groupSelection) return
    const serialized: Record<string, UnitSel> = {}
    Object.entries(groupSelection).forEach(([id, sel]) => {
      serialized[id] = { checkIn: dateToString(sel.checkIn), checkOut: dateToString(sel.checkOut), type: sel.type }
    })
    setGroupSelection(null)
    setTimelineSelection(null)
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


  const datePickerValue = schedulerStartDate.getFullYear() + '-' + String(schedulerStartDate.getMonth() + 1).padStart(2, '0')
  return (
    <div className="space-y-3 font-sans flex-1 min-h-0 flex flex-col overflow-hidden">
      <CalendarToolbar
        monthHeader={schedulerStartDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
        datePickerValue={datePickerValue}
        onPrevMonth={() => { const p = new Date(schedulerStartDate); p.setMonth(p.getMonth() - 1); setSchedulerStartDate(p) }}
        onNextMonth={() => { const n = new Date(schedulerStartDate); n.setMonth(n.getMonth() + 1); setSchedulerStartDate(n) }}
        onMonthChange={value => { const [y, m] = value.split('-').map(Number); setSchedulerStartDate(new Date(y, m - 1, 1)) }}
        onThisMonth={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setSchedulerStartDate(d) }}
        newBookingDisabled={!groupSelection || Object.keys(groupSelection).length === 0}
        logOldDisabled={!groupSelection || Object.keys(groupSelection).length === 0}
        onNewBooking={confirmGroup}
        onNewCorporate={confirmGroupCorporate}
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
          setTimelineSelection={setTimelineSelection}
          groupSelection={groupSelection}
          handleCellClick={handleCellClick}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
        />
      </div>


      {selectedExtendBooking && (
        <ExtendStayModal
          key={selectedExtendBooking.id}
          booking={selectedExtendBooking}
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
          onEditBooking={() => { setEditingBooking(selectedExtendBooking); setShowManualForm(true); setSelectedExtendBooking(null) }}
        />
      )}

      {showManualForm && (
        <WalkInBookingForm
          key={editingBooking ? 'edit-' + editingBooking.id : Object.keys(formSelections).join(',')}
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
          onClose={() => {
            setShowManualForm(false); setEditingBooking(null); setFormSelections({})
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
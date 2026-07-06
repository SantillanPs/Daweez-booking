import React, { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardData } from './DashboardContext'
import { Booking, Room } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { WalkInBookingForm } from './WalkInBookingForm'
import {
  Calendar, Filter, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react'

// Import modular subcomponents
import { ExtendStayModal } from './calendar/ExtendStayModal'
import { TimelineGrid } from './calendar/TimelineGrid'

const ROOM_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'room-1':  { bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-200' },
  'room-2':  { bg: 'bg-yellow-50',  text: 'text-yellow-800',  border: 'border-yellow-200' },
  'room-3':  { bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200' },
  'room-4':  { bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-200' },
  'room-5':  { bg: 'bg-rose-50',    text: 'text-rose-800',    border: 'border-rose-200' },
  'room-6':  { bg: 'bg-violet-50',  text: 'text-violet-800',  border: 'border-violet-200' },
  'room-7':  { bg: 'bg-teal-50',    text: 'text-teal-800',    border: 'border-teal-200' },
  'room-8':  { bg: 'bg-sky-50',     text: 'text-sky-800',     border: 'border-sky-200' },
  'room-9':  { bg: 'bg-orange-50',  text: 'text-orange-800',  border: 'border-orange-200' },
  'room-10': { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-300' },
}
const VENUE_COLORS = { bg: 'bg-fuchsia-50', text: 'text-fuchsia-800', border: 'border-fuchsia-200' }



const getBookingStyle = (b: Booking) => {
  if (b.status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
  if (b.status === 'blocked') return 'bg-slate-100 text-slate-400 border-slate-200 line-through'
  switch (b.source) {
    case 'airbnb':      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'booking_com': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'facebook':    return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'google_maps': return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'website':     return 'bg-violet-50 text-violet-700 border-violet-200'
    default:            return 'bg-slate-50 text-slate-700 border-slate-200'
  }
}

export function CalendarTab() {
  const queryClient = useQueryClient()
  const { rooms, venues, bookings, createManualBooking, cancelBooking } = useDashboardData()

  // ── Timeline state ──
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(new Date())
  const [daysCount] = useState<number>(30)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [timelineSelection, setTimelineSelection] = useState<{ roomId?: string; venueId?: string; checkIn: Date } | null>(null)

  // ── Booking detail / extension modal ──
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState<string>('')
  const [extendError, setExtendError] = useState<string>('')

  // ── Walk‑in form wizard ──
  const [showManualForm, setShowManualForm] = useState(false)
  const [formRoomIds, setFormRoomIds] = useState<Set<string>>(new Set(['room-1']))
  const [formVenueIds, setFormVenueIds] = useState<Set<string>>(new Set())
  const [formCheckIn, setFormCheckIn] = useState('')
  const [formCheckOut, setFormCheckOut] = useState('')

  const parseUTCDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }

  // Index bookings by exact Date string
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    bookings.forEach(b => {
      const start = parseUTCDate(b.check_in)
      const end = parseUTCDate(b.check_out)
      const current = new Date(start)
      if (current < end) {
        while (current < end) {
          const dateStr = current.toISOString().split('T')[0]
          if (!map[dateStr]) map[dateStr] = []
          map[dateStr].push(b)
          current.setUTCDate(current.getUTCDate() + 1)
        }
      }
    })
    return map
  }, [bookings])

  // Index bookings by Room/Venue Date key (for Timeline Grid overlaps & cell mapping)
  const bookingByRoomAndDate = useMemo(() => {
    const map: Record<string, Booking> = {}
    bookings.forEach(b => {
      const keyId = b.room_id || syncEngine.normalizeVenueId(b.venue_id)
      if (keyId) {
        const start = parseUTCDate(b.check_in)
        const current = new Date(start)
        const checkOut = parseUTCDate(b.check_out)
        if (current < checkOut) {
          while (current < checkOut) {
            const dateStr = current.toISOString().split('T')[0]
            map[`${keyId}_${dateStr}`] = b
            current.setUTCDate(current.getUTCDate() + 1)
          }
        }
      }
    })
    return map
  }, [bookings])

  // Build timeline day list info objects
  const daysList = useMemo(() => {
    const list = []
    const todayStr = new Date().toDateString()
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(schedulerStartDate)
      d.setDate(schedulerStartDate.getDate() + i)
      list.push({
        date: d,
        isoStr: d.toISOString().split('T')[0],
        time: d.getTime(),
        dayNum: d.getDate(),
        weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1),
        isToday: d.toDateString() === todayStr
      })
    }
    return list
  }, [schedulerStartDate, daysCount])

  const resetAndOpenManualForm = useCallback((roomIds: Set<string>, venueIds: Set<string>, checkIn = '', checkOut = '') => {
    setFormRoomIds(roomIds)
    setFormVenueIds(venueIds)
    setFormCheckIn(checkIn)
    setFormCheckOut(checkOut)
    setShowManualForm(true)
  }, [])

  const handleCellClick = useCallback((id: string, type: 'room' | 'venue', date: Date) => {
    const isRoom = type === 'room'
    const selIdKey = isRoom ? 'roomId' : 'venueId'
    
    // If clicking the exact same check-in date again, cancel the selection
    if (timelineSelection && timelineSelection[selIdKey] === id && date.toDateString() === timelineSelection.checkIn.toDateString()) {
      setTimelineSelection(null)
      return
    }

    if (!timelineSelection || date < timelineSelection.checkIn) {
      // Start a new selection (Click 1, or clicked earlier date)
      setTimelineSelection({ [selIdKey]: id, checkIn: date })
    } else {
      // Complete the selection (Click 2)
      const checkInStr = timelineSelection.checkIn.toISOString().split('T')[0]
      const checkOutStr = date.toISOString().split('T')[0]
      
      const roomIdsToBook = new Set<string>()
      const venueIdsToBook = new Set<string>()

      // Add first clicked unit
      if (timelineSelection.roomId) roomIdsToBook.add(timelineSelection.roomId)
      if (timelineSelection.venueId) venueIdsToBook.add(timelineSelection.venueId)

      // Add second clicked unit
      if (isRoom) {
        roomIdsToBook.add(id)
      } else {
        venueIdsToBook.add(id)
      }

      // Verify availability for all rooms
      const unavailRooms = Array.from(roomIdsToBook).filter(rid => !syncEngine.isRoomAvailable(rid, checkInStr, checkOutStr, bookings))
      if (unavailRooms.length > 0) {
        const roomNames = unavailRooms.map(rid => rooms.find(r => r.id === rid)?.room_number || rid).join(', ')
        alert(`Overlap collision! Rooms [${roomNames}] are already booked on some dates in this range.`)
        setTimelineSelection(null)
        return
      }

      // Verify availability for all venues
      const unavailVenues = Array.from(venueIdsToBook).filter(vid => !syncEngine.isVenueRangeAvailable(vid, checkInStr, checkOutStr, bookings))
      if (unavailVenues.length > 0) {
        const venueNames = unavailVenues.map(vid => venues.find(v => v.id === vid)?.name || vid).join(', ')
        alert(`Overlap collision! Venues [${venueNames}] are already reserved on some dates in this range.`)
        setTimelineSelection(null)
        return
      }

      resetAndOpenManualForm(roomIdsToBook, venueIdsToBook, checkInStr, checkOutStr)
      setTimelineSelection(null)
    }
  }, [timelineSelection, bookings, rooms, venues, resetAndOpenManualForm])

  const handleExtendStaySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setExtendError('')
    if (!selectedExtendBooking || !extendCheckoutDate) return
    try {
      const isRoom = !!selectedExtendBooking.room_id
      if (isRoom) {
        if (!syncEngine.isRoomAvailable(selectedExtendBooking.room_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)) {
          setExtendError('Overlap collision — room already reserved.'); return
        }
      } else {
        if (!syncEngine.isVenueRangeAvailable(selectedExtendBooking.venue_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)) {
          setExtendError('Overlap collision — venue already reserved.'); return
        }
      }
      const pricing = syncEngine.calculatePricing({
        roomId: selectedExtendBooking.room_id,
        venueId: selectedExtendBooking.venue_id,
        checkIn: selectedExtendBooking.check_in,
        checkOut: extendCheckoutDate,
        guestEmail: selectedExtendBooking.guest_email,
        breakfastOrders: selectedExtendBooking.breakfast_orders,
        bookingsList: bookings
      })
      const current = await syncEngine.getBookings()
      const updated = current.map(b => b.id === selectedExtendBooking.id ? { ...b, check_out: extendCheckoutDate, balance_due: pricing.balanceDue } : b)
      await syncEngine.saveBookings(updated)
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      setSelectedExtendBooking(null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during stay extension'
      setExtendError(msg)
    }
  }

  const spannedMonthHeader = useMemo(() => {
    if (daysList.length === 0) return ''
    const first = daysList[0].date
    const last = daysList[daysList.length - 1].date
    
    const firstMonth = first.toLocaleDateString('en-US', { month: 'long' })
    const lastMonth = last.toLocaleDateString('en-US', { month: 'long' })
    const firstYear = first.getFullYear()
    const lastYear = last.getFullYear()
    
    if (firstMonth === lastMonth && firstYear === lastYear) {
      return `${firstMonth} ${firstYear}`
    } else if (firstYear === lastYear) {
      return `${firstMonth} - ${lastMonth} ${firstYear}`
    } else {
      return `${firstMonth} ${firstYear} - ${lastMonth} ${lastYear}`
    }
  }, [daysList])

  const getYYYYMMDD = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const datePickerValue = getYYYYMMDD(schedulerStartDate)

  return (
    <div className="space-y-4 font-sans">
      {/* Upper header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 md:p-3.5 rounded-lg border border-slate-200">
        {/* Left Side: Title */}
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#B89251]" />
            <span>{spannedMonthHeader}</span>
          </h2>
        </div>

        {/* Right Side: Controls and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Compact Navigation controls */}
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200/60">
            {/* Double-left chevron: Shift by 30 days */}
            <button 
              onClick={() => { const p = new Date(schedulerStartDate); p.setDate(p.getDate() - 30); setSchedulerStartDate(p) }}
              title="Prev 30 days"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition-all cursor-pointer"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            {/* Single-left chevron: Shift by 7 days */}
            <button 
              onClick={() => { const p = new Date(schedulerStartDate); p.setDate(p.getDate() - 7); setSchedulerStartDate(p) }}
              title="Prev 7 days"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* Native Date Picker */}
            <input 
              type="date"
              value={datePickerValue}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m, d] = e.target.value.split('-').map(Number)
                  setSchedulerStartDate(new Date(y, m - 1, d))
                }
              }}
              className="bg-white border border-slate-200 text-slate-700 text-xs px-1.5 py-0.5 rounded outline-none font-mono focus:ring-1 focus:ring-[#B89251] focus:border-[#B89251] cursor-pointer w-[115px] text-center"
            />
            
            {/* Single-right chevron: Shift by 7 days */}
            <button 
              onClick={() => { const n = new Date(schedulerStartDate); n.setDate(n.getDate() + 7); setSchedulerStartDate(n) }}
              title="Next 7 days"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            {/* Double-right chevron: Shift by 30 days */}
            <button 
              onClick={() => { const n = new Date(schedulerStartDate); n.setDate(n.getDate() + 30); setSchedulerStartDate(n) }}
              title="Next 30 days"
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition-all cursor-pointer"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
            
            <div className="h-4 w-px bg-slate-200 mx-1" />
            
            {/* Today */}
            <button 
              onClick={() => setSchedulerStartDate(new Date())}
              className="text-xs font-semibold text-[#9A783E] px-2 py-0.5 hover:bg-white hover:shadow-sm rounded transition-all cursor-pointer"
            >
              Today
            </button>
          </div>

          <div>
            <button onClick={() => resetAndOpenManualForm(new Set(['room-1']), new Set())}
              className="flex items-center gap-1.5 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>New Booking</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified Timeline Grid */}
      <div className="block">
        <TimelineGrid
          rooms={rooms}
          venues={venues}
          daysList={daysList}
          bookingByRoomAndDate={bookingByRoomAndDate}
          getBookingStyle={getBookingStyle}
          activeTooltip={activeTooltip}
          setActiveTooltip={setActiveTooltip}
          timelineSelection={timelineSelection}
          setTimelineSelection={setTimelineSelection}
          handleCellClick={handleCellClick}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
        />
      </div>

      {/* ── Booking details / stay extension modal ── */}
      {selectedExtendBooking && (
        <ExtendStayModal
          booking={selectedExtendBooking}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          extendCheckoutDate={extendCheckoutDate}
          extendError={extendError}
          onClose={() => setSelectedExtendBooking(null)}
          onExtendStaySubmit={handleExtendStaySubmit}
          setExtendCheckoutDate={setExtendCheckoutDate}
        />
      )}

      {/* ── Walk-in booking form wizard ── */}
      {showManualForm && (
        <WalkInBookingForm
          key={`${Array.from(formRoomIds).join(',')}-${Array.from(formVenueIds).join(',')}-${formCheckIn}-${formCheckOut}`}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          createManualBooking={createManualBooking}
          cancelBooking={cancelBooking}
          initialRoomIds={formRoomIds}
          initialVenueIds={formVenueIds}
          initialCheckIn={formCheckIn}
          initialCheckOut={formCheckOut}
          onClose={() => setShowManualForm(false)}
        />
      )}
    </div>
  )
}

import React, { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardData } from './DashboardContext'
import { Booking, Room } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { WalkInBookingForm } from './WalkInBookingForm'
import {
  Calendar, Filter, Plus, ChevronLeft, ChevronRight
} from 'lucide-react'

// Import modular subcomponents
import { ExtendStayModal } from './calendar/ExtendStayModal'
import { MonthGridView } from './calendar/MonthGridView'
import { DayPreviewPanel } from './calendar/DayPreviewPanel'
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
  const { rooms, venues, bookings, createManualBooking } = useDashboardData()

  // ── Calendar state ──
  const [schedulerMode, setSchedulerMode] = useState<'month' | 'timeline'>('month')
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date())
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set())
  const [prevRooms, setPrevRooms] = useState<Room[]>([])
  const [showRoomFilter, setShowRoomFilter] = useState(false)
  const [selectedPreviewDate, setSelectedPreviewDate] = useState<Date | null>(null)

  // Adjust state when rooms are loaded/updated
  if (rooms !== prevRooms && rooms.length > 0) {
    setPrevRooms(rooms)
    if (selectedRoomIds.size === 0) {
      setSelectedRoomIds(new Set(rooms.map(r => r.id)))
    }
  }

  // ── Timeline state ──
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(new Date())
  const [daysCount] = useState<number>(30)
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [timelineSelection, setTimelineSelection] = useState<{ roomId: string; checkIn: Date } | null>(null)

  // ── Booking detail / extension modal ──
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState<string>('')
  const [extendError, setExtendError] = useState<string>('')

  // ── Walk‑in form wizard ──
  const [showManualForm, setShowManualForm] = useState(false)
  const [formPathway, setFormPathway] = useState<'room' | 'venue'>('room')
  const [formRoomIds, setFormRoomIds] = useState<Set<string>>(new Set(['room-1']))
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

  // Index bookings by Room_Date key (for Timeline Grid overlaps & cell mapping)
  const bookingByRoomAndDate = useMemo(() => {
    const map: Record<string, Booking> = {}
    bookings.forEach(b => {
      if (b.room_id) {
        const start = parseUTCDate(b.check_in)
        const current = new Date(start)
        const checkOut = parseUTCDate(b.check_out)
        if (current < checkOut) {
          while (current < checkOut) {
            const dateStr = current.toISOString().split('T')[0]
            map[`${b.room_id}_${dateStr}`] = b
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

  const resetAndOpenManualForm = useCallback((pathway: 'room' | 'venue', roomIds: Set<string>, checkIn = '', checkOut = '') => {
    setFormPathway(pathway); setFormRoomIds(roomIds)
    setFormCheckIn(checkIn); setFormCheckOut(checkOut)
    setShowManualForm(true)
  }, [])

  const handleCellClick = useCallback((roomId: string, date: Date) => {
    // If clicking the exact same check-in date again, cancel the selection
    if (timelineSelection && timelineSelection.roomId === roomId && date.toDateString() === timelineSelection.checkIn.toDateString()) {
      setTimelineSelection(null)
      return
    }

    if (!timelineSelection || timelineSelection.roomId !== roomId || date < timelineSelection.checkIn) {
      // Start a new selection (Click 1, or room changed, or clicked earlier date)
      setTimelineSelection({ roomId, checkIn: date })
    } else {
      // Complete the selection (Click 2)
      const checkInStr = timelineSelection.checkIn.toISOString().split('T')[0]
      const checkOutStr = date.toISOString().split('T')[0]
      
      // Verify availability for the entire range
      if (!syncEngine.isRoomAvailable(roomId, checkInStr, checkOutStr, bookings)) {
        const roomNum = rooms.find(r => r.id === roomId)?.room_number || roomId
        alert(`Overlap collision! Room ${roomNum} is already booked on some dates in this range.`)
        setTimelineSelection(null)
        return
      }

      resetAndOpenManualForm('room', new Set([roomId]), checkInStr, checkOutStr)
      setTimelineSelection(null)
    }
  }, [timelineSelection, bookings, rooms, resetAndOpenManualForm])

  const handleExtendStaySubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setExtendError('')
    if (!selectedExtendBooking || !extendCheckoutDate) return
    try {
      if (!syncEngine.isRoomAvailable(selectedExtendBooking.room_id!, selectedExtendBooking.check_in, extendCheckoutDate, bookings, selectedExtendBooking.id)) {
        setExtendError('Overlap collision — room already reserved.'); return
      }
      const pricing = syncEngine.calculatePricing({
        roomId: selectedExtendBooking.room_id, checkIn: selectedExtendBooking.check_in,
        checkOut: extendCheckoutDate, guestEmail: selectedExtendBooking.guest_email,
        breakfastOrders: selectedExtendBooking.breakfast_orders, bookingsList: bookings
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

  return (
    <div className="space-y-4 font-sans">
      {/* Upper header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200">
        <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg self-start">
          <button onClick={() => setSchedulerMode('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${schedulerMode === 'month' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <Calendar className="w-3.5 h-3.5 text-[#B89251]" />
            <span>Month View</span>
          </button>
          <button onClick={() => setSchedulerMode('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${schedulerMode === 'timeline' ? 'bg-white text-slate-800 shadow-sm border border-slate-200/50' : 'text-slate-500 hover:text-slate-700'}`}>
            <Filter className="w-3.5 h-3.5 text-[#B89251]" />
            <span>Timeline</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {schedulerMode === 'timeline' && (
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200/60">
              <button onClick={() => { const p = new Date(schedulerStartDate); p.setDate(p.getDate() - 7); setSchedulerStartDate(p) }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono font-bold text-slate-700 px-1">
                {schedulerStartDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <button onClick={() => { const n = new Date(schedulerStartDate); n.setDate(n.getDate() + 7); setSchedulerStartDate(n) }}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded transition-colors cursor-pointer">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setSchedulerStartDate(new Date())}
                className="text-xs font-semibold text-[#9A783E] px-2 py-1 hover:bg-white rounded transition-all cursor-pointer">
                Today
              </button>
            </div>
          )}
          {schedulerMode === 'month' && (
            <button onClick={() => setShowRoomFilter(!showRoomFilter)}
              className={`flex items-center gap-1.5 text-xs font-semibold border px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${showRoomFilter ? 'bg-slate-50 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <Filter className="w-3.5 h-3.5" />
              <span>Rooms</span>
            </button>
          )}
          <button onClick={() => resetAndOpenManualForm('room', new Set(['room-1']))}
            className="flex items-center gap-1.5 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Booking</span>
          </button>
        </div>
      </div>

      {/* Room filter panel (collapsible) */}
      {schedulerMode === 'month' && showRoomFilter && (
        <div className="bg-white border border-slate-200 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">Filter by room</span>
            <div className="flex gap-3 text-xs">
              <button onClick={() => setSelectedRoomIds(new Set(rooms.map(r => r.id)))} className="text-[#9A783E] font-medium hover:underline cursor-pointer">All</button>
              <button onClick={() => setSelectedRoomIds(new Set())} className="text-slate-400 font-medium hover:underline cursor-pointer">None</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rooms.map(room => {
              const on = selectedRoomIds.has(room.id)
              const c = ROOM_COLORS[room.id] || ROOM_COLORS['room-10']
              return (
                <label key={room.id}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer select-none transition-all ${on ? `${c.bg} ${c.border} ${c.text} font-medium` : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                  <input type="checkbox" checked={on} className="accent-[#B89251] w-3.5 h-3.5"
                    onChange={() => {
                      const n = new Set(selectedRoomIds)
                      if (n.has(room.id)) {
                        n.delete(room.id)
                      } else {
                        n.add(room.id)
                      }
                      setSelectedRoomIds(n)
                    }} />
                  Room {room.room_number}
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── MONTH CALENDAR & TIMELINE VIEWS (PERSISTED TO PREVENT MOUNT DELAY) ─── */}
      <div className={schedulerMode === 'month' ? 'block' : 'hidden'}>
        <MonthGridView
          rooms={rooms}
          currentMonthDate={currentMonthDate}
          selectedRoomIds={selectedRoomIds}
          bookings={bookings}
          ROOM_COLORS={ROOM_COLORS}
          VENUE_COLORS={VENUE_COLORS}
          setCurrentMonthDate={setCurrentMonthDate}
          setSelectedPreviewDate={setSelectedPreviewDate}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
          resetAndOpenManualForm={resetAndOpenManualForm}
        />
      </div>

      <div className={schedulerMode === 'timeline' ? 'block' : 'hidden'}>
        <TimelineGrid
          rooms={rooms}
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

      {/* ── Day‑level drill‑down preview panel ── */}
      {selectedPreviewDate && (
        <DayPreviewPanel
          selectedPreviewDate={selectedPreviewDate}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          bookingByRoomAndDate={bookingByRoomAndDate}
          ROOM_COLORS={ROOM_COLORS}
          setSelectedPreviewDate={setSelectedPreviewDate}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
          resetAndOpenManualForm={resetAndOpenManualForm}
        />
      )}

      {/* ── Booking details / stay extension modal ── */}
      {selectedExtendBooking && (
        <ExtendStayModal
          booking={selectedExtendBooking}
          rooms={rooms}
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
          key={`${formPathway}-${Array.from(formRoomIds).join(',')}-${formCheckIn}-${formCheckOut}`}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          createManualBooking={createManualBooking}
          initialPathway={formPathway}
          initialRoomIds={formRoomIds}
          initialCheckIn={formCheckIn}
          initialCheckOut={formCheckOut}
          onClose={() => setShowManualForm(false)}
        />
      )}
    </div>
  )
}

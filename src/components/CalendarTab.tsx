import React, { useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardData } from './DashboardContext'
import { Booking, Room } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { WalkInBookingForm } from './WalkInBookingForm'
import {
  Calendar, Filter, Plus, ChevronLeft, ChevronRight, Users, AlertCircle, X
} from 'lucide-react'

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

  // Helper to parse date strings as UTC Date objects to prevent timezone shifting
  const parseUTCDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d))
  }

  // Create a memoized bookings lookup map by date for month view
  const bookingsByDate = useMemo(() => {
    const map: Record<string, Booking[]> = {}
    bookings.forEach(b => {
      if (b.room_id) {
        const current = parseUTCDate(b.check_in)
        const checkOut = parseUTCDate(b.check_out)
        if (current < checkOut) {
          while (current < checkOut) {
            const dateStr = current.toISOString().split('T')[0]
            if (!map[dateStr]) map[dateStr] = []
            map[dateStr].push(b)
            current.setUTCDate(current.getUTCDate() + 1)
          }
        }
      } else if (b.venue_id) {
        const dateStr = b.check_in
        if (!map[dateStr]) map[dateStr] = []
        map[dateStr].push(b)
      }
    })
    return map
  }, [bookings])

  // Create a memoized bookings lookup map by room and date for timeline view
  const bookingByRoomAndDate = useMemo(() => {
    const map: Record<string, Booking> = {}
    bookings.forEach(b => {
      if (b.room_id) {
        const current = parseUTCDate(b.check_in)
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

  // Build timeline day list
  const daysList = useMemo(() => {
    const list: Date[] = []
    for (let i = 0; i < daysCount; i++) {
      const d = new Date(schedulerStartDate)
      d.setDate(schedulerStartDate.getDate() + i)
      list.push(d)
    }
    return list
  }, [schedulerStartDate, daysCount])

  const formatDateHeader = (date: Date) => ({
    day: date.getDate(),
    weekday: date.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1),
  })

  const getMonthGridDates = (base: Date) => {
    const y = base.getFullYear(), m = base.getMonth()
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
    const grid: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) grid.push(null)
    for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(y, m, d))
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }

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

  const resetAndOpenManualForm = (pathway: 'room' | 'venue', roomIds: Set<string>, checkIn = '', checkOut = '') => {
    setFormPathway(pathway); setFormRoomIds(roomIds)
    setFormCheckIn(checkIn); setFormCheckOut(checkOut)
    setShowManualForm(true)
  }

  const handleCellClick = (roomId: string, date: Date) => {
    const d = date.toISOString().split('T')[0]
    const next = new Date(date); next.setDate(date.getDate() + 1)
    resetAndOpenManualForm('room', new Set([roomId]), d, next.toISOString().split('T')[0])
  }

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
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      setSelectedExtendBooking(null)
      alert('Stay extended successfully!')
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Overlap collision.'
      setExtendError(errMsg)
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex bg-slate-100 rounded-lg p-0.5 text-xs font-medium">
            <button onClick={() => setSchedulerMode('month')}
              className={`px-3 py-1.5 rounded-md transition-all ${schedulerMode === 'month' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Month
            </button>
            <button onClick={() => setSchedulerMode('timeline')}
              className={`px-3 py-1.5 rounded-md transition-all ${schedulerMode === 'timeline' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Timeline
            </button>
          </div>

          {/* Timeline date controls */}
          {schedulerMode === 'timeline' && (
            <div className="flex items-center gap-2">
              <input type="date" value={schedulerStartDate.toISOString().split('T')[0]}
                onChange={e => setSchedulerStartDate(new Date(e.target.value))}
                className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-[#B89251]" />
              <button onClick={() => setSchedulerStartDate(new Date())}
                className="text-xs font-medium text-[#9A783E] border border-[#E5D5C0] bg-[#FDFBF7] hover:bg-[#B89251] hover:text-white px-2.5 py-1.5 rounded-lg transition-all">
                Today
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {schedulerMode === 'month' && (
            <button onClick={() => setShowRoomFilter(!showRoomFilter)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all ${showRoomFilter ? 'bg-[#FDFBF7] border-[#E5D5C0] text-[#9A783E]' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rooms</span>
              <span className="text-[10px] opacity-60">{selectedRoomIds.size}/{rooms.length}</span>
            </button>
          )}
          <button onClick={() => resetAndOpenManualForm('room', new Set(['room-1']))}
            className="flex items-center gap-1.5 bg-[#B89251] hover:bg-[#9A783E] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
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
              <button onClick={() => setSelectedRoomIds(new Set(rooms.map(r => r.id)))} className="text-[#9A783E] font-medium hover:underline">All</button>
              <button onClick={() => setSelectedRoomIds(new Set())} className="text-slate-400 font-medium hover:underline">None</button>
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

      {/* ─── MONTH CALENDAR VIEW ─── */}
      {schedulerMode === 'month' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Month header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-800">
              {currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
            <div className="flex items-center gap-1">
              <button onClick={() => { const p = new Date(currentMonthDate); p.setMonth(p.getMonth() - 1); setCurrentMonthDate(p) }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => { const n = new Date(currentMonthDate); n.setMonth(n.getMonth() + 1); setCurrentMonthDate(n) }}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentMonthDate(new Date())}
                className="text-xs font-medium text-[#9A783E] px-2 py-1 hover:bg-[#FDFBF7] rounded-lg transition-colors ml-1">
                Today
              </button>
            </div>
          </div>

          {/* Week‑day header */}
          <div className="grid grid-cols-7 text-center border-b border-slate-100 text-[10px] uppercase tracking-wider font-semibold text-slate-400 py-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {getMonthGridDates(currentMonthDate).map((date, idx) => {
              if (!date) return <div key={idx} className="min-h-[80px] sm:min-h-[100px] bg-slate-50/40 border-b border-r border-slate-100" />

              const fmtDate = date.toISOString().split('T')[0]
              const isToday = date.toDateString() === new Date().toDateString()
              const dayBookings = (bookingsByDate[fmtDate] || []).filter(b => {
                if (b.room_id && !selectedRoomIds.has(b.room_id)) return false
                return true
              })

              return (
                <div key={idx} onClick={() => setSelectedPreviewDate(date)}
                  className={`group min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-slate-100 flex flex-col cursor-pointer transition-colors ${isToday ? 'bg-[#FDFBF7]' : 'hover:bg-slate-50'}`}>
                  {/* Day number + quick add */}
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium ${isToday ? 'bg-[#B89251] text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold' : 'text-slate-500'}`}>
                      {date.getDate()}
                    </span>
                    <button type="button"
                      onClick={e => { e.stopPropagation(); const t = new Date(date); t.setDate(t.getDate() + 1); resetAndOpenManualForm('room', new Set([rooms[0]?.id || 'room-1']), fmtDate, t.toISOString().split('T')[0]) }}
                      className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[10px] text-slate-400 hover:bg-[#B89251] hover:text-white rounded transition-all cursor-pointer">
                      +
                    </button>
                  </div>
                  {/* Booking chips */}
                  <div className="space-y-0.5 overflow-hidden flex-1">
                    {dayBookings.slice(0, 3).map(b => {
                      const room = rooms.find(r => r.id === b.room_id)
                      const c = b.room_id ? (ROOM_COLORS[b.room_id] || ROOM_COLORS['room-10']) : VENUE_COLORS
                      return (
                        <div key={b.id}
                          onClick={e => { e.stopPropagation(); if (b.status !== 'blocked') { setSelectedExtendBooking(b); setExtendCheckoutDate(b.check_out); setExtendError('') } }}
                          className={`text-[8px] sm:text-[9px] font-semibold px-1 py-0.5 rounded border truncate cursor-pointer ${c.bg} ${c.text} ${c.border}`}
                          title={`${room ? `Room ${room.room_number}` : 'Venue'} – ${b.guest_name}`}>
                          {room ? `R${room.room_number}` : 'VN'} · {b.guest_name.split(' ')[0]}
                        </div>
                      )
                    })}
                    {dayBookings.length > 3 && (
                      <div className="text-[8px] text-slate-400 font-medium text-center">+{dayBookings.length - 3} more</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ─── TIMELINE GRID VIEW ─── */}
      {schedulerMode === 'timeline' && (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 p-3 text-left text-xs text-slate-500 font-medium min-w-[160px]">
                    Room
                  </th>
                  {daysList.map((day, i) => {
                    const { day: num, weekday } = formatDateHeader(day)
                    const isToday = day.toDateString() === new Date().toDateString()
                    return (
                      <th key={i} className={`border-b border-slate-200 p-1.5 text-center text-[10px] min-w-[38px] font-mono ${isToday ? 'bg-[#FDFBF7] text-[#9A783E] font-semibold' : 'text-slate-400'}`}>
                        <div>{weekday}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${isToday ? 'border-b border-[#B89251] pb-0.5' : ''}`}>{num}</div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                    <td className="sticky left-0 z-20 bg-white border-r border-slate-200 p-3 min-w-[160px]">
                      <span className="text-xs font-semibold text-slate-800 block">Room {room.room_number}</span>
                      <span className="text-[10px] text-[#B89251]">₱{room.base_price.toLocaleString()}/night</span>
                    </td>
                    {daysList.map((day, dIdx) => {
                      const fmtStr = day.toISOString().split('T')[0]
                      const booking = bookingByRoomAndDate[`${room.id}_${fmtStr}`]
                      if (booking) {
                        const isStart = fmtStr === booking.check_in
                        const tipId = `${room.id}-${dIdx}`
                        return (
                          <td key={dIdx} className="p-0 border-r border-slate-100 relative"
                            onMouseEnter={() => setActiveTooltip(tipId)} onMouseLeave={() => setActiveTooltip(null)}>
                            <div className={`h-7 mx-0.5 flex items-center justify-center text-[9px] font-semibold rounded-sm border cursor-pointer select-none ${getBookingStyle(booking)}`}>
                              {isStart ? <span className="px-0.5 truncate">{booking.guest_name.split(' ')[0]}</span> : <span className="opacity-0">.</span>}
                            </div>
                            {activeTooltip === tipId && (
                              <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-52 bg-white border border-slate-200 p-3 shadow-lg rounded-lg text-xs space-y-1.5 pointer-events-none">
                                <div className="font-semibold text-slate-800">{booking.guest_name}</div>
                                <div className="text-[10px] text-slate-400 font-mono">{booking.check_in} → {booking.check_out}</div>
                                <div className="text-[10px] text-slate-500">
                                  {booking.guest_phone}<br />
                                  <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-medium' : 'text-amber-600'}>{booking.status}</span>
                                  {' · '}{booking.source}
                                </div>
                              </div>
                            )}
                          </td>
                        )
                      }
                      return (
                        <td key={dIdx} onClick={() => handleCellClick(room.id, day)}
                          className="border-r border-slate-100 p-0 h-8 hover:bg-[#FDFBF7]/60 cursor-cell transition-colors" />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Day‑level drill‑down preview panel ── */}
      {selectedPreviewDate && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-[#B89251]" />
              <span>
                {selectedPreviewDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </span>
            </h4>
            <button onClick={() => setSelectedPreviewDate(null)} className="text-slate-400 hover:text-slate-600 text-xs font-semibold">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {rooms.map(room => {
              const fd = selectedPreviewDate.toISOString().split('T')[0]
              const reserve = bookingByRoomAndDate[`${room.id}_${fd}`]
              const c = ROOM_COLORS[room.id] || ROOM_COLORS['room-10']
              return (
                <div key={room.id} className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-700 block">Room {room.room_number}</span>
                    <span className="text-[10px] text-slate-400">{room.name}</span>
                  </div>
                  {reserve ? (
                    <div onClick={() => { if (reserve.status !== 'blocked') { setSelectedExtendBooking(reserve); setExtendCheckoutDate(reserve.check_out); setExtendError('') } }}
                      className={`px-2.5 py-1 rounded border text-[10px] font-semibold cursor-pointer max-w-[140px] truncate ${c.bg} ${c.text} ${c.border}`}>
                      {reserve.status === 'blocked' ? 'Blocked' : reserve.guest_name}
                    </div>
                  ) : (
                    <button type="button"
                      onClick={() => { const t = new Date(selectedPreviewDate); t.setDate(t.getDate() + 1); resetAndOpenManualForm('room', new Set([room.id]), fd, t.toISOString().split('T')[0]) }}
                      className="text-[10px] text-[#9A783E] hover:text-[#B89251] font-semibold border border-[#E5D5C0] hover:bg-[#FDFBF7] px-2.5 py-1 rounded transition-colors cursor-pointer">
                      Available · Book
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {(() => {
            const fd = selectedPreviewDate.toISOString().split('T')[0]
            const venueBookings = bookings.filter(b => b.venue_id && b.check_in === fd)
            if (venueBookings.length === 0) return null
            return (
              <div className="pt-3 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-2">Venue Reservations</span>
                <div className="space-y-2">
                  {venueBookings.map(b => (
                    <div key={b.id} className="p-3 bg-fuchsia-50/40 rounded-lg border border-fuchsia-100 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{venues.find(v => v.id === b.venue_id)?.name}</span>
                        <span className="text-[10px] text-slate-400">Events Venue</span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-fuchsia-800 block">{b.guest_name}</span>
                        <span className="text-[9px] text-slate-400">{b.source} · {b.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* ── Booking details / stay extension modal ── */}
      {selectedExtendBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Reservation Details</h3>
              <button onClick={() => setSelectedExtendBooking(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1 text-xs">
                <h3 className="text-sm font-semibold text-slate-800">{selectedExtendBooking.guest_name}</h3>
                <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500">
                  <div><span className="text-slate-400 block">Unit:</span> <span className="font-medium text-slate-800">{rooms.find(r => r.id === selectedExtendBooking.room_id)?.name || 'Event Venue'}</span></div>
                  <div><span className="text-slate-400 block">Source:</span> <span className="font-medium text-slate-800 uppercase">{selectedExtendBooking.source}</span></div>
                  <div><span className="text-slate-400 block">Phone:</span> <span className="font-medium text-slate-800 font-mono">{selectedExtendBooking.guest_phone}</span></div>
                  <div><span className="text-slate-400 block">Email:</span> <span className="font-medium text-slate-800 truncate block" title={selectedExtendBooking.guest_email}>{selectedExtendBooking.guest_email}</span></div>
                </div>
              </div>

              {/* Companions Registry Display */}
              {selectedExtendBooking.companions && selectedExtendBooking.companions.length > 0 && (
                <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-lg space-y-2">
                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[#B89251]" /> Companions ({selectedExtendBooking.companions.length + 1} total guests)
                  </div>
                  <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                    {selectedExtendBooking.companions.map((comp, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[10px] bg-white border border-slate-100 px-2.5 py-1 rounded">
                        <span className="font-medium text-slate-700">{comp.name}</span>
                        <span className="text-slate-400 capitalize">{comp.gender}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleExtendStaySubmit} className="space-y-3.5 border-t border-slate-100 pt-3">
                {extendError && (
                  <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-lg">
                    <AlertCircle className="w-4 h-4" /><span>{extendError}</span>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-medium block mb-1">Check-in</label>
                    <input type="date" readOnly value={selectedExtendBooking.check_in}
                      className="w-full bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded text-xs font-mono outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#B89251] font-semibold block mb-1">Check-out (Extend)</label>
                    <input type="date" required min={selectedExtendBooking.check_in} value={extendCheckoutDate}
                      onChange={e => setExtendCheckoutDate(e.target.value)}
                      className="w-full bg-slate-50 border border-[#B89251] text-slate-800 px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:bg-white" />
                  </div>
                </div>

                {extendCheckoutDate && extendCheckoutDate !== selectedExtendBooking.check_out && (
                  <div className="p-3 bg-[#FDFBF7] border border-[#E5D5C0] rounded-lg text-xs space-y-1 text-slate-600 font-medium">
                    <div className="flex justify-between">
                      <span>Extended Nights:</span>
                      <span className="font-mono">{Math.max(0, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(selectedExtendBooking.check_out).getTime()) / 86400000))}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200/40 pt-1">
                      <span>New Total Balance Due:</span>
                      <span className="font-mono text-[#9A783E]">₱{(() => { try { return syncEngine.calculatePricing({ roomId: selectedExtendBooking.room_id, checkIn: selectedExtendBooking.check_in, checkOut: extendCheckoutDate, guestEmail: selectedExtendBooking.guest_email, breakfastOrders: selectedExtendBooking.breakfast_orders, bookingsList: bookings }).balanceDue.toLocaleString() } catch { return '0' } })()}</span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setSelectedExtendBooking(null)}
                    className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium py-2.5 rounded-lg border border-slate-200 transition-colors">
                    Cancel
                  </button>
                  <button type="submit" disabled={extendCheckoutDate === selectedExtendBooking.check_out}
                    className="flex-1 bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-medium py-2.5 rounded-lg transition-colors">
                    Save Extension
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
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

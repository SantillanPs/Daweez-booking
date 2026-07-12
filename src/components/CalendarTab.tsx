import React, { useState, useMemo, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useDashboardData } from './DashboardContext'
import { Booking, Room } from '../types/booking'
import * as syncEngine from '../utils/syncEngine'
import { WalkInBookingForm } from './WalkInBookingForm'
import {
  Calendar, Filter, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X
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
  'room-10': { bg: 'bg-softbg',  text: 'text-main',   border: 'border-soft' },
}
const VENUE_COLORS = { bg: 'bg-fuchsia-50', text: 'text-fuchsia-800', border: 'border-fuchsia-200' }



const getBookingStyle = (b: Booking) => {
  if (b.status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
  if (b.status === 'blocked') return 'bg-softbg text-muted border-soft line-through'
  switch (b.source) {
    case 'airbnb':      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'booking_com': return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'facebook':    return 'bg-indigo-50 text-indigo-700 border-indigo-200'
    case 'google_maps': return 'bg-orange-50 text-orange-700 border-orange-200'
    case 'website':     return 'bg-violet-50 text-violet-700 border-violet-200'
    default:            return 'bg-page text-main border-soft'
  }
}

export function CalendarTab() {
  const queryClient = useQueryClient()
  const { rooms, venues, bookings, createManualBooking, cancelBooking, confirmBooking, isConfirming, updateBooking } = useDashboardData()

  // ── Timeline state ──
  const [schedulerStartDate, setSchedulerStartDate] = useState<Date>(() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d
  })
  
  const daysCount = useMemo(() => {
    return new Date(schedulerStartDate.getFullYear(), schedulerStartDate.getMonth() + 1, 0).getDate()
  }, [schedulerStartDate])

  const [activeTooltip, setActiveTooltip] = useState<string | null>(null)
  const [timelineSelection, setTimelineSelection] = useState<{ roomId?: string; venueId?: string; checkIn: Date } | null>(null)

  // ── Booking detail / extension modal ──
  const [selectedExtendBooking, setSelectedExtendBooking] = useState<Booking | null>(null)
  const [extendCheckoutDate, setExtendCheckoutDate] = useState<string>('')
  const [extendError, setExtendError] = useState<string>('')
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null)

  // ── Walk‑in form wizard ──
  const [showManualForm, setShowManualForm] = useState(false)
  const [formSelections, setFormSelections] = useState<Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>>({})
  const [groupSelection, setGroupSelection] = useState<Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }> | null>(null)

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

  const resetAndOpenManualForm = useCallback((initialSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>) => {
    setFormSelections(initialSelections)
    setShowManualForm(true)
  }, [])

  const handleCellClick = useCallback((id: string, type: 'room' | 'venue', date: Date) => {
    // If this unit is already selected in groupSelection, toggle it off
    if (groupSelection && groupSelection[id]) {
      setGroupSelection(prev => {
        if (!prev) return null
        const next = { ...prev }
        delete next[id]
        return Object.keys(next).length === 0 ? null : next
      })
      return
    }

    const selIdKey = type === 'room' ? 'roomId' : 'venueId'
    
    // If clicking the exact same check-in date again, cancel the selection draft
    if (timelineSelection && timelineSelection[selIdKey] === id && date.toDateString() === timelineSelection.checkIn.toDateString()) {
      setTimelineSelection(null)
      return
    }

    if (!timelineSelection || (timelineSelection.roomId !== id && timelineSelection.venueId !== id)) {
      // Start a new selection (Click 1) or switch to a new unit
      setTimelineSelection({ [selIdKey]: id, checkIn: date })
    } else {
      // Complete the selection (Click 2)
      if (date <= timelineSelection.checkIn) {
        // Invalid check-out date, start a new Click 1 selection at this date
        setTimelineSelection({ [selIdKey]: id, checkIn: date })
        return
      }

      const checkInStr = timelineSelection.checkIn.toISOString().split('T')[0]
      const checkOutStr = date.toISOString().split('T')[0]
      
      let isAvailable = true
      if (type === 'room') {
        isAvailable = syncEngine.isRoomAvailable(id, checkInStr, checkOutStr, bookings)
      } else {
        isAvailable = syncEngine.isVenueRangeAvailable(id, checkInStr, checkOutStr, bookings)
      }

      if (!isAvailable) {
        const unitName = type === 'room' ? (rooms.find(r => r.id === id)?.room_number || id) : (venues.find(v => v.id === id)?.name || id)
        alert(`Overlap collision! ${type === 'room' ? 'Room' : 'Venue'} [${unitName}] is already booked on some dates in this range.`)
        setTimelineSelection(null)
        return
      }

      setGroupSelection(prev => ({
        ...(prev || {}),
        [id]: { checkIn: timelineSelection.checkIn, checkOut: date, type }
      }))
      setTimelineSelection(null)
    }
  }, [timelineSelection, groupSelection, bookings, rooms, venues])

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
        bookingsList: bookings,
        rooms,
        venues
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
    return schedulerStartDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  }, [schedulerStartDate])

  const getYYYYMM = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}`
  }
  const datePickerValue = getYYYYMM(schedulerStartDate)

  const getYYYYMMDD = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  return (
    <div className="space-y-4 font-sans flex-1 min-h-0 flex flex-col overflow-hidden">
      {/* Upper header controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 md:p-3.5 rounded-lg border border-soft flex-shrink-0">
        {/* Left Side: Title */}
        <div>
          <h2 className="text-lg font-bold text-main tracking-tight flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-primary" />
            <span>{spannedMonthHeader}</span>
          </h2>
        </div>

        {/* Right Side: Controls and Actions */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Compact Navigation controls */}
          <div className="flex items-center gap-1 bg-page p-1 rounded-lg border border-soft/60">
            {/* Single-left chevron: Shift by 1 month */}
            <button 
              onClick={() => { const p = new Date(schedulerStartDate); p.setMonth(p.getMonth() - 1); setSchedulerStartDate(p) }}
              title="Previous Month"
              className="p-1 text-muted hover:text-main hover:bg-softbg rounded transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* Native Month Picker */}
            <input 
              type="month"
              value={datePickerValue}
              onChange={(e) => {
                if (e.target.value) {
                  const [y, m] = e.target.value.split('-').map(Number)
                  setSchedulerStartDate(new Date(y, m - 1, 1))
                }
              }}
              className="bg-card border border-soft text-main text-xs px-1.5 py-0.5 rounded outline-none font-mono focus:ring-1 focus:ring-[#B89251] focus:border-brand-primary cursor-pointer w-[115px] text-center"
            />
            
            {/* Single-right chevron: Shift by 1 month */}
            <button 
              onClick={() => { const n = new Date(schedulerStartDate); n.setMonth(n.getMonth() + 1); setSchedulerStartDate(n) }}
              title="Next Month"
              className="p-1 text-muted hover:text-main hover:bg-softbg rounded transition-all cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            
            <div className="h-4 w-px bg-soft mx-1" />
            
            {/* Today */}
            <button 
              onClick={() => {
                const d = new Date()
                d.setDate(1)
                d.setHours(0, 0, 0, 0)
                setSchedulerStartDate(d)
              }}
              className="text-xs font-semibold text-brand-text px-2 py-0.5 hover:bg-card hover:shadow-sm rounded transition-all cursor-pointer"
            >
              This Month
            </button>
          </div>

          <div>
            <button onClick={() => {
              const todayStr = getYYYYMMDD(new Date())
              const tomorrowStr = getYYYYMMDD(new Date(Date.now() + 86400000))
              resetAndOpenManualForm({ 'room-1': { checkIn: todayStr, checkOut: tomorrowStr, type: 'room' } })
            }}
              className="flex items-center gap-1.5 bg-brand-primary hover:bg-brand-text text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors cursor-pointer shadow-sm">
              <Plus className="w-3.5 h-3.5" />
              <span>New Booking</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unified Timeline Grid */}
      <div className="flex-grow min-h-0 flex flex-col overflow-hidden">
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
          groupSelection={groupSelection}
          handleCellClick={handleCellClick}
          setSelectedExtendBooking={setSelectedExtendBooking}
          setExtendCheckoutDate={setExtendCheckoutDate}
          setExtendError={setExtendError}
        />
      </div>

      {/* Bottom Floating Bar for Group Selection */}
      {groupSelection && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-brand-bg border border-brand-border p-3 md:p-4 rounded-xl shadow-xl flex flex-col md:flex-row items-center gap-3 md:gap-4 max-w-[90vw] md:max-w-4xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-brand-primary"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-primary"></span>
            </span>
            <span className="text-xs font-bold text-main">
              Selected ({Object.keys(groupSelection).length}):
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
            {Object.entries(groupSelection).map(([id, sel]) => {
              const name = sel.type === 'room'
                ? `Room ${rooms.find(r => r.id === id)?.room_number || id}`
                : (venues.find(v => v.id === id)?.name || id)
              const dateRangeStr = `${sel.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${sel.checkOut.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
              return (
                <div key={id} className="flex items-center gap-1.5 bg-card border border-brand-border px-2 py-0.5 rounded text-[11px] text-main font-medium shadow-sm">
                  <span>{name}</span>
                  <span className="text-brand-text text-[10px] font-mono">({dateRangeStr})</span>
                  <button
                    onClick={() => {
                      setGroupSelection(prev => {
                        if (!prev) return null
                        const next = { ...prev }
                        delete next[id]
                        return Object.keys(next).length === 0 ? null : next
                      })
                    }}
                    className="text-muted hover:text-red-500 hover:bg-red-50 p-0.5 rounded cursor-pointer transition-colors"
                    title="Remove"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>

          <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end border-t md:border-t-0 pt-2 md:pt-0 border-soft">
            <button
              onClick={() => {
                setGroupSelection(null)
                setTimelineSelection(null)
              }}
              className="text-xs font-semibold text-muted hover:text-main transition-colors px-3 py-1.5 hover:bg-page rounded cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                const serialized: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }> = {}
                Object.entries(groupSelection).forEach(([id, sel]) => {
                  serialized[id] = {
                    checkIn: sel.checkIn.toISOString().split('T')[0],
                    checkOut: sel.checkOut.toISOString().split('T')[0],
                    type: sel.type
                  }
                })
                resetAndOpenManualForm(serialized)
                setGroupSelection(null)
              }}
              className="text-xs font-bold text-white bg-brand-primary hover:bg-brand-text px-4 py-1.5 rounded-lg shadow-sm transition-colors cursor-pointer"
            >
              Confirm Booking
            </button>
          </div>
        </div>
      )}

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
          onConfirmReservation={async (id) => {
            try {
              await confirmBooking(id)
              setSelectedExtendBooking(null)
            } catch (err) {
              setExtendError('Failed to confirm reservation.')
            }
          }}
          onCancelBooking={cancelBooking}
          isConfirming={isConfirming}
          onEditBooking={() => {
            setEditingBooking(selectedExtendBooking)
            setSelectedExtendBooking(null)
          }}
        />
      )}

      {editingBooking && (
        <WalkInBookingForm
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          createManualBooking={createManualBooking}
          cancelBooking={cancelBooking}
          updateBooking={updateBooking}
          initialSelections={{
            [editingBooking.room_id || editingBooking.venue_id || '']: {
              checkIn: editingBooking.check_in,
              checkOut: editingBooking.check_out,
              type: editingBooking.room_id ? 'room' : 'venue'
            }
          }}
          editingBookings={
            editingBooking.invoice_number 
              ? bookings.filter(b => b.invoice_number === editingBooking.invoice_number)
              : [editingBooking]
          }
          onClose={() => setEditingBooking(null)}
        />
      )}

      {/* ── Walk-in booking form wizard ── */}
      {showManualForm && (
        <WalkInBookingForm
          key={Object.keys(formSelections).join(',')}
          rooms={rooms}
          venues={venues}
          bookings={bookings}
          createManualBooking={createManualBooking}
          cancelBooking={cancelBooking}
          initialSelections={formSelections}
          onClose={() => setShowManualForm(false)}
        />
      )}
    </div>
  )
}

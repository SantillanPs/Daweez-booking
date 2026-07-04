import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Booking, Room } from '../../types/booking'
import { useDashboardData } from '../DashboardContext'

interface MonthGridViewProps {
  rooms: Room[]
  currentMonthDate: Date
  selectedRoomIds: Set<string>
  bookingsByDate: Record<string, Booking[]>
  ROOM_COLORS: Record<string, { bg: string; text: string; border: string }>
  VENUE_COLORS: { bg: string; text: string; border: string }
  setCurrentMonthDate: (date: Date) => void
  setSelectedPreviewDate: (date: Date | null) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  resetAndOpenManualForm: (pathway: 'room' | 'venue', roomIds: Set<string>, checkIn?: string, checkOut?: string) => void
}

const getPreviousDay = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() - 1)
  return date.toISOString().split('T')[0]
}

const getDayStr = (d: Date | null) => {
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dateNum = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dateNum}`
}

const getBookingStyle = (b: Booking, baseStyle: { bg: string; text: string; border: string }) => {
  if (b.status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
  if (b.status === 'blocked') return 'bg-slate-100 text-slate-400 border-slate-200 line-through'
  switch (b.source) {
    case 'airbnb':      return 'bg-emerald-50 text-emerald-700 border-emerald-250'
    case 'booking_com': return 'bg-blue-50 text-blue-700 border-blue-250'
    case 'facebook':    return 'bg-indigo-50 text-indigo-700 border-indigo-250'
    case 'google_maps': return 'bg-orange-50 text-orange-700 border-orange-250'
    case 'website':     return 'bg-violet-50 text-violet-700 border-violet-250'
    default:            return `${baseStyle.bg} ${baseStyle.text} ${baseStyle.border}`
  }
}

export function MonthGridView({
  rooms,
  currentMonthDate,
  selectedRoomIds,
  ROOM_COLORS,
  VENUE_COLORS,
  setCurrentMonthDate,
  setSelectedPreviewDate,
  setSelectedExtendBooking,
  setExtendCheckoutDate,
  setExtendError,
  resetAndOpenManualForm
}: MonthGridViewProps) {
  
  const { bookings } = useDashboardData()

  // Memoize Month Grid Calendar calculations
  const gridDates = useMemo(() => {
    const y = currentMonthDate.getFullYear(), m = currentMonthDate.getMonth()
    const first = new Date(y, m, 1), last = new Date(y, m + 1, 0)
    const grid: (Date | null)[] = []
    for (let i = 0; i < first.getDay(); i++) grid.push(null)
    for (let d = 1; d <= last.getDate(); d++) grid.push(new Date(y, m, d))
    while (grid.length % 7 !== 0) grid.push(null)
    return grid
  }, [currentMonthDate])

  const weeks = useMemo(() => {
    const w: (Date | null)[][] = []
    for (let i = 0; i < gridDates.length; i += 7) {
      w.push(gridDates.slice(i, i + 7))
    }
    return w
  }, [gridDates])

  const todayStr = useMemo(() => new Date().toDateString(), [])

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden font-sans">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-bold text-slate-800">
          {currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex items-center gap-1">
          <button 
            type="button"
            onClick={() => { const p = new Date(currentMonthDate); p.setMonth(p.getMonth() - 1); setCurrentMonthDate(p) }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => { const n = new Date(currentMonthDate); n.setMonth(n.getMonth() + 1); setCurrentMonthDate(n) }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button 
            type="button"
            onClick={() => setCurrentMonthDate(new Date())}
            className="text-xs font-semibold text-[#9A783E] px-2 py-1 hover:bg-[#FDFBF7] rounded-lg transition-colors ml-1 cursor-pointer"
          >
            Today
          </button>
        </div>
      </div>

      {/* Week‑day header */}
      <div className="grid grid-cols-7 text-center border-b border-slate-100 text-[10px] uppercase tracking-wider font-bold text-slate-450 py-2 bg-slate-50/50">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      {/* Day cells grid divided by weeks */}
      <div className="flex flex-col">
        {weeks.map((weekDays, wIdx) => {
          const weekStart = weekDays.find(d => d !== null) || null
          const weekEnd = [...weekDays].reverse().find(d => d !== null) || null
          
          let weekStartStr = ''
          let weekEndStr = ''
          
          if (weekStart) weekStartStr = getDayStr(weekStart)
          if (weekEnd) weekEndStr = getDayStr(weekEnd)

          // Gather overlapping events for this week
          interface WeekEvent {
            booking: Booking
            startIdx: number
            span: number
          }
          const weekEvents: WeekEvent[] = []

          if (weekStart && weekEnd) {
            bookings.forEach(b => {
              if (b.room_id && !selectedRoomIds.has(b.room_id)) return
              const checkInStr = b.check_in
              const lastNightStr = b.room_id ? getPreviousDay(b.check_out) : b.check_in

              if (checkInStr <= weekEndStr && lastNightStr >= weekStartStr) {
                let startIdx = 0
                for (let i = 0; i < 7; i++) {
                  const day = weekDays[i]
                  if (day && getDayStr(day) === checkInStr) {
                    startIdx = i
                    break
                  }
                }
                const firstNonNullIdx = weekDays.findIndex(d => d !== null)
                if (checkInStr < getDayStr(weekDays[firstNonNullIdx])) {
                  startIdx = firstNonNullIdx
                }

                let endIdx = 6
                for (let i = 0; i < 7; i++) {
                  const day = weekDays[i]
                  if (day && getDayStr(day) === lastNightStr) {
                    endIdx = i
                    break
                  }
                }
                const lastNonNullIdx = 6 - [...weekDays].reverse().findIndex(d => d !== null)
                if (lastNightStr > getDayStr(weekDays[lastNonNullIdx])) {
                  endIdx = lastNonNullIdx
                }

                const span = endIdx - startIdx + 1
                if (span > 0) {
                  weekEvents.push({ booking: b, startIdx, span })
                }
              }
            })
          }

          // Sort events: longest span first, then earliest start date
          weekEvents.sort((a, b) => {
            if (b.span !== a.span) return b.span - a.span
            return a.startIdx - b.startIdx
          })

          // Pack events into max 3 horizontal slots
          const slots: (WeekEvent | null)[][] = [[], [], []]
          const dayOverflowCount = new Array(7).fill(0)
          const slotEvents: { event: WeekEvent; slot: number }[] = []

          weekEvents.forEach(evt => {
            let assignedSlot = -1
            for (let s = 0; s < 3; s++) {
              let ok = true
              for (let day = evt.startIdx; day < evt.startIdx + evt.span; day++) {
                if (slots[s][day]) {
                  ok = false
                  break
                }
              }
              if (ok) {
                assignedSlot = s
                break
              }
            }

            if (assignedSlot !== -1) {
              for (let day = evt.startIdx; day < evt.startIdx + evt.span; day++) {
                slots[assignedSlot][day] = evt
              }
              slotEvents.push({ event: evt, slot: assignedSlot })
            } else {
              for (let day = evt.startIdx; day < evt.startIdx + evt.span; day++) {
                dayOverflowCount[day]++
              }
            }
          })

          return (
            <div key={wIdx} className="relative border-b border-slate-100 last:border-b-0">
              {/* Background Cell Grid */}
              <div className="grid grid-cols-7">
                {weekDays.map((date, dIdx) => {
                  if (!date) {
                    return <div key={dIdx} className="min-h-[85px] sm:min-h-[105px] bg-slate-50/40 border-r border-slate-100 last:border-r-0" />
                  }

                  const fmtDate = getDayStr(date)
                  const isToday = date.toDateString() === todayStr
                  const overflowCount = dayOverflowCount[dIdx]

                  return (
                    <div 
                      key={dIdx}
                      onClick={() => setSelectedPreviewDate(date)}
                      className={`group min-h-[85px] sm:min-h-[105px] p-1.5 border-r border-slate-100 last:border-r-0 flex flex-col cursor-pointer transition-colors relative ${isToday ? 'bg-[#FDFBF7]' : 'hover:bg-slate-50'}`}
                    >
                      {/* Date header */}
                      <div className="flex items-center justify-between mb-1 z-15 relative">
                        <span className={`text-[10px] sm:text-xs font-semibold ${isToday ? 'bg-[#B89251] text-white w-4.5 h-4.5 sm:w-5 sm:h-5 flex items-center justify-center rounded-full text-[9px] sm:text-[10px] font-bold' : 'text-slate-500'}`}>
                          {date.getDate()}
                        </span>
                        <button 
                          type="button"
                          onClick={e => { 
                            e.stopPropagation()
                            const t = new Date(date)
                            t.setDate(t.getDate() + 1)
                            resetAndOpenManualForm('room', new Set([rooms[0]?.id || 'room-1']), fmtDate, t.toISOString().split('T')[0]) 
                          }}
                          className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[10px] text-slate-400 hover:bg-[#B89251] hover:text-white rounded transition-all cursor-pointer z-20 pointer-events-auto"
                        >
                          +
                        </button>
                      </div>

                      {/* Day Overflow indicator */}
                      {overflowCount > 0 && (
                        <div 
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedPreviewDate(date)
                          }}
                          className="text-[8px] sm:text-[9px] text-[#9A783E] hover:text-[#B89251] font-bold text-center mt-auto pb-1.5 hover:underline cursor-pointer select-none pointer-events-auto z-15 relative"
                        >
                          +{overflowCount} more
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Absolute Overlay Event Spanning Bars */}
              <div className="absolute inset-x-0 top-[26px] sm:top-[28px] bottom-0 pointer-events-none select-none flex flex-col gap-1 pr-1.5 pl-0.5">
                {[0, 1, 2].map(slot => {
                  const eventsInSlot = slotEvents.filter(se => se.slot === slot)
                  return (
                    <div key={slot} className="relative h-[18px] sm:h-[20px] w-full">
                      {eventsInSlot.map(({ event }) => {
                        const room = rooms.find(r => r.id === event.booking.room_id)
                        const c = event.booking.room_id ? (ROOM_COLORS[event.booking.room_id] || ROOM_COLORS['room-10']) : VENUE_COLORS
                        
                        const leftPct = (event.startIdx / 7) * 100
                        const widthPct = (event.span / 7) * 100
                        
                        const checkInStr = event.booking.check_in
                        const lastNightStr = event.booking.room_id ? getPreviousDay(event.booking.check_out) : event.booking.check_in
                        
                        const roundedLeftClass = checkInStr >= weekStartStr ? 'rounded-l-md' : 'rounded-l-none border-l-0'
                        const roundedRightClass = lastNightStr <= weekEndStr ? 'rounded-r-md' : 'rounded-r-none border-r-0'

                        return (
                          <div
                            key={event.booking.id}
                            onClick={e => {
                              e.stopPropagation()
                              if (event.booking.status !== 'blocked') {
                                setSelectedExtendBooking(event.booking)
                                setExtendCheckoutDate(event.booking.check_out)
                                setExtendError('')
                              }
                            }}
                            style={{
                              left: `${leftPct}%`,
                              width: `calc(${widthPct}% - 4px)`,
                              marginLeft: '2px',
                              marginRight: '2px'
                            }}
                            className={`absolute top-0 h-full text-[8px] sm:text-[9px] font-bold px-2 flex items-center justify-between border cursor-pointer pointer-events-auto shadow-sm select-none transition-all hover:scale-[1.008] hover:shadow-md ${roundedLeftClass} ${roundedRightClass} ${getBookingStyle(event.booking, c)}`}
                            title={`${room ? `Room ${room.room_number}` : 'Venue'} – ${event.booking.guest_name}`}
                          >
                            <span className="truncate">
                              {room ? `Rm ${room.room_number}` : 'VN'} · {event.booking.guest_name}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}
              </div>

            </div>
          )
        })}
      </div>
    </div>
  )
}

import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Booking, Room } from '../../types/booking'

interface MonthGridViewProps {
  rooms: Room[]
  currentMonthDate: Date
  selectedRoomIds: Set<string>
  bookingsByDate: Record<string, Booking[]>
  ROOM_COLORS: Record<string, { bg: string; text: string; border: string }>
  VENUE_COLORS: { bg: string; text: string; border: string }
  setCurrentMonthDate: (date: Date) => void
  setSelectedPreviewDate: (date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  resetAndOpenManualForm: (pathway: 'room' | 'venue', roomIds: Set<string>, checkIn?: string, checkOut?: string) => void
}

interface MonthCellProps {
  date: Date
  isToday: boolean
  dayBookings: Booking[]
  rooms: Room[]
  ROOM_COLORS: Record<string, { bg: string; text: string; border: string }>
  VENUE_COLORS: { bg: string; text: string; border: string }
  setSelectedPreviewDate: (date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  resetAndOpenManualForm: (pathway: 'room' | 'venue', roomIds: Set<string>, checkIn?: string, checkOut?: string) => void
}

// Optimized, memoized day cell rendering
const MonthCell = React.memo(
  ({
    date,
    isToday,
    dayBookings,
    rooms,
    ROOM_COLORS,
    VENUE_COLORS,
    setSelectedPreviewDate,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError,
    resetAndOpenManualForm
  }: MonthCellProps) => {
    const fmtDate = date.toISOString().split('T')[0]

    return (
      <div 
        onClick={() => setSelectedPreviewDate(date)}
        className={`group min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-slate-100 flex flex-col cursor-pointer transition-colors ${isToday ? 'bg-[#FDFBF7]' : 'hover:bg-slate-50'}`}
      >
        {/* Day number + quick add */}
        <div className="flex items-center justify-between mb-1">
          <span className={`text-xs font-medium ${isToday ? 'bg-[#B89251] text-white w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold' : 'text-slate-500'}`}>
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
            className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center text-[10px] text-slate-400 hover:bg-[#B89251] hover:text-white rounded transition-all cursor-pointer"
          >
            +
          </button>
        </div>
        {/* Booking chips */}
        <div className="space-y-0.5 overflow-hidden flex-1">
          {dayBookings.slice(0, 3).map(b => {
            const room = rooms.find(r => r.id === b.room_id)
            const c = b.room_id ? (ROOM_COLORS[b.room_id] || ROOM_COLORS['room-10']) : VENUE_COLORS
            return (
              <div 
                key={b.id}
                onClick={e => { 
                  e.stopPropagation()
                  if (b.status !== 'blocked') { 
                    setSelectedExtendBooking(b)
                    setExtendCheckoutDate(b.check_out)
                    setExtendError('') 
                  } 
                }}
                className={`text-[8px] sm:text-[9px] font-semibold px-1 py-0.5 rounded border truncate cursor-pointer ${c.bg} ${c.text} ${c.border}`}
                title={`${room ? `Room ${room.room_number}` : 'Venue'} – ${b.guest_name}`}
              >
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
  },
  // Custom memo comparator: only re-render if date, today status, or bookings change
  (prevProps, nextProps) => {
    const datesEqual = prevProps.date.getTime() === nextProps.date.getTime()
    if (!datesEqual) return false
    const prevLen = prevProps.dayBookings.length
    const nextLen = nextProps.dayBookings.length
    if (prevLen !== nextLen) return false
    for (let i = 0; i < prevLen; i++) {
      if (prevProps.dayBookings[i].id !== nextProps.dayBookings[i].id ||
          prevProps.dayBookings[i].status !== nextProps.dayBookings[i].status ||
          prevProps.dayBookings[i].guest_name !== nextProps.dayBookings[i].guest_name) {
        return false
      }
    }
    return (
      prevProps.isToday === nextProps.isToday &&
      prevProps.ROOM_COLORS === nextProps.ROOM_COLORS
    )
  }
)

export function MonthGridView({
  rooms,
  currentMonthDate,
  selectedRoomIds,
  bookingsByDate,
  ROOM_COLORS,
  VENUE_COLORS,
  setCurrentMonthDate,
  setSelectedPreviewDate,
  setSelectedExtendBooking,
  setExtendCheckoutDate,
  setExtendError,
  resetAndOpenManualForm
}: MonthGridViewProps) {

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

  const todayStr = useMemo(() => new Date().toDateString(), [])

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <h3 className="text-sm font-semibold text-slate-800 font-sans">
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
      <div className="grid grid-cols-7 text-center border-b border-slate-100 text-[10px] uppercase tracking-wider font-semibold text-slate-400 py-2">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <div key={d}>{d}</div>)}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {gridDates.map((date, idx) => {
          if (!date) return <div key={idx} className="min-h-[80px] sm:min-h-[100px] bg-slate-50/40 border-b border-r border-slate-100" />

          const fmtDate = date.toISOString().split('T')[0]
          const isToday = date.toDateString() === todayStr
          const dayBookings = (bookingsByDate[fmtDate] || []).filter(b => {
            if (b.room_id && !selectedRoomIds.has(b.room_id)) return false
            return true
          })

          return (
            <MonthCell
              key={idx}
              date={date}
              isToday={isToday}
              dayBookings={dayBookings}
              rooms={rooms}
              ROOM_COLORS={ROOM_COLORS}
              VENUE_COLORS={VENUE_COLORS}
              setSelectedPreviewDate={setSelectedPreviewDate}
              setSelectedExtendBooking={setSelectedExtendBooking}
              setExtendCheckoutDate={setExtendCheckoutDate}
              setExtendError={setExtendError}
              resetAndOpenManualForm={resetAndOpenManualForm}
            />
          )
        })}
      </div>
    </div>
  )
}

import React, { useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Booking, Room } from '../../types/booking'

interface MonthGridViewProps {
  rooms: Room[]
  currentMonthDate: Date
  selectedRoomIds: Set<string>
  bookings: Booking[]
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
  bookings: Booking[]
  selectedRoomIds: Set<string>
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
    bookings,
    selectedRoomIds,
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

    // Compute active check-ins, check-outs, stay-overs, and blocks for this day cell
    const allEvents = useMemo(() => {
      const list: { type: 'in' | 'out' | 'stay' | 'block'; booking: Booking }[] = []
      
      bookings.forEach(b => {
        if (b.status === 'blocked') {
          if (fmtDate >= b.check_in && fmtDate < b.check_out) {
            list.push({ type: 'block', booking: b })
          }
        } else {
          if (b.check_in === fmtDate) {
            list.push({ type: 'in', booking: b })
          } else if (b.check_out === fmtDate) {
            list.push({ type: 'out', booking: b })
          } else if (fmtDate > b.check_in && fmtDate < b.check_out) {
            list.push({ type: 'stay', booking: b })
          }
        }
      })

      // Apply room filter
      const filtered = list.filter(item => {
        if (item.booking.room_id && !selectedRoomIds.has(item.booking.room_id)) return false
        return true
      })

      // Sort prioritizing Actionable Events: Check-ins first, then Check-outs, then Blocks, then Stay-overs
      filtered.sort((a, b) => {
        const priority = { in: 1, out: 2, block: 3, stay: 4 }
        return priority[a.type] - priority[b.type]
      })

      return filtered
    }, [bookings, fmtDate, selectedRoomIds])

    return (
      <div 
        onClick={() => setSelectedPreviewDate(date)}
        className={`group min-h-[80px] sm:min-h-[100px] p-1 sm:p-1.5 border-b border-r border-slate-100 flex flex-col cursor-pointer transition-colors ${isToday ? 'bg-[#FDFBF7]' : 'hover:bg-slate-50'}`}
      >
        {/* Day number + quick add */}
        <div className="flex items-center justify-between mb-1 shrink-0">
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
        <div className="space-y-0.5 overflow-hidden flex-1 mb-1">
          {allEvents.slice(0, 3).map(item => {
            const b = item.booking
            const room = rooms.find(r => r.id === b.room_id)
            const isBlocked = b.status === 'blocked'
            
            const c = isBlocked 
              ? { bg: 'bg-slate-50', text: 'text-slate-400 line-through', border: 'border-slate-200' }
              : (b.room_id ? (ROOM_COLORS[b.room_id] || ROOM_COLORS['room-10']) : VENUE_COLORS)
            
            let label = room ? `Rm ${room.room_number}` : 'Venue'
            let borderStyle = ''
            let opacityStyle = ''
            let statusSuffix = ''

            if (item.type === 'in') {
              borderStyle = 'border-l-[3px] border-l-emerald-500 rounded-l-none pl-1'
              statusSuffix = ' (In)'
            } else if (item.type === 'out') {
              borderStyle = 'border-l-[3px] border-l-rose-500 rounded-l-none pl-1'
              opacityStyle = 'opacity-75'
              statusSuffix = ' (Out)'
            } else if (item.type === 'block') {
              label = room ? `Rm ${room.room_number} (Blocked)` : 'Blocked'
            }

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
                className={`text-[8px] sm:text-[9px] font-bold px-1 py-0.5 rounded border truncate cursor-pointer ${c.bg} ${c.text} ${c.border} ${borderStyle} ${opacityStyle}`}
                title={`${room ? `Room ${room.room_number}` : 'Venue'} – ${b.guest_name}${statusSuffix}`}
              >
                {label} · {b.guest_name.split(' ')[0]}
              </div>
            )
          })}
          {allEvents.length > 3 && (
            <div className="text-[8px] text-slate-400 font-bold text-center">+{allEvents.length - 3} more</div>
          )}
        </div>

        {/* Occupancy Mini Map Strip (Always shows occupancy state for all 10 rooms) */}
        <div className="flex items-center gap-[1.5px] mt-auto pt-1 border-t border-slate-100/50 justify-center shrink-0">
          {rooms.slice(0, 10).map(r => {
            // Room is occupied tonight if there is an active check-in or stay-over (guest sleeps there tonight)
            const isRoomOccupied = allEvents.some(item => item.booking.room_id === r.id && item.type !== 'out' && item.booking.status !== 'blocked')
            const isRoomBlocked = allEvents.some(item => item.booking.room_id === r.id && item.booking.status === 'blocked')
            const c = ROOM_COLORS[r.id] || ROOM_COLORS['room-10']
            
            let dotClass = 'bg-slate-200'
            if (isRoomBlocked) {
              dotClass = 'bg-slate-450'
            } else if (isRoomOccupied) {
              // Convert text color token to matching background class
              dotClass = c.text.replace('text-', 'bg-')
            }

            return (
              <span 
                key={r.id} 
                title={`Room ${r.room_number}: ${isRoomBlocked ? 'Blocked' : isRoomOccupied ? 'Occupied' : 'Vacant'}`}
                className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${dotClass}`} 
              />
            )
          })}
        </div>

      </div>
    )
  },
  // Custom memo comparator: only re-render if date, today status, selection, or bookings change
  (prevProps, nextProps) => {
    return (
      prevProps.date.getTime() === nextProps.date.getTime() &&
      prevProps.isToday === nextProps.isToday &&
      prevProps.bookings === nextProps.bookings &&
      prevProps.selectedRoomIds === nextProps.selectedRoomIds
    )
  }
)

export function MonthGridView({
  rooms,
  currentMonthDate,
  selectedRoomIds,
  bookings,
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

          const isToday = date.toDateString() === todayStr

          return (
            <MonthCell
              key={idx}
              date={date}
              isToday={isToday}
              bookings={bookings}
              selectedRoomIds={selectedRoomIds}
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

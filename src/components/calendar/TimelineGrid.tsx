import React from 'react'
import { Booking, Room } from '../../types/booking'

interface TimelineDayInfo {
  date: Date
  isoStr: string
  time: number
  dayNum: number
  weekday: string
  isToday: boolean
}

interface TimelineGridProps {
  rooms: Room[]
  daysList: TimelineDayInfo[]
  bookingByRoomAndDate: Record<string, Booking>
  getBookingStyle: (b: Booking) => string
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
  timelineSelection: { roomId: string; checkIn: Date } | null
  setTimelineSelection: (val: { roomId: string; checkIn: Date } | null) => void
  handleCellClick: (roomId: string, date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
}

interface TimelineCellProps {
  date: Date
  isoStr: string
  roomId: string
  booking: Booking | null
  isCheckIn: boolean
  getBookingStyle: (b: Booking) => string
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
  onCellClick: (roomId: string, date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  dIdx: number
}

// Highly optimized, memoized timeline cell wrapper
const TimelineCell = React.memo(
  ({
    date,
    isoStr,
    roomId,
    booking,
    isCheckIn,
    getBookingStyle,
    activeTooltip,
    setActiveTooltip,
    onCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError,
    dIdx
  }: TimelineCellProps) => {
    const hoverTimeoutRef = React.useRef<any>(null)

    React.useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      }
    }, [])

    if (booking) {
      const isStart = isoStr === booking.check_in
      const tipId = `${roomId}-${dIdx}`
      const isTooltipActive = activeTooltip === tipId

      return (
        <td className="p-0 border-r border-slate-100 relative"
          onMouseEnter={() => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = setTimeout(() => {
              setActiveTooltip(tipId)
            }, 500)
          }}
          onMouseLeave={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
            setActiveTooltip(null)
          }}>
          <div 
            onClick={e => { 
              e.stopPropagation()
              if (booking.status !== 'blocked') { 
                setSelectedExtendBooking(booking)
                setExtendCheckoutDate(booking.check_out)
                setExtendError('') 
              } 
            }}
            className={`h-7 mx-0.5 flex items-center justify-center text-[9px] font-semibold rounded-sm border cursor-pointer select-none ${getBookingStyle(booking)}`}
          >
            {isStart ? <span className="px-0.5 truncate">{booking.guest_name.split(' ')[0]}</span> : <span className="opacity-0">.</span>}
          </div>
          {isTooltipActive && (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-52 bg-white border border-slate-200 p-3 shadow-lg rounded-lg text-xs space-y-1.5 pointer-events-none text-left">
              <div className="font-semibold text-slate-800">{booking.guest_name}</div>
              <div className="text-[10px] text-slate-400 font-mono">{booking.check_in} → {booking.check_out}</div>
              <div className="text-[10px] text-slate-500 font-sans">
                {booking.guest_phone}<br />
                <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-medium' : 'text-amber-600'}>{booking.status}</span>
                {' · '}{booking.source}
              </div>
            </div>
          )}
        </td>
      )
    }

    if (isCheckIn) {
      return (
        <td 
          onClick={() => onCellClick(roomId, date)}
          className="p-0 h-8 relative cursor-cell rounded-lg border-2 bg-[#B89251] border-[#9A783E] text-white animate-fade-in">
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider">
            In
          </div>
        </td>
      )
    }
    
    return (
      <td 
        onClick={() => onCellClick(roomId, date)}
        className="border-r border-slate-100 p-0 h-8 cursor-cell" />
    )
  },
  // Custom memo comparator
  (prevProps, nextProps) => {
    return (
      prevProps.isCheckIn === nextProps.isCheckIn &&
      prevProps.activeTooltip === nextProps.activeTooltip &&
      prevProps.booking?.id === nextProps.booking?.id &&
      prevProps.booking?.status === nextProps.booking?.status
    )
  }
)

export const TimelineGrid = React.memo(
  function TimelineGrid({
    rooms,
    daysList,
    bookingByRoomAndDate,
    getBookingStyle,
    activeTooltip,
    setActiveTooltip,
    timelineSelection,
    setTimelineSelection,
    handleCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError
  }: TimelineGridProps) {
    
    // Optimize date lookups with timestamps to avoid string comparisons in the loop
    const checkInTime = React.useMemo(() => timelineSelection ? timelineSelection.checkIn.getTime() : 0, [timelineSelection])

    return (
      <div className="space-y-2.5">
        {timelineSelection && (
          <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-xs bg-slate-950/95 backdrop-blur-sm border border-slate-800 text-slate-100 rounded-lg p-3.5 shadow-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 font-sans">
            <span className="flex h-2.5 w-2.5 relative mt-1 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-amber-400"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            </span>
            <div className="flex-1 text-xs">
              <p className="font-bold text-white">Date Selection Active</p>
              <p className="text-slate-400 mt-1 leading-normal">
                Selecting Room <strong>{rooms.find(r => r.id === timelineSelection.roomId)?.room_number}</strong>.
              </p>
              <p className="text-slate-400 leading-normal">
                Check‑in: <strong>{timelineSelection.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>.
              </p>
              <p className="text-[11px] text-amber-400/90 font-medium mt-1.5">
                Click checkout date on the grid.
              </p>
            </div>
            <button 
              type="button" 
              onClick={() => setTimelineSelection(null)}
              className="text-[10px] font-bold text-slate-300 hover:text-white transition-colors cursor-pointer border border-slate-800 hover:border-slate-650 px-2 py-1 rounded bg-slate-900">
              Cancel
            </button>
          </div>
        )}
        
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50">
                  <th className="sticky left-0 z-20 bg-slate-50 border-b border-r border-slate-200 p-3 text-left text-xs text-slate-500 font-medium min-w-[160px]">
                    Room
                  </th>
                  {daysList.map((dayInfo, i) => {
                    return (
                      <th key={i} className={`border-b border-slate-200 p-1.5 text-center text-[10px] min-w-[38px] font-mono ${dayInfo.isToday ? 'bg-[#FDFBF7] text-[#9A783E] font-semibold' : 'text-slate-400'}`}>
                        <div>{dayInfo.weekday}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${dayInfo.isToday ? 'border-b border-[#B89251] pb-0.5' : ''}`}>{dayInfo.dayNum}</div>
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
                    {daysList.map((dayInfo, dIdx) => {
                      const booking = bookingByRoomAndDate[`${room.id}_${dayInfo.isoStr}`]
                      const isDraftCheckIn = timelineSelection && timelineSelection.roomId === room.id && dayInfo.time === checkInTime

                      return (
                        <TimelineCell
                          key={dIdx}
                          date={dayInfo.date}
                          isoStr={dayInfo.isoStr}
                          roomId={room.id}
                          booking={booking || null}
                          isCheckIn={!!isDraftCheckIn}
                          getBookingStyle={getBookingStyle}
                          activeTooltip={activeTooltip}
                          setActiveTooltip={setActiveTooltip}
                          onCellClick={handleCellClick}
                          setSelectedExtendBooking={setSelectedExtendBooking}
                          setExtendCheckoutDate={setExtendCheckoutDate}
                          setExtendError={setExtendError}
                          dIdx={dIdx}
                        />
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
)

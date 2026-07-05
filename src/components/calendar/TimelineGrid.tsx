import React from 'react'
import { Booking, Room, Venue } from '../../types/booking'

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
  venues: Venue[]
  daysList: TimelineDayInfo[]
  bookingByRoomAndDate: Record<string, Booking>
  getBookingStyle: (b: Booking) => string
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
  timelineSelection: { roomId?: string; venueId?: string; checkIn: Date } | null
  setTimelineSelection: (val: { roomId?: string; venueId?: string; checkIn: Date } | null) => void
  handleCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
}

interface TimelineCellProps {
  date: Date
  isoStr: string
  id: string
  type: 'room' | 'venue'
  booking: Booking | null
  span: number
  isCheckIn: boolean
  getBookingStyle: (b: Booking) => string
  activeTooltip: string | null
  setActiveTooltip: (id: string | null) => void
  onCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
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
    id,
    type,
    booking,
    span,
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
      const tipId = `${id}-${dIdx}`
      const isTooltipActive = activeTooltip === tipId

      return (
        <td 
          colSpan={span}
          className="p-0 border-r border-slate-100 relative align-middle"
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
          }}
        >
          <div 
            onClick={e => { 
              e.stopPropagation()
              if (booking.status !== 'blocked') { 
                setSelectedExtendBooking(booking)
                setExtendCheckoutDate(booking.check_out)
                setExtendError('') 
              } 
            }}
            className={`h-7 mx-0.5 flex items-center justify-between text-[9.5px] font-extrabold px-2.5 rounded-sm border cursor-pointer select-none transition-all hover:scale-[1.003] hover:shadow-sm ${getBookingStyle(booking)}`}
          >
            <span className="truncate">
              {booking.guest_name}
            </span>
            {span > 1 && (
              <span className="text-[8px] opacity-65 font-mono shrink-0 pl-1.5">
                {span} nites
              </span>
            )}
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
          onClick={() => onCellClick(id, type, date)}
          className="p-0 h-8 relative cursor-cell rounded bg-[#B89251] border border-[#9A783E] text-white animate-fade-in align-middle"
        >
          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider">
            In
          </div>
        </td>
      )
    }
    
    return (
      <td 
        onClick={() => onCellClick(id, type, date)}
        className="border-r border-slate-100 p-0 h-8 cursor-cell hover:bg-[#FDFBF7]/60 transition-colors" 
      />
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.onCellClick === nextProps.onCellClick &&
      prevProps.isCheckIn === nextProps.isCheckIn &&
      prevProps.span === nextProps.span &&
      prevProps.activeTooltip === nextProps.activeTooltip &&
      prevProps.booking?.id === nextProps.booking?.id &&
      prevProps.booking?.status === nextProps.booking?.status
    )
  }
)

export const TimelineGrid = React.memo(
  function TimelineGrid({
    rooms,
    venues,
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
    
    const checkInTime = React.useMemo(() => timelineSelection ? timelineSelection.checkIn.getTime() : 0, [timelineSelection])

    const selectionName = React.useMemo(() => {
      if (!timelineSelection) return ''
      if (timelineSelection.roomId) {
        return `Room ${rooms.find(r => r.id === timelineSelection.roomId)?.room_number}`
      }
      if (timelineSelection.venueId) {
        return venues.find(v => v.id === timelineSelection.venueId)?.name || 'Venue'
      }
      return ''
    }, [timelineSelection, rooms, venues])

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
                Selecting <strong>{selectionName}</strong>.
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
                    Room / Venue
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
                {rooms.map(room => {
                  const cells: React.ReactNode[] = []
                  let dIdx = 0

                  while (dIdx < daysList.length) {
                    const dayInfo = daysList[dIdx]
                    const booking = bookingByRoomAndDate[`${room.id}_${dayInfo.isoStr}`]

                    if (booking) {
                      let span = 1
                      while (dIdx + span < daysList.length) {
                        const nextDay = daysList[dIdx + span]
                        const nextBooking = bookingByRoomAndDate[`${room.id}_${nextDay.isoStr}`]
                        if (nextBooking && nextBooking.id === booking.id) {
                          span++
                        } else {
                          break
                        }
                      }

                      cells.push(
                        <TimelineCell
                          key={dIdx}
                          date={dayInfo.date}
                          isoStr={dayInfo.isoStr}
                          id={room.id}
                          type="room"
                          booking={booking}
                          span={span}
                          isCheckIn={false}
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
                      dIdx += span
                    } else {
                      const isDraftCheckIn = timelineSelection && timelineSelection.roomId === room.id && dayInfo.time === checkInTime
                      cells.push(
                        <TimelineCell
                          key={dIdx}
                          date={dayInfo.date}
                          isoStr={dayInfo.isoStr}
                          id={room.id}
                          type="room"
                          booking={null}
                          span={1}
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
                      dIdx++
                    }
                  }

                  return (
                    <tr key={room.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                      <td className="sticky left-0 z-20 bg-white border-r border-slate-200 p-3 min-w-[160px]">
                        <span className="text-xs font-semibold text-slate-800 block">Room {room.room_number}</span>
                        <span className="text-[10px] text-[#B89251]">₱{room.base_price.toLocaleString()}/night</span>
                      </td>
                      {cells}
                    </tr>
                  )
                })}

                <tr className="bg-slate-100/50">
                  <td colSpan={daysList.length + 1} className="sticky left-0 z-20 bg-slate-100/70 border-b border-slate-200 p-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 text-left">
                    Event Venues
                  </td>
                </tr>

                {venues.map(venue => {
                  const cells: React.ReactNode[] = []
                  let dIdx = 0

                  while (dIdx < daysList.length) {
                    const dayInfo = daysList[dIdx]
                    const booking = bookingByRoomAndDate[`${venue.id}_${dayInfo.isoStr}`]

                    if (booking) {
                      let span = 1
                      while (dIdx + span < daysList.length) {
                        const nextDay = daysList[dIdx + span]
                        const nextBooking = bookingByRoomAndDate[`${venue.id}_${nextDay.isoStr}`]
                        if (nextBooking && nextBooking.id === booking.id) {
                          span++
                        } else {
                          break
                        }
                      }

                      cells.push(
                        <TimelineCell
                          key={dIdx}
                          date={dayInfo.date}
                          isoStr={dayInfo.isoStr}
                          id={venue.id}
                          type="venue"
                          booking={booking}
                          span={span}
                          isCheckIn={false}
                          getBookingStyle={(b) => {
                            if (b.status === 'blocked') return 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                            if (b.status === 'pending') return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                            return 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                          }}
                          activeTooltip={activeTooltip}
                          setActiveTooltip={setActiveTooltip}
                          onCellClick={handleCellClick}
                          setSelectedExtendBooking={setSelectedExtendBooking}
                          setExtendCheckoutDate={setExtendCheckoutDate}
                          setExtendError={setExtendError}
                          dIdx={dIdx}
                        />
                      )
                      dIdx += span
                    } else {
                      const isDraftCheckIn = timelineSelection && timelineSelection.venueId === venue.id && dayInfo.time === checkInTime
                      cells.push(
                        <TimelineCell
                          key={dIdx}
                          date={dayInfo.date}
                          isoStr={dayInfo.isoStr}
                          id={venue.id}
                          type="venue"
                          booking={null}
                          span={1}
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
                      dIdx++
                    }
                  }

                  return (
                    <tr key={venue.id} className="border-b border-slate-100 hover:bg-slate-50/30">
                      <td className="sticky left-0 z-20 bg-white border-r border-slate-200 p-3 min-w-[160px]">
                        <span className="text-xs font-semibold text-slate-800 block">{venue.name}</span>
                        <span className="text-[10px] text-[#B89251]">₱{venue.base_price.toLocaleString()}/day</span>
                      </td>
                      {cells}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }
)

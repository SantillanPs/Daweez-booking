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
  groupSelection?: Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }> | null
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
  isHighlighted: boolean
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
    isHighlighted,
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
          className="p-0 border-r border-soft relative align-middle"
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
                {span} nights
              </span>
            )}
          </div>
          {isTooltipActive && (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-52 bg-card border border-soft p-3 shadow-lg rounded-lg text-xs space-y-1.5 pointer-events-none text-left font-sans">
              <div className="font-semibold text-main">{booking.guest_name}</div>
              <div className="text-[10px] text-muted font-mono">{booking.check_in} → {booking.check_out}</div>
              <div className="text-[10px] text-muted">
                {booking.guest_phone}<br />
                <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-medium' : 'text-amber-600'}>{booking.status}</span>
                {' · '}{booking.source}
                {booking.event_addons?.payment_reference && (
                  <>
                    <br />
                    <span className="text-[9.5px] text-brand-text font-bold">
                      Ref: {booking.event_addons.payment_reference}
                    </span>
                  </>
                )}
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
          className="p-0.5 h-8 relative cursor-cell align-middle"
        >
          <div className="w-full h-full rounded bg-brand-primary text-white flex items-center justify-center text-[9px] font-bold uppercase tracking-wider shadow-sm animate-in zoom-in-95 duration-150 border border-[#9A783E]">
            In
          </div>
        </td>
      )
    }

    if (isHighlighted) {
      return (
        <td
          onClick={() => onCellClick(id, type, date)}
          className="p-0 h-8 cursor-cell relative align-middle transition-all bg-gradient-to-r from-[#FAF0DD]/60 to-[#F5E6CC]/50 hover:from-[#FAF0DD]/80 hover:to-[#F5E6CC]/70"
        >
          <div className="absolute inset-0 border-y border-dashed border-brand-primary/40" />
        </td>
      )
    }

    return (
      <td
        onClick={() => onCellClick(id, type, date)}
        className="border-r border-soft p-0 h-8 cursor-cell hover:bg-brand-bg/60 transition-colors"
      />
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.onCellClick === nextProps.onCellClick &&
      prevProps.isCheckIn === nextProps.isCheckIn &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
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
    groupSelection,
    handleCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError
  }: TimelineGridProps) {

    const checkInTime = React.useMemo(() => timelineSelection ? timelineSelection.checkIn.getTime() : 0, [timelineSelection])
    const selectionRanges = React.useMemo(() => {
      if (!groupSelection) return {}
      const ranges: Record<string, { start: number; end: number }> = {}
      Object.entries(groupSelection).forEach(([id, sel]) => {
        ranges[id] = {
          start: sel.checkIn.getTime(),
          end: sel.checkOut.getTime()
        }
      })
      return ranges
    }, [groupSelection])

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
      <div className="space-y-2.5 flex-1 min-h-0 flex flex-col overflow-hidden">
        {timelineSelection && (
          <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-xs bg-brand-bg/95 backdrop-blur-md border border-brand-border text-main rounded-lg p-3.5 shadow-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 font-sans">
            <span className="flex h-2.5 w-2.5 relative mt-1 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-brand-primary"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-brand-primary"></span>
            </span>
            <div className="flex-1 text-xs">
              <p className="font-bold text-brand-text">Date Selection Active</p>
              <p className="text-slate-650 mt-1 leading-normal">
                Selecting <strong>{selectionName}</strong>.
              </p>
              <p className="text-slate-650 leading-normal">
                Check‑in: <strong className="text-brand-text">{timelineSelection.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>.
              </p>
              <p className="text-[11px] text-brand-primary font-semibold mt-1.5 animate-pulse">
                Click checkout date on the grid.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTimelineSelection(null)}
              className="text-[10px] font-bold text-muted hover:text-main transition-all cursor-pointer border border-brand-border hover:border-slate-350 px-2 py-1 rounded bg-card hover:bg-page shadow-sm">
              Cancel
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-card border border-soft rounded-lg overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0 overflow-auto relative">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-page">
                  <th className="sticky top-0 left-0 z-30 bg-page border-b border-r border-soft p-3 text-left text-xs text-muted font-medium min-w-[160px]">
                    Room / Venue
                  </th>
                  {daysList.map((dayInfo, i) => {
                    return (
                      <th key={i} className={`sticky top-0 z-10 border-b border-soft p-1.5 text-center text-[10px] min-w-[38px] font-mono ${dayInfo.isToday ? 'bg-brand-bg text-brand-text font-semibold' : 'bg-page text-muted'}`}>
                        <div>{dayInfo.weekday}</div>
                        <div className={`text-xs font-semibold mt-0.5 ${dayInfo.isToday ? 'border-b border-brand-primary pb-0.5' : ''}`}>{dayInfo.dayNum}</div>
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
                          isHighlighted={false}
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
                      const range = selectionRanges[room.id]
                      const isHighlighted = !!(
                        range &&
                        dayInfo.time >= range.start &&
                        dayInfo.time <= range.end
                      )
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
                          isHighlighted={isHighlighted}
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
                    <tr key={room.id} className="border-b border-soft hover:bg-page/30">
                      <td className="sticky left-0 z-20 bg-card border-r border-soft p-3 min-w-[160px]">
                        <span className="text-xs font-semibold text-main block">Room {room.room_number}</span>
                        <span className="text-[10px] text-brand-primary">₱{room.base_price.toLocaleString()}/night</span>
                      </td>
                      {cells}
                    </tr>
                  )
                })}

                <tr className="bg-softbg/50">
                  <td colSpan={daysList.length + 1} className="sticky left-0 z-20 bg-softbg/70 border-b border-soft p-2 text-[10px] font-bold uppercase tracking-wider text-muted text-left">
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
                          isHighlighted={false}
                          getBookingStyle={(b) => {
                            if (b.status === 'blocked') return 'bg-softbg text-muted border-soft line-through'
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
                      const range = selectionRanges[venue.id]
                      const isHighlighted = !!(
                        range &&
                        dayInfo.time >= range.start &&
                        dayInfo.time <= range.end
                      )
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
                          isHighlighted={isHighlighted}
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
                    <tr key={venue.id} className="border-b border-soft hover:bg-page/30">
                      <td className="sticky left-0 z-20 bg-card border-r border-soft p-3 min-w-[160px]">
                        <span className="text-xs font-semibold text-main block">{venue.name}</span>
                        <span className="text-[10px] text-brand-primary">₱{venue.base_price.toLocaleString()}/day</span>
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

import React from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { getBookingStyle, getVenueBookingStyle, roomDisplayName } from './bookingStyles'
import { normalizeVenueId } from '../../utils/helpers'
import { TimelineCell } from './TimelineCell'
import { TimelineDayInfo } from './timelineDays'

export type { TimelineDayInfo }

interface TimelineGridProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  daysList: TimelineDayInfo[]
  bookingByRoomAndDate: Record<string, Booking>
  timelineSelection: { roomId?: string; venueId?: string; checkIn: Date } | null
  setTimelineSelection: (val: { roomId?: string; venueId?: string; checkIn: Date } | null) => void
  groupSelection?: Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }> | null
  handleCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
}

export const TimelineGrid = React.memo(
  function TimelineGrid({
    rooms,
    venues,
    bookings,
    daysList,
    bookingByRoomAndDate,
    timelineSelection,
    setTimelineSelection,
    groupSelection,
    handleCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError
  }: TimelineGridProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    // The window is rebuilt from today on every month change (card k154), so the
    // left edge — the day the desk is working on — must never stay scrolled off.
    const windowStartIso = daysList[0]?.isoStr
    React.useEffect(() => { scrollRef.current?.scrollTo({ left: 0 }) }, [windowStartIso])

    // Crosshair: know the hovered day so the column + row read at a glance.
    const [hoverDay, setHoverDay] = React.useState<string | null>(null)
    const handleGridMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      const t = (e.target as HTMLElement).closest('[data-day]') as HTMLElement | null
      setHoverDay(t ? t.getAttribute('data-day') : null)
    }
    const handleGridMouseLeave = () => setHoverDay(null)

    // Which booking checks out on each unit+day (for the small "out" mark).
    const checkoutByUnitAndDate = React.useMemo(() => {
      const map: Record<string, Booking> = {}
      bookings.forEach(b => {
        const keyId = b.room_id || normalizeVenueId(b.venue_id)
        if (keyId && b.check_out) map[keyId + '_' + b.check_out] = b
      })
      return map
    }, [bookings])

    const checkInTime = React.useMemo(() => timelineSelection ? timelineSelection.checkIn.getTime() : 0, [timelineSelection])
    const selectionRanges = React.useMemo(() => {
      if (!groupSelection) return {}
      const ranges: Record<string, { start: number; end: number }> = {}
      Object.entries(groupSelection).forEach(([id, sel]) => {
        ranges[id] = { start: sel.checkIn.getTime(), end: sel.checkOut.getTime() }
      })
      return ranges
    }, [groupSelection])

    const selectionName = React.useMemo(() => {
      if (!timelineSelection) return ''
      if (timelineSelection.roomId) {
        return roomDisplayName(rooms.find(r => r.id === timelineSelection.roomId))
      }
      if (timelineSelection.venueId) {
        return venues.find(v => v.id === timelineSelection.venueId)?.name || 'Venue'
      }
      return ''
    }, [timelineSelection, rooms, venues])

    const buildRowCells = (id: string, type: 'room' | 'venue') => {
      const cells: React.ReactNode[] = []
      let dIdx = 0
      while (dIdx < daysList.length) {
        const dayInfo = daysList[dIdx]
        const booking = bookingByRoomAndDate[id + '_' + dayInfo.isoStr]
        if (booking) {
          let span = 1
          while (dIdx + span < daysList.length) {
            const nextBooking = bookingByRoomAndDate[id + '_' + daysList[dIdx + span].isoStr]
            if (nextBooking && nextBooking.id === booking.id) span++
            else break
          }
          cells.push(
            <TimelineCell key={dayInfo.isoStr} date={dayInfo.date} isoStr={dayInfo.isoStr} id={id} type={type} booking={booking} span={span} isCheckIn={false} isHighlighted={false} isContinuation={!!booking.check_in && booking.check_in < daysList[0].isoStr} isWeekend={dayInfo.isWeekend} isToday={dayInfo.isToday} getBookingStyle={type === 'room' ? getBookingStyle : getVenueBookingStyle} onCellClick={handleCellClick} setSelectedExtendBooking={setSelectedExtendBooking} setExtendCheckoutDate={setExtendCheckoutDate} setExtendError={setExtendError} />
          )
          dIdx += span
        } else {
          const isDraftCheckIn = timelineSelection && ((type === 'room' && timelineSelection.roomId === id) || (type === 'venue' && timelineSelection.venueId === id)) && dayInfo.time === checkInTime
          const range = selectionRanges[id]
          const isHighlighted = !!(range && dayInfo.time >= range.start && dayInfo.time <= range.end)
          const checkout = checkoutByUnitAndDate[id + '_' + dayInfo.isoStr] || null
          cells.push(
            <TimelineCell key={dayInfo.isoStr} date={dayInfo.date} isoStr={dayInfo.isoStr} id={id} type={type} booking={null} span={1} isCheckIn={!!isDraftCheckIn} isHighlighted={isHighlighted} isWeekend={dayInfo.isWeekend} isToday={dayInfo.isToday} checkoutBooking={checkout} getBookingStyle={getBookingStyle} onCellClick={handleCellClick} setSelectedExtendBooking={setSelectedExtendBooking} setExtendCheckoutDate={setExtendCheckoutDate} setExtendError={setExtendError} />
          )
          dIdx++
        }
      }
      return cells
    }

    // ONE PRICE (card k128): there is only one figure per room, so the calendar
    // shows it plainly — no crossed-out second price standing beside it, which
    // only invited staff to read the old regular figure as the real one.
    const displayPriceFor = (unit: Room | Venue) => getEffectiveNightlyPrice(unit.base_price, unit.promo_price, true)

    return (
      <div className="space-y-2.5 flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
        {timelineSelection && (
          <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-50 max-w-xs bg-card border border-gold-200 text-main rounded-xl p-3.5 shadow-softLg flex items-start gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200 font-sans">
            <span className="flex h-2.5 w-2.5 relative mt-1 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-gold-600"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gold-600"></span>
            </span>
            <div className="flex-1 text-xs">
              <p className="font-display font-bold text-gold-700">Booking {selectionName}</p>
              <p className="text-muted mt-1 leading-normal">
                Check-in: <strong className="text-main">{timelineSelection.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>.
              </p>
              <p className="text-[11px] text-brand-text font-semibold mt-1.5">
                Now click the check-out date.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setTimelineSelection(null)}
              className="text-[10px] font-bold text-muted hover:text-main transition-all cursor-pointer border border-soft hover:border-gold-400 px-2 py-1 rounded-lg bg-page hover:bg-gold-100">
              Cancel
            </button>
          </div>
        )}

        <div className="flex-1 min-h-0 bg-card border border-soft rounded-xl overflow-hidden flex flex-col shadow-soft">
          <div className="flex-1 min-h-0 overflow-auto relative" ref={scrollRef} onMouseMove={handleGridMouseMove} onMouseLeave={handleGridMouseLeave}>
            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-paper-50">
                  <th className="sticky top-0 left-0 z-30 bg-paper-50 border-b border-r border-soft p-3 text-left text-[11px] text-muted font-bold uppercase tracking-wider w-[170px] min-w-[170px]">
                    Room / Venue
                  </th>
                  {daysList.map((dayInfo, i) => (
                    <th key={i} data-day={dayInfo.isoStr} className={'sticky top-0 z-10 border-b border-soft p-1 text-center w-[54px] min-w-[54px] ' + (dayInfo.isToday ? 'bg-gold-100' : 'bg-paper-50') + (dayInfo.monthLabel ? ' border-l-2 border-l-gold-300' : '') + (hoverDay === dayInfo.isoStr ? ' !bg-gold-200/70' : '')}>
                      <div className={'text-[9px] font-bold uppercase ' + (dayInfo.isToday ? 'text-gold-700' : 'text-muted/70')}>{dayInfo.weekday}</div>
                      <div className="mt-0.5 flex items-center justify-center gap-0.5">
                        {dayInfo.isToday ? (
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-gold-400 text-ink-900 text-[11px] font-bold">{dayInfo.dayNum}</span>
                        ) : (
                          <span className="text-[11px] font-semibold text-main">{dayInfo.dayNum}</span>
                        )}
                        {dayInfo.monthLabel && <span className="text-[8px] font-bold uppercase text-gold-800">{dayInfo.monthLabel}</span>}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rooms.map(room => (
                  <tr key={room.id} className="group border-b border-soft hover:bg-paper-50/50">
                    <td className="sticky left-0 z-20 bg-card border-r border-soft p-2.5 min-w-[170px] transition-colors group-hover:bg-gold-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gold-100 text-gold-700 font-display font-bold text-xs flex items-center justify-center shrink-0">
                          {room.room_number}
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-main block">{roomDisplayName(room)}</span>
                          <span className="text-[10px] text-gold-700 font-medium">₱{displayPriceFor(room).toLocaleString()}/night</span>
                        </div>
                      </div>
                    </td>
                    {buildRowCells(room.id, 'room')}
                  </tr>
                ))}

                <tr className="bg-gold-100/80">
                  <td colSpan={daysList.length + 1} className="sticky left-0 z-20 bg-gold-100/90 border-b border-soft p-2 text-[10px] font-bold uppercase tracking-widest text-gold-800 text-left">
                    Event venues
                  </td>
                </tr>

                {venues.map(venue => (
                  <tr key={venue.id} className="group border-b border-soft hover:bg-paper-50/50">
                    <td className="sticky left-0 z-20 bg-card border-r border-soft p-2.5 min-w-[170px] transition-colors group-hover:bg-gold-100">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gold-100 text-gold-700 font-display font-bold text-xs flex items-center justify-center shrink-0">
                          <span>♪</span>
                        </div>
                        <div>
                          <span className="text-xs font-semibold text-main block">{venue.name}</span>
                          <span className="text-[10px] text-gold-700 font-medium">₱{displayPriceFor(venue).toLocaleString()}/day</span>
                        </div>
                      </div>
                    </td>
                    {buildRowCells(venue.id, 'venue')}
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

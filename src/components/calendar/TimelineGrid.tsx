import React from 'react'
import { Plus } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { getBookingStyle, getVenueBookingStyle, roomDisplayName } from './bookingStyles'
import { normalizeVenueId, dateToString } from '../../utils/helpers'
import { TimelineCell } from './TimelineCell'
import { TimelineDayInfo } from './timelineDays'

export type { TimelineDayInfo }

/** The three hours a room can be sold for from the action bar. 22 hours is NOT here on
 *  purpose: it is the room's own price, i.e. an ordinary overnight stay, which the desk
 *  books from a date range. */
const SHORT_STAY_HOURS = [3, 6, 12]

interface TimelineGridProps {
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  daysList: TimelineDayInfo[]
  bookingByRoomAndDate: Record<string, Booking>
  timelineSelection: { roomId?: string; venueId?: string; checkIn: Date } | null
  groupSelection?: Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }> | null
  handleCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  /**
   * The booking actions live HERE, not in the toolbar (the owner's design): they
   * appear pinned to the cell that was picked, once dates are chosen. One day offers
   * a short stay; a range offers a normal or corporate booking.
   */
  onNewBooking: () => void
  onNewCorporate: () => void
  /** A single picked day: the hours the desk tapped on the bar (3, 6 or 12). */
  onNewShortStay: (hours: number) => void
  /** Clears whatever is picked — a single day AND a finished range. */
  onClearSelection: () => void
  /** Ids of short stays whose bought hours have run out — their blocks go red. */
  dueShortStayIds?: string[]
}

export const TimelineGrid = React.memo(
  function TimelineGrid({
    rooms,
    venues,
    bookings,
    daysList,
    bookingByRoomAndDate,
    timelineSelection,
    groupSelection,
    handleCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError,
    onNewBooking,
    onNewCorporate,
    onNewShortStay,
    onClearSelection,
    dueShortStayIds
  }: TimelineGridProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    // ── the action bar, pinned to the cell that was picked ────────────────────
    // The owner's complaint about the first build: it lined up with the DATE but sat
    // at the top of the grid, so on a room low down the list the buttons were nowhere
    // near the room. It now hangs off the picked cell itself — same row, just under
    // it — and lives INSIDE the scroller, so it travels with the grid when the desk
    // scrolls either way instead of drifting away from the selection.
    const barAnchor = React.useMemo(() => {
      if (timelineSelection) {
        const unitId = timelineSelection.roomId || timelineSelection.venueId
        return unitId ? { unitId, iso: dateToString(timelineSelection.checkIn) } : null
      }
      const first = groupSelection ? Object.entries(groupSelection)[0] : null
      return first ? { unitId: first[0], iso: dateToString(first[1].checkIn) } : null
    }, [timelineSelection, groupSelection])
    const [barPos, setBarPos] = React.useState<{ left: number; top: number } | null>(null)
    const placeBar = React.useCallback(() => {
      const scroller = scrollRef.current
      if (!barAnchor || !scroller) { setBarPos(null); return }
      const cell = scroller.querySelector('[data-unit="' + barAnchor.unitId + '"][data-day="' + barAnchor.iso + '"]') as HTMLElement | null
      if (!cell) { setBarPos(null); return }
      // ABOVE the picked row, by one bar height plus a small gap: on the row it covered
      // the very dates the desk had just chosen (the owner's catch), and flush against
      // the row above still read as touching it, so it clears both. For the first rows
      // there is no room above — the sticky day header is there — so it drops below the
      // row instead, which is the only place left on screen.
      const BAR_HEIGHT = 36
      const GAP = 18
      const above = cell.offsetTop - BAR_HEIGHT - GAP
      // The bar starts TWO DAY COLUMNS to the left of the picked day (the owner's ask):
      // it hangs off the picked cell but begins before it, so the pick still sits in
      // clear air to the right of the bar's own label. The column width is measured
      // from the day headers rather than hard-coded, and the shift is clamped at the
      // FIRST day column so a pick near the left edge (the window opens on today, so
      // this is common) can never slide the bar over the sticky room-name column.
      const dayHeaders = scroller.querySelectorAll('th[data-day]') as NodeListOf<HTMLElement>
      const dayWidth = dayHeaders.length > 1 ? dayHeaders[1].offsetLeft - dayHeaders[0].offsetLeft : 54
      const firstDayLeft = dayHeaders.length > 0 ? dayHeaders[0].offsetLeft : 0
      const left = Math.max(cell.offsetLeft - 2 * dayWidth, firstDayLeft)
      setBarPos({ left, top: above > 52 ? above : cell.offsetTop + cell.offsetHeight + GAP })
    }, [barAnchor])
    React.useEffect(() => { placeBar() }, [placeBar, daysList, timelineSelection, groupSelection])
    React.useEffect(() => {
      const scroller = scrollRef.current
      if (!scroller) return
      scroller.addEventListener('scroll', placeBar)
      window.addEventListener('resize', placeBar)
      return () => { scroller.removeEventListener('scroll', placeBar); window.removeEventListener('resize', placeBar) }
    }, [placeBar])

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
    //
    // A SHORT STAY never gets one: its stored check-out is the next day only because
    // the room is taken for the whole day (housekeeping included), but the guest leaves
    // the same day they arrived — the rose OUT mark on the following morning made a
    // 3-hour stay read as an overnight one (the owner's catch).
    const checkoutByUnitAndDate = React.useMemo(() => {
      const map: Record<string, Booking> = {}
      bookings.forEach(b => {
        if (b.stay_hours) return
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

    /** The room the bar is hanging off, when the pick is a room — its board prices are
     *  what the hour buttons quote, and a venue has none. */
    const barRoom = React.useMemo(
      () => (barAnchor ? rooms.find(r => r.id === barAnchor.unitId) || null : null),
      [barAnchor, rooms]
    )

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
            <TimelineCell key={dayInfo.isoStr} date={dayInfo.date} isoStr={dayInfo.isoStr} id={id} type={type} booking={booking} span={span} isCheckIn={false} isHighlighted={false} isContinuation={!!booking.check_in && booking.check_in < daysList[0].isoStr} isWeekend={dayInfo.isWeekend} isToday={dayInfo.isToday} isShortStayDue={!!dueShortStayIds && dueShortStayIds.indexOf(booking.id) !== -1} getBookingStyle={type === 'room' ? getBookingStyle : getVenueBookingStyle} onCellClick={handleCellClick} setSelectedExtendBooking={setSelectedExtendBooking} setExtendCheckoutDate={setExtendCheckoutDate} setExtendError={setExtendError} />
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
        <div className="flex-1 min-h-0 bg-card border border-soft rounded-xl overflow-hidden flex flex-col shadow-soft">
          <div className="flex-1 min-h-0 overflow-auto relative" ref={scrollRef} onMouseMove={handleGridMouseMove} onMouseLeave={handleGridMouseLeave}>
            {/* The action bar lives INSIDE the scroller, pinned just under the cell the
                desk picked, so it is beside both the room and the date and it travels
                with the grid. */}
            {barAnchor && barPos && (() => {
              const ranges = groupSelection ? Object.entries(groupSelection) : []
              const hasRange = ranges.length > 0
              const first = hasRange ? ranges[0][1] : null
              const from = first ? first.checkIn : timelineSelection?.checkIn
              const to = first ? first.checkOut : null
              const nights = from && to ? Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000)) : 0
              const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              return (
                <div style={{ '--bar-left': barPos.left + 'px', '--bar-top': barPos.top + 'px' } as React.CSSProperties}
                  className="absolute z-40 [left:var(--bar-left)] [top:var(--bar-top)] bg-card border border-gold-400 rounded-full pl-3 pr-1.5 py-1.5 shadow-softLg flex items-center gap-2 text-[11.5px] font-semibold text-main animate-in fade-in duration-150">
                  <span className="truncate max-w-[150px]" title={selectionName}>
                    <span className="font-display font-bold text-gold-700">{selectionName}</span>
                    <span className="text-muted"> · {from ? fmt(from) : ''}{to && nights > 0 ? ' → ' + fmt(to) : ''}</span>
                  </span>

                  {hasRange ? (
                    <>
                      <button type="button" onClick={onNewBooking}
                        className="shrink-0 inline-flex items-center gap-1 bg-gold-400 hover:bg-gold-600 text-ink-900 text-[11.5px] font-bold px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                        <Plus className="w-3 h-3" /> New booking
                      </button>
                      <button type="button" onClick={onNewCorporate}
                        className="shrink-0 text-[11.5px] font-bold text-gold-700 hover:bg-gold-100 border border-soft px-3 py-1.5 rounded-full transition-colors cursor-pointer">
                        Corporate
                      </button>
                    </>
                  ) : (
                    /* ONE DAY: the short-stay hours straightaway (the owner's ask) —
                       the old single `Short stay` button just opened the form, which
                       then asked the same question again. 22 hours is left out on
                       purpose: it IS the room's own price, so it is an ordinary
                       overnight stay and the desk gets it by picking a date range. */
                    barRoom ? (
                      SHORT_STAY_HOURS.map(h => {
                        const price = h === 3 ? barRoom.hour3_price : h === 6 ? barRoom.hour6_price : barRoom.hour12_price
                        const sellable = !!price && Number(price) > 0
                        return (
                          <button key={h} type="button" disabled={!sellable} onClick={() => onNewShortStay(h)}
                            title={sellable
                              ? 'A ' + h + '-hour stay takes ' + roomDisplayName(barRoom) + ' for this whole day'
                              : 'This room is not sold for ' + h + ' hours — set it in Settings → Room Rates'}
                            className="shrink-0 inline-flex items-center gap-1 text-[11.5px] font-bold text-gold-700 hover:bg-gold-100 border border-soft hover:border-gold-400 px-3 py-1.5 rounded-full transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-soft">
                            {h}h{sellable ? ' · ₱' + Number(price).toLocaleString() : ' · —'}
                          </button>
                        )
                      })
                    ) : (
                      /* A venue is never sold for hours — only a room is. */
                      <span className="shrink-0 text-[10.5px] text-muted">Tap the check-out day for a normal stay</span>
                    )
                  )}

                  {/* Clears whatever was picked — a single day AND a finished range,
                      which is why it goes through the caller: the first version only
                      cleared the single day, so Cancel did nothing on a range. */}
                  <button type="button" onClick={onClearSelection}
                    title="Clear the selection"
                    className="shrink-0 text-[10px] font-bold text-muted hover:text-main transition-all cursor-pointer border border-soft hover:border-gold-400 px-2 py-1 rounded-full bg-page hover:bg-gold-100">
                    Cancel
                  </button>
                </div>
              )
            })()}

            <table className="w-full table-fixed border-collapse">
              <thead>
                <tr className="bg-paper-50">
                  <th className="sticky top-0 left-0 z-30 bg-paper-50 border-b border-r border-soft p-3 text-left text-[11px] text-muted font-bold uppercase tracking-wider w-[170px] min-w-[170px]">
                    Room / Venue
                  </th>
                  {daysList.map((dayInfo, i) => (
                    <th key={i} data-day={dayInfo.isoStr} className={'sticky top-0 z-10 border-b border-soft p-1 text-center w-[96px] min-w-[96px] ' + (dayInfo.isToday ? 'bg-gold-100' : 'bg-paper-50') + (dayInfo.monthLabel ? ' border-l-2 border-l-gold-300' : '') + (hoverDay === dayInfo.isoStr ? ' !bg-gold-200/70' : '')}>
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

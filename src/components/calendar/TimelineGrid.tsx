import React from 'react'
import { Ban, FilePlus, Plus } from 'lucide-react'
import { Booking, PartnerDeal, Room, Venue } from '../../types/booking'
import { isBilledToAgency } from '../../utils/bookingMoney'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { getBookingStyle, roomDisplayName } from './bookingStyles'
import { dateToString } from '../../utils/helpers'
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
  daysList: TimelineDayInfo[]
  /** Who fills each half of each day, per unit id — see `timelineHalves`. */
  halves: Record<string, (Booking | null)[]>
  /** The saved agencies — a stay billed to one wears its name on the calendar. */
  partnerDeals: PartnerDeal[]
  timelineSelection: { roomId?: string; venueId?: string; checkIn: Date } | null
  groupSelection?: Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }> | null
  handleCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  /**
   * The booking actions live HERE, not in the toolbar (the owner's design): they
   * appear pinned to the cell that was picked, once dates are chosen. One day offers
   * the short-stay hours, a block and an old-booking log; a range offers a normal
   * booking, the same block and the same log. There is no Corporate button any more
   * (the owner, 2026-09): the agency is a quiet mark inside the booking form itself.
   */
  onNewBooking: () => void
  /** Blocks the picked dates — opens the small pane that asks only why. */
  onBlockDates: () => void
  /** Logs an old paper booking for the picked dates. */
  onLogOldBooking: () => void
  /** A single picked day: the hours the desk tapped on the bar (3, 6 or 12). */
  onNewShortStay: (hours: number) => void
  /** Clears whatever is picked — a single day AND a finished range. */
  onClearSelection: () => void
  /** Ids of short stays whose bought hours have run out — their blocks go red. */
  dueShortStayIds?: string[]
  /** The rooms have not arrived from the database yet. */
  loading?: boolean
}

// One room's row and one day's column, in one place: the header, the rows and the cells
// must agree on them, and the action bar measures the day column off the page.
// Narrower on a phone, where the room column was taking half the screen.
const UNIT_COL = 'w-[136px] min-w-[136px] sm:w-[184px] sm:min-w-[184px]'
// A day is two columns — its morning and its afternoon — each half as wide as the day, so
// a stay can begin at the middle of one day and end at the middle of another.
const HALF_COL = 'w-[52px] min-w-[52px]'
const UNIT_CELL = 'sticky left-0 z-20 bg-card border-r border-b border-soft px-3.5 h-12 transition-colors group-hover:bg-gold-100 ' + UNIT_COL

export const TimelineGrid = React.memo(
  function TimelineGrid({
    rooms,
    venues,
    daysList,
    halves,
    partnerDeals,
    timelineSelection,
    groupSelection,
    handleCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError,
    onNewBooking,
    onBlockDates,
    onLogOldBooking,
    onNewShortStay,
    onClearSelection,
    dueShortStayIds,
    loading = false
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
      // The bar and its gap add up to ONE ROW (48px), so above the pick it lies inside
      // the row over it and covers no more of the grid than that.
      const BAR_HEIGHT = 42
      const GAP = 6
      const above = cell.offsetTop - BAR_HEIGHT - GAP
      // The bar starts TWO DAY COLUMNS to the left of the picked day (the owner's ask):
      // it hangs off the picked cell but begins before it, so the pick still sits in
      // clear air to the right of the bar's own label. The column width is measured
      // from the day headers rather than hard-coded, and the shift is clamped at the
      // FIRST day column so a pick near the left edge (the window opens on today, so
      // this is common) can never slide the bar over the sticky room-name column.
      const dayHeaders = scroller.querySelectorAll('th[data-day]') as NodeListOf<HTMLElement>
      const dayWidth = dayHeaders.length > 1 ? dayHeaders[1].offsetLeft - dayHeaders[0].offsetLeft : 104
      const firstDayLeft = dayHeaders.length > 0 ? dayHeaders[0].offsetLeft : 0
      const left = Math.max(cell.offsetLeft - 2 * dayWidth, firstDayLeft)
      const headerHeight = (scroller.querySelector('thead') as HTMLElement | null)?.offsetHeight ?? 48
      setBarPos({ left, top: above > headerHeight + 4 ? above : cell.offsetTop + cell.offsetHeight + GAP })
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

    // The name an agency booking wears on its pill. `company_name` is the agency's name as it
    // was when the booking was made; the saved agency is the fallback for one that has none.
    const agencyNames = React.useMemo(() => {
      const names: Record<string, string> = {}
      partnerDeals.forEach(d => { names[d.id] = d.name })
      return names
    }, [partnerDeals])
    const agencyNameOf = (b: Booking) =>
      isBilledToAgency(b) ? ((b.company_name || '').trim() || agencyNames[b.partner_deal_id || ''] || '') : ''

    // A row is walked HALF a day at a time (see `timelineHalves`): a stay is one cell as
    // wide as the halves it fills, and what is left is free — a whole day where both halves
    // are, otherwise just the morning or the afternoon.
    const buildRowCells = (id: string, type: 'room' | 'venue') => {
      const cells: React.ReactNode[] = []
      const row = halves[id]
      const width = daysList.length * 2
      const at = (k: number) => (row ? row[k] : null)
      let k = 0
      while (k < width) {
        const dayInfo = daysList[k >> 1]
        const booking = at(k)
        if (booking) {
          let span = 1
          while (k + span < width && at(k + span)?.id === booking.id) span++
          cells.push(
            <TimelineCell key={k} date={dayInfo.date} isoStr={dayInfo.isoStr} id={id} type={type} booking={booking} span={span} closesDay={(k + span) % 2 === 0} isCheckIn={false} isContinuation={!!booking.check_in && booking.check_in < daysList[0].isoStr} isWeekend={dayInfo.isWeekend} isToday={dayInfo.isToday} isShortStayDue={!!dueShortStayIds && dueShortStayIds.indexOf(booking.id) !== -1} agencyName={agencyNameOf(booking)} getBookingStyle={getBookingStyle} onCellClick={handleCellClick} setSelectedExtendBooking={setSelectedExtendBooking} setExtendCheckoutDate={setExtendCheckoutDate} setExtendError={setExtendError} />
          )
          k += span
          continue
        }
        const morning = k % 2 === 0
        const wholeDay = morning && !at(k + 1)
        const halfOf = wholeDay ? undefined : morning ? 'left' : 'right'
        const isDraftCheckIn = timelineSelection && ((type === 'room' && timelineSelection.roomId === id) || (type === 'venue' && timelineSelection.venueId === id)) && dayInfo.time === checkInTime
        const range = selectionRanges[id]
        const highlight = range
          ? dayInfo.time === range.start ? 'start' : dayInfo.time === range.end ? 'end' : dayInfo.time > range.start && dayInfo.time < range.end ? 'mid' : null
          : null
        cells.push(
          <TimelineCell key={k} date={dayInfo.date} isoStr={dayInfo.isoStr} id={id} type={type} booking={null} span={wholeDay ? 2 : 1} halfOf={halfOf} closesDay={!morning || wholeDay} isCheckIn={!!isDraftCheckIn} highlight={highlight} isWeekend={dayInfo.isWeekend} isToday={dayInfo.isToday} getBookingStyle={getBookingStyle} onCellClick={handleCellClick} setSelectedExtendBooking={setSelectedExtendBooking} setExtendCheckoutDate={setExtendCheckoutDate} setExtendError={setExtendError} />
        )
        k += wholeDay ? 2 : 1
      }
      return cells
    }

    // ONE PRICE (card k128): there is only one figure per room, so the calendar
    // shows it plainly — no crossed-out second price standing beside it, which
    // only invited staff to read the old regular figure as the real one.
    const displayPriceFor = (unit: Room | Venue) => getEffectiveNightlyPrice(unit.base_price, unit.promo_price)

    return (
      // The grid is the third line of the calendar's one sheet (see `CalendarTab`), so it
      // draws no card of its own: it is the scroller and nothing round it.
      <div className="flex-1 min-h-0 min-w-0 overflow-auto relative" ref={scrollRef} onMouseMove={handleGridMouseMove} onMouseLeave={handleGridMouseLeave}>
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
          // A finished range has no single picked cell, so its name comes from the range.
          const rangeUnit = ranges.length === 1 ? ranges[0][0] : ''
          const barName = selectionName || (ranges.length > 1
            ? ranges.length + ' units'
            : rangeUnit
              ? (rooms.find(r => r.id === rangeUnit) ? roomDisplayName(rooms.find(r => r.id === rangeUnit)) : venues.find(v => v.id === rangeUnit)?.name || '')
              : '')
          return (
            <div style={{ '--bar-left': barPos.left + 'px', '--bar-top': barPos.top + 'px' } as React.CSSProperties}
              className="absolute z-40 [left:var(--bar-left)] [top:var(--bar-top)] bg-card border border-gold-400 rounded-full pl-4 pr-1.5 py-1.5 shadow-softLg flex items-center gap-2 text-[13px] font-semibold text-main animate-in fade-in duration-150">
              {/* When the bar is squeezed against the edge of the screen it is the room's
                  name that is cut, never the dates — they are what was just picked. */}
              <span className="flex min-w-0 items-baseline gap-1" title={barName}>
                <span className="truncate max-w-[170px] font-display font-bold text-brand-text">{barName}</span>
                <span className="shrink-0 text-muted">· {from ? fmt(from) : ''}{to && nights > 0 ? ' → ' + fmt(to) : ''}</span>
              </span>

              {hasRange ? (
                <>
                  <button type="button" onClick={onNewBooking}
                    className="shrink-0 inline-flex items-center gap-1 h-7 px-3.5 rounded-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-[13px] font-bold transition-colors active:scale-[0.98] cursor-pointer">
                    <Plus className="w-3.5 h-3.5" /> New booking
                  </button>
                </>
              ) : (
                /* ONE DAY: the short-stay hours straightaway (the owner's ask) —
                   the old single `Short stay` button just opened the form, which
                   then asked the same question again. 22 hours is left out on
                   purpose: it IS the room's own price, so it is an ordinary
                   overnight stay and the desk gets it by picking a date range.
                   The buttons carry the HOURS ONLY (the owner's ruling, 2026-09):
                   the price of the hours is on the room and in the tooltip, so the
                   bar stays short. */
                barRoom ? (
                  SHORT_STAY_HOURS.map(h => {
                    const price = h === 3 ? barRoom.hour3_price : h === 6 ? barRoom.hour6_price : barRoom.hour12_price
                    const sellable = !!price && Number(price) > 0
                    return (
                      <button key={h} type="button" disabled={!sellable} onClick={() => onNewShortStay(h)}
                        title={sellable
                          ? 'A ' + h + '-hour stay — ₱' + Number(price).toLocaleString() + ' — takes ' + roomDisplayName(barRoom) + ' for this whole day'
                          : 'This room is not sold for ' + h + ' hours — set it in Settings → Rooms & prices'}
                        className="shrink-0 inline-flex items-center gap-1 h-7 px-3 rounded-full border border-soft text-[13px] font-bold text-brand-text hover:bg-gold-100 hover:border-gold-400 transition-colors active:scale-[0.98] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-soft">
                        {sellable ? h + 'h' : h + 'h · —'}
                      </button>
                    )
                  })
                ) : (
                  /* A venue is never sold for hours — only a room is. */
                  <span className="shrink-0 text-[12px] font-medium text-muted">Tap the check-out day for a normal stay</span>
                )
              )}

              {/* Block the dates that are picked — ONE icon, the same on a single day
                  and on a range (the owner's ruling, 2026-09: the words were noise).
                  It opens a small pane that only asks why; the room and dates come
                  from the pick. Blocking is no longer a mode of the booking form. */}
              <button type="button" onClick={onBlockDates}
                title="Block these dates — cleaning, maintenance or owner use"
                aria-label="Block these dates"
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-gold-400 text-brand-text hover:bg-gold-100 transition-colors active:scale-95 cursor-pointer">
                <Ban className="w-3.5 h-3.5" />
              </button>

              {/* Log old booking — **now its only entrance** (the owner, 2026-09-29:
                  the toolbar's copy was removed as a duplicate). It is offered by the
                  same pick that fills its dates in, beside the other things the desk
                  can do with those dates. */}
              <button type="button" onClick={onLogOldBooking}
                title="Log an old paper booking for these dates"
                aria-label="Log old booking"
                className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full border border-soft text-muted hover:text-main hover:border-gold-400 transition-colors active:scale-95 cursor-pointer">
                <FilePlus className="w-3.5 h-3.5" />
              </button>

              {/* Clears whatever was picked — a single day AND a finished range,
                  which is why it goes through the caller: the first version only
                  cleared the single day, so Cancel did nothing on a range. */}
              <button type="button" onClick={onClearSelection}
                title="Clear the selection"
                className="shrink-0 h-7 px-3 rounded-full text-[13px] font-semibold text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
                Cancel
              </button>
            </div>
          )
        })()}

        {/* Every cell draws its own rules (`border-separate`). In a collapsed table the
            rules belong to the table, and the pinned header and room column — which
            paint over it — lost theirs on an ordinary screen. */}
        <table className="w-full table-fixed border-separate border-spacing-0">
          {/* The widths live on the columns: the day headers span two of them. */}
          <colgroup>
            <col className={UNIT_COL} />
            {daysList.map((dayInfo, i) => (
              <React.Fragment key={i}>
                <col className={HALF_COL} />
                <col className={HALF_COL} />
              </React.Fragment>
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className={'sticky top-0 left-0 z-30 bg-card border-b border-r border-soft px-3.5 text-left align-bottom pb-2 text-[13px] font-medium text-muted ' + UNIT_COL}>
                Room
              </th>
              {daysList.map((dayInfo, i) => (
                <th key={i} colSpan={2} data-day={dayInfo.isoStr} className={'sticky top-0 z-10 border-b border-soft px-1 py-1.5 text-center ' + (dayInfo.isToday ? 'bg-gold-100' : 'bg-card') + (dayInfo.monthLabel ? ' border-l-2 border-l-gold-300' : '') + (hoverDay === dayInfo.isoStr ? ' !bg-gold-200/70' : '')}>
                  <div className={'text-[11px] font-semibold leading-none ' + (dayInfo.isToday ? 'text-brand-text' : 'text-muted')}>{dayInfo.weekday}</div>
                  <div className="mt-1 flex h-6 items-center justify-center gap-1">
                    {dayInfo.isToday ? (
                      <span className="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-gold-400 text-ink-900 text-[13px] font-bold tabular-nums">{dayInfo.dayNum}</span>
                    ) : (
                      <span className="text-[13px] font-semibold tabular-nums text-main">{dayInfo.dayNum}</span>
                    )}
                    {dayInfo.monthLabel && <span className="text-[11px] font-bold text-brand-text">{dayInfo.monthLabel}</span>}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* The grid's own shape while the rooms are on their way, so nothing jumps
                when they land. */}
            {loading && rooms.length === 0 && [0, 1, 2, 3, 4, 5, 6, 7].map(i => (
              <tr key={'wait-' + i} aria-hidden="true">
                <td className={UNIT_CELL}>
                  <span className="block h-3 w-28 rounded bg-softbg animate-pulse" />
                  <span className="mt-1.5 block h-2.5 w-16 rounded bg-softbg animate-pulse" />
                </td>
                <td colSpan={daysList.length * 2} className="h-12 border-b border-soft" />
              </tr>
            ))}

            {/* A room is its NUMBER first — it is what the desk says aloud — then its
                kind and its price. No tile behind the number: the row is the box. */}
            {rooms.map(room => (
              <tr key={room.id} className="group hover:bg-paper-50/50">
                <td className={UNIT_CELL}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 shrink-0 text-center font-display text-[15px] font-bold tabular-nums text-main">{room.room_number}</span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-semibold leading-4 text-main">{roomDisplayName(room)}</span>
                      <span className="block text-[12px] leading-4 tabular-nums text-muted">₱{displayPriceFor(room).toLocaleString()}/night</span>
                    </span>
                  </div>
                </td>
                {buildRowCells(room.id, 'room')}
              </tr>
            ))}

            {venues.length > 0 && (
              <tr>
                <td colSpan={daysList.length * 2 + 1} className="border-b border-soft bg-paper-50 p-0">
                  <span className="sticky left-0 inline-flex h-8 items-center px-3.5 text-[13px] font-semibold text-main">Event venues</span>
                </td>
              </tr>
            )}

            {venues.map(venue => (
              <tr key={venue.id} className="group hover:bg-paper-50/50">
                <td className={UNIT_CELL}>
                  <span className="block truncate text-[13px] font-semibold leading-4 text-main">{venue.name}</span>
                  <span className="block text-[12px] leading-4 tabular-nums text-muted">₱{displayPriceFor(venue).toLocaleString()}/day</span>
                </td>
                {buildRowCells(venue.id, 'venue')}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }
)

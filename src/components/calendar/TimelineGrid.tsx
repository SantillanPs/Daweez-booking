import React from 'react'
import { Ban, Coffee, FilePlus, LogIn, LogOut, Plus } from 'lucide-react'
import { Booking, PartnerDeal, Room, Venue } from '../../types/booking'
import { isBilledToAgency } from '../../utils/bookingMoney'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { dueToday, getBookingStyle, roomDisplayName } from './bookingStyles'
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
  /** The guest to ask about breakfast this morning, per room id — only the rooms that have
   *  breakfast today and have not been asked yet. */
  breakfastToAsk?: Record<string, Booking>
  /** Opens the breakfast picker for that guest. */
  onBreakfast?: (booking: Booking) => void
  /** The guest whose breakfast the kitchen has cooked and the desk has not yet brought, per room id. */
  breakfastReady?: Record<string, Booking>
  /** The desk has brought that breakfast to the room. */
  onBreakfastServed?: (booking: Booking) => void
}

// One room's row and one day's column, in one place: the header, the rows and the cells
// must agree on them, and the action bar measures the day column off the page.
// Narrower on a phone, where the room column was taking half the screen.
const UNIT_COL = 'w-[136px] min-w-[136px] sm:w-[184px] sm:min-w-[184px]'
// A day is two columns — its morning and its afternoon — each half as wide as the day, so
// a stay can begin at the middle of one day and end at the middle of another.
const HALF_COL = 'w-[52px] min-w-[52px]'
const UNIT_CELL_BASE = 'sticky left-0 z-20 border-r border-b border-soft pr-3.5 h-12 transition-colors group-hover:bg-gold-100 ' + UNIT_COL
const UNIT_CELL = UNIT_CELL_BASE + ' bg-card pl-3.5'
// **A room with a guest in it wears a bar down its left edge** — green since 2026-10-09,
// when the checked-in pill turned green; it was gold (Sebastian, 2026-10-08:
// the staff could not tell from the room column which rooms were occupied). The bar takes
// the place of 5px of the padding, so the room numbers stay in one line down the column.
const UNIT_CELL_OCCUPIED = UNIT_CELL_BASE + ' bg-paper-50 pl-[9px] border-l-[5px] border-l-emerald-600'

function DayCount({ n, title, className, children }: { n: number; title: string; className: string; children: React.ReactNode }) {
  return (
    <span title={n + ' ' + title} className={'flex h-5 items-center justify-center gap-0.5 ' + className}>
      {n > 0 && <>{children}{n}</>}
    </span>
  )
}

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
    loading = false,
    breakfastToAsk,
    onBreakfast,
    breakfastReady,
    onBreakfastServed
  }: TimelineGridProps) {
    const scrollRef = React.useRef<HTMLDivElement>(null)

    // ── the action bar, pinned to the cell that was picked ────────────────────
    // The owner's complaint about the first build: it lined up with the DATE but sat
    // at the top of the grid, so on a room low down the list the buttons were nowhere
    // near the room. It now hangs off the picked cell itself — same row, just above
    // it — and lives INSIDE the scroller, so it travels with the grid when the desk
    // scrolls either way instead of drifting away from the selection.
    // `outIso` is the check-out day once a range is picked (empty while only the first day is).
    const barAnchor = React.useMemo(() => {
      if (timelineSelection) {
        const unitId = timelineSelection.roomId || timelineSelection.venueId
        return unitId ? { unitId, iso: dateToString(timelineSelection.checkIn), outIso: '' } : null
      }
      const first = groupSelection ? Object.entries(groupSelection)[0] : null
      return first ? { unitId: first[0], iso: dateToString(first[1].checkIn), outIso: dateToString(first[1].checkOut) } : null
    }, [timelineSelection, groupSelection])
    // Where the bar goes: the middle of the picked dates, its row, how wide it is, and how far
    // left and right it may reach. The width is the bar's own, read back once it is on screen.
    const [barPos, setBarPos] = React.useState<{ center: number; top: number; width: number; minLeft: number; maxRight: number } | null>(null)
    const barRef = React.useRef<HTMLDivElement>(null)
    const placeBar = React.useCallback(() => {
      const scroller = scrollRef.current
      if (!barAnchor || !scroller) { setBarPos(null); return }
      const cellAt = (iso: string) => scroller.querySelector('[data-unit="' + barAnchor.unitId + '"][data-day="' + iso + '"]') as HTMLTableCellElement | null
      const cell = cellAt(barAnchor.iso)
      if (!cell) { setBarPos(null); return }
      const outCell = barAnchor.outIso ? cellAt(barAnchor.outIso) : null
      // ABOVE the picked row, by one bar height plus a small gap: on the row it covered
      // the very dates the desk had just chosen (the owner's catch), and flush against
      // the row above still read as touching it, so it clears both.
      // **Always above, never below** (Sebastian, 2026-10-06). It used to drop below the
      // row for the first rooms, where the sticky day header is what lies above, and then
      // sat on top of the very rooms the desk was about to pick the next day from. Now it
      // goes over the header there instead (it is drawn above it), kept inside the grid's
      // top edge so it is never cut off.
      // The bar and its gap add up to ONE ROW (48px), so above the pick it lies inside
      // the row over it and covers no more of the grid than that.
      const BAR_HEIGHT = 42
      const GAP = 6
      const above = Math.max(0, cell.offsetTop - BAR_HEIGHT - GAP)
      // **Centred on the picked dates** (Sebastian, 2026-10-06). It began two day columns to
      // the left of the first pick; it now sits in the middle of the stay, which runs from
      // the afternoon of the first day to the morning of the last — the span that is
      // highlighted (a day that is still whole is `colSpan` 2, and only its half belongs to
      // the stay). While only the first day is picked, it is centred on that day's mark.
      const startX = cell.offsetLeft + (cell.colSpan > 1 ? cell.offsetWidth / 2 : 0)
      const endX = outCell
        ? outCell.offsetLeft + (outCell.colSpan > 1 ? outCell.offsetWidth / 2 : outCell.offsetWidth)
        : cell.offsetLeft + cell.offsetWidth
      // It may not slide left over the sticky room names, nor off the right end of the grid.
      const dayHeaders = scroller.querySelectorAll('th[data-day]') as NodeListOf<HTMLElement>
      const minLeft = dayHeaders.length > 0 ? dayHeaders[0].offsetLeft : 0
      const table = scroller.querySelector('table') as HTMLElement | null
      const next = {
        center: Math.round((startX + endX) / 2),
        top: above,
        width: barRef.current?.offsetWidth ?? 0,
        minLeft,
        maxRight: table ? table.offsetWidth : scroller.scrollWidth,
      }
      setBarPos(prev => (prev && prev.center === next.center && prev.top === next.top && prev.width === next.width && prev.minLeft === next.minLeft && prev.maxRight === next.maxRight ? prev : next))
    }, [barAnchor])
    // After every render, before the screen is painted: the bar's own width is only known
    // once it is on screen, and it changes when it goes from one day to a range. Nothing
    // is set when nothing moved, so this settles at once.
    React.useLayoutEffect(() => { placeBar() })
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
    // Read off the rows already on screen: every stay that touches a day shown is in one.
    // `occupied` is the rooms and venues with a guest in them now; the counts are, per day,
    // how many are STILL to arrive and still to leave — they go down as the desk checks
    // guests in and out (Sebastian, 2026-10-08: "will arrive", "will leave").
    const todayIso = dateToString(new Date())
    const { occupied, counts } = React.useMemo(() => {
      const occupied: Record<string, boolean> = {}
      const counts: Record<string, { arrive: number; leave: number }> = {}
      const seen: Record<string, boolean> = {}
      const at = (iso: string) => counts[iso] || (counts[iso] = { arrive: 0, leave: 0 })
      Object.entries(halves).forEach(([unitId, row]) => row.forEach(b => {
        if (!b || b.status === 'blocked' || seen[b.id]) return
        seen[b.id] = true
        if (b.actual_check_in && !b.actual_check_out) occupied[unitId] = true
        // A guest who is late is still to come, or still to go: they count under today.
        const leaves = b.stay_hours ? b.check_in : b.check_out
        if (!b.actual_check_in) at(b.check_in < todayIso ? todayIso : b.check_in).arrive++
        if (!b.actual_check_out) at(leaves < todayIso ? todayIso : leaves).leave++
      }))
      return { occupied, counts }
    }, [halves, todayIso])

    const agencyNameOf = (b: Booking) =>
      isBilledToAgency(b) ? ((b.company_name || '').trim() || agencyNames[b.partner_deal_id || ''] || '') : ''

    // A row is walked HALF a day at a time (see `timelineHalves`): a stay is one cell as
    // wide as the halves it fills, and what is left is free — a whole day where both halves
    // are, otherwise just the morning or the afternoon.
    const buildRowCells = (id: string, type: 'room' | 'venue') => {
      const cells: React.ReactNode[] = []
      const row = halves[id]
      const width = daysList.length * 2
      const todayAt = daysList.findIndex(d => d.isToday)
      const at = (k: number) => (row ? row[k] : null)
      let k = 0
      while (k < width) {
        const dayInfo = daysList[k >> 1]
        const booking = at(k)
        if (booking) {
          let span = 1
          while (k + span < width && at(k + span)?.id === booking.id) span++
          // The part of this stay that lies on today, in halves from its own left edge.
          const todayFrom = Math.max(k, todayAt * 2)
          const todayTo = todayAt < 0 ? 0 : Math.min(k + span, todayAt * 2 + 2)
          cells.push(
            <TimelineCell key={k} date={dayInfo.date} isoStr={dayInfo.isoStr} id={id} type={type} booking={booking} span={span} closesDay={(k + span) % 2 === 0} isCheckIn={false} isContinuation={!!booking.check_in && booking.check_in < daysList[0].isoStr} isWeekend={dayInfo.isWeekend} isToday={dayInfo.isToday} isShortStayDue={!!dueShortStayIds && dueShortStayIds.indexOf(booking.id) !== -1} agencyName={agencyNameOf(booking)} due={dueToday(booking, todayIso)} todayFrom={todayTo > todayFrom ? todayFrom - k : -1} todayHalves={Math.max(0, todayTo - todayFrom)} getBookingStyle={getBookingStyle} onCellClick={handleCellClick} setSelectedExtendBooking={setSelectedExtendBooking} setExtendCheckoutDate={setExtendCheckoutDate} setExtendError={setExtendError} />
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
      <div data-grid className="flex-1 min-h-0 min-w-0 overflow-auto relative" ref={scrollRef} onMouseMove={handleGridMouseMove} onMouseLeave={handleGridMouseLeave}>
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
          // Centred on the dates, kept between the room names and the end of the grid.
          const left = Math.min(
            Math.max(barPos.center - barPos.width / 2, barPos.minLeft),
            Math.max(barPos.minLeft, barPos.maxRight - barPos.width),
          )
          return (
            <div ref={barRef} style={{ '--bar-left': left + 'px', '--bar-top': barPos.top + 'px' } as React.CSSProperties}
              className="absolute z-40 w-max [left:var(--bar-left)] [top:var(--bar-top)] bg-card border border-gold-400 rounded-full pl-4 pr-1.5 py-1.5 shadow-softLg flex items-center gap-2 text-[13px] font-semibold text-main animate-in fade-in duration-150">
              {/* `w-max`: the bar is always as wide as what is in it. Left to the browser, an
                  absolute box sitting far to the right of the visible grid is squeezed to
                  the little room that is left, and the buttons ended up ON the dates
                  (Sebastian, 2026-10-06). */}
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
                <th key={i} colSpan={2} data-day={dayInfo.isoStr} className={'sticky top-0 z-10 border-b border-soft px-0 pt-1.5 pb-0 text-center ' + (dayInfo.isToday ? 'bg-gold-100' : 'bg-card') + (dayInfo.monthLabel ? ' border-l-2 border-l-gold-300' : '') + (hoverDay === dayInfo.isoStr ? ' !bg-gold-200/70' : '')}>
                  <div className="flex h-6 items-center justify-center gap-1.5">
                    <span className={'text-[12px] font-semibold leading-none ' + (dayInfo.isToday ? 'text-brand-text' : 'text-muted')}>{dayInfo.weekday}</span>
                    {dayInfo.isToday ? (
                      <span className="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-full bg-gold-400 text-ink-900 text-[13px] font-bold tabular-nums">{dayInfo.dayNum}</span>
                    ) : (
                      <span className="text-[13px] font-semibold tabular-nums text-main">{dayInfo.dayNum}</span>
                    )}
                    {dayInfo.monthLabel && <span className="text-[11px] font-bold text-brand-text">{dayInfo.monthLabel}</span>}
                  </div>
                  {/* How many will leave and how many will arrive that day, **each over its own
                      half of the day** (Sebastian, 2026-10-08): guests leave in the morning and
                      arrive in the afternoon, so the number stands right above the pills it
                      counts. Leaving is charcoal and arriving green, like the edges of the
                      pills, and the arriving arrow is turned round so the two mirror each
                      other. A zero is left blank. */}
                  <div className="mt-1 grid grid-cols-2 border-t border-soft text-[12px] font-bold leading-none tabular-nums">
                    <DayCount n={counts[dayInfo.isoStr]?.leave || 0} title="will leave" className="border-r border-dashed border-soft text-ink-900"><LogOut className="w-3 h-3" /></DayCount>
                    <DayCount n={counts[dayInfo.isoStr]?.arrive || 0} title="will arrive" className="text-emerald-700"><LogIn className="w-3 h-3 -scale-x-100" /></DayCount>
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
                <td className={occupied[room.id] ? UNIT_CELL_OCCUPIED : UNIT_CELL}>
                  <div className="flex items-center gap-2.5">
                    <span className="w-6 shrink-0 text-center font-display text-[15px] font-bold tabular-nums text-main">{room.room_number}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-4 text-main">{roomDisplayName(room)}</span>
                      <span className="block text-[12px] leading-4 tabular-nums text-muted">₱{displayPriceFor(room).toLocaleString()}/night</span>
                    </span>
                    {/* **The breakfast cup is on the ROOM, and it is a button** (Sebastian,
                        2026-10-08). It began on the pill, where it was too small to tap and
                        did not fit any bigger. Here it can be, and a guest who has overstayed
                        — no pill on the calendar — still has a room to wear it. It hops
                        because it is a job, not a label (*"it looks more of a status than a
                        'this room needs breakfast'"*), and it is gone once the room is asked. */}
                    {breakfastToAsk?.[room.id] && (
                      <button type="button" onClick={() => onBreakfast?.(breakfastToAsk[room.id])}
                        title={'Ask room ' + room.room_number + ' what they want for breakfast'}
                        aria-label={'Ask room ' + room.room_number + ' about breakfast'}
                        className="-mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-main transition-colors hover:bg-gold-200 active:scale-95 cursor-pointer">
                        <Coffee className="w-5 h-5 animate-hop" />
                      </button>
                    )}
                    {/* The same cup in green: the kitchen has cooked it. One tap once it
                        is brought to the room, and it is gone. */}
                    {breakfastReady?.[room.id] && (
                      <button type="button" onClick={() => onBreakfastServed?.(breakfastReady[room.id])}
                        title={'Breakfast is ready for room ' + room.room_number + '. Tap once it is served.'}
                        aria-label={'Breakfast is ready for room ' + room.room_number + '. Tap once it is served.'}
                        className="-mr-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200 active:scale-95 cursor-pointer">
                        <Coffee className="w-5 h-5 animate-hop" />
                      </button>
                    )}
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
                <td className={occupied[venue.id] ? UNIT_CELL_OCCUPIED : UNIT_CELL}>
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

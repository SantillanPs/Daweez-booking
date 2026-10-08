import React from 'react'
import { Building2, Check } from 'lucide-react'
import { Booking } from '../../types/booking'
import { pillInitials, pillMoney } from './bookingStyles'
import { clockLabel, shortStayEnd } from '../../utils/shortStay'
import { blockReason, isOpenEnded } from '../../utils/openBlock'

export interface TimelineCellProps {
  date: Date
  isoStr: string
  id: string
  type: 'room' | 'venue'
  booking: Booking | null
  /** How many HALF days wide the cell is — a day has two halves, the morning and the
   *  afternoon (see `timelineHalves`). A stay is as wide as the halves it fills. */
  span: number
  /** A free cell that is only the morning (`left`) or the afternoon (`right`) of its day,
   *  because a stay fills the other half. Left out when the cell is the whole day. */
  halfOf?: 'left' | 'right'
  /** The cell's right edge is the end of a day, so it draws that day's rule. A cell that
   *  ends at noon does not: the day is not over there. */
  closesDay: boolean
  isCheckIn: boolean
  /** Part of the range that was just picked: its first day (from the afternoon), the days
   *  between, or its last day (until the morning). */
  highlight?: 'start' | 'mid' | 'end' | null
  /** The stay began before the first day on screen (the grid opens at today,
   *  card k154), so the pill is cut off at the left edge and says so. */
  isContinuation?: boolean
  isWeekend: boolean
  isToday: boolean
  /** A short stay whose bought hours have run out — the block goes red, because the
   *  room is due for cleaning and the panel pops itself open (the owner's ruling). */
  isShortStayDue?: boolean
  /** The agency that is paying for the stay, when there is one. The pill carries its name
   *  where the guest's would be (Sebastian, 2026-10-06). */
  agencyName?: string
  /** The desk still has to check this guest in, or out, today — the pill's edge says so:
   *  green on the left for an arrival, charcoal on the right for a departure. */
  due?: 'in' | 'out' | null
  /** Where today lies under this stay: the half it starts at, counted from the stay's own
   *  left edge (-1 when the stay is not on today), and how many halves of it. */
  todayFrom?: number
  todayHalves?: number
  getBookingStyle: (b: Booking) => string
  onCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
}

/** `2026-10-08` as the desk says it: `Thu 8 Oct`. Read as a local day — the hotel is UTC+8. */
const niceDay = (iso: string): string => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  const day = new Date(y, m - 1, d)
  return day.toLocaleDateString('en-US', { weekday: 'short' }) + ' ' + d + ' ' + day.toLocaleDateString('en-US', { month: 'short' })
}

/** `3 nights`, counted between two days. A short stay ends the day it begins and has none. */
const nightsWord = (from: string, to: string): string => {
  const at = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  const n = Math.round((at(to) - at(from)) / 86400000)
  return n > 0 ? n + (n === 1 ? ' night' : ' nights') : ''
}

/** The mark of a guest who has checked out: a tick in a small charcoal circle. */
function LeftTick({ className }: { className: string }) {
  return (
    <span className={'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink-600 text-white ' + className} aria-hidden="true">
      <Check className="w-2.5 h-2.5" strokeWidth={3} />
    </span>
  )
}

// Optimized, memoized timeline cell. Tooltip visibility lives in this cell
// only, so hovering a booking never re-renders the whole grid.
export const TimelineCell = React.memo(
  function TimelineCell({
    date,
    isoStr,
    id,
    type,
    booking,
    span,
    halfOf,
    closesDay,
    isCheckIn,
    highlight,
    isContinuation,
    isWeekend,
    isToday,
    isShortStayDue,
    agencyName,
    due,
    todayFrom = -1,
    todayHalves = 0,
    getBookingStyle,
    onCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError
  }: TimelineCellProps) {
    const [showTooltip, setShowTooltip] = React.useState(false)
    // **The hover card opens downwards on the top rows** (Sebastian, 2026-10-08). It
    // always opened above the pill, and on the first few rooms that put it under the
    // calendar's top line, cut off. It now looks at how much grid there is above the pill
    // and drops below it when there is not enough.
    const [tipBelow, setTipBelow] = React.useState(false)
    const TIP_NEEDS = 190
    const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      }
    }, [])

    // The rule on the cell's right is the end of a DAY. A stay that ends at noon, or a
    // free morning, ends mid-day and draws none, so the day is never cut in two by a line.
    const dayRule = closesDay ? ' border-r' : ''

    if (booking) {
      // A block shows WHY the dates are closed (card k91) — `Cleaning`, `Owner use` —
      // not the placeholder name every block is stored under.
      const isBlock = booking.status === 'blocked'
      const openEnded = isOpenEnded(booking)
      // An agency booking is read by whose bill it is: the agency's name, not the name of
      // the person who made the reservation (they are on the hover card and in the panel).
      const pillName = isBlock ? blockReason(booking) + (openEnded ? ' · until further notice' : '') : (agencyName || booking.guest_name)
      const left = !!booking.actual_check_out
      const money = pillMoney(booking)
      // A short stay whose guest is in the room shows THE TIME THE ROOM IS FREE — never
      // a countdown (the owner's ruling) — unless money is still owed, which comes first.
      const freeAt = shortStayEnd(booking.actual_check_in, Number(booking.stay_hours || 0))
      const showClock = !!freeAt && !booking.actual_check_out && money.text === 'Paid'
      const narrow = span < 2
      return (
        <td
          colSpan={span}
          data-day={isoStr}
          className={'p-0 h-12 border-b border-soft relative align-middle' + dayRule}
          onMouseEnter={e => {
            const cell = e.currentTarget
            const grid = cell.closest('[data-grid]')
            const head = grid?.querySelector('thead')
            if (grid) setTipBelow(cell.getBoundingClientRect().top - grid.getBoundingClientRect().top - (head?.getBoundingClientRect().height || 0) < TIP_NEEDS)
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
            hoverTimeoutRef.current = setTimeout(() => setShowTooltip(true), 500)
          }}
          onMouseLeave={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
            setShowTooltip(false)
          }}
        >
          {/* **Today's column runs on behind the pill** (Sebastian, 2026-10-08): a stay's cell
              is one box across all its days, so it used to wipe the highlight out wherever
              a booking sat on today. It is drawn again here, under the pill, on just the
              part of the stay that is today. */}
          {todayFrom >= 0 && (
            <div aria-hidden="true"
              style={{ '--today-left': (todayFrom / span) * 100 + '%', '--today-width': (todayHalves / span) * 100 + '%' } as React.CSSProperties}
              className="absolute inset-y-0 bg-gold-100/50 [left:var(--today-left)] [width:var(--today-width)]" />
          )}
          <div
            onClick={e => {
              e.stopPropagation()
              // A block opens its panel too — that is where it is ended or removed.
              setSelectedExtendBooking(booking)
              setExtendCheckoutDate(openEnded ? '' : booking.check_out)
              setExtendError('')
            }}
            title={pillName}
            className={'relative overflow-hidden mx-0.5 h-10 rounded-md border cursor-pointer select-none transition hover:brightness-95 flex flex-col justify-center ' +
              (narrow ? 'items-center px-0 ' : 'px-2 ') +
              (isShortStayDue ? 'bg-danger-100 border-danger-400 text-danger-600' : getBookingStyle(booking)) +
              (due === 'in' ? ' border-l-[5px] border-l-emerald-700' : due === 'out' ? ' border-r-[5px] border-r-ink-900' : '')}
          >
            {/* SIGNS, NOT WORDS (Sebastian, 2026-10-08: "use visual design, not so much text
                heavy"). The pill's edge is what the desk has to do today and the
                building is an agency; what each means is in the calendar's guide
                (`CalendarGuide`), not written on the pill. No deposit is the exception: it
                is back in words, and blue initials where there is no room for them. */}
            {/* HALF A DAY is too narrow to read a name or an amount — it is the stay's last
                morning, or its first afternoon at the edge of the screen — so it wears the
                guest's INITIALS (the staff wanted to see who is leaving; it used to say only
                IN). The full name is on the hover card and in the panel. */}
            {narrow ? (
              <span className={'relative font-display text-[13px] font-bold leading-4' + (money.noDeposit && !isBlock ? ' text-blue-700' : '')}>
                {isBlock ? '' : pillInitials(pillName)}
                {left && !isBlock && <LeftTick className="absolute -right-2.5 -bottom-1.5" />}
              </span>
            ) : (<>
            {/* TWO LINES, both in words (the staff's feedback, 2026-10-04): who is in the
                room and whether they are IN or OUT, then what is still to pay. The desk
                reads the calendar without opening a booking. A block has one line — why
                the dates are closed. 13px and 12px: the pills are what the desk reads all
                day, and at 11px they were the smallest words on the screen. */}
            <span className="flex items-center gap-1 min-w-0 text-[13px] font-bold leading-4">
              {agencyName && !isBlock && <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 truncate">
                {isContinuation && <span className="opacity-70" title={'Already staying — arrived ' + booking.check_in}>‹ </span>}
                {pillName}
              </span>
              {/* No IN tag any more: the green pill and the green bar on the room say it. A
                  guest who has left keeps a tick beside the name. */}
              {left && !isBlock && <LeftTick className="shrink-0" />}
            </span>
            {!isBlock && (
              <span className={'text-[12px] font-semibold truncate leading-4 ' + (isShortStayDue ? '' : showClock ? 'text-ink-700' : money.className)}>
                {isShortStayDue && freeAt ? 'time up ' + clockLabel(freeAt)
                  : showClock && freeAt ? 'out ' + clockLabel(freeAt)
                    : booking.stay_hours && !booking.actual_check_in ? booking.stay_hours + ' hrs · ' + money.text
                      : money.text}
              </span>
            )}
            </>)}
          </div>
          {/* THREE BANDS: who, when, how much (Sebastian, 2026-10-09: the card "looks messy").
              It was six grey lines of about one size, the dates as raw numbers, and a line
              saying whether the guest had checked in — which he had taken off: the pill's
              own colour says it. The dates read as days now and say how many nights. */}
          {showTooltip && (
            <div className={'absolute left-1/2 -translate-x-1/2 z-30 w-60 ' + (tipBelow ? 'top-full mt-2' : 'bottom-full mb-2') + ' bg-card border border-soft shadow-softLg rounded-xl text-[13px] divide-y divide-soft pointer-events-none text-left font-sans animate-in fade-in duration-150'}>
              <div className="px-3 pt-2.5 pb-2">
                <div className="flex items-center gap-1.5 font-display text-[14px] font-bold tracking-tight text-main">
                  {agencyName && !isBlock && <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
                  <span className="min-w-0 truncate">{pillName}</span>
                </div>
                {agencyName && !isBlock && <div className="text-[12px] text-muted truncate">for {booking.guest_name}</div>}
              </div>
              <div className="px-3 py-2 flex items-baseline justify-between gap-2 font-semibold text-main">
                <span>{openEnded ? 'from ' + niceDay(booking.check_in) : niceDay(booking.check_in) + ' → ' + niceDay(booking.check_out)}</span>
                {booking.stay_hours
                  ? <span className="shrink-0 text-[12px] font-medium text-muted">{booking.stay_hours} hrs{freeAt ? ' · out ' + clockLabel(freeAt) : ''}</span>
                  : !openEnded && <span className="shrink-0 text-[12px] font-medium text-muted">{nightsWord(booking.check_in, booking.check_out)}</span>}
              </div>
              {!isBlock && (
                <div className="px-3 py-2 flex items-baseline justify-between gap-2">
                  <b className={'font-display text-[15px] font-bold tracking-tight ' + money.className}>{money.text}</b>
                  {booking.guest_phone && booking.guest_phone.trim() !== 'None' && <span className="shrink-0 text-[12px] text-muted tabular-nums">{booking.guest_phone}</span>}
                </div>
              )}
            </div>
          )}
        </td>
      )
    }

    // A free cell is a whole day, or one half of it when a stay fills the other half.
    // The marks drawn inside it follow the same rule as the stays: from the AFTERNOON of
    // the first day (in from 2 PM) to the MORNING of the last (out by 12 PM), so on a day
    // that is still whole they take only the half that belongs to the stay.
    const whole = !halfOf

    if (isCheckIn) {
      return (
        // The picked day renders as this "In" cell — and it MUST carry the position
        // markers too, or the action bar cannot find the cell it hangs off (that is
        // why the Short stay button never appeared on a single picked day).
        <td data-unit={id} data-day={isoStr} colSpan={span} onClick={() => onCellClick(id, type, date)} className={'p-0 h-12 border-b border-soft relative cursor-cell align-middle' + dayRule}>
          <div className={'absolute inset-y-1 rounded-md bg-gold-400 text-ink-900 flex items-center justify-center text-[12px] font-bold animate-in zoom-in-95 duration-150 ' + (whole ? 'left-1/2 right-0.5' : 'inset-x-0.5')}>
            In
          </div>
        </td>
      )
    }

    if (highlight) {
      const place = whole && highlight === 'start' ? 'left-1/2 right-0' : whole && highlight === 'end' ? 'left-0 right-1/2' : 'inset-x-0'
      return (
        <td
          data-unit={id}
          data-day={isoStr}
          colSpan={span}
          onClick={() => onCellClick(id, type, date)}
          className={'p-0 h-12 border-b border-soft cursor-cell relative align-middle' + dayRule}
        >
          <div className={'absolute inset-y-0 border-y border-dashed border-gold-400/50 bg-gold-100/70 transition-colors hover:bg-gold-100 ' + place} />
        </td>
      )
    }

    return (
      <td
        data-unit={id}
        data-day={isoStr}
        colSpan={span}
        onClick={() => onCellClick(id, type, date)}
        className={'relative border-b border-soft p-0 h-12 cursor-cell transition-colors ' + (isToday ? 'bg-gold-100/50' : isWeekend ? 'bg-paper-50/60' : '') + ' hover:bg-gold-100/70' + dayRule}
      >
        {/* Nothing is drawn where a guest left: the end of their pill says it. The arrow and
            the word "out" that used to stand here were taken off (Sebastian, 2026-10-06). */}
      </td>
    )
  },
  (prevProps, nextProps) => {
    // The booking this cell renders is ALSO the object handed to the quick view
    // when the pill is clicked, so a field left out of this comparison is a field
    // the slide-over can open stale. That is exactly what happened after a
    // check-in: only `actual_check_in` changed, the comparator called the two
    // props equal, the cell kept the old object, and reopening the booking showed
    // "Check in" again for a guest who was already in the room. Keep the stage and
    // the money in here (the pill's own dot and every figure the panel shows).
    return (
      prevProps.date.getTime() === nextProps.date.getTime() &&
      prevProps.isoStr === nextProps.isoStr &&
      prevProps.id === nextProps.id &&
      prevProps.type === nextProps.type &&
      prevProps.onCellClick === nextProps.onCellClick &&
      prevProps.isCheckIn === nextProps.isCheckIn &&
      prevProps.highlight === nextProps.highlight &&
      prevProps.halfOf === nextProps.halfOf &&
      prevProps.closesDay === nextProps.closesDay &&
      prevProps.isContinuation === nextProps.isContinuation &&
      prevProps.isWeekend === nextProps.isWeekend &&
      prevProps.isToday === nextProps.isToday &&
      prevProps.isShortStayDue === nextProps.isShortStayDue &&
      prevProps.agencyName === nextProps.agencyName &&
      prevProps.due === nextProps.due &&
      prevProps.todayFrom === nextProps.todayFrom &&
      prevProps.todayHalves === nextProps.todayHalves &&
      prevProps.span === nextProps.span &&
      prevProps.booking?.id === nextProps.booking?.id &&
      prevProps.booking?.status === nextProps.booking?.status &&
      prevProps.booking?.payment_status === nextProps.booking?.payment_status &&
      // `payment_plan` decides whether the pill says "Reserved" (and which colour its dot
      // is), so it MUST be compared — the same trap as `actual_check_in` below.
      prevProps.booking?.payment_plan === nextProps.booking?.payment_plan &&
      prevProps.booking?.actual_check_in === nextProps.booking?.actual_check_in &&
      prevProps.booking?.actual_check_out === nextProps.booking?.actual_check_out &&
      prevProps.booking?.check_in === nextProps.booking?.check_in &&
      prevProps.booking?.check_out === nextProps.booking?.check_out &&
      prevProps.booking?.guest_name === nextProps.booking?.guest_name &&
      // A block's pill reads its reason.
      prevProps.booking?.notes === nextProps.booking?.notes &&
      prevProps.booking?.stay_hours === nextProps.booking?.stay_hours &&
      prevProps.booking?.downpayment_paid === nextProps.booking?.downpayment_paid &&
      prevProps.booking?.balance_due === nextProps.booking?.balance_due &&
      (prevProps.booking?.payment_records?.length || 0) === (nextProps.booking?.payment_records?.length || 0)
    )
  }
)

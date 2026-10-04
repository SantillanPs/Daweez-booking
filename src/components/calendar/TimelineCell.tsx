import React from 'react'
import { LogOut } from 'lucide-react'
import { Booking } from '../../types/booking'
import { pillMoney, stageTag, stageWords } from './bookingStyles'
import { clockLabel, shortStayEnd } from '../../utils/shortStay'
import { blockReason, isOpenEnded } from '../../utils/openBlock'

export interface TimelineCellProps {
  date: Date
  isoStr: string
  id: string
  type: 'room' | 'venue'
  booking: Booking | null
  span: number
  isCheckIn: boolean
  isHighlighted: boolean
  /** The stay began before the first day on screen (the grid opens at today,
   *  card k154), so the pill is cut off at the left edge and says so. */
  isContinuation?: boolean
  isWeekend: boolean
  isToday: boolean
  /** A short stay whose bought hours have run out — the block goes red, because the
   *  room is due for cleaning and the panel pops itself open (the owner's ruling). */
  isShortStayDue?: boolean
  checkoutBooking?: Booking | null
  getBookingStyle: (b: Booking) => string
  onCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
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
    isCheckIn,
    isHighlighted,
    isContinuation,
    isWeekend,
    isToday,
    isShortStayDue,
    checkoutBooking,
    getBookingStyle,
    onCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError
  }: TimelineCellProps) {
    const [showTooltip, setShowTooltip] = React.useState(false)
    const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

    React.useEffect(() => {
      return () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      }
    }, [])

    if (booking) {
      // A block shows WHY the dates are closed (card k91) — `Cleaning`, `Owner use` —
      // not the placeholder name every block is stored under.
      const isBlock = booking.status === 'blocked'
      const openEnded = isOpenEnded(booking)
      const pillName = isBlock ? blockReason(booking) + (openEnded ? ' · until further notice' : '') : booking.guest_name
      const tag = stageTag(booking)
      const money = pillMoney(booking)
      // A short stay whose guest is in the room shows THE TIME THE ROOM IS FREE — never
      // a countdown (the owner's ruling) — unless money is still owed, which comes first.
      const freeAt = shortStayEnd(booking.actual_check_in, Number(booking.stay_hours || 0))
      const showClock = !!freeAt && !booking.actual_check_out && money.text === 'Paid'
      return (
        <td
          colSpan={span}
          data-day={isoStr}
          className="p-0 h-12 border-r border-b border-soft relative align-middle"
          onMouseEnter={() => {
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
          <div
            onClick={e => {
              e.stopPropagation()
              // A block opens its panel too — that is where it is ended or removed.
              setSelectedExtendBooking(booking)
              setExtendCheckoutDate(openEnded ? '' : booking.check_out)
              setExtendError('')
            }}
            title={pillName}
            className={'mx-0.5 px-2 h-10 rounded-md border cursor-pointer select-none transition hover:brightness-95 flex flex-col justify-center ' +
              (isShortStayDue ? 'bg-danger-100 border-danger-400 text-danger-600' : getBookingStyle(booking))}
          >
            {/* TWO LINES, both in words (the staff's feedback, 2026-10-04): who is in the
                room and whether they are IN or OUT, then what is still to pay. The desk
                reads the calendar without opening a booking. A block has one line — why
                the dates are closed. 13px and 12px: the pills are what the desk reads all
                day, and at 11px they were the smallest words on the screen. */}
            <span className="flex items-center justify-between gap-1 min-w-0 text-[13px] font-bold leading-4">
              <span className="min-w-0 truncate">
                {isContinuation && <span className="opacity-70" title={'Already staying — arrived ' + booking.check_in}>‹ </span>}
                {pillName}
              </span>
              {!isBlock && tag && (
                <span className={'shrink-0 rounded px-1 text-[10px] font-bold leading-[15px] ' +
                  (tag === 'IN' ? 'bg-gold-400 text-ink-900' : 'bg-ink-300 text-ink-700')}>
                  {tag}
                </span>
              )}
            </span>
            {!isBlock && (
              <span className={'text-[12px] font-semibold truncate leading-4 ' + (isShortStayDue ? '' : showClock ? 'text-ink-700' : money.className)}>
                {isShortStayDue && freeAt ? 'time up ' + clockLabel(freeAt)
                  : showClock && freeAt ? 'out ' + clockLabel(freeAt)
                    : booking.stay_hours && !booking.actual_check_in ? booking.stay_hours + ' hrs · ' + money.text
                      : money.text}
              </span>
            )}
          </div>
          {showTooltip && (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-60 bg-card border border-soft p-3 shadow-softLg rounded-lg text-[13px] space-y-1.5 pointer-events-none text-left font-sans animate-in fade-in duration-150">
              <div className="font-display text-[14px] font-bold text-main">{pillName}</div>
              {booking.stay_hours ? (
                <div className="text-[12px] font-semibold text-brand-text">
                  Short stay · {booking.stay_hours} hours
                  {freeAt ? ' · out by ' + clockLabel(freeAt) : ' · clock starts at check-in'}
                </div>
              ) : null}
              <div className="text-[12px] text-muted tabular-nums">{openEnded ? 'from ' + booking.check_in : booking.check_in + ' → ' + booking.check_out}</div>
              {!isBlock && (
                <div className="text-[13px] text-muted space-y-0.5">
                  {booking.guest_phone && booking.guest_phone.trim() !== 'None' && <div>{booking.guest_phone}</div>}
                  <div className="font-semibold text-main">{stageWords(booking)}</div>
                  <div className={'font-semibold ' + money.className}>{money.text}</div>
                </div>
              )}
            </div>
          )}
        </td>
      )
    }

    if (isCheckIn) {
      return (
        // The picked day renders as this "In" cell — and it MUST carry the position
        // markers too, or the action bar cannot find the cell it hangs off (that is
        // why the Short stay button never appeared on a single picked day).
        <td data-unit={id} data-day={isoStr} onClick={() => onCellClick(id, type, date)} className="px-0.5 h-12 border-b border-soft relative cursor-cell align-middle">
          <div className="w-full h-10 rounded-md bg-gold-400 text-ink-900 flex items-center justify-center text-[12px] font-bold animate-in zoom-in-95 duration-150">
            In
          </div>
        </td>
      )
    }

    if (isHighlighted) {
      return (
        <td
          data-unit={id}
          data-day={isoStr}
          onClick={() => onCellClick(id, type, date)}
          className="p-0 h-12 border-b border-soft cursor-cell relative align-middle transition-colors bg-gold-100/70 hover:bg-gold-100"
        >
          <div className="absolute inset-0 border-y border-dashed border-gold-400/50" />
        </td>
      )
    }

    return (
      <td
        data-unit={id}
        data-day={isoStr}
        onClick={() => onCellClick(id, type, date)}
        title={checkoutBooking ? checkoutBooking.guest_name + ' checks out this day' : undefined}
        className={'relative border-r border-b border-soft p-0 h-12 cursor-cell transition-colors ' + (isToday ? 'bg-gold-100/50' : isWeekend ? 'bg-paper-50/60' : '') + ' hover:bg-gold-100/70'}
      >
        {/* The morning a guest leaves, said beside the end of their pill. It was 7px and
            rose; red on this grid means money owed and nothing else, so it is plain ink at
            a size that can be read. */}
        {checkoutBooking && (
          <span className="absolute left-1.5 top-1/2 -translate-y-1/2 pointer-events-none inline-flex items-center gap-1 text-[11px] font-medium text-muted">
            <LogOut className="w-3 h-3" aria-hidden="true" /> out
          </span>
        )}
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
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.isContinuation === nextProps.isContinuation &&
      prevProps.isWeekend === nextProps.isWeekend &&
      prevProps.isToday === nextProps.isToday &&
      prevProps.isShortStayDue === nextProps.isShortStayDue &&
      prevProps.checkoutBooking?.id === nextProps.checkoutBooking?.id &&
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

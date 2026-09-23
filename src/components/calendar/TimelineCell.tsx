import React from 'react'
import { Booking } from '../../types/booking'
import { getPaymentDotClass, getPaymentLabel, SOURCE_LABELS } from './bookingStyles'
import { clockLabel, shortStayEnd } from '../../utils/shortStay'

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
      return (
        <td
          colSpan={span}
          data-day={isoStr}
          className={'p-0 border-r border-soft relative align-middle'}
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
              if (booking.status !== 'blocked') {
                setSelectedExtendBooking(booking)
                setExtendCheckoutDate(booking.check_out)
                setExtendError('')
              }
            }}
            title={booking.guest_name}
            className={'mx-0.5 px-1.5 rounded-md border cursor-pointer select-none transition-shadow hover:shadow-sm text-[10px] font-bold ' +
              (isShortStayDue ? 'bg-danger-100 border-danger-400 text-danger-600 ' : '') + getBookingStyle(booking) +
              (booking.stay_hours ? ' h-9 py-1 flex flex-col justify-center' : ' h-8 flex items-center justify-between gap-0.5')}
          >
            {/* Short stay (the printed rate board): the room was sold for a few hours
                rather than a night, so the block carries THE TIME THE ROOM IS FREE —
                never a countdown (the owner's ruling). Two tight lines: who is in the
                room, then the fact the desk acts on. Before the guest is checked in
                there is no clock yet, so the second line says what was sold instead of
                the redundant "short stay" it used to repeat — the gold block and the
                tooltip already say that. The day columns are 96 px so a real name fits
                above a full `out 1:12 PM`. */}
            {booking.stay_hours ? (
              <>
                <span className="flex items-center justify-between gap-1 min-w-0 leading-tight">
                  <span className="min-w-0 truncate">
                    {isContinuation && <span className="opacity-70" title={'Already staying — arrived ' + booking.check_in}>‹ </span>}
                    {booking.guest_name}
                  </span>
                  <span
                    title={'Payment: ' + getPaymentLabel(booking) + ' — from the payments recorded on the booking'}
                    aria-label={'Payment: ' + getPaymentLabel(booking)}
                    className={'w-2 h-2 rounded-full shrink-0 ' + getPaymentDotClass(booking)}
                  />
                </span>
                <span className="text-[8.5px] font-mono opacity-90 truncate leading-tight">
                  {shortStayEnd(booking.actual_check_in, Number(booking.stay_hours))
                    ? 'out ' + clockLabel(shortStayEnd(booking.actual_check_in, Number(booking.stay_hours))!)
                    : booking.stay_hours + '-hour stay'}
                </span>
              </>
            ) : (
              <>
                <span className="min-w-0 truncate">
                  {isContinuation && <span className="opacity-70" title={'Already staying — arrived ' + booking.check_in}>‹ </span>}
                  {booking.guest_name}
                </span>
                <span className="flex items-center gap-1 shrink-0">
                  {span > 1 ? <span className="text-[8.5px] opacity-70 font-mono">{span}n</span> : null}
                  <span
                    title={'Payment: ' + getPaymentLabel(booking) + ' — from the payments recorded on the booking'}
                    aria-label={'Payment: ' + getPaymentLabel(booking)}
                    className={'w-2 h-2 rounded-full ' + getPaymentDotClass(booking)}
                  />
                </span>
              </>
            )}
          </div>
          {showTooltip && (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-56 bg-card border border-soft p-3 shadow-softLg rounded-xl text-xs space-y-1.5 pointer-events-none text-left font-sans">
              <div className="font-display font-bold text-main">{booking.guest_name}</div>
              {booking.stay_hours ? (
                <div className="text-[10px] font-bold text-brand-text">
                  Short stay · {booking.stay_hours} hours
                  {shortStayEnd(booking.actual_check_in, Number(booking.stay_hours))
                    ? ' · out by ' + clockLabel(shortStayEnd(booking.actual_check_in, Number(booking.stay_hours))!)
                    : ' · clock starts at check-in'}
                </div>
              ) : null}
              <div className="text-[10px] text-muted font-mono">{booking.check_in} → {booking.check_out}</div>
              <div className="text-[10px] text-muted">
                {booking.guest_phone}<br />
                <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                  {booking.status === 'confirmed' ? 'Confirmed' : booking.status === 'pending' ? 'On hold' : 'Blocked'}
                </span>
                {' · '}
                <span className={
                  !booking.payment_status || booking.payment_status === 'unpaid'
                    ? 'text-danger-500 font-semibold'
                    : booking.payment_status === 'downpayment' ? 'text-amber-600 font-semibold' : 'text-emerald-600 font-semibold'
                }>
                  {getPaymentLabel(booking)}
                </span>
                {' · '}{SOURCE_LABELS[booking.source] || booking.source}
                {booking.event_addons?.payment_reference && (
                  <>
                    <br />
                    <span className="text-[9.5px] text-brand-text font-bold">Ref: {booking.event_addons.payment_reference}</span>
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
        // The picked day renders as this "In" cell — and it MUST carry the position
        // markers too, or the action bar cannot find the cell it hangs off (that is
        // why the Short stay button never appeared on a single picked day).
        <td data-unit={id} data-day={isoStr} onClick={() => onCellClick(id, type, date)} className="p-0.5 h-8 relative cursor-cell align-middle">
          <div className="w-full h-full rounded-md bg-gold-400 text-ink-900 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider shadow-sm animate-in zoom-in-95 duration-150">
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
          className="p-0 h-8 cursor-cell relative align-middle transition-colors bg-gradient-to-r from-gold-100/70 to-gold-100/60 hover:from-gold-100 hover:to-gold-100"
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
        className={'relative border-r border-soft p-0 h-8 cursor-cell transition-colors ' + (isToday ? 'bg-gold-100/50' : isWeekend ? 'bg-paper-50/60' : '') + ' hover:bg-gold-100/70'}
      >
        {checkoutBooking && (
          <span className="absolute top-0.5 right-0.5 pointer-events-none text-[7px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 rounded-sm px-1 py-px leading-none">
            out
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
      prevProps.booking?.actual_check_in === nextProps.booking?.actual_check_in &&
      prevProps.booking?.actual_check_out === nextProps.booking?.actual_check_out &&
      prevProps.booking?.check_in === nextProps.booking?.check_in &&
      prevProps.booking?.check_out === nextProps.booking?.check_out &&
      prevProps.booking?.guest_name === nextProps.booking?.guest_name &&
      prevProps.booking?.stay_hours === nextProps.booking?.stay_hours &&
      prevProps.booking?.downpayment_paid === nextProps.booking?.downpayment_paid &&
      prevProps.booking?.balance_due === nextProps.booking?.balance_due &&
      (prevProps.booking?.payment_records?.length || 0) === (nextProps.booking?.payment_records?.length || 0)
    )
  }
)

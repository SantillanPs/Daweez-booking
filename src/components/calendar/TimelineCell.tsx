import React from 'react'
import { Booking } from '../../types/booking'
import { getPaymentDotClass, getPaymentLabel, SOURCE_LABELS } from './bookingStyles'

export interface TimelineCellProps {
  date: Date
  isoStr: string
  id: string
  type: 'room' | 'venue'
  booking: Booking | null
  span: number
  isCheckIn: boolean
  isHighlighted: boolean
  isWeekend: boolean
  isToday: boolean
  checkoutBooking?: Booking | null
  getBookingStyle: (b: Booking) => string
  onCellClick: (id: string, type: 'room' | 'venue', date: Date) => void
  setSelectedExtendBooking: (booking: Booking) => void
  setExtendCheckoutDate: (date: string) => void
  setExtendError: (err: string) => void
  onQuickPaymentChange?: (booking: Booking, status: 'unpaid' | 'downpayment' | 'paid') => void
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
    isWeekend,
    isToday,
    checkoutBooking,
    getBookingStyle,
    onCellClick,
    setSelectedExtendBooking,
    setExtendCheckoutDate,
    setExtendError,
    onQuickPaymentChange
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
            className={'h-8 mx-0.5 flex items-center justify-between gap-0.5 px-1 rounded-md border cursor-pointer select-none transition-shadow hover:shadow-sm text-[10px] font-bold ' + getBookingStyle(booking)}
          >
            <span className="min-w-0 truncate">{booking.guest_name}</span>
            <span className="flex items-center gap-1 shrink-0">
              {span > 1 && (
                <span className="text-[8.5px] opacity-70 font-mono">{span}n</span>
              )}
              <button
                onClick={e => {
                  e.stopPropagation()
                  const next = !booking.payment_status || booking.payment_status === 'unpaid'
                    ? 'downpayment' : booking.payment_status === 'downpayment' ? 'paid' : 'unpaid'
                  onQuickPaymentChange?.(booking, next)
                }}
                title={'Payment: ' + getPaymentLabel(booking) + ' — click to change'}
                aria-label="Change payment status"
                className={'w-2 h-2 rounded-full cursor-pointer transition-transform hover:scale-150 ' + getPaymentDotClass(booking)}
              />
            </span>
          </div>
          {showTooltip && (
            <div className="absolute left-1/2 bottom-full mb-2 -translate-x-1/2 z-30 w-56 bg-card border border-soft p-3 shadow-softLg rounded-xl text-xs space-y-1.5 pointer-events-none text-left font-sans">
              <div className="font-display font-bold text-main">{booking.guest_name}</div>
              <div className="text-[10px] text-muted font-mono">{booking.check_in} → {booking.check_out}</div>
              <div className="text-[10px] text-muted">
                {booking.guest_phone}<br />
                <span className={booking.status === 'confirmed' ? 'text-emerald-600 font-semibold' : 'text-amber-600 font-semibold'}>
                  {booking.status === 'confirmed' ? 'Confirmed' : booking.status === 'pending' ? 'On hold' : 'Blocked'}
                </span>
                {' · '}
                <span className={
                  !booking.payment_status || booking.payment_status === 'unpaid'
                    ? 'text-coral-500 font-semibold'
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
        <td onClick={() => onCellClick(id, type, date)} className="p-0.5 h-8 relative cursor-cell align-middle">
          <div className="w-full h-full rounded-md bg-sea-600 text-white flex items-center justify-center text-[9px] font-bold uppercase tracking-wider shadow-sm animate-in zoom-in-95 duration-150">
            In
          </div>
        </td>
      )
    }

    if (isHighlighted) {
      return (
        <td
          onClick={() => onCellClick(id, type, date)}
          className="p-0 h-8 cursor-cell relative align-middle transition-colors bg-gradient-to-r from-sea-100/70 to-sea-50/60 hover:from-sea-100 hover:to-sea-50"
        >
          <div className="absolute inset-0 border-y border-dashed border-sea-400/50" />
        </td>
      )
    }

    return (
      <td
        data-day={isoStr}
        onClick={() => onCellClick(id, type, date)}
        title={checkoutBooking ? checkoutBooking.guest_name + ' checks out this day' : undefined}
        className={'relative border-r border-soft p-0 h-8 cursor-cell transition-colors ' + (isToday ? 'bg-sea-50/50' : isWeekend ? 'bg-sand-50/60' : '') + ' hover:bg-sea-100/70'}
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
    return (
      prevProps.onCellClick === nextProps.onCellClick &&
      prevProps.isCheckIn === nextProps.isCheckIn &&
      prevProps.isHighlighted === nextProps.isHighlighted &&
      prevProps.isWeekend === nextProps.isWeekend &&
      prevProps.isToday === nextProps.isToday &&
      prevProps.checkoutBooking?.id === nextProps.checkoutBooking?.id &&
            prevProps.span === nextProps.span &&
      prevProps.booking?.id === nextProps.booking?.id &&
      prevProps.booking?.status === nextProps.booking?.status &&
      prevProps.booking?.payment_status === nextProps.booking?.payment_status
    )
  }
)

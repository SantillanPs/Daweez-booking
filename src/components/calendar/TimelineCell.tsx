import React from 'react'
import { Building2, Check, LogIn, LogOut } from 'lucide-react'
import { dateToString } from '../../utils/helpers'
import { Booking } from '../../types/booking'
import { doorTime, minutesLabel } from '../../utils/doorTimes'
import { bookingStage, pillInitials, pillMoney } from './bookingStyles'
import { clockLabel } from '../../utils/shortStay'
import { blockReason, isOpenEnded } from '../../utils/openBlock'

export interface TimelineCellProps {
  date: Date
  isoStr: string
  id: string
  type: 'room' | 'venue'
  booking: Booking | null
  /** The booking's money as its bill sees it (`asBill`): a room booked with others shows the
   *  whole bill's words and figure. The booking itself when it is alone. */
  bill?: Booking | null
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
  /** The highlighted day's place in the pick (0 is the check-in day), so the pick sweeps
   *  across night by night. */
  pickAt?: number
  /** Where a stay being rescheduled is now: a dashed outline on its first day (from the
   *  afternoon), the days between, its last day (until the morning), or a short stay's whole day. */
  was?: 'start' | 'mid' | 'end' | 'day' | null
  /** The stay began before the first day on screen (the grid opens at today,
   *  card k154), so the pill is cut off at the left edge and says so. */
  isContinuation?: boolean
  isWeekend: boolean
  isToday: boolean
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

/**
 * The money line of a pill. **It answers a payment where the desk is looking** (Sebastian,
 * 2026-10-09): when the words change — "Not paid" to "Paid" — the new words come up from
 * under the line. Nothing moves when the calendar first opens. It shows no amount since
 * 2026-10-20 (`pillMoney`), so there is no figure to count any more.
 */
function MoneyWords({ text, className }: { text: string; className: string }) {
  const [first] = React.useState(text)
  return (
    <span className={'relative text-[12px] font-semibold truncate leading-4 ' + className}>
      <span key={text} className={text === first ? '' : 'bp-up'}>{text}</span>
    </span>
  )
}

/**
 * The card a pill shows on hover. **One card that changes with the stay** (Sebastian,
 * 2026-10-15, redesigned from a mock he approved): the name leads beside a circle in the
 * pill's own colour; the stay is drawn as one block per night — slept nights green,
 * tonight gold; the money is the booking panel's bar; and a line for today appears only
 * when the desk has to check the guest in or out. It used to be three boxed rows of one
 * weight that read the same on arrival day, mid-stay and after leaving.
 *
 * **It grows up out of the pill** (animation A in the mock): the card scales from the
 * pill's edge, its parts arrive in turn, the nights fill left to right, the bar runs out.
 */
function HoverCard({ booking, bill, pillName, agencyName, isBlock, openEnded, money, freeAt, due, inHotel, left, below }: {
  booking: Booking
  /** Its bill's money (`asBill`): what the paid bar fills from. */
  bill: Booking
  pillName: string
  agencyName?: string
  isBlock: boolean
  openEnded: boolean
  money: { text: string; className: string }
  freeAt: Date | null
  due?: 'in' | 'out' | null
  inHotel: boolean
  left: boolean
  below: boolean
}) {
  const at = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d) }
  const nights = openEnded || booking.stay_hours ? 0 : Math.max(0, Math.round((at(booking.check_out) - at(booking.check_in)) / 86400000))
  const today = at(dateToString(new Date()))
  // Tonight's place in the stay: 0 is the first night. Before arrival it is below 0.
  const tonight = Math.round((today - at(booking.check_in)) / 86400000)
  const doorIn = doorTime(booking, 'in', dateToString(new Date()))
  const doorOut = doorTime(booking, 'out', dateToString(new Date()))
  const paid = Number(bill.downpayment_paid || 0)
  const owed = Number(bill.balance_due || 0)
  const phone = booking.guest_phone && booking.guest_phone.trim() !== 'None' ? booking.guest_phone : ''
  const sub = agencyName ? 'for ' + booking.guest_name : phone
  const circle = isBlock || left ? 'bg-ink-200 text-ink-600'
    : agencyName ? 'bg-ink-900 text-gold-400'
      : inHotel ? 'bg-emerald-600 text-white'
        : 'bg-paper-50 text-main border-[1.5px] ' + (due === 'in' ? 'border-emerald-600' : 'border-soft')
  const middle = booking.stay_hours ? booking.stay_hours + ' hrs' + (freeAt ? ' · out ' + clockLabel(freeAt) : '')
    : openEnded ? 'until further notice'
      : inHotel && tonight >= 0 && tonight < nights ? 'night ' + (tonight + 1) + ' of ' + nights
        : nightsWord(booking.check_in, booking.check_out)
  return (
    <div className={'absolute left-1/2 -translate-x-1/2 z-30 pointer-events-none ' + (below ? 'top-full mt-2' : 'bottom-full mb-2')}>
      <div className={'hc-grow w-64 bg-card border border-soft shadow-softLg rounded-xl px-3.5 pt-3 pb-3.5 grid gap-2.5 text-left font-sans ' + (below ? 'origin-top' : 'origin-bottom')}>
        <div className="flex items-center gap-2.5">
          <span className={'w-[34px] h-[34px] shrink-0 rounded-full grid place-items-center font-display text-[13px] font-bold ' + circle} aria-hidden="true">
            {agencyName ? <Building2 className="w-4 h-4" /> : pillInitials(pillName)}
          </span>
          <span className="min-w-0 grid">
            <b className="font-display text-[15px] font-bold tracking-tight text-main leading-tight truncate">{pillName}</b>
            {sub && <span className="text-[12px] text-muted truncate">{sub}</span>}
          </span>
        </div>
        {due && !isBlock && (
          <div className={'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-bold ' + (due === 'in' ? 'bg-emerald-50 text-emerald-700' : 'bg-ink-100 text-main')}>
            {due === 'in' ? <LogIn className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> : <LogOut className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
            {due === 'in' ? 'Arrives today, from 2 PM' : 'Leaves today, by 12 PM'}
          </div>
        )}
        <div className="grid gap-1.5">
          {nights > 0 && nights <= 31 && (
            <div className="flex gap-[3px]" aria-hidden="true">
              {Array.from({ length: nights }, (_, i) => (
                <span key={i} className="relative flex-1 h-2 rounded-[3px] bg-paper-100 border border-soft overflow-hidden">
                  {(left || (inHotel && i <= tonight)) && (
                    <span style={{ '--i': i } as React.CSSProperties}
                      className={'hc-night absolute -inset-px ' + (!left && i === tonight ? 'bg-gold-400' : 'bg-emerald-600')} />
                  )}
                </span>
              ))}
            </div>
          )}
          <div className="flex items-baseline justify-between gap-2 text-[12px] font-semibold text-main tabular-nums">
            <span>{niceDay(booking.check_in)}</span>
            <span className="font-medium text-muted">{middle}</span>
            {!openEnded && !booking.stay_hours && <span>{niceDay(booking.check_out)}</span>}
          </div>
          {/* The times the desk ticked, or the usual ones once the day has gone by (`doorTimes`). */}
          {!isBlock && (doorIn || doorOut) && (
            <div className="flex items-baseline justify-between gap-2 text-[11.5px] text-muted tabular-nums">
              <span>{doorIn && <>In <b className={doorIn.usual ? 'font-semibold' : 'font-bold text-main'}>{minutesLabel(doorIn.minutes)}</b></>}</span>
              <span>{doorOut && <>Out <b className={doorOut.usual ? 'font-semibold' : 'font-bold text-main'}>{minutesLabel(doorOut.minutes)}</b></>}</span>
            </div>
          )}
        </div>
        {!isBlock && (
          <div className="grid gap-1.5">
            {paid + owed > 0 && !agencyName && (
              <div className="h-[5px] rounded-full overflow-hidden bg-danger-200" aria-hidden="true">
                <span style={{ '--paid': Math.min(1, paid / (paid + owed)) } as React.CSSProperties}
                  className="hc-bar block h-full rounded-full bg-emerald-600 origin-left [transform:scaleX(var(--paid))]" />
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <b className={'font-display text-[15px] font-bold tracking-tight ' + money.className}>{money.text}</b>
              {paid + owed > 0 && money.text !== 'Paid' && !agencyName && <span className="text-[12px] text-muted tabular-nums">of ₱{(paid + owed).toLocaleString()}</span>}
              {agencyName && phone && <span className="text-[12px] text-muted tabular-nums">{phone}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The mark of a guest who has checked out: a tick in a small charcoal circle. */
function LeftTick({ className }: { className: string }) {
  return (
    <span className={'inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-ink-600 text-white ' + className} aria-hidden="true">
      <Check className="w-2.5 h-2.5" strokeWidth={3} />
    </span>
  )
}

// **The hover card answers quickly** (Sebastian, 2026-10-15: the reservation hover felt
// slow). It waited half a second; it now waits a short beat so a mouse passing over the
// grid does not flash cards, and once one card has been open, the next pill's card opens
// at once — the desk reading down a column is not made to wait on every pill.
const TIP_WAIT_MS = 200
let tipWarmUntil = 0

// Optimized, memoized timeline cell. Tooltip visibility lives in this cell
// only, so hovering a booking never re-renders the whole grid.
export const TimelineCell = React.memo(
  function TimelineCell({
    date,
    isoStr,
    id,
    type,
    booking,
    bill,
    span,
    halfOf,
    closesDay,
    isCheckIn,
    highlight,
    was,
    pickAt = 0,
    isContinuation,
    isWeekend,
    isToday,
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
      // **The stage comes from the dates** (Sebastian, 2026-10-20: the desk no longer checks
      // guests in or out, and the app changes nothing by itself — `stayStage`).
      const stage = bookingStage(booking)
      const left = stage === 'out'
      // **A pill says where the stay is, not who it is** (Sebastian, 2026-10-09): "Reserved"
      // before its dates, "Occupied" during them, and the guest's name once they are over. Who it is stays on the hover card and in the panel.
      // An agency's name and a block's reason are not a guest's name, so they are still
      // shown, and a half-day pill keeps its initials — how the desk tells who is leaving.
      const pillWords = isBlock || agencyName || left ? pillName : stage === 'in' ? 'Occupied' : 'Reserved'
      const money = pillMoney(bill || booking)
      const inHotel = !isBlock && stage === 'in'
      // A short stay has no start time any more (it started on Check in), so it shows its
      // hours, not the time the room is free.
      const freeAt = null
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
            hoverTimeoutRef.current = setTimeout(() => setShowTooltip(true), Date.now() < tipWarmUntil ? 0 : TIP_WAIT_MS)
          }}
          onMouseLeave={() => {
            if (hoverTimeoutRef.current) {
              clearTimeout(hoverTimeoutRef.current)
              hoverTimeoutRef.current = null
            }
            if (showTooltip) tipWarmUntil = Date.now() + 400
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
            // Found by the booking form once its receipt is closed, so the new pill can land (`BookingCreatedPanel`).
            data-pill={booking.id}
            onClick={e => {
              e.stopPropagation()
              // A block opens its panel too — that is where it is ended or removed.
              setSelectedExtendBooking(booking)
              setExtendCheckoutDate(openEnded ? '' : booking.check_out)
              setExtendError('')
            }}
            className={'relative overflow-hidden mx-0.5 h-10 rounded-md border cursor-pointer select-none transition-[filter,transform,border-color,background-color,color,box-shadow,opacity] duration-300 hover:brightness-95 hover:-translate-y-0.5 hover:shadow-soft active:translate-y-0 active:shadow-none active:scale-[0.98] flex flex-col justify-center animate-in fade-in zoom-in-95 motion-reduce:animate-none ' +
              // The words sit in the middle of the pill (Sebastian, on the ripple mock, 2026-10-18).
              'text-center ' + (narrow ? 'items-center px-0 ' : 'px-2 ') +
              getBookingStyle(booking)}
          >
            {/* THE GREEN OF A GUEST WHO IS IN. It is a wash inside the pill, not the pill's
                own colour, so checking in is seen: it crosses from the left. Checking out
                drains it off to the right as the pill turns grey. */}
            {!isBlock && (
              <span aria-hidden="true" className={'absolute inset-0 bg-emerald-50 transition-transform duration-[600ms] ease-out ' +
                (inHotel ? 'origin-left scale-x-100' : left ? 'origin-right scale-x-0' : 'origin-left scale-x-0')} />
            )}
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
            <span className="relative flex items-center justify-center gap-1 min-w-0 text-[13px] font-bold leading-4">
              {agencyName && !isBlock && <Building2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 truncate">
                {isContinuation && <span className="opacity-70" title={'Already staying — arrived ' + booking.check_in}>‹ </span>}
                {pillWords}
              </span>
              {/* No IN tag any more: the green pill and the green bar on the room say it. A
                  guest who has left keeps a tick beside the name. */}
              {left && !isBlock && <LeftTick className="shrink-0" />}
            </span>
            {!isBlock && (booking.stay_hours ? (
              <span className={'relative text-[12px] font-semibold truncate leading-4 ' + money.className}>
                {booking.stay_hours + ' hrs · ' + money.pill}
              </span>
            ) : (
              <MoneyWords text={money.pill} className={money.className} />
            ))}
            </>)}
          </div>
          {showTooltip && (
            <HoverCard booking={booking} bill={bill || booking} pillName={pillName} agencyName={isBlock ? undefined : agencyName} isBlock={isBlock}
              openEnded={openEnded} money={money} freeAt={freeAt} due={due} inHotel={inHotel} left={left} below={tipBelow} />
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
          <div style={{ '--i': pickAt } as React.CSSProperties} className={'fd-pick absolute inset-y-0 border-y border-dashed border-gold-400/50 bg-gold-100/70 transition-colors hover:bg-gold-100 ' + place} />
        </td>
      )
    }

    // The old place of a stay being rescheduled: a dashed outline, so the desk sees where it was.
    const wasPlace = !was ? '' : was === 'day' ? 'inset-x-0.5 rounded-md border-x'
      : whole && was === 'start' ? 'left-1/2 right-0 rounded-l-md border-l'
        : whole && was === 'end' ? 'left-0 right-1/2 rounded-r-md border-r'
          : was === 'start' ? 'inset-x-0 rounded-l-md border-l' : was === 'end' ? 'inset-x-0 rounded-r-md border-r' : 'inset-x-0'
    return (
      <td
        data-unit={id}
        data-day={isoStr}
        colSpan={span}
        onClick={() => onCellClick(id, type, date)}
        className={'fd-free relative border-b border-soft p-0 h-12 cursor-cell transition-colors ' + (isToday ? 'bg-gold-100/50' : isWeekend ? 'bg-paper-50/60' : '') + ' hover:bg-gold-100/70' + dayRule}
      >
        {/* Nothing is drawn where a guest left: the end of their pill says it. The arrow and
            the word "out" that used to stand here were taken off (Sebastian, 2026-10-06). */}
        {was && <div aria-hidden="true" className={'absolute inset-y-1 border-y-[1.5px] border-dashed border-paper-400 pointer-events-none ' + wasPlace} />}
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
      prevProps.pickAt === nextProps.pickAt &&
      prevProps.was === nextProps.was &&
      prevProps.halfOf === nextProps.halfOf &&
      prevProps.closesDay === nextProps.closesDay &&
      prevProps.isContinuation === nextProps.isContinuation &&
      prevProps.isWeekend === nextProps.isWeekend &&
      prevProps.isToday === nextProps.isToday &&
      prevProps.agencyName === nextProps.agencyName &&
      prevProps.due === nextProps.due &&
      prevProps.todayFrom === nextProps.todayFrom &&
      prevProps.todayHalves === nextProps.todayHalves &&
      prevProps.span === nextProps.span &&
      prevProps.booking?.id === nextProps.booking?.id &&
      prevProps.booking?.status === nextProps.booking?.status &&
      prevProps.booking?.payment_status === nextProps.booking?.payment_status &&
      // `payment_plan` decides whether the pill says "Reserved" (and which colour its dot
      // is), so it MUST be compared.
      prevProps.booking?.payment_plan === nextProps.booking?.payment_plan &&
      prevProps.booking?.check_in === nextProps.booking?.check_in &&
      prevProps.booking?.check_out === nextProps.booking?.check_out &&
      prevProps.booking?.guest_name === nextProps.booking?.guest_name &&
      // A block's pill reads its reason.
      prevProps.booking?.notes === nextProps.booking?.notes &&
      prevProps.booking?.stay_hours === nextProps.booking?.stay_hours &&
      // The hover card shows the check-in and check-out times the desk ticked.
      prevProps.booking?.actual_check_in === nextProps.booking?.actual_check_in &&
      prevProps.booking?.actual_check_out === nextProps.booking?.actual_check_out &&
      prevProps.booking?.downpayment_paid === nextProps.booking?.downpayment_paid &&
      prevProps.booking?.balance_due === nextProps.booking?.balance_due &&
      // The bill's money changes when another room of it is paid.
      prevProps.bill?.balance_due === nextProps.bill?.balance_due &&
      prevProps.bill?.downpayment_paid === nextProps.bill?.downpayment_paid &&
      (prevProps.bill?.payment_records?.length || 0) === (nextProps.bill?.payment_records?.length || 0) &&
      (prevProps.booking?.payment_records?.length || 0) === (nextProps.booking?.payment_records?.length || 0)
    )
  }
)

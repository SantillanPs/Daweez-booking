import { Booking, Room, Venue, RateConfig } from '../../types/booking'
import { shortStayLine, stayHoursOf } from '../../utils/shortStay'
import { fmtTime } from './stayLines'
import { SectionName } from './StatementShell'

/** `Mon, Oct 12` — from the recorded moment when there is one, else from the booked date's own parts. */
const dayOf = (dateStr?: string, actual?: string) => {
  const [y, m, d] = (dateStr || '').split('-').map(Number)
  const at = actual ? new Date(actual) : y && m && d ? new Date(y, m - 1, d) : null
  return at ? at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ''
}
const timeOf = (actual?: string) =>
  actual ? new Date(actual).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''

/** Whole days between two `YYYY-MM-DD` dates, counted from local parts. */
const daysBetween = (from?: string, to?: string) => {
  const [y1, m1, d1] = (from || '').split('-').map(Number)
  const [y2, m2, d2] = (to || '').split('-').map(Number)
  if (!y1 || !y2) return 0
  return Math.round((new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime()) / 86400000)
}
const count = (n: number, word: string) => n + ' ' + word + (n === 1 ? '' : 's')

/**
 * The statement's two blocks, side by side — **GUEST**, then **STAY** (the owner's pick from the
 * drawings, 2026-10-13: the name and the room in large type with the details under them, and the
 * two dates beside each other).
 *
 * His one complaint about the first drawing decides how the text is set: *"I can't immediately
 * differentiate between labels and actual information."* So there are three kinds of text here and
 * they never share a look — a **section name** (black capitals on a rule), a **label** (grey,
 * light: `Check in`, `Birth date`), and the **information** (black). Nothing that is information
 * is grey.
 *
 * A field the booking does not hold prints nothing, as before. The earlier rulings still hold: a
 * SHORT STAY is hours, not nights, so it names no check-out the guest never had; the count of
 * guests sits with the stay.
 */
export function StatementGuestStay({ booking, rooms, venues, rates, roomsLabel = '' }: {
  booking: Booking
  /** `7, 9` when the bill covers several rooms; the table below lists each room's type. */
  roomsLabel?: string
  rooms: Room[]
  venues: Venue[]
  rates: RateConfig
}) {
  const b = booking
  const isRoom = !!b.room_id
  const room = rooms.find(r => r.id === b.room_id)
  const venue = venues.find(v => v.id === b.venue_id)
  const unit = roomsLabel ? 'Rooms ' + roomsLabel
    : isRoom ? ['Room ' + (room?.room_number ?? ''), room?.name].filter(Boolean).join(' · ')
    : (venue?.name || '')

  const companions = b.companions || []
  const guestCount = 1 + companions.length
  const stayHours = stayHoursOf(b)
  const nights = daysBetween(b.check_in, b.check_out)
  const guestEmail = b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''

  const text = (v?: string) => (v ?? '').toString().trim()
  const guestLines = [
    [text(b.guest_phone), text(b.guest_nationality), text(b.guest_gender)].filter(Boolean).join(' · '),
    text(b.guest_address),
    guestEmail,
  ].filter(Boolean)
  // A companion keeps what the registration form asks of them, in brackets after the name.
  const withLine = companions.map(c => {
    const about = [c.nationality, c.sex].map(v => text(v)).filter(Boolean).join(', ')
    return c.name + (about ? ' (' + about + ')' : '')
  }).join(', ')

  const label = 'text-[10px] text-muted'
  const big = 'font-display text-[14.5px] font-bold text-ink-900 leading-tight'
  const info = 'text-[10.5px] font-medium text-ink-900 leading-snug'

  return (
    <div className="grid grid-cols-2 gap-6 items-start">
      <div>
        <SectionName>Guest</SectionName>
        <p className={big}>{b.guest_name}</p>
        <div className="mt-0.5">
          {guestLines.map(line => <p key={line} className={info + ' break-words'}>{line}</p>)}
          {text(b.birthdate) && <p className={info}><span className={label}>Birth date</span> {b.birthdate}</p>}
          {text(b.vehicle_plate) && <p className={info}><span className={label}>Plate no.</span> {b.vehicle_plate}</p>}
          {withLine && <p className={info}><span className={label}>With</span> {withLine}</p>}
        </div>
      </div>

      <div>
        <SectionName>Stay</SectionName>
        <p className={big}>{unit}</p>
        <p className={info + ' mt-0.5'}>
          {stayHours > 0 ? count(stayHours, 'hour') : count(nights, isRoom ? 'night' : 'day')} · {count(guestCount, 'guest')}
        </p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 mt-1 pt-1 border-t border-ink-200">
          <div>
            <p className={label}>Check in</p>
            <p className="text-[12.5px] font-bold text-ink-900 leading-tight">{dayOf(b.check_in, b.actual_check_in)}</p>
            <p className={info}>
              {timeOf(b.actual_check_in) || (stayHours === 0 && <><span className={label}>Standard</span> {fmtTime(rates.standardCheckInTime)}</>)}
            </p>
          </div>
          {stayHours > 0 ? (
            <div className="col-span-2">
              <p className={label}>Short stay</p>
              <p className="text-[12.5px] font-bold text-ink-900 leading-tight">{shortStayLine(b.actual_check_in, stayHours)}</p>
            </div>
          ) : (
            <>
              <p className={label + ' font-bold pt-3.5'}>to</p>
              <div>
                <p className={label}>Check out</p>
                <p className="text-[12.5px] font-bold text-ink-900 leading-tight">{dayOf(b.check_out, b.actual_check_out)}</p>
                <p className={info}>
                  {timeOf(b.actual_check_out) || <><span className={label}>Standard</span> {fmtTime(rates.standardCheckOutTime)}</>}
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { Booking, Room, Venue, RateConfig } from '../../types/booking'
import { shortStayLine, stayHoursOf } from '../../utils/shortStay'
import { fmtTime } from './stayLines'
import { SectionName } from './StatementShell'
import { BillMove } from './BillDesk'
import { DayStrip } from './BillDates'

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
export function StatementGuestStay({ booking, rooms, venues, rates, roomsLabel = '', billTo, move }: {
  booking: Booking
  /** Rescheduling on the bill: the two dates are tapped to open the days under them. */
  move?: BillMove
  /**
   * The agency bill (the owner's pick, 2026-10-15): the first block is **Bill to** — the agency,
   * the guest as `c/o`, the agency's own address and contact. Its Stay leads with the nights;
   * the rooms' numbers sit under it, since the table rows name only each room's type.
   */
  billTo?: { name: string; lines: string[] }
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
  // A booking saved with no contact number stores the word `None`; it is not a number to
  // print (he asked of the bill, 2026-10-13: *"why is there none"*).
  const phone = text(b.guest_phone) === 'None' ? '' : text(b.guest_phone)
  const guestLines = [
    [phone, text(b.guest_nationality), text(b.guest_gender)].filter(Boolean).join(' · '),
    text(b.guest_address),
    guestEmail,
  ].filter(Boolean)
  // A companion keeps what the registration form asks of them, in brackets after the name.
  const withLine = companions.map(c => {
    const about = [c.nationality, c.sex].map(v => text(v)).filter(Boolean).join(', ')
    return c.name + (about ? ' (' + about + ')' : '')
  }).join(', ')

  // Which date's days are open under the Stay block.
  const [picking, setPicking] = useState<'in' | 'out' | null>(null)
  const dayValue = 'text-[12.5px] font-bold text-ink-900 leading-tight'
  // On a bill the stay can move on, a date is written on a dashed gold line like the bill's
  // other blanks, and prints as plain text.
  const day = (end: 'in' | 'out', text: string) => move ? (
    <p className={dayValue}>
      <button type="button" onClick={() => setPicking(p => (p === end ? null : end))} aria-expanded={picking === end}
        className={'-ml-0.5 px-0.5 rounded-sm border-b-[1.5px] border-dashed border-gold-400 print:border-0 hover:bg-gold-100 transition-colors cursor-pointer ' + (picking === end ? 'bg-gold-100' : '')}>
        {text}
      </button>
    </p>
  ) : <p className={dayValue}>{text}</p>

  const label = 'text-[10px] text-muted'
  const big = 'font-display text-[14.5px] font-bold text-ink-900 leading-tight'
  const info = 'text-[10.5px] font-medium text-ink-900 leading-snug'

  return (
    <div className="grid grid-cols-2 gap-6 items-start">
      {billTo ? (
        <div>
          <SectionName>Bill to</SectionName>
          <p className={big}>{billTo.name}</p>
          <p className={info + ' mt-0.5'}><span className={label}>c/o</span> {b.guest_name}</p>
          {text(b.institution) && <p className={info}><span className={label}>Institution</span> {b.institution}</p>}
          {billTo.lines.filter(Boolean).map(line => <p key={line} className={info + ' break-words'}>{line}</p>)}
        </div>
      ) : (
      <div>
        <SectionName>Guest</SectionName>
        <p className={big}>{b.guest_name}</p>
        <div className="mt-0.5">
          {text(b.institution) && <p className={info}><span className={label}>Institution</span> {b.institution}</p>}
          {guestLines.map(line => <p key={line} className={info + ' break-words'}>{line}</p>)}
          {text(b.birthdate) && <p className={info}><span className={label}>Birth date</span> {b.birthdate}</p>}
          {text(b.vehicle_plate) && <p className={info}><span className={label}>Plate no.</span> {b.vehicle_plate}</p>}
          {withLine && <p className={info}><span className={label}>With</span> {withLine}</p>}
        </div>
      </div>
      )}

      <div>
        <SectionName>Stay</SectionName>
        {billTo ? (
          <>
            <p className={big}>{stayHours > 0 ? count(stayHours, 'hour') : count(nights, isRoom ? 'night' : 'day')}</p>
            {/* The table's rows name the room's type, not its number, so the number is here. */}
            <p className={info + ' mt-0.5'}>
              {roomsLabel ? 'Rooms ' + roomsLabel : isRoom ? 'Room ' + (room?.room_number ?? '') : (venue?.name || '')} · {count(guestCount, 'guest')}
              {text(b.vehicle_plate) && <> · <span className={label}>Plate no.</span> {b.vehicle_plate}</>}
            </p>
          </>
        ) : (
          <>
            <p className={big}>{unit}</p>
            <p className={info + ' mt-0.5'}>
              {stayHours > 0 ? count(stayHours, 'hour') : count(nights, isRoom ? 'night' : 'day')} · {count(guestCount, 'guest')}
            </p>
          </>
        )}
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 mt-1 pt-1 border-t border-ink-200">
          <div>
            <p className={label}>Check in</p>
            {day('in', dayOf(b.check_in, b.actual_check_in))}
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
                {day('out', dayOf(b.check_out, b.actual_check_out))}
                <p className={info}>
                  {timeOf(b.actual_check_out) || <><span className={label}>Standard</span> {fmtTime(rates.standardCheckOutTime)}</>}
                </p>
              </div>
            </>
          )}
        </div>
        {move && picking && <DayStrip key={picking} move={move} end={picking} onClose={() => setPicking(null)} />}
      </div>
    </div>
  )
}

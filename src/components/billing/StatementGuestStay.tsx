import { Booking, Room, Venue, RateConfig } from '../../types/booking'
import { shortStayLine, stayHoursOf } from '../../utils/shortStay'
import { fmtTime, fmtStayTime } from './stayLines'
import { Line } from './StatementShell'

/**
 * The statement's two labelled field sections — **GUEST**, then **STAY** (card k144, the
 * owner's ruling, 2026-09-29: *"let's establish the layout of the information … I meant
 * like organize it"*).
 *
 * Before this, every field sat in ONE two-column grid with **no heading anywhere**, so the
 * guest's name read beside a room number and a contact number sat under a check-out date.
 * A reader had to work out for themselves which line was about **who** was staying and
 * which was about **the stay**. Each section is now its own two-column grid, so a field
 * can never jump between them, and both columns of a section fill before the next section
 * starts — which is why this costs **fewer rows** than the flat grid did.
 *
 * Extracted from `InvoiceDocument` when that file reached 297 of its 300-line limit, the
 * same reason `StatementChargesTable` was split out before it. The two sections are
 * self-contained: they need only the booking and the rate config.
 */
export function StatementGuestStay({ booking, rooms, venues, rates }: {
  booking: Booking
  rooms: Room[]
  venues: Venue[]
  rates: RateConfig
}) {
  const b = booking
  const isRoom = !!b.room_id
  const room = rooms.find(r => r.id === b.room_id)
  const venue = venues.find(v => v.id === b.venue_id)
  const roomType = isRoom ? (room?.name || '') : (venue?.name || '')
  const roomNo = isRoom ? String(room?.room_number ?? '') : ''

  const guestCount = 1 + (b.companions ? b.companions.length : 0)
  const stayHours = stayHoursOf(b)
  const guestEmail = b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''

  // A heading is printed only when its section has something under it, so a bare `GUEST`
  // over nothing can never appear — the same rule as `Line`, which already refuses to
  // print a label with a blank value.
  const hasGuestSection = [b.guest_name, b.guest_phone, b.guest_address, b.guest_nationality,
    guestEmail, b.birthdate, b.vehicle_plate, b.guest_gender]
    .some(v => String(v ?? '').trim().length > 0)
  const hasStaySection = [roomNo, roomType, b.check_in, b.check_out, stayHours]
    .some(v => String(v ?? '').trim().length > 0)

  // The two groups are separated by **space alone**, not by a heading (the owner's ruling
  // the same day: *"remove the guest and stay pills, and just add a bit of space between
  // name and room rows"*). The gap has to be visibly larger than the gap between rows
  // *inside* a grid — that one is 2px (`gap-y-0.5`) — or the two groups read as one
  // continuous table and the grouping is lost. `space-y-4` is 16px: eight times the row
  // gap, clearly a break, and not a hole on a sheet this dense. The wrapper is the single
  // direct child of `StatementShell`, so the page's own 8px rhythm still separates this
  // block from the letterhead above it and the charges table below.
  return (
    <div className="space-y-4">
      {hasGuestSection && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
          <Line label="Name" value={b.guest_name} />
          <Line label="Contact" value={b.guest_phone} />
          <Line label="Address" value={b.guest_address} />
          <Line label="Nationality" value={b.guest_nationality} />
          <Line label="Email" value={guestEmail} />
          <Line label="Birth Date" value={b.birthdate} />
          <Line label="Plate No." value={b.vehicle_plate} />
          <Line label="Sex" value={b.guest_gender} />
        </div>
      )}

      {hasStaySection && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
          <Line label="Room No." value={roomNo} />
          <Line label="Type" value={roomType} />
          <Line label="Check In" value={fmtStayTime(b.check_in, b.actual_check_in)} />
          {/* A SHORT STAY is hours, not nights (the owner's S3 ruling): the stored
              check-out is the next day because the room is taken for the whole day, so
              printing it would name a check-out the guest never had. */}
          {stayHours > 0 ? (
            <Line label="Short Stay" value={shortStayLine(b.actual_check_in, stayHours)} />
          ) : (
            <Line label="Check Out" value={fmtStayTime(b.check_out, b.actual_check_out)} />
          )}
          {stayHours === 0 && (
            <Line label="Standard" value={fmtTime(rates.standardCheckInTime) + ' / ' + fmtTime(rates.standardCheckOutTime)} />
          )}
          <Line label="Guests" value={'Total ' + guestCount} />
        </div>
      )}
    </div>
  )
}

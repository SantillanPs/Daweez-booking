import React, { useMemo, useState } from 'react'
import { BedDouble, Search } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { dateToString } from '../../utils/helpers'

interface GuestPickerProps {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  /** The guest whose tab is open right now, so the list can show where staff are. */
  activeBookingId?: string
  onPick: (booking: Booking) => void
  busy?: boolean
}

/**
 * A guest who is in the hotel right now: checked in and not yet checked out.
 *
 * Food can only be charged after check-in (the owner's rule — people order when
 * they are here), so this is exactly the list the restaurant may charge to.
 */
export function inHouseGuests(bookings: Booking[]): Booking[] {
  return bookings
    .filter(b => !!b.actual_check_in && !b.actual_check_out)
    .sort((a, b) => (a.actual_check_in || '').localeCompare(b.actual_check_in || ''))
}

const since = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dateToString(d)
}

/** Where a guest is: "Room 3", or the venue they booked. */
export function guestPlace(b: Booking, rooms: Room[], venues: Venue[]): string {
  if (b.room_id) {
    const room = rooms.find(r => r.id === b.room_id)
    return room ? 'Room ' + room.room_number : 'Room'
  }
  return venues.find(v => v.id === b.venue_id)?.name || 'Venue'
}

// Charging a room, in the restaurant (k69).
//
// The owner wanted this: the till lives in the Restaurant screen, so the food
// that goes on a guest's bill is taken here — by finding the guest who is in the
// hotel, not by opening their booking slide-over and squinting at a menu inside it.
export function GuestPicker({ bookings, rooms, venues, activeBookingId, onPick, busy = false }: GuestPickerProps) {
  const [query, setQuery] = useState('')

  const guests = useMemo(() => inHouseGuests(bookings), [bookings])

  const whereOf = (b: Booking) => guestPlace(b, rooms, venues)

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return guests
    return guests.filter(b => (b.guest_name || '').toLowerCase().includes(q) || whereOf(b).toLowerCase().includes(q))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guests, query, rooms, venues])

  return (
    <div className="bg-card border border-soft rounded-lg overflow-hidden">
      <p className="px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-soft">
        Charge to a room
      </p>

      {guests.length === 0 ? (
        <p className="px-3.5 py-3 text-[12.5px] text-muted">
          Nobody is checked in right now. A guest's food can go on their bill once they are in the hotel.
        </p>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-soft">
            <div className="flex items-center gap-1.5 bg-page border border-soft rounded-lg px-2">
              <Search className="w-3.5 h-3.5 text-muted shrink-0" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Guest name or room"
                className="w-full bg-transparent text-[12.5px] text-main py-1.5 focus:outline-none"
              />
            </div>
          </div>
          <ul className="divide-y divide-soft max-h-[210px] overflow-y-auto">
            {shown.length === 0 ? (
              <li className="px-3.5 py-3 text-[12.5px] text-muted">No checked-in guest matches that.</li>
            ) : shown.map(b => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => onPick(b)}
                  disabled={busy}
                  className={'w-full text-left px-3.5 py-2.5 transition-colors cursor-pointer disabled:opacity-50 ' +
                    (b.id === activeBookingId ? 'bg-gold-100' : 'hover:bg-page')}
                >
                  <span className="flex items-center gap-2">
                    <BedDouble className="w-3.5 h-3.5 text-gold-800 shrink-0" />
                    <span className="text-[13px] font-bold text-main truncate">{whereOf(b)}</span>
                    <span className="text-[12.5px] text-ink-600 truncate">{b.guest_name || 'Guest'}</span>
                  </span>
                  <span className="block text-[10.5px] text-muted mt-0.5">In since {since(b.actual_check_in)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

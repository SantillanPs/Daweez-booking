import React, { useMemo, useState } from 'react'
import { LogIn, LogOut, BedDouble, Coffee } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { dateToString } from '../../utils/helpers'
import { isReservationAwaitingArrival, isOwedByAgency } from '../../utils/bookingMoney'
import { wantsBreakfastToday, breakfastOn, breakfastSummary } from '../../utils/breakfastChoice'

type ListKey = 'arriving' | 'leaving' | 'inHouse' | 'breakfast'

interface TodayStripProps {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  /** Opens the booking's quick view — the same panel a tap on the calendar opens. */
  onOpen: (booking: Booking) => void
  /** Opens the breakfast picker for a room that has breakfast. */
  onBreakfast: (booking: Booking) => void
}

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Today at the desk: who is arriving, who is leaving, who is in the hotel. Three
// counts on one line; a tap opens the names, and a name opens that booking.
//
//   Arriving  — booked to be here today and not checked in yet (a guest due
//               yesterday who has not shown up is still expected, and says so).
//   Leaving   — checked in, and today is their last day or already past it.
//   In hotel  — everyone checked in and not yet checked out.
//   Breakfast — the rooms in the hotel that booked breakfast, and how many of them
//               have been asked what they want this morning (`1/3`).
export function TodayStrip({ bookings, rooms, venues, onOpen, onBreakfast }: TodayStripProps) {
  const [open, setOpen] = useState<ListKey | null>(null)
  const today = dateToString(new Date())

  const lists = useMemo(() => {
    const stays = bookings.filter(b => b.status !== 'blocked' && b.status !== 'cancelled')
    const inHouse = stays.filter(b => !!b.actual_check_in && !b.actual_check_out)
    return {
      arriving: stays
        .filter(b => !b.actual_check_in && b.check_in <= today && today < b.check_out)
        .sort((a, b) => a.check_in.localeCompare(b.check_in)),
      // A short stay leaves the day it arrives, whatever its stored check-out says.
      leaving: inHouse
        .filter(b => b.check_out <= today || !!b.stay_hours)
        .sort((a, b) => a.check_out.localeCompare(b.check_out)),
      inHouse: inHouse.slice().sort((a, b) => a.check_out.localeCompare(b.check_out)),
      // Not asked yet first, so the list reads as what is still to do.
      breakfast: inHouse.filter(wantsBreakfastToday)
        .sort((a, b) => Number(!!breakfastOn(a, today)) - Number(!!breakfastOn(b, today))),
    }
  }, [bookings, today])

  const place = (b: Booking) => {
    if (b.room_id) {
      const room = rooms.find(r => r.id === b.room_id)
      return room ? 'Room ' + room.room_number : 'Room'
    }
    return venues.find(v => v.id === b.venue_id)?.name || 'Venue'
  }

  const hint = (key: ListKey, b: Booking): { text: string; warn: boolean } => {
    if (key === 'breakfast') {
      const asked = breakfastOn(b, today)
      return asked ? { text: breakfastSummary(asked), warn: false } : { text: 'not asked yet', warn: true }
    }
    if (key === 'arriving') {
      if (b.check_in < today) return { text: 'expected ' + fmtDay(b.check_in), warn: true }
      if (isReservationAwaitingArrival(b)) return { text: 'Reserved', warn: false }
    }
    if (key !== 'arriving' && !b.stay_hours && b.check_out < today) {
      return { text: 'was due out ' + fmtDay(b.check_out), warn: true }
    }
    if (isOwedByAgency(b)) return { text: 'billed to agency', warn: false }
    const owes = b.payment_status !== 'paid' ? Number(b.balance_due || 0) : 0
    if (owes > 0) return { text: 'owes ₱' + owes.toLocaleString(), warn: true }
    if (key === 'inHouse') return { text: 'until ' + fmtDay(b.check_out), warn: false }
    return { text: 'paid', warn: false }
  }

  const chips: { key: ListKey; label: string; Icon: typeof LogIn }[] = [
    { key: 'arriving', label: 'Arriving', Icon: LogIn },
    { key: 'leaving', label: 'Leaving', Icon: LogOut },
    { key: 'inHouse', label: 'In the hotel', Icon: BedDouble },
    { key: 'breakfast', label: 'Breakfast', Icon: Coffee },
  ]
  const breakfastAsked = lists.breakfast.filter(b => !!breakfastOn(b, today)).length
  const shown = open ? lists[open] : []

  return (
    <div className="bg-card border border-soft rounded-xl px-3 py-2 flex-shrink-0 shadow-soft">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Today</span>
        {chips.map(({ key, label, Icon }) => {
          const count = lists[key].length
          const on = open === key
          return (
            <button
              key={key}
              type="button"
              disabled={count === 0}
              onClick={() => setOpen(on ? null : key)}
              aria-expanded={on}
              className={'inline-flex items-center gap-1.5 text-[12px] font-bold px-2.5 py-1.5 rounded-lg border transition-colors ' +
                (on ? 'bg-gold-400 border-gold-400 text-ink-900 cursor-pointer'
                  : count === 0 ? 'bg-page border-soft text-muted'
                    : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100 cursor-pointer')}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              <span className="font-mono">{key === 'breakfast' ? breakfastAsked + '/' + count : count}</span>
            </button>
          )
        })}
      </div>

      {open && shown.length > 0 && (
        <div className="mt-2 pt-2 border-t border-soft flex flex-wrap gap-1.5 max-h-[96px] overflow-y-auto">
          {shown.map(b => {
            const h = hint(open, b)
            return (
              <button
                key={b.id}
                type="button"
                // The breakfast list stays open, so the desk goes down it room by room.
                onClick={() => { if (open === 'breakfast') onBreakfast(b); else { setOpen(null); onOpen(b) } }}
                className="inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg border border-soft bg-page hover:border-gold-400 hover:bg-gold-100 transition-colors cursor-pointer"
              >
                <b className="text-main">{b.guest_name}</b>
                <span className="text-muted">· {place(b)}</span>
                <span className={h.warn ? 'font-semibold text-danger-600' : 'text-muted'}>· {h.text}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

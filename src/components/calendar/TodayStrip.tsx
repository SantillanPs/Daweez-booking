import { useMemo, useState } from 'react'
import { Coffee, Utensils } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { dateToString } from '../../utils/helpers'
import { wantsBreakfastToday, breakfastOn, breakfastSummary } from '../../utils/breakfastChoice'
import { slipNumber } from '../../utils/orderSlips'
import { useDinerSlips } from '../../hooks/useDinerSlips'
import { DinerPayModal } from '../restaurant/DinerPayModal'
import { tableName } from '../restaurant/served'

type ListKey = 'breakfast' | 'diners'

interface TodayStripProps {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  /** Opens the breakfast picker for a room that has breakfast. */
  onBreakfast: (booking: Booking) => void
}

// The two things the desk does today that the calendar cannot show: ask the rooms with
// breakfast what they want, and take the money of a diner who has no room.
//
//   Breakfast — the rooms in the hotel that booked breakfast, and how many of them
//               have been asked what they want this morning (`1/3`).
//   Diners    — the diners with no room whose order slips are not paid. The money is
//               always taken here, at the front desk, never in the restaurant
//               (Sebastian, 2026-10-04); a room guest's slip is paid from the booking.
//
// **It used to be a whole line of the calendar** — "Today: Arriving · Leaving · In the
// hotel" — and Sebastian had it taken off as redundant (2026-10-08): the grid says all
// three now (the numbers under each date, the edges of the pills, the gold bar on a room).
// What was left sits on the calendar's top line, and only while there is something to do.
export function TodayStrip({ bookings, rooms, venues, onBreakfast }: TodayStripProps) {
  const [open, setOpen] = useState<ListKey | null>(null)
  const today = dateToString(new Date())
  const diners = useDinerSlips()

  // Not asked yet first, so the list reads as what is still to do.
  const breakfast = useMemo(() => bookings
    .filter(b => b.status !== 'blocked' && b.status !== 'cancelled' && !!b.actual_check_in && !b.actual_check_out)
    .filter(wantsBreakfastToday)
    .sort((a, b) => Number(!!breakfastOn(a, today)) - Number(!!breakfastOn(b, today))), [bookings, today])
  const breakfastAsked = breakfast.filter(b => !!breakfastOn(b, today)).length

  const place = (b: Booking) => {
    if (b.room_id) {
      const room = rooms.find(r => r.id === b.room_id)
      return room ? 'Room ' + room.room_number : 'Room'
    }
    return venues.find(v => v.id === b.venue_id)?.name || 'Venue'
  }

  const chipLook = (on: boolean) =>
    'inline-flex items-center gap-1.5 h-9 px-3 rounded-md border text-[13px] font-semibold transition-colors duration-150 cursor-pointer active:scale-[0.98] ' +
    (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')
  const NAME = 'flex w-full items-center gap-1.5 min-h-11 px-3 rounded-md border border-soft bg-card text-left text-[13px] hover:border-gold-400 hover:bg-gold-100 transition-colors duration-150 active:scale-[0.98] cursor-pointer'

  return (
    <div className="relative flex items-center gap-1.5 mr-1.5">
      {breakfast.length > 0 && (
        <button type="button" onClick={() => setOpen(open === 'breakfast' ? null : 'breakfast')} aria-expanded={open === 'breakfast'} className={chipLook(open === 'breakfast')}>
          <Coffee className="w-4 h-4" />
          Breakfast
          <span className="font-bold tabular-nums">{breakfastAsked + '/' + breakfast.length}</span>
        </button>
      )}
      {diners.slips.length > 0 && (
        <button type="button" onClick={() => setOpen(open === 'diners' ? null : 'diners')} aria-expanded={open === 'diners'} className={chipLook(open === 'diners')}>
          <Utensils className="w-4 h-4" />
          Diners to pay
          <span className="font-bold tabular-nums">{diners.slips.length}</span>
          {/* Somebody's bill has been sent over: they are on their way to pay. */}
          {diners.slips.some(s => !!s.tab.billed_at) && open !== 'diners' && (
            <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse motion-reduce:animate-none" />
          )}
        </button>
      )}

      {open && (<>
        {/* A tap anywhere else puts the list away. */}
        <button type="button" aria-label="Close the list" onClick={() => setOpen(null)} className="fixed inset-0 z-40 cursor-default" />
        <div className="absolute right-0 top-full z-50 mt-2 flex max-h-[320px] w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-1.5 overflow-y-auto rounded-lg border border-gold-400 bg-card p-2 animate-in fade-in duration-150 motion-reduce:animate-none">
          {open === 'breakfast' && breakfast.map(b => {
            const asked = breakfastOn(b, today)
            return (
              // The list stays open, so the desk goes down it room by room.
              <button key={b.id} type="button" onClick={() => onBreakfast(b)} className={NAME}>
                <b className="text-main">{b.guest_name}</b>
                <span className="text-muted">· {place(b)}</span>
                <span className={asked ? 'text-muted' : 'font-semibold text-danger-600'}>· {asked ? breakfastSummary(asked) : 'not asked yet'}</span>
              </button>
            )
          })}
          {open === 'diners' && diners.slips.map(s => (
            <button key={s.tab.id} type="button" onClick={() => { setOpen(null); diners.pay(s) }} className={NAME}>
              <b className="text-main">{tableName(s.tab.table_label) || s.tab.label || 'Walk-in'}</b>
              <span className="text-muted">· {[s.tab.table_label ? s.tab.label : '', slipNumber(s.tab)].filter(Boolean).join(' · ')}</span>
              {/* The bill has been sent over, or they are still at their table. */}
              {s.tab.billed_at
                ? <span className="font-semibold text-danger-600">· to pay ₱{s.total.toLocaleString()}</span>
                : <span className="text-muted">· still eating · ₱{s.total.toLocaleString()}</span>}
            </button>
          ))}
        </div>
      </>)}

      {diners.paying && (
        <DinerPayModal
          key={diners.paying.tab.id}
          slip={diners.paying}
          onClose={() => diners.pay(null)}
          onChanged={() => void diners.reload()}
        />
      )}
    </div>
  )
}

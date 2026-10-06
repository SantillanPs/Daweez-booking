import React from 'react'
import { Check } from 'lucide-react'
import { Room } from '../../types/booking'
import { breakfastSellable } from '../../utils/breakfast'
import { OPTION_NAME } from './formStyles'

interface BreakfastRoomChipsProps {
  /** The rooms this booking actually picked, in the order they were picked. */
  rooms: Room[]
  /** The room ids that have breakfast. Empty means none of them. */
  chosen: string[]
  onToggle: (roomId: string) => void
  onAll: (on: boolean) => void
  /** @deprecated kept for callers that still pass it; the price now lives on the room. */
  pricePerBed?: number
}

/**
 * Breakfast, per room (cards k140, k138 follow-up) — one line in the stay's list.
 *
 * Breakfast is a ROOM's choice, never a guest's, so the desk is asked one
 * question: "which rooms want breakfast?" — one tick box per room and one All/None
 * toggle.
 *
 * **It is a tick box, and it looks like one** (Sebastian, 2026-10-05: *"work on the
 * breakfast chip"*). OFF was an empty circle — the shape of a choose-one button — beside
 * the words `Room 3 ₱300`, which on a booking of one room read as the room and its price
 * rather than as breakfast to add. Now OFF is an empty square and ON a ticked one on gold,
 * so it still says its state without relying on colour (the owner could not tell that a
 * brown chip meant "on"). With one room the box says what it adds — `₱300 for the stay`;
 * the room is already in the form's title. With several, each box is named by its room.
 *
 * A room the desk has never priced is NOT tappable — it would charge ₱0 and look like it
 * worked — so it reads "no price".
 *
 * It builds OFF: a room starts without breakfast, so nothing is ever charged by
 * accident.
 *
 * **The sentences under the chips are gone** (the staff's feedback, 2026-10-04: the form
 * was hard to read). `No breakfast on this booking.` said what the empty boxes already
 * said; the total is in the payment column.
 */
export function BreakfastRoomChips({ rooms, chosen, onToggle, onAll }: BreakfastRoomChipsProps) {
  if (rooms.length === 0) return null

  const priced = rooms.filter(breakfastSellable)
  const allOn = priced.length > 0 && priced.every(r => chosen.includes(r.id))
  const alone = rooms.length === 1

  return (
    <li className="min-h-12 py-1.5 flex items-center justify-between gap-4">
      <span className={OPTION_NAME}>Breakfast</span>
      <div className="flex items-center justify-end gap-1.5 flex-wrap min-w-0">
        {priced.length > 1 && (
          <button
            type="button"
            onClick={() => onAll(!allOn)}
            className="h-9 text-[14px] font-semibold text-brand-text hover:underline px-2 cursor-pointer"
          >
            {allOn ? 'None' : 'All rooms'}
          </button>
        )}
        {rooms.map(room => {
          const sellable = breakfastSellable(room)
          const amount = Number(room.breakfast_price || 0)
          const on = sellable && chosen.includes(room.id)
          const price = '₱' + amount.toLocaleString()
          return (
            <button
              key={room.id}
              type="button"
              role="checkbox"
              disabled={!sellable}
              aria-checked={on}
              aria-label={'Breakfast for Room ' + room.room_number + (sellable ? ', ' + price + ' for the stay' : ', no price')}
              onClick={() => onToggle(room.id)}
              title={sellable ? undefined : 'No breakfast price for this room yet — set it in Settings, under Rooms & prices'}
              className={'flex items-center gap-2 h-9 text-[14px] font-semibold rounded-md pl-2.5 pr-3 border transition-colors duration-150 ' +
                (!sellable
                  ? 'bg-softbg text-muted border-soft cursor-not-allowed'
                  : on
                    ? 'bg-gold-400 text-ink-900 border-gold-400 cursor-pointer active:scale-[0.97]'
                    : 'bg-card text-main border-soft cursor-pointer hover:border-gold-400 active:scale-[0.97]')}
            >
              <span aria-hidden="true"
                // `rounded`, not `rounded-sm`: this project's `sm` is 8px, which drew the box
                // as the very circle it replaces.
                className={'w-4 h-4 shrink-0 inline-flex items-center justify-center rounded border-2 ' +
                  (on ? 'bg-ink-900 border-ink-900 text-gold-100' : 'border-ink-300')}>
                {on && <Check className="w-3 h-3" strokeWidth={4} />}
              </span>
              {!alone && <span>Room {room.room_number}</span>}
              <span className={'tabular-nums ' + (on || alone ? '' : 'text-muted')}>
                {sellable ? (alone ? price + ' for the stay' : price) : 'no price'}
              </span>
            </button>
          )
        })}
      </div>
    </li>
  )
}

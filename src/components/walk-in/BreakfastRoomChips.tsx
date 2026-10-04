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
 * question: "which rooms want breakfast?" — one chip per room and one All/None
 * toggle.
 *
 * A chip says its own state without relying on colour (the owner could not tell
 * that a brown chip meant "on"): a tick and a charcoal fill for ON, an empty circle
 * for OFF. A room the desk has never priced is NOT tappable — it would charge ₱0 and
 * look like it worked — so it reads "no price".
 *
 * It builds OFF: a room starts without breakfast, so nothing is ever charged by
 * accident.
 *
 * **The sentences under the chips are gone** (the staff's feedback, 2026-10-04: the form
 * was hard to read). `No breakfast on this booking.` said what the empty circles already
 * said; the price is on the chip and the total is in the payment column.
 */
export function BreakfastRoomChips({ rooms, chosen, onToggle, onAll }: BreakfastRoomChipsProps) {
  if (rooms.length === 0) return null

  const priced = rooms.filter(breakfastSellable)
  const allOn = priced.length > 0 && priced.every(r => chosen.includes(r.id))

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
          return (
            <button
              key={room.id}
              type="button"
              disabled={!sellable}
              aria-pressed={on}
              onClick={() => onToggle(room.id)}
              title={sellable
                ? (on ? 'Tap to take breakfast off this room' : 'Tap to add breakfast — ₱' + amount.toLocaleString() + ' once for the stay')
                : 'No breakfast price for this room yet — set it in Settings → Room Rates'}
              className={'flex items-center gap-1.5 h-9 text-[14px] font-semibold rounded-md px-3 border transition-[background-color,border-color,color,transform] duration-150 ' +
                (!sellable
                  ? 'bg-base-200 text-base-content/50 border-base-300 cursor-not-allowed'
                  : on
                    ? 'bg-ink-900 text-white border-ink-900 cursor-pointer active:scale-[0.97]'
                    : 'bg-base-100 text-base-content border-base-300 cursor-pointer hover:border-ink-900 active:scale-[0.97]')}
            >
              {on
                ? <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
                : <span className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-40 shrink-0" />}
              <span>Room {room.room_number}</span>
              <span className={on ? 'tabular-nums' : 'tabular-nums text-muted'}>
                {sellable ? '₱' + amount.toLocaleString() : 'no price'}
              </span>
            </button>
          )
        })}
      </div>
    </li>
  )
}

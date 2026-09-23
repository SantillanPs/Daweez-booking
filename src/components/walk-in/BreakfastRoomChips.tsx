import React from 'react'
import { Check } from 'lucide-react'
import { Room } from '../../types/booking'
import { breakfastSellable } from '../../utils/breakfast'

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
 * Breakfast, per room (cards k140, k138 follow-up).
 *
 * Breakfast is a ROOM's choice, never a guest's, so the desk is asked one
 * question: "which rooms want breakfast?" — one chip per room, one All/None
 * toggle, and a plain-language line under it saying what that adds up to.
 *
 * A chip says its own state without relying on colour (the owner could not tell
 * that a brown chip meant "on"): a tick for ON, an empty circle and a dashed
 * edge for OFF, and the summary line repeats it in words. A room the desk has
 * never priced is NOT tappable — it would charge ₱0 and look like it worked —
 * it reads "no price" and the summary says where to set it.
 *
 * It builds OFF: a room starts without breakfast, so nothing is ever charged by
 * accident.
 */
export function BreakfastRoomChips({ rooms, chosen, onToggle, onAll }: BreakfastRoomChipsProps) {
  if (rooms.length === 0) return null

  const priced = rooms.filter(breakfastSellable)
  const unpriced = rooms.filter(r => !breakfastSellable(r))
  const onRooms = rooms.filter(r => breakfastSellable(r) && chosen.includes(r.id))
  const added = onRooms.reduce((sum, r) => sum + Number(r.breakfast_price || 0), 0)
  const allOn = priced.length > 0 && priced.every(r => chosen.includes(r.id))
  const roomList = (list: Room[]) => list.map(r => 'Room ' + r.room_number).join(' and ')

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-2.5 font-sans">
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] font-bold tracking-widest uppercase text-base-content/60 mr-1">Breakfast</span>
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
              className={'flex items-center gap-1.5 text-[11.5px] font-bold rounded-lg px-2.5 py-1.5 border transition-colors ' +
                (!sellable
                  ? 'bg-page text-base-content/40 border-dashed border-soft cursor-not-allowed'
                  : on
                    ? 'bg-gold-400 text-ink-900 border-gold-600 shadow-sm cursor-pointer'
                    : 'bg-card text-muted border-dashed border-soft cursor-pointer hover:border-gold-400 hover:text-main')}
            >
              {on
                ? <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3.5} />
                : <span className="w-3.5 h-3.5 rounded-full border-2 border-current opacity-40 shrink-0" />}
              <span>Room {room.room_number}</span>
              <span className={on ? 'font-bold' : 'font-semibold opacity-70'}>
                {sellable ? '₱' + amount.toLocaleString() : 'no price'}
              </span>
            </button>
          )
        })}
        {priced.length > 1 && (
          <button
            type="button"
            onClick={() => onAll(!allOn)}
            className="text-[10.5px] font-bold text-muted border border-soft rounded-lg px-2 py-1.5 hover:text-main transition-colors cursor-pointer"
          >
            {allOn ? 'None' : 'All rooms'}
          </button>
        )}
      </div>

      <p className="text-[10.5px] mt-1.5">
        {onRooms.length > 0 ? (
          <span className="text-gold-800 font-bold">
            Breakfast added: ₱{added.toLocaleString()} once for the stay · {roomList(onRooms)}
          </span>
        ) : (
          <span className="text-muted font-semibold">No breakfast on this booking.</span>
        )}
        {unpriced.length > 0 && (
          <span className="text-muted">
            {' '}{roomList(unpriced)} {unpriced.length > 1 ? 'have' : 'has'} no breakfast price yet — set it in Settings → Room Rates.
          </span>
        )}
      </p>
    </div>
  )
}

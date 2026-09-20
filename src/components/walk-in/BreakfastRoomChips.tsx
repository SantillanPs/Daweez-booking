import React from 'react'
import { Room } from '../../types/booking'

interface BreakfastRoomChipsProps {
  /** The rooms this booking actually picked, in the order they were picked. */
  rooms: Room[]
  /** The room ids that have breakfast. Empty means none of them. */
  chosen: string[]
  onToggle: (roomId: string) => void
  onAll: (on: boolean) => void
  /** ₱ per bed, from Settings → Shared Rates (the breakfast price). */
  pricePerBed: number
}

/**
 * Breakfast, per room (cards k140/k138 follow-up).
 *
 * Breakfast is charged as ₱150 × the room's beds, once for the stay, so the
 * question the desk has to answer is "which ROOMS want breakfast?" — never
 * "which guest does?". This is that question, asked in one line no matter how
 * many rooms are on the booking: a chip per room, lit gold when it is on, plus
 * a single All/None toggle. The amount is worked out here so nobody multiplies
 * beds in their head.
 *
 * It builds OFF: a room starts without breakfast and the desk taps the ones that
 * want it, so nothing is ever charged by accident.
 */
export function BreakfastRoomChips({ rooms, chosen, onToggle, onAll, pricePerBed }: BreakfastRoomChipsProps) {
  if (rooms.length === 0) return null
  const allOn = rooms.every(r => chosen.includes(r.id))

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-2.5 font-sans">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-bold tracking-widest uppercase text-base-content/60">Breakfast</span>
        {rooms.map(room => {
          const on = chosen.includes(room.id)
          const beds = Number(room.beds || 0)
          const amount = pricePerBed * beds
          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onToggle(room.id)}
              title={beds > 0
                ? '₱' + pricePerBed + ' × ' + beds + ' beds = ₱' + amount.toLocaleString()
                : 'Set this room\'s number of beds in Settings → Room Rates'}
              className={'text-[11.5px] font-bold rounded-lg px-2.5 py-1.5 border transition-colors cursor-pointer ' +
                (on ? 'bg-gold-400 text-ink-900 border-gold-400' : 'bg-card text-muted border-soft hover:border-gold-400')}
            >
              Room {room.room_number}{on && beds > 0 ? ' · ₱' + amount.toLocaleString() : ''}
            </button>
          )
        })}
        {rooms.length > 1 && (
          <button
            type="button"
            onClick={() => onAll(!allOn)}
            className="text-[10.5px] font-bold text-muted border border-soft rounded-lg px-2 py-1.5 hover:text-main transition-colors cursor-pointer"
          >
            {allOn ? 'None' : 'All'}
          </button>
        )}
      </div>
      <p className="text-[10.5px] text-muted mt-1.5">
        ₱{pricePerBed} for each bed, once for the stay — only the rooms you tap are charged.
        {rooms.some(r => !r.beds) && ' A room with no bed count set keeps its old breakfast until you fill it in.'}
      </p>
    </div>
  )
}

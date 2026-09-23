import React from 'react'
import { Clock } from 'lucide-react'
import { Room } from '../../types/booking'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

/** The four durations on the hotel's printed rate board. */
const DURATIONS = [3, 6, 12, 22]

interface ShortStayPickerProps {
  /** The rooms picked on the calendar — their board prices fill the buttons. */
  rooms: Room[]
  /** The chosen duration, or null for an ordinary overnight stay. */
  hours: number | null
  onPick: (hours: number) => void
}

/**
 * Short stay, from the hotel's printed rate board.
 *
 * The desk has been taking these on paper: a room for 3, 6, 12 or 22 hours at a
 * fixed price. The 22-hour price IS the room's own price, so the three short
 * figures are the room's short-stay prices (blank = that room is not sold short).
 *
 * There is deliberately **no Overnight button** (the owner's instruction): an
 * ordinary overnight stay is what this row is left alone for, and it is booked
 * from a date range on the calendar, so offering it here only asked a question
 * the desk had already answered.
 *
 * A short stay still takes the room for the WHOLE day — housekeeping cleans it
 * afterwards, so it is never resold the same day (the owner's ruling) — which is
 * why nothing here has to know about times.
 */
export function ShortStayPicker({ rooms, hours, onPick }: ShortStayPickerProps) {
  const room = rooms[0]

  return (
    <div className="bg-card border border-soft rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-gold-100 text-gold-800 flex items-center justify-center shrink-0">
          <Clock className="w-3 h-3" />
        </span>
        <h4 className="text-[10px] font-bold text-main tracking-widest uppercase">Short stay</h4>
        <span className="text-[10.5px] text-muted">leave this alone for a normal overnight booking</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DURATIONS.map(h => {
          const price = h === 3 ? room?.hour3_price : h === 6 ? room?.hour6_price : h === 12 ? room?.hour12_price : (room?.promo_price || room?.base_price)
          // 22 hours is the room's own price, so it is always sellable; the three
          // short ones need a figure typed in Settings.
          const sellable = h === 22 ? !!price : !!price && Number(price) > 0
          const on = hours === h
          return (
            <button key={h} type="button" disabled={!sellable} onClick={() => onPick(h)}
              title={sellable ? undefined : 'This room is not sold for ' + h + ' hours — set it in Settings → Room Rates'}
              className={'text-[11.5px] font-bold px-3 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ' +
                (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-ink-600 hover:border-gold-400')}>
              {h} hours {sellable ? '· ' + fmtPeso(Number(price)) : '· —'}
            </button>
          )
        })}
      </div>

      {hours !== null ? (
        <p className="text-[11px] text-ink-600">
          <b className="text-ink-900">A {hours}-hour stay takes the room for the whole day</b> — housekeeping cleans it afterwards, so it cannot be sold again today. It is paid in full at the counter, with one receipt and no deposit.
        </p>
      ) : (
        <p className="text-[11px] text-muted">
          {room && !room.hour3_price && !room.hour6_price && !room.hour12_price
            ? 'This room has no short-stay prices yet — set them in Settings → Room Rates. The dashes on the printed board mean exactly that.'
            : 'Pick 3, 6 or 12 hours to sell this room short, or 22 hours for a full day.'}
        </p>
      )}
    </div>
  )
}

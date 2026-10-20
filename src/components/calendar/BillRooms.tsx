import { useEffect, useRef, useState } from 'react'
import { Link2 } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'

/**
 * **"🔗 4 rooms" beside the figure** (the shared-bill mock, Sebastian, 2026-10-20, "Pop-over"):
 * the figure is the whole bill's, and the tag says so. Tapped, the bill's rooms open in a small
 * bubble — nothing in the panel moves — and a room opens its own panel, which shows the same
 * figure. A tap anywhere else puts the bubble away.
 */
export function BillRooms({ rows, current, rooms, venues, onOpen }: {
  rows: Booking[]
  current: string
  rooms: Room[]
  venues: Venue[]
  onOpen?: (b: Booking) => void
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])
  const label = (b: Booking) => b.room_id
    ? String(rooms.find(r => r.id === b.room_id)?.room_number ?? '')
    : (venues.find(v => v.id === b.venue_id)?.name || 'Venue').charAt(0)
  return (
    <span ref={box} className="relative inline-flex">
      <button type="button" onClick={() => onOpen && setOpen(o => !o)} aria-expanded={open}
        className={'inline-flex items-center gap-1 rounded-full pl-[3px] pr-2 py-[2px] text-[11.5px] font-bold text-main transition-[background-color,transform] active:scale-95 ' +
          (open ? 'bg-gold-100' : 'bg-paper-100 hover:bg-gold-100') + (onOpen ? ' cursor-pointer' : ' cursor-default')}>
        <span aria-hidden="true" className={'w-4 h-4 rounded-full grid place-items-center bg-ink-900 text-gold-400 transition-transform duration-300 ' + (open ? '-rotate-[20deg]' : '')}>
          <Link2 className="w-2.5 h-2.5" />
        </span>
        {rows.length} rooms
      </button>
      {open && (
        <span role="group" aria-label="Rooms on this bill"
          className="bill-pop absolute top-[calc(100%+8px)] -left-1 z-20 flex gap-1 p-[5px] rounded-xl bg-ink-900 shadow-softLg">
          {rows.map((b, i) => (
            <button key={b.id} type="button" onClick={() => { setOpen(false); if (b.id !== current) onOpen?.(b) }}
              aria-current={b.id === current} aria-label={b.room_id ? 'Room ' + label(b) : label(b)}
              style={{ '--i': i } as React.CSSProperties}
              className={'bw-in min-w-9 h-8 px-2 rounded-lg border-[1.5px] font-display text-[13px] font-bold transition-colors cursor-pointer ' +
                (b.id === current ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-ink-800 border-ink-700 text-white hover:border-gold-400')}>
              {label(b)}
            </button>
          ))}
        </span>
      )}
    </span>
  )
}

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BedDouble, ChevronLeft, ChevronRight, ConciergeBell } from 'lucide-react'
import { Booking } from '../../types/booking'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface BillPickerProps {
  /** The "Send bill" button it opens above. */
  anchor: DOMRect
  /** `Table 4 · OS-0021`. */
  title: string
  total: number
  /** The guests in the hotel a bill may go on, with where each one stays (`Room 2`). */
  guests: { booking: Booking; place: string; room?: number }[]
  /** The guest pays now, at the front desk. */
  onFrontDesk: () => void
  /** The bill goes on this guest's room. */
  onRoom: (booking: Booking, place: string) => void
  onClose: () => void
}

const ROW = 'w-full min-h-[60px] flex items-center gap-3 px-3 py-2 rounded-xl border border-soft bg-card text-left hover:border-gold-400 hover:bg-gold-100 hover:translate-x-0.5 transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer animate-in fade-in slide-in-from-top-1 fill-mode-both motion-reduce:animate-none'

// Where a table's bill goes (Sebastian, 2026-10-05).
//
// A guest with a room sits at a table like anybody else, and "not all guests want their
// bills added to the rooms": it is only when the bill comes that they say whether they
// pay now, at the front desk, or it goes on their room to be paid before they check out.
// So a table is never tied to a room while the order is taken — the room is chosen here,
// at the end, and only if the guest asks for it.
//
// **Two choices first, the rooms second** (2026-10-08). It was one window with the front
// desk and every room in a single list; most bills go to the front desk, so the rooms
// wait behind "A room". It opens just above the button that was pressed.
export function BillPicker({ anchor, title, total, guests, onFrontDesk, onRoom, onClose }: BillPickerProps) {
  const [rooms, setRooms] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[70] font-sans" onClick={onClose}>
      <div role="dialog" aria-label="Where the bill goes" onClick={e => e.stopPropagation()}
        style={{ '--r': Math.max(16, window.innerWidth - anchor.right) + 'px', '--b': Math.max(16, window.innerHeight - anchor.top + 8) + 'px' } as React.CSSProperties}
        className="absolute right-[var(--r)] bottom-[var(--b)] w-[300px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain flex flex-col gap-2 p-3.5 rounded-xl bg-card border border-gold-400 shadow-softLg origin-bottom-right animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
        {rooms ? (
          <>
            <button type="button" onClick={() => setRooms(false)}
              className="self-start inline-flex items-center gap-1 min-h-9 text-[13px] font-semibold text-brand-text cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <p className="px-0.5 font-display text-[15px] font-bold tracking-tight text-main">Which room?</p>
            {guests.map(({ booking, place, room }, i) => (
              <button key={booking.id} type="button" onClick={() => onRoom(booking, place)} className={ROW} style={{ animationDelay: i * 45 + 'ms' }}>
                {/* The room's number in the gold tile the calendar gives a room with a guest in it. */}
                <span className="w-[38px] h-[38px] shrink-0 grid place-items-center rounded-lg bg-gold-100 shadow-[inset_4px_0_0_#D0AB60] font-display text-[16px] font-bold text-main">
                  {room ?? <BedDouble className="w-4 h-4" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[14.5px] font-bold text-main">{place}</span>
                  <span className="block text-[12.5px] text-muted truncate">{booking.guest_name}</span>
                </span>
              </button>
            ))}
          </>
        ) : (
          <>
            <p className="px-0.5 font-display text-[15px] font-bold tracking-tight text-main">
              Send the bill to
              <span className="block font-sans text-[12.5px] font-medium tracking-normal text-muted truncate">
                {title} · <b className="font-bold text-main tabular-nums">{fmtPeso(total)}</b>
              </span>
            </p>
            <button type="button" onClick={onFrontDesk} className={ROW}>
              <ConciergeBell className="w-[22px] h-[22px] shrink-0 text-gold-800" />
              <span className="min-w-0">
                <span className="block text-[14.5px] font-bold text-main">Front desk</span>
                <span className="block text-[12.5px] text-muted">The guest pays there</span>
              </span>
            </button>
            {guests.length > 0 && (
              <button type="button" onClick={() => setRooms(true)} className={ROW} style={{ animationDelay: '45ms' }}>
                <BedDouble className="w-[22px] h-[22px] shrink-0 text-gold-800" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-bold text-main">A room</span>
                  <span className="block text-[12.5px] text-muted">It goes on the room’s bill</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
              </button>
            )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BedDouble, ChevronLeft, ChevronRight, Clock, ConciergeBell } from 'lucide-react'
import { Booking } from '../../types/booking'
import { peso } from '../../utils/helpers'
import { readPayLaterNames } from '../../utils/tabs'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'


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
  /** The guest pays another time: the bill goes on the front desk's Pay later list under this name. */
  onPayLater: (name: string) => void
  /** The name the slip was started under, if any — the first guess for who pays later. */
  name?: string
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
export function BillPicker({ anchor, title, total, guests, onFrontDesk, onRoom, onPayLater, name, onClose }: BillPickerProps) {
  const [rooms, setRooms] = useState(false)
  // **Pay later** (Sebastian, 2026-11-17): a diner who eats and does not pay at once. Asked for a
  // name so the desk knows whom to ask; the names already waiting are offered, so one person's
  // slips stay under one name.
  const [later, setLater] = useState(false)
  const [who, setWho] = useState(name || '')
  const [known, setKnown] = useState<{ name: string; owed: number }[]>([])
  useEffect(() => { readPayLaterNames().then(setKnown).catch(() => {}) }, [])
  const typed = who.trim().toLowerCase()
  const offered = known.filter(k => !typed || k.name.toLowerCase().includes(typed)).slice(0, 6)

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
        {later ? (
          <form className="contents" onSubmit={e => { e.preventDefault(); onPayLater(who) }}>
            <button type="button" onClick={() => setLater(false)}
              className="self-start inline-flex items-center gap-1 min-h-9 text-[13px] font-semibold text-brand-text cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <p className="px-0.5 font-display text-[15px] font-bold tracking-tight text-main">
              Who pays later?
              <span className="block font-sans text-[12.5px] font-medium tracking-normal text-muted tabular-nums">{peso(total)}</span>
            </p>
            <input autoFocus value={who} onChange={e => setWho(e.target.value)} placeholder="e.g. Sir James" autoComplete="off"
              className="w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[16px] focus:outline-none focus:border-gold-500" />
            {offered.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {offered.map((k, i) => (
                  <button key={k.name} type="button" onClick={() => setWho(k.name)} style={{ animationDelay: i * 35 + 'ms' }}
                    className={'min-h-9 px-3 rounded-full border text-[13px] font-semibold transition-colors cursor-pointer animate-in fade-in slide-in-from-top-1 fill-mode-both motion-reduce:animate-none ' +
                      (k.name.toLowerCase() === typed ? 'border-gold-400 bg-gold-100 text-main' : 'border-soft bg-card text-main hover:border-gold-400 hover:bg-gold-100')}>
                    {k.name} <span className="font-medium text-muted tabular-nums">{peso(k.owed)}</span>
                  </button>
                ))}
              </div>
            )}
            <button type="submit" className="min-h-12 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold transition-[background-color,transform] active:scale-[0.98] cursor-pointer">
              Pay later
            </button>
          </form>
        ) : rooms ? (
          <>
            <button type="button" onClick={() => setRooms(false)}
              className="self-start inline-flex items-center gap-1 min-h-9 text-[13px] font-semibold text-brand-text cursor-pointer">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <p className="px-0.5 font-display text-[15px] font-bold tracking-tight text-main">Which room?</p>
            {guests.map(({ booking, place, room }, i) => (
              <button key={booking.id} type="button" onClick={() => onRoom(booking, place)} className={ROW} style={{ animationDelay: i * 45 + 'ms' }}>
                {/* The room's number with the green bar the calendar gives a room with a guest in it. */}
                <span className="w-[38px] h-[38px] shrink-0 grid place-items-center rounded-lg bg-emerald-50 shadow-[inset_4px_0_0_#059669] font-display text-[16px] font-bold text-main">
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
                {title} · <b className="font-bold text-main tabular-nums">{peso(total)}</b>
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
            <button type="button" onClick={() => { markSeen('pay-later'); setLater(true) }} className={'relative ' + ROW} style={{ animationDelay: '90ms' }}>
              <Clock className="w-[22px] h-[22px] shrink-0 text-gold-800" />
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-bold text-main">Pay later</span>
                <span className="block text-[12.5px] text-muted">Frees the table · the desk keeps it</span>
              </span>
              <ChevronRight className="w-4 h-4 shrink-0 text-muted" />
              <NewTag id="pay-later" at="-top-1.5 right-2" />
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

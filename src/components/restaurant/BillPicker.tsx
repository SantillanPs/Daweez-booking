import { createPortal } from 'react-dom'
import { BedDouble, ConciergeBell, X } from 'lucide-react'
import { Booking } from '../../types/booking'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface BillPickerProps {
  /** `Table 4 · OS-0021`. */
  title: string
  total: number
  /** The guests in the hotel a bill may go on, with where each one stays (`Room 2`). */
  guests: { booking: Booking; place: string }[]
  /** The guest pays now, at the front desk. */
  onFrontDesk: () => void
  /** The bill goes on this guest's room. */
  onRoom: (booking: Booking, place: string) => void
  onClose: () => void
}

const ROW = 'w-full min-h-14 flex items-center gap-3 px-3 rounded-lg border border-soft bg-card text-left hover:border-gold-400 hover:bg-gold-100 transition-colors duration-200 active:scale-[0.99] cursor-pointer'

// Where a table's bill goes (Sebastian, 2026-10-05).
//
// A guest with a room sits at a table like anybody else, and "not all guests want their
// bills added to the rooms": it is only when the bill comes that they say whether they
// pay now, at the front desk, or it goes on their room to be paid before they check out.
// So a table is never tied to a room while the order is taken — the room is chosen here,
// at the end, and only if the guest asks for it.
export function BillPicker({ title, total, guests, onFrontDesk, onRoom, onClose }: BillPickerProps) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-900/50 font-sans animate-in fade-in duration-200 motion-reduce:animate-none" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="Where the bill goes" onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-sm max-h-[88dvh] flex flex-col bg-card border border-soft rounded-t-2xl sm:rounded-xl shadow-softLg overflow-hidden animate-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none">
        <div className="shrink-0 flex items-start justify-between gap-3 px-4 py-3 border-b border-soft">
          <div className="min-w-0">
            <h3 className="font-display font-bold text-main">Send the bill</h3>
            <p className="text-[14px] text-muted mt-0.5 truncate">
              {title} · <b className="font-bold text-main tabular-nums">{fmtPeso(total)}</b>
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 -mr-2 -mt-1.5 inline-flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 space-y-2">
          <button type="button" onClick={onFrontDesk} className={ROW}>
            <ConciergeBell className="w-5 h-5 shrink-0 text-gold-600" />
            <span className="text-[15px] font-bold text-main">To the front desk — the guest pays now</span>
          </button>

          {guests.length > 0 && <p className="pt-2 px-1 text-[13px] font-medium text-muted">Or onto a room’s bill</p>}
          {guests.map(({ booking, place }) => (
            <button key={booking.id} type="button" onClick={() => onRoom(booking, place)} className={ROW}>
              <BedDouble className="w-5 h-5 shrink-0 text-gold-600" />
              <span className="min-w-0">
                <span className="block text-[15px] font-bold text-main">{place}</span>
                <span className="block text-[13px] text-muted truncate">{booking.guest_name}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  )
}

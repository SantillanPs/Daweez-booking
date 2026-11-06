import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Booking, Room } from '../../types/booking'
import { isRoomAvailable } from '../../utils/availability'
import { ChannelAlert, CHANNEL_ADMIN, CHANNEL_NAME, closeChannelAlert, placeChannelStay } from '../../utils/channelStay'
import { showToast } from '../../utils/toast'
import { ChannelMark } from './ChannelMark'
import { shortDay } from '../../utils/helpers'

const fmtDays = (a: string, b: string) => {
  return shortDay(a) + ' → ' + shortDay(b)
}

/**
 * **A room sold twice** (the mock, Sebastian, 2026-10-31). The site sold dates this hotel had already
 * given away, so two guests hold the room and the desk decides; nothing here moves the guest already
 * in it (the app never moves a booking by itself, Sebastian, 2026-10-20). The first free room of the
 * same kind leads and the rest wait under More.
 */
export function SoldTwicePanel({ alert, rooms, bookings, onClose, onAnswered, onFailed, onPlaced }: {
  alert: ChannelAlert
  rooms: Room[]
  bookings: Booking[]
  onClose: () => void
  /** Takes it off the calendar and the bell at once. */
  onAnswered: (id: string) => void
  /** The save was refused: it comes back. */
  onFailed: () => void
  onPlaced: (bookingId: string) => void
}) {
  const [more, setMore] = useState(false)
  const [placed, setPlaced] = useState<number | null>(null)
  const site = CHANNEL_NAME[alert.channel]
  const here = rooms.find(r => r.id === alert.room_id)
  const inWay = bookings.find(b => b.id === alert.booking_id)
  // The same kind of room first, the guest having paid for that kind.
  const free = useMemo(() => rooms
    .filter(r => r.id !== alert.room_id && isRoomAvailable(r.id, alert.check_in, alert.check_out, bookings))
    .sort((a, b) => Number(b.name === here?.name) - Number(a.name === here?.name) || a.room_number - b.room_number),
  [rooms, bookings, alert, here])
  const [best, ...others] = free

  const place = (room: Room) => {
    setPlaced(room.room_number)
    onAnswered(alert.id)
    placeChannelStay(alert.id, room.id).then(id => {
      window.setTimeout(() => { onClose(); onPlaced(id) }, 900)
    }).catch(err => {
      onFailed(); setPlaced(null)
      showToast(/ROOM_TAKEN/.test(String(err?.message)) ? 'Room ' + room.room_number + ' was taken a moment ago. Choose another.' : 'Could not move the guest. Please try again.', 'error')
    })
  }
  // Dealt with away from the screen. The sync will not ask again while the stay stays on the site.
  const settle = () => {
    onClose()
    onAnswered(alert.id)
    closeChannelAlert(alert.id).catch(() => { onFailed(); showToast('Could not save that. Please try again.', 'error') })
  }

  const QUIET = 'w-full min-h-11 rounded-lg border-[1.5px] border-soft px-3 text-left text-[13px] font-semibold text-main hover:bg-softbg active:scale-[0.98] transition-[background-color,transform] cursor-pointer'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-slate-900/50 animate-in fade-in duration-200 motion-reduce:animate-none" />
      <div role="dialog" aria-label={'Room ' + here?.room_number + ' sold twice'} className="bw-arrive relative w-full max-w-[26rem] max-h-[88vh] overflow-y-auto rounded-xl bg-card p-5 grid gap-4 shadow-softLg">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-[42px] h-[42px] shrink-0 grid place-items-center rounded-[10px] border-[1.5px] border-dashed border-danger-500 bg-danger-50 font-display text-[19px] font-bold text-danger-600">!</span>
          <h3 className="flex-1 min-w-0 font-display font-bold text-[18px] leading-tight text-main">Room {here?.room_number} sold twice</h3>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="-mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {placed !== null ? (
          <p role="status" className="bp-up min-h-[54px] grid place-items-center rounded-xl bg-emerald-50 font-display text-[18px] font-bold text-emerald-700">✓ Room {placed}</p>
        ) : (<>
          <div className="grid gap-2">
            {inWay && (
              <div className="flex items-center gap-2 rounded-lg bg-softbg px-3 py-2 text-[13px]">
                <b className="min-w-0 truncate font-semibold text-main">{inWay.status === 'blocked' ? 'Blocked' : inWay.guest_name}</b>
                <span className="ml-auto whitespace-nowrap text-muted">{fmtDays(inWay.check_in, inWay.check_out)}</span>
              </div>
            )}
            <div className="flex items-center gap-2 rounded-lg border-[1.5px] border-dashed border-danger-500 bg-danger-50 px-3 py-2 text-[13px]">
              <ChannelMark channel={alert.channel} />
              <b className="min-w-0 truncate font-semibold text-main">{site} guest</b>
              <span className="ml-auto whitespace-nowrap text-muted">{fmtDays(alert.check_in, alert.check_out)}</span>
            </div>
          </div>
          {best ? (
            <button type="button" onClick={() => place(best)} className="bw-shine w-full min-h-[54px] rounded-xl bg-gold-400 px-4 text-[16px] font-bold text-ink-900 hover:bg-gold-600 active:scale-[0.98] transition-[background-color,transform] duration-200 cursor-pointer">
              Put guest in Room {best.room_number}
            </button>
          ) : (
            <p className="text-center text-[13px] font-semibold text-muted">No other room is free on these dates.</p>
          )}
          <div className="grid gap-2">
            {(more || !best) && (
              <div className="grid gap-2 bw-arrive">
                {others.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {others.map(r => (
                      <button key={r.id} type="button" onClick={() => place(r)} title={r.name}
                        className="min-h-11 rounded-full border-[1.5px] border-soft px-3.5 text-[13px] font-bold text-main hover:bg-softbg active:scale-95 transition-[background-color,transform] cursor-pointer">
                        Room {r.room_number}
                      </button>
                    ))}
                  </div>
                )}
                <button type="button" onClick={settle} className={QUIET}>Guest found another room</button>
                <button type="button" onClick={() => { window.open(CHANNEL_ADMIN[alert.channel], '_blank', 'noopener'); settle() }} className={QUIET}>Cancel on {site}</button>
              </div>
            )}
            {best && (
              <button type="button" onClick={() => setMore(m => !m)} aria-expanded={more} className="min-h-9 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">
                {more ? 'Less' : 'More'}
              </button>
            )}
          </div>
        </>)}
      </div>
    </div>,
    document.body,
  )
}

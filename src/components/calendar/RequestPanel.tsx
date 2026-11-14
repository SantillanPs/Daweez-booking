import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { isRoomAvailable, isVenueRangeAvailable } from '../../utils/availability'
import { BookingRequest } from '../../utils/bookingRequests'
import { parseDay, pesoWhole, shortDay } from '../../utils/helpers'
import { RequestMark } from './RequestBell'

const SOURCE = { whatsapp: 'WhatsApp', messenger: 'Messenger', website: 'Website' }
const REASONS = ['Room taken', 'No deposit', 'Guest cancelled']

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'just now'
  if (min < 60) return min + ' min ago'
  const h = Math.round(min / 60)
  return h < 24 ? h + (h === 1 ? ' hour ago' : ' hours ago') : shortDay(iso.slice(0, 10))
}

/**
 * **A guest asking for a room** (the mock, Sebastian, 2026-11-12). Who, which room and when, what they
 * were quoted and the deposit asked (half the stay, Sebastian). Booking it opens the new bill already
 * filled in, so the desk makes the booking the usual way; turning it down keeps a reason, like a
 * cancelled bill. A room taken since is still booked from here, on other dates the desk sets on the bill: the request
 * is kept "in case that guest wants to reschedule" (Sebastian, 2026-11-15).
 */
export function RequestPanel({ request: r, rooms, venues, bookings, onClose, onBook, onDecline }: {
  request: BookingRequest
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  onClose: () => void
  onBook: (r: BookingRequest) => void
  onDecline: (r: BookingRequest, note: string) => void
}) {
  const room = rooms.find(x => x.id === r.room_id)
  const venue = venues.find(x => x.id === r.room_id)
  const unit = room ? 'Room ' + room.room_number : venue?.name || 'Room'
  const free = room ? isRoomAvailable(r.room_id, r.check_in, r.check_out, bookings) : isVenueRangeAvailable(r.room_id, r.check_in, r.check_out, bookings)
  const [more, setMore] = useState(false)
  const [picked, setPicked] = useState<string[]>(free ? [] : ['Room taken'])
  const [words, setWords] = useState('')
  const [copied, setCopied] = useState(false)
  const nights = Math.round((parseDay(r.check_out).getTime() - parseDay(r.check_in).getTime()) / 86400000)

  const copy = () => {
    navigator.clipboard?.writeText(r.phone).then(() => setCopied(true), () => {})
  }
  const decline = () => onDecline(r, [...picked, words.trim()].filter(Boolean).join(' · '))

  const CHIP = 'inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-bold text-ink-700'
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-slate-900/50 animate-in fade-in duration-200 motion-reduce:animate-none" />
      <div role="dialog" aria-label={'Request from ' + r.guest_name} className="bw-arrive relative w-full max-w-[26rem] max-h-[88vh] overflow-y-auto rounded-xl bg-card p-5 grid gap-4 shadow-softLg">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="w-[42px] h-[42px] shrink-0 grid place-items-center rounded-[10px] border-[1.5px] border-dashed border-gold-600 bg-gold-100">
            <RequestMark source={r.source} big />
          </span>
          <h3 className="flex-1 min-w-0 font-display font-bold text-[18px] leading-tight text-main">
            <span className="block truncate">{r.guest_name}</span>
            <span className="block text-[12px] font-sans font-semibold text-muted">{SOURCE[r.source]} · {ago(r.created_at)}</span>
          </h3>
          <button type="button" onClick={onClose} aria-label="Close" title="Close" className="-mr-2 w-11 h-11 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-3.5 gap-y-1.5 text-[14px]">
          <dt className="font-semibold text-muted">Stay</dt>
          <dd className="flex flex-wrap items-center gap-1.5 font-bold tabular-nums text-main">
            {unit} · {shortDay(r.check_in)} → {shortDay(r.check_out)}
            <span className={CHIP}>{nights} {nights === 1 ? 'night' : 'nights'}</span>
            {r.guests ? <span className={CHIP}>{r.guests} {r.guests === 1 ? 'guest' : 'guests'}</span> : null}
          </dd>
          <dt className="font-semibold text-muted">Phone</dt>
          <dd className="flex items-center gap-2 font-bold tabular-nums text-main">
            <span className="select-all">{r.phone}</span>
            <button type="button" onClick={copy} className="rounded-md border-[1.5px] border-soft px-2 py-0.5 text-[11px] font-bold text-ink-700 hover:bg-softbg active:scale-95 transition-[background-color,transform] cursor-pointer">{copied ? 'Copied' : 'Copy'}</button>
          </dd>
          {r.companions?.length ? (<>
            <dt className="font-semibold text-muted">With</dt>
            <dd className="font-bold text-main">{r.companions.join(', ')}</dd>
          </>) : null}
          {r.language && (<>
            <dt className="font-semibold text-muted">Speaks</dt>
            <dd><span className="inline-flex rounded-full bg-gold-100 px-2 py-0.5 text-[11px] font-bold text-gold-800">{r.language}</span></dd>
          </>)}
          {r.note && (<>
            <dt className="font-semibold text-muted">Note</dt>
            <dd className="text-main">{r.note}</dd>
          </>)}
        </dl>

        {r.quoted_total ? (
          <div className="flex gap-2.5">
            <div className="flex-1 rounded-lg bg-softbg px-3 py-2.5">
              <span className="block text-[12px] font-semibold text-muted">Quoted</span>
              <b className="font-display text-[18px] font-bold tabular-nums text-main">{pesoWhole(r.quoted_total)}</b>
            </div>
            <div className="flex-1 rounded-lg bg-gold-100 px-3 py-2.5">
              <span className="block text-[12px] font-semibold text-gold-800">Deposit asked</span>
              <b className="font-display text-[18px] font-bold tabular-nums text-main">{pesoWhole(r.quoted_total / 2)}</b>
            </div>
          </div>
        ) : null}

        {!free && <p className="-mb-2 text-center text-[13px] font-semibold text-danger-600">{unit} was taken on these dates</p>}
        <button type="button" onClick={() => onBook(r)} className="bw-shine w-full min-h-[54px] rounded-xl bg-gold-400 px-4 text-[16px] font-bold text-ink-900 hover:bg-gold-600 active:scale-[0.98] transition-[background-color,transform] duration-200 cursor-pointer">
          {free ? 'Book ' + unit : 'Book other dates'}
        </button>

        <div className="grid gap-2">
          {more && (
            <div className="grid gap-2 bw-arrive">
              <div className="flex flex-wrap gap-1.5">
                {REASONS.map(x => {
                  const on = picked.includes(x)
                  return (
                    <button key={x} type="button" aria-pressed={on} onClick={() => setPicked(p => on ? p.filter(y => y !== x) : [...p, x])}
                      className={'min-h-10 rounded-full border-[1.5px] px-3 text-[13px] font-bold active:scale-95 transition-[background-color,border-color,color,transform] cursor-pointer ' + (on ? 'bg-ink-900 border-ink-900 text-white' : 'border-soft text-main hover:bg-softbg')}>
                      {x}
                    </button>
                  )
                })}
              </div>
              <input value={words} onChange={e => setWords(e.target.value)} placeholder="Guest found a cheaper place" aria-label="Why"
                className="w-full min-h-11 rounded-lg border-[1.5px] border-soft bg-card px-3 text-[16px] text-main outline-none focus:border-gold-400" />
              <button type="button" onClick={decline} className="w-full min-h-11 rounded-lg bg-danger-50 text-[14px] font-bold text-danger-600 hover:bg-danger-100 active:scale-[0.98] transition-[background-color,transform] cursor-pointer">
                Turn down
              </button>
            </div>
          )}
          <button type="button" onClick={() => setMore(m => !m)} aria-expanded={more} className="min-h-9 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">
            {more ? 'Less' : 'More'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

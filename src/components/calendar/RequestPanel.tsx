import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, BedDouble, CalendarDays, Moon, Users, Clock, Coffee, Phone, Wallet, Copy } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { isRoomAvailable, isVenueRangeAvailable } from '../../utils/availability'
import { BookingRequest, paymentShotUrl, referenceSeen, unitsOf } from '../../utils/bookingRequests'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { parseDay, pesoWhole, shortDay } from '../../utils/helpers'
import { RequestMark } from './RequestBell'
import { NewTag } from '../NewMark'

const SOURCE = { whatsapp: 'WhatsApp', messenger: 'Messenger', website: 'Website' }
const digits = (v?: string | null) => (v || '').replace(/\D/g, '')

/** Who the screenshot says the money went to, and whether that is the hotel's account. The apps hide the middle of
 *  a number (0917 ... 1234) and of a name (NA***A D.), so the ends are what can match. Null when it could not be read. */
function sentTo(r: BookingRequest): { to: string; ours: boolean } | null {
  const read = r.pay_read
  const name = (read?.sent_to_name || '').trim()
  const num = (read?.sent_to_number || '').trim()
  if (!name && !num) return null
  const pay = getPaymentAccounts()
  const acct = r.pay_account === 'gcash' ? { name: pay.gcashName, number: pay.gcashNumber }
    : r.pay_account === 'bank2' ? { name: pay.bank2AccountName, number: pay.bank2AccountNumber }
    : { name: pay.bankAccountName, number: pay.bankAccountNumber }
  const tail = digits(num).slice(-3)
  const first = (v: string) => v.toLowerCase().replace(/[^a-z]/g, '').slice(0, 2)
  const ours = tail.length === 3 ? digits(acct.number).endsWith(tail) : !!first(name) && first(name) === first(acct.name)
  return { to: [name, num].filter(Boolean).join(' · '), ours }
}

const ago = (iso: string) => {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'just now'
  if (min < 60) return min + ' min ago'
  const h = Math.round(min / 60)
  return h < 24 ? h + (h === 1 ? ' hour ago' : ' hours ago') : shortDay(iso.slice(0, 10))
}

/**
 * **A guest asking for a room.** Kept to the one job (Sebastian, 2026-11-19: "let's redesign this to keep it simpler"):
 * who it is, the stay, the money to find in the app, and Confirm or Remove. The stay is a ticket — in, nights, out, the
 * room — with an icon on each fact (Sebastian, 2026-11-27: "I need to immediately know the room and dates"); a taken
 * room turns its tile red instead of adding a line. The screenshot is read only for the reference and the account it went to;
 * a check that passed says nothing, only a problem gets a line. Confirm opens the new bill already filled in (on other
 * dates if the room was taken since: the request is kept "in case that guest wants to reschedule", 2026-11-15).
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
  const nameOf = (id: string) => {
    const room = rooms.find(x => x.id === id)
    return room ? 'Room ' + room.room_number : venues.find(x => x.id === id)?.name || 'Room'
  }
  // A website request can ask for several rooms (2026-11-26); each one is checked.
  const taken = unitsOf(r).filter(u => !(rooms.some(x => x.id === u) ? isRoomAvailable(u, r.check_in, r.check_out, bookings) : isVenueRangeAvailable(u, r.check_in, r.check_out, bookings)))
  const [removing, setRemoving] = useState(false)
  const [copied, setCopied] = useState(false)
  const paid = !!r.pay_amount
  const way = r.pay_method === 'GCash' ? 'GCash' : r.pay_account === 'bank2' ? 'Landbank' : r.pay_account === 'bank' ? 'BPI' : 'the bank'
  const [shot, setShot] = useState<string | null>(null)
  const [zoom, setZoom] = useState(false)
  const [seen, setSeen] = useState<string | null>(null)
  useEffect(() => { if (r.pay_shot) void paymentShotUrl(r.pay_shot).then(setShot) }, [r.pay_shot])
  useEffect(() => { if (r.pay_reference) referenceSeen(r.pay_reference, r.id).then(setSeen, () => setSeen(null)) }, [r.pay_reference, r.id])
  const to = paid ? sentTo(r) : null
  const units = unitsOf(r)
  const isRoom = (id: string) => rooms.some(x => x.id === id)
  // The tile says which rooms; with one, a red tile is the whole message. With several it cannot say which, so a line does.
  const problems = ([
    taken.length > 0 && units.length > 1 && { icon: BedDouble, text: taken.map(nameOf).join(' + ') + (taken.length > 1 ? ' were' : ' was') + ' taken on these dates' },
    to && !to.ours && { icon: Wallet, text: 'Sent to ' + to.to + ', not the hotel' },
    seen && { icon: Copy, text: 'Same reference as ' + seen },
  ].filter(Boolean)) as { icon: typeof X; text: string }[]
  const nights = Math.round((parseDay(r.check_out).getTime() - parseDay(r.check_in).getTime()) / 86400000)
  const allRooms = units.every(isRoom)
  const tile = allRooms ? units.map(u => rooms.find(x => x.id === u)!.room_number).join(' · ') : units.map(nameOf).join(' + ')
  // The website writes breakfast as the note; it reads better as one of the stay's facts.
  const breakfast = r.note === 'Wants breakfast'
  const end = (day: string, label: string) => {
    const d = parseDay(day)
    return (
      <div className="grid gap-px px-2 py-2.5 text-center">
        <span className="flex items-center justify-center gap-1 text-[11px] font-bold uppercase tracking-wide text-muted"><CalendarDays className="w-3.5 h-3.5 text-gold-600" />{label}</span>
        <b className="font-display text-[28px] leading-none font-bold tabular-nums text-main">{d.getDate()}</b>
        <span className="text-[12px] font-semibold text-muted">{d.toLocaleDateString('en-US', { weekday: 'short' })} · {d.toLocaleDateString('en-US', { month: 'short' })}</span>
      </div>
    )
  }

  const copy = () => {
    navigator.clipboard?.writeText(r.phone).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) }, () => {})
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-slate-900/50 animate-in fade-in duration-200 motion-reduce:animate-none" />
      <div role="dialog" aria-label={'Request from ' + r.guest_name} className="bw-arrive relative w-full max-w-[24rem] max-h-[88vh] overflow-y-auto overflow-x-hidden rounded-xl bg-card p-5 grid gap-4 shadow-softLg">
        <NewTag id="request-pay-day" />
        <div className="grid gap-0.5">
          <div className="-mt-2 -mr-2 flex items-center gap-1.5 text-[12px] font-semibold text-muted">
            <RequestMark source={r.source} />
            <span className="flex-1">{SOURCE[r.source]} · {ago(r.created_at)}</span>
            <button type="button" onClick={onClose} aria-label="Close" title="Close" className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="min-w-0 font-display font-bold text-[22px] leading-tight text-main break-words">{r.guest_name}</h3>
            <button type="button" onClick={copy} title="Copy the number" className="inline-grid text-[15px] font-semibold tabular-nums text-gold-800 active:scale-95 transition-transform cursor-pointer">
              <span className={'[grid-area:1/1] inline-flex items-center gap-1.5 border-b-[1.5px] border-dashed border-gold-200 transition-[opacity,transform] duration-200 ' + (copied ? 'opacity-0 -translate-y-1.5' : '')}><Phone className="w-4 h-4" />{r.phone}</span>
              <span aria-live="polite" className={'[grid-area:1/1] text-emerald-700 transition-[opacity,transform] duration-200 ' + (copied ? '' : 'opacity-0 translate-y-1.5')}>Copied</span>
            </button>
          </div>
        </div>

        <div className="grid gap-2.5">
          <div className="bw-arrive relative grid grid-cols-[1fr_auto_1fr_auto] rounded-xl bg-softbg">
            <NewTag id="request-ticket" />
            {end(r.check_in, 'In')}
            <span className="grid place-items-center content-center gap-0.5 px-0.5 text-[11px] font-bold text-gold-800" title={nights + (nights === 1 ? ' night' : ' nights')}>
              <Moon className="w-[18px] h-[18px] text-gold-600" />{nights}
            </span>
            {end(r.check_out, 'Out')}
            <span className={'grid place-items-center content-center gap-0.5 rounded-r-xl px-3.5 text-white transition-colors duration-300 ' + (taken.length ? 'bg-danger-600' : 'bg-ink-900')}>
              <BedDouble className="w-[18px] h-[18px] opacity-70" />
              <b className={'font-display font-bold leading-none text-center ' + (tile.length > 5 ? 'text-[14px] max-w-[6.5rem]' : 'text-[22px]')}>{tile}</b>
              <small className="text-[10px] font-bold uppercase opacity-85">{taken.length ? 'Taken' : allRooms ? (units.length > 1 ? 'Rooms' : 'Room') : 'Venue'}</small>
            </span>
          </div>
          {(r.guests || r.arrival || breakfast) && (
            <div className="flex flex-wrap justify-evenly gap-x-3 gap-y-1.5 text-[13px] font-semibold text-main">
              {r.guests ? <span className="inline-flex items-center gap-1.5"><Users className="w-[15px] h-[15px] text-gold-600" />{r.guests} {r.guests > 1 ? 'guests' : 'guest'}</span> : null}
              {r.arrival && <span className="inline-flex items-center gap-1.5"><Clock className="w-[15px] h-[15px] text-gold-600" />{r.arrival}</span>}
              {breakfast && <span className="inline-flex items-center gap-1.5"><Coffee className="w-[15px] h-[15px] text-gold-600" />Breakfast</span>}
            </div>
          )}
          {r.companions?.length ? <p className="text-[14px] font-semibold text-main"><span className="text-muted">with</span> {r.companions.join(', ')}</p> : null}
          {r.note && !breakfast && <p className="text-[13px] text-muted">{r.note}</p>}
        </div>

        {paid ? (
          <div className="flex items-center gap-3.5 rounded-xl bg-gold-100 p-3.5">
            <button type="button" onClick={() => shot && setZoom(true)} aria-label="See the screenshot"
              className="w-[64px] h-[88px] shrink-0 overflow-hidden rounded-md bg-gold-200 cursor-zoom-in active:scale-95 transition-transform">
              {shot && <img src={shot} alt="" className="w-full h-full object-cover object-top animate-in fade-in duration-300" />}
            </button>
            <div className="min-w-0 grid gap-0.5">
              <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gold-800"><Wallet className="w-3.5 h-3.5" />Find in {way}</span>
              <b className="font-display text-[30px] leading-none font-bold tabular-nums text-main">{pesoWhole(r.pay_amount!)}</b>
              {r.pay_reference && <span className="mt-1 text-[15px] font-bold tabular-nums text-main break-all"><span className="mr-1.5 text-[12px] font-semibold text-muted">ref</span>{r.pay_reference}</span>}
              {to?.ours && <span className="text-[13px] font-semibold text-main"><span className="mr-1.5 text-[12px] text-muted">to</span>{to.to} <span className="text-emerald-700">{'✓'}</span></span>}
            </div>
          </div>
        ) : r.pay_on && r.quoted_total ? (
          // Paying at the hotel (the website, 2026-11-26): nothing is paid yet, and the guest named the day they come.
          <div className="rounded-xl bg-softbg p-3.5 grid gap-0.5">
            <span className="text-[12px] font-semibold text-muted">Pays at the front desk</span>
            <b className="font-display text-[26px] leading-none font-bold tabular-nums text-main">{pesoWhole(r.quoted_total / 2)}</b>
            <span className="text-[14px] font-semibold text-main">on {shortDay(r.pay_on)}</span>
          </div>
        ) : r.quoted_total ? (
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

        {problems.map(({ icon: Icon, text: p }, i) => (
          <p key={p} className="bw-arrive -mt-1 flex items-center gap-2 rounded-lg bg-danger-50 px-3 py-2 text-[13px] font-semibold text-danger-600" style={{ animationDelay: i * 90 + 'ms' }}>
            <Icon aria-hidden="true" className="w-4 h-4 shrink-0" />{p}
          </p>
        ))}

        <button type="button" onClick={() => onBook(r)} className="bw-shine w-full min-h-[54px] rounded-xl bg-gold-400 px-4 text-[16px] font-bold text-ink-900 hover:bg-gold-600 active:scale-[0.98] transition-[background-color,transform] duration-200 cursor-pointer">
          Confirm
        </button>

        <div className="-mt-2 grid">
          <div className={'grid transition-[grid-template-rows] duration-300 ' + (removing ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <button type="button" onClick={() => onDecline(r, '')} tabIndex={removing ? 0 : -1}
                className="mt-1 w-full min-h-11 rounded-lg bg-danger-50 text-[14px] font-bold text-danger-600 hover:bg-danger-100 active:scale-[0.98] transition-[background-color,transform] cursor-pointer">
                Remove request
              </button>
            </div>
          </div>
          <button type="button" onClick={() => setRemoving(m => !m)} aria-expanded={removing} className="min-h-9 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">
            {removing ? 'Keep it' : 'Remove'}
          </button>
        </div>
      </div>
      {zoom && shot && <div onClick={() => setZoom(false)} className="fixed inset-0 z-10 grid place-items-center bg-slate-900/80 p-4 cursor-zoom-out animate-in fade-in duration-200 motion-reduce:animate-none">
        <img src={shot} alt="The guest's payment screenshot" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg animate-in zoom-in-95 duration-200 motion-reduce:animate-none" />
      </div>}
    </div>,
    document.body,
  )
}

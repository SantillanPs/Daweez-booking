import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, BedDouble, CalendarDays, Moon, Users, Clock, Coffee, Phone, Wallet, Copy, Link2, Check, Receipt, CircleCheck } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { isRoomAvailable, isVenueRangeAvailable } from '../../utils/availability'
import { BookingRequest, bookedAlready, paymentShotUrl, referenceSeen, unitsOf } from '../../utils/bookingRequests'
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
export function RequestPanel({ request: r, rooms, venues, bookings, onClose, onBook, onBookNow, onConfirmOnto, onConfirmOnly, onDecline }: {
  request: BookingRequest
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  onClose: () => void
  /** Opens the new bill filled in: only when the room was taken, so it can go on other dates. */
  onBook: (r: BookingRequest) => void
  /** Books it at once from the request, no bill opening (Sebastian, 2026-11-27: "the information of the guest is all there"). */
  onBookNow: (r: BookingRequest) => void
  /** The booking the desk already made: the request becomes it, and the payment goes on it unless it is there already. */
  onConfirmOnto: (r: BookingRequest, booking: Booking, addMoney: boolean) => void
  /** The money was found; the guest is told, nothing is booked yet. */
  onConfirmOnly: (r: BookingRequest) => void
  onDecline: (r: BookingRequest, note: string) => void
}) {
  const nameOf = (id: string) => {
    const room = rooms.find(x => x.id === id)
    return room ? 'Room ' + room.room_number : venues.find(x => x.id === id)?.name || 'Room'
  }
  // Booked by hand already (the guest called): that booking is not "taken", it is this request.
  const found = bookedAlready(r, bookings)
  // A website request can ask for several rooms (2026-11-26); each one is checked.
  const taken = found ? [] : unitsOf(r).filter(u => !(rooms.some(x => x.id === u) ? isRoomAvailable(u, r.check_in, r.check_out, bookings) : isVenueRangeAvailable(u, r.check_in, r.check_out, bookings)))
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
    seen && !found?.moneyOn && { icon: Copy, text: 'Same reference as ' + seen },
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

  // **The money is found before anything is confirmed** (Sebastian, 2026-11-27: "a payment confirmed step, only then
  // does it add to the bill"; mock A): the desk types the last 4 of the reference they see in the app. Only once it
  // matches do the buttons appear. Money already on the booking, or confirmed before, needs nothing.
  const ref = digits(r.pay_reference)
  const last4 = ref.slice(-4)
  const [typed, setTyped] = useState('')
  const [nope, setNope] = useState(0)
  const [stamped, setStamped] = useState(false)
  const checked = !paid || !!found?.moneyOn || !!r.pay_confirmed_at || stamped
  const type = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 4)
    setTyped(d)
    if (d.length < 4) return
    if (d === last4) setTimeout(() => setStamped(true), 220)
    else { setNope(n => n + 1); setTimeout(() => setTyped(''), 380) }
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

        {found && (
          <div className="bw-arrive grid gap-2 rounded-xl bg-softbg p-3.5">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-gold-800"><Link2 className="w-3.5 h-3.5" />Booked already</span>
            <div className="min-w-0 grid">
              <b className="text-[15px] font-bold text-main break-words">{found.booking.guest_name} · {nameOf(found.booking.room_id || found.booking.venue_id || '')}</b>
              <span className="text-[12px] font-semibold text-muted tabular-nums">{shortDay(found.booking.check_in)} → {shortDay(found.booking.check_out)}{found.booking.invoice_number ? ' · #' + found.booking.invoice_number : ''}{found.booking.prepared_by ? ' · ' + found.booking.prepared_by : ''}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12px] font-semibold text-emerald-700">
              {found.sameName && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Same name</span>}
              {found.sameDates && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Same dates</span>}
              {found.moneyOn && <span className="inline-flex items-center gap-1"><Check className="w-3.5 h-3.5" />Same reference</span>}
            </div>
          </div>
        )}

        {paid ? (
          <div className={'grid gap-3 rounded-xl p-3.5 transition-colors duration-500 ' + (checked ? 'bg-emerald-50' : 'bg-gold-100')}>
          <div className="flex items-center gap-3.5">
            <button type="button" onClick={() => shot && setZoom(true)} aria-label="See the screenshot"
              className="relative w-[64px] h-[88px] shrink-0 overflow-hidden rounded-md bg-gold-200 cursor-zoom-in active:scale-95 transition-transform">
              {shot && <img src={shot} alt="" className="w-full h-full object-cover object-top animate-in fade-in duration-300" />}
              {checked && <span className={'absolute left-1 right-1 top-[38%] rounded border-[2.5px] border-emerald-700 bg-white/90 py-0.5 text-center font-display text-[9px] font-extrabold tracking-wide text-emerald-700 ' + (stamped ? 'rq-stamp' : '-rotate-[14deg]')}>RECEIVED</span>}
            </button>
            <div className="min-w-0 grid gap-0.5">
              {checked
                ? <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700"><CircleCheck className="w-3.5 h-3.5" />{found?.moneyOn ? 'On that bill' : 'Found in ' + way}</span>
                : <span className="flex items-center gap-1.5 text-[12px] font-semibold text-gold-800"><Wallet className="w-3.5 h-3.5" />Find in {way}</span>}
              <b className="font-display text-[30px] leading-none font-bold tabular-nums text-main">{pesoWhole(r.pay_amount!)}</b>
              {r.pay_reference && <span className="mt-1 text-[15px] font-bold tabular-nums text-main break-all"><span className="mr-1.5 text-[12px] font-semibold text-muted">ref</span>{r.pay_reference}</span>}
              {to?.ours && <span className="text-[13px] font-semibold text-main"><span className="mr-1.5 text-[12px] text-muted">to</span>{to.to} <span className="text-emerald-700">{'✓'}</span></span>}
              {found?.moneyOn && <span className="flex items-center gap-1.5 text-[12px] font-semibold text-emerald-700"><Receipt className="w-3.5 h-3.5" />{found.moneyOn.receipt_number}</span>}
            </div>
          </div>
          {!checked && (last4.length === 4 ? (
            <label className="grid justify-items-center gap-2 border-t-[1.5px] border-dashed border-gold-200 pt-3">
              <span className="text-[13px] font-semibold text-gold-800">Last 4 of the ref in {way}</span>
              {/* The shake restarts by remounting the slots only: the box keeps its focus for the next try. */}
              <span className="relative">
              <span key={nope} className={'flex items-center gap-1.5 ' + (nope ? 'animate-shake' : '')}>
                {[0, 1, 2, 3].map(i => (
                  <span key={i + (typed[i] || '')} className={'rq-slot grid place-items-center w-10 h-12 rounded-lg bg-card font-display text-[20px] font-bold tabular-nums text-main ' + (typed[i] ? 'pop ' : '') + (typed.length === 4 && typed === last4 ? 'ring-[1.5px] ring-emerald-700 text-emerald-700' : i === typed.length ? 'ring-2 ring-gold-600' : 'ring-[1.5px] ring-gold-200')}>{typed[i] || ''}</span>
                ))}
              </span>
                <input value={typed} onChange={e => type(e.target.value)} inputMode="numeric" autoComplete="off" maxLength={4} placeholder="e.g. 5570"
                  aria-label={'Last 4 digits of the reference in ' + way} className="absolute inset-0 w-full opacity-0 text-[16px] cursor-text" />
              </span>
            </label>
          ) : (
            // No reference to match against: the desk says they found it.
            <button type="button" onClick={() => setStamped(true)} className="min-h-11 border-t-[1.5px] border-dashed border-gold-200 text-[14px] font-bold text-gold-800 hover:text-main cursor-pointer">
              Found it in {way}
            </button>
          ))}
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

        {checked && (
          <button type="button" className={'bw-shine w-full min-h-[54px] rounded-xl bg-gold-400 px-4 text-[16px] font-bold text-ink-900 hover:bg-gold-600 active:scale-[0.98] transition-[background-color,transform] duration-200 cursor-pointer ' + (stamped ? 'bw-arrive' : '')}
            onClick={() => found ? onConfirmOnto(r, found.booking, paid && !found.moneyOn) : taken.length ? onBook(r) : onBookNow(r)}>
            <NewTag id="request-confirm" />
            {found ? 'Confirm on this booking' : taken.length ? 'Confirm' : 'Confirm & book'}
          </button>
        )}

        <div className="-mt-2 grid">
          <div className={'grid transition-[grid-template-rows] duration-300 ' + (removing ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
            <div className="overflow-hidden">
              <button type="button" onClick={() => onDecline(r, '')} tabIndex={removing ? 0 : -1}
                className="mt-1 w-full min-h-11 rounded-lg bg-danger-50 text-[14px] font-bold text-danger-600 hover:bg-danger-100 active:scale-[0.98] transition-[background-color,transform] cursor-pointer">
                Remove request
              </button>
            </div>
          </div>
          <div className="flex justify-center gap-6">
            {paid && checked && !found && !r.pay_confirmed_at && !removing && (
              <button type="button" onClick={() => onConfirmOnly(r)} className="min-h-9 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">Confirm only</button>
            )}
            <button type="button" onClick={() => setRemoving(m => !m)} aria-expanded={removing} className="min-h-9 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">
              {removing ? 'Keep it' : 'Remove'}
            </button>
          </div>
        </div>
      </div>
      {zoom && shot && <div onClick={() => setZoom(false)} className="fixed inset-0 z-10 grid place-items-center bg-slate-900/80 p-4 cursor-zoom-out animate-in fade-in duration-200 motion-reduce:animate-none">
        <img src={shot} alt="The guest's payment screenshot" className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg animate-in zoom-in-95 duration-200 motion-reduce:animate-none" />
      </div>}
    </div>,
    document.body,
  )
}

import React, { useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { X, Check, Coffee, Plus, House } from 'lucide-react'
import { NationalityInput } from '../NationalityInput'
import { NumInput } from '../NumInput'
import { Booking, Room, Venue, Companion, EventAddons } from '../../types/booking'
import { getEffectiveNightlyPrice } from '../../utils/promoMode'
import { venueTypes, venueTypeOf, venueTypeTitle } from '../../utils/venueTypes'
import { dateToString, generateUUID } from '../../utils/helpers'
import { calculatePricing } from '../../utils/pricing'
import { getRateConfig } from '../../utils/rateConfig'
import { breakfastSellable } from '../../utils/breakfast'
import { PAYMENT_METHODS } from '../../utils/paymentMethod'
import { lastReceptionist, rememberReceptionist, staffNamesOf } from '../../utils/receptionists'
import { PriceBox } from '../PriceBox'
import { useDashboardData } from '../DashboardContext'
import { showToast } from '../../utils/toast'

type CreateManual = (p: {
  roomId?: string; venueId?: string; guestName: string; guestEmail: string; guestPhone: string
  guestAddress?: string; guestNationality?: string; companions?: Companion[]
  checkIn: string; checkOut: string; source: 'manual'; status: 'confirmed'
  referenceNumber?: string; registeredOn?: string
  paymentMethod?: string; downpaymentPaid?: number; balanceDue?: number
  paymentStatus?: 'unpaid' | 'downpayment' | 'paid'; paymentRecords?: Booking['payment_records']
  preparedBy?: string; breakfastIncluded?: boolean; stayHours?: number; groupId?: string
  eventAddons?: EventAddons
}) => Promise<Booking>

interface Sel { checkIn: string; checkOut: string; type: 'room' | 'venue' }

interface LogOldBookingModalProps {
  rooms: Room[]
  venues: Venue[]
  /** Every booking, for the receptionists' names written on them before. */
  bookings: Booking[]
  createManualBooking: CreateManual
  onClose: () => void
  // Calendar selection (room/venue + dates) to pre-fill, like the other booking forms.
  initialSelections?: Record<string, Sel>
  /** One day was picked on the calendar — the pick a short stay starts from — so the paper
   *  is a short stay and only its hours are asked (Sebastian, 2026-10-17: "even though I
   *  clicked short stay on the calendar, it didn't choose it immediately in the form"). */
  shortStay?: boolean
}

const HOURS = [3, 6, 12, 22] as const
const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)'
const fmtPeso = (n: number) => '₱' + Math.round(n).toLocaleString()
const fmtDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) }
const nextDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return dateToString(new Date(y, m - 1, d + 1)) }
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const newReceiptId = () => 'rcpt-' + Date.now()

// A slot that changes what it holds grows or shrinks to it, so what sits below it glides
// instead of jumping (the Log old booking mock, Sebastian, 2026-10-17: "it snaps when you hide").
function swap(change: () => void, ...slots: (HTMLElement | null)[]) {
  const live = slots.filter((s): s is HTMLElement => !!s)
  const from = live.map(s => s.offsetHeight)
  flushSync(change)
  if (reduced()) return
  live.forEach((s, i) => {
    const to = s.offsetHeight
    if (to === from[i]) return
    s.style.overflow = 'hidden'
    s.animate([{ height: from[i] + 'px' }, { height: to + 'px' }], { duration: 340, easing: EASE }).onfinish = () => { s.style.overflow = '' }
  })
}

/** A box ticked on the paper: the tick draws itself in (`lo-tick` in index.css). */
function Tick({ on, onClick, boxed, children }: { on: boolean; onClick: () => void; boxed?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick}
      className={'lo-tick inline-flex items-center gap-2 min-h-11 text-[15px] font-bold text-main cursor-pointer active:scale-[0.97] transition-[transform,border-color] ' +
        (boxed ? 'min-h-12 px-3 rounded-xl border-[1.5px] bg-card ' + (on ? 'border-ink-900' : 'border-paper-200 hover:border-gold-400') : '')}>
      <span className="w-6 h-6 rounded-[6px] border-2 border-ink-900 grid place-items-center shrink-0">
        <svg viewBox="0 0 24 24" className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
      </span>
      {children}
    </button>
  )
}

/** Circled by hand on the paper — the hours taken, the receptionist on duty (`lo-circ`). */
function Circled({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={'lo-circ relative min-h-11 px-3.5 py-2 text-center leading-tight cursor-pointer active:scale-[0.96] transition-transform ' + (className || '')}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" className="absolute -inset-[3px] w-[calc(100%+6px)] h-[calc(100%+6px)] overflow-visible text-gold-400" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M52 3C82 2 98 15 97 31C96 49 70 58 46 57C19 56 2 46 3 29C4 12 28 4 62 6" />
      </svg>
      {children}
    </button>
  )
}

/**
 * Breakfast for one room, as a strip along the bottom of its ticket with a switch (the
 * breakfast mock, design A, Sebastian, 2026-10-17) — the way the Vacation House's kinds sit
 * on theirs, instead of a row of ticks apart from the rooms. On, it turns the breakfast brown
 * of the calendar and the cup hops. A room never priced asks for its price right here, as the
 * New booking form does; the price is saved on the room and breakfast goes on.
 */
function BreakfastStrip({ room, on, perNight, onToggle }: { room: Room; on: boolean; perNight: boolean; onToggle: () => void }) {
  const [pricing, setPricing] = useState(false)
  const { updateRoomBreakfastPrice } = useDashboardData()
  const price = Number(room.breakfast_price || 0)
  const base = 'w-full flex items-center gap-2.5 min-h-12 px-3 border-t-[1.5px] border-dashed border-paper-200 text-left text-[14px] font-bold transition-colors duration-300 '
  if (!breakfastSellable(room)) return (
    <div className={base + 'bg-paper-50 text-gold-800'}>
      <Coffee aria-hidden="true" className="w-4 h-4 shrink-0" />
      <span className="flex-1">Breakfast</span>
      {pricing ? (
        <PriceBox className="h-9 text-[14px]" label={null} onBack={() => setPricing(false)}
          onSave={p => {
            setPricing(false)
            updateRoomBreakfastPrice?.(room.id, p)
              .catch(() => showToast('The breakfast price for Room ' + room.room_number + ' was not saved. Try again.', 'error'))
            onToggle()
          }} />
      ) : (
        <button type="button" onClick={() => setPricing(true)} aria-label={'Breakfast for Room ' + room.room_number + ', no price yet — set it'}
          className="h-8 px-2.5 rounded-lg border border-dashed border-gold-500 text-[13px] hover:bg-gold-100 cursor-pointer transition-[background-color,transform] active:scale-95">Set price</button>
      )}
    </div>
  )
  return (
    <button type="button" role="switch" aria-checked={on} onClick={onToggle}
      aria-label={'Breakfast for Room ' + room.room_number + ', ' + fmtPeso(price) + (perNight ? ' a night' : '')}
      className={base + 'cursor-pointer ' + (on ? 'bg-gold-100 text-gold-800' : 'bg-paper-50 text-main hover:bg-gold-100/60')}>
      <Coffee aria-hidden="true" className={'w-4 h-4 shrink-0 ' + (on ? 'bk-hop' : 'text-muted')} />
      <span className="flex-1">Breakfast <span className="text-[12px] font-semibold text-muted tabular-nums">· {fmtPeso(price)}{perNight ? ' a night' : ''}</span></span>
      <span aria-hidden="true" className={'relative w-10 h-6 shrink-0 rounded-full transition-colors duration-300 ' + (on ? 'bg-gold-800' : 'bg-paper-300')}>
        <span className={'absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] ' + (on ? 'translate-x-4' : '')} />
      </span>
    </button>
  )
}

/** A heading on the paper, with a rule running out to the edge. */
const Section = ({ children }: { children: React.ReactNode }) => (
  <h4 className="flex items-center gap-2.5 font-display text-[15px] font-bold text-main after:content-[''] after:flex-1 after:h-px after:bg-paper-200">{children}</h4>
)

/**
 * Copies a paper registration into the system — design B of the Log old booking mock
 * (Sebastian, 2026-10-17): laid out like the paper the desk copies from, with the payment as
 * its torn-off stub. It logs a short stay (3, 6, 12 or 22 hours, one room) and each room's
 * breakfast, and every figure comes from `calculatePricing` — the form used to work out its
 * own nights × price, so a paper booking with breakfast or for a few hours was logged at the
 * wrong figure.
 */
export function LogOldBookingModal({ rooms, venues, bookings, createManualBooking, onClose, initialSelections, shortStay }: LogOldBookingModalProps) {
  const [regNo, setRegNo] = useState('')
  const [regOn, setRegOn] = useState('')
  const [guestName, setGuestName] = useState('')
  const [guestPhone, setGuestPhone] = useState('')
  const [nationality, setNationality] = useState('')
  const [address, setAddress] = useState('')
  const [companions, setCompanions] = useState<Companion[]>([])
  const [more, setMore] = useState(false)
  const [units, setUnits] = useState<Record<string, Sel>>(() => ({ ...initialSelections }))
  const [hours, setHours] = useState<number>(3)
  const [breakfast, setBreakfast] = useState<string[]>([])
  // The kind taken of a venue that comes in kinds (the Vacation House: the house, & Ground,
  // or Exclusive), by venue id; missing is the plain venue — as on the New booking form.
  const [kinds, setKinds] = useState<Record<string, string>>({})
  const [paid, setPaid] = useState<number | null>(null)
  const [method, setMethod] = useState('')
  const [payDate, setPayDate] = useState<string | null>(null)
  // The same names as the New booking form, opening on the last one used on this computer.
  const [preparedBy, setPreparedBy] = useState(lastReceptionist)
  const [staffNames, setStaffNames] = useState(() => staffNamesOf(bookings))
  const [typingStaff, setTypingStaff] = useState(false)
  const [error, setError] = useState('')
  const [logged, setLogged] = useState(false)

  const staySlot = useRef<HTMLDivElement>(null)
  const moreSlot = useRef<HTMLDivElement>(null)
  const lineSlot = useRef<HTMLDivElement>(null)
  const nameBox = useRef<HTMLLabelElement>(null)
  const methodBox = useRef<HTMLDivElement>(null)

  const entries = Object.entries(units)
  const first = entries[0]
  // A short stay is one room for one day: the room and the day the desk picked.
  const isShort = !!shortStay && first?.[1].type === 'room'
  const list: [string, Sel][] = isShort ? [[first[0], { ...first[1], checkOut: nextDay(first[1].checkIn) }]] : entries
  const valid = (s: Sel) => !!s.checkIn && !!s.checkOut && s.checkOut > s.checkIn
  const nameOf = (id: string, s: Sel) => {
    if (s.type === 'room') return 'Room ' + (rooms.find(r => r.id === id)?.room_number ?? '')
    const venue = venues.find(v => v.id === id)
    const kind = venueTypeOf(venue, kinds[id])
    return venue ? (kind ? venueTypeTitle(venue, kind) : venue.name) : id
  }
  const addonsOf = (id: string): EventAddons | undefined => (kinds[id] ? { venue_type: kinds[id] } : undefined)

  // ONE pricing rule: the same figures the booking is saved with.
  const priced = list.map(([id, s]) => {
    const p = valid(s) ? calculatePricing({
      roomId: s.type === 'room' ? id : undefined, venueId: s.type === 'venue' ? id : undefined,
      checkIn: s.checkIn, checkOut: s.checkOut, guestEmail: '', rooms, venues, eventAddons: addonsOf(id),
      breakfastIncluded: breakfast.includes(id), shortStayHours: isShort ? hours : undefined, rates: getRateConfig(),
    }) : null
    return { id, s, p, total: p?.grandTotal ?? 0 }
  })
  const total = priced.reduce((a, u) => a + u.total, 0)
  const paidNow = paid ?? total
  const balance = Math.max(0, total - paidNow)

  const want = (el: HTMLElement | null) => {
    if (!el) return
    el.classList.remove('bw-want', 'bw-nope'); el.getBoundingClientRect(); el.classList.add('bw-want', 'bw-nope')
    el.querySelector('input')?.focus()
  }

  const setUnit = (id: string, patch: Partial<Sel>) => { setUnits(u => ({ ...u, [id]: { ...u[id], ...patch } })); setPaid(null) }
  const addUnit = (id: string) => {
    if (!id || units[id]) return
    const type = rooms.some(r => r.id === id) ? 'room' : 'venue'
    const today = dateToString(new Date())
    const dates = first ? { checkIn: first[1].checkIn, checkOut: first[1].checkOut } : { checkIn: today, checkOut: nextDay(today) }
    swap(() => { setUnits(u => ({ ...u, [id]: { ...dates, type } })); setPaid(null) }, staySlot.current, lineSlot.current)
  }
  // The row folds shut first, so the rooms under it slide up rather than jump.
  const removeUnit = (id: string, row: HTMLElement | null) => {
    const go = () => swap(() => {
      setUnits(u => { const n = { ...u }; delete n[id]; return n })
      setBreakfast(b => b.filter(x => x !== id)); setPaid(null)
    }, lineSlot.current)
    if (!row || reduced()) { go(); return }
    row.style.overflow = 'hidden'
    row.animate([{ height: row.offsetHeight + 'px', opacity: 1 }, { height: '0px', opacity: 0, transform: 'translateX(-12px)' }], { duration: 280, easing: EASE }).onfinish = go
  }
  const toggleBreakfast = (id: string) => swap(() => {
    setBreakfast(b => b.includes(id) ? b.filter(x => x !== id) : [...b, id]); setPaid(null)
  }, lineSlot.current)

  const reset = () => {
    // The receptionist on duty stays: the next paper is usually from the same shift.
    setRegNo(''); setRegOn(''); setGuestName(''); setGuestPhone(''); setNationality(''); setAddress('')
    // A short stay keeps its room and day — there is nowhere on it to pick them again.
    setCompanions([]); setMore(false); if (!isShort) setUnits({}); setHours(3); setBreakfast([]); setKinds({})
    setPaid(null); setMethod(''); setPayDate(null); setError(''); setLogged(false)
  }

  const handleSave = async () => {
    if (!guestName.trim()) { want(nameBox.current); return }
    if (list.length === 0 || list.some(([, s]) => !valid(s))) { want(staySlot.current); return }
    if (paidNow > 0 && !method) { want(methodBox.current); return }
    // The seal shows at once and the rows are saved behind it; a failure takes it back.
    setError(''); setLogged(true)
    if (preparedBy.trim()) rememberReceptionist(preparedBy)
    try {
      const n = priced.length
      // The one amount paid is split across the rooms in proportion to each room's bill.
      const raw = priced.map(u => total > 0 ? Math.floor(paidNow * u.total / total) : 0)
      let diff = paidNow - raw.reduce((a, b) => a + b, 0)
      for (let i = 0; i < n && diff > 0; i++) { const add = Math.min(priced[i].total - raw[i], diff); raw[i] += add; diff -= add }
      const paidAt = new Date((payDate ?? list[0][1].checkIn) + 'T12:00:00').toISOString()
      // ONE receipt, on EVERY room it paid for, with each room's own slice as `share`
      // (the owner's ruling, 2026-09-30). No `receipt_number`: `receiptNumberFor` derives a
      // stable one for a payment from the paper days.
      const receiptId = newReceiptId()
      const groupId = n > 1 ? 'grp-' + generateUUID() : undefined
      const cleaned = companions.filter(c => c.name.trim())
      for (let i = 0; i < n; i++) {
        const { id, s, total: own } = priced[i]
        const down = raw[i]
        const bal = Math.max(0, own - down)
        await createManualBooking({
          roomId: s.type === 'room' ? id : undefined,
          venueId: s.type === 'venue' ? id : undefined,
          groupId,
          guestName: guestName.trim(),
          guestEmail: 'admin@daweez-booking.vercel.app',
          guestPhone: guestPhone.trim() || 'None',
          guestAddress: address.trim() || undefined,
          guestNationality: nationality.trim() || undefined,
          companions: cleaned.length > 0 ? cleaned : undefined,
          checkIn: s.checkIn, checkOut: s.checkOut, source: 'manual', status: 'confirmed',
          referenceNumber: regNo.trim() || undefined,
          registeredOn: regOn || undefined,
          breakfastIncluded: breakfast.includes(id),
          eventAddons: addonsOf(id),
          stayHours: isShort ? hours : undefined,
          paymentMethod: method || undefined,
          downpaymentPaid: down,
          balanceDue: bal,
          paymentStatus: bal <= 0 ? 'paid' : down > 0 ? 'downpayment' : 'unpaid',
          paymentRecords: paidNow > 0
            ? [{ id: receiptId, amount: paidNow, method, paid_at: paidAt, ...(n > 1 ? { share: down } : {}) }]
            : undefined,
          preparedBy: preparedBy.trim() || undefined,
        })
      }
    } catch (err) {
      setLogged(false)
      setError(err instanceof Error ? err.message : 'Could not save the booking. Please try again.')
    }
  }

  // EASIER TO READ (the paper card mock, Sebastian, 2026-10-17: "it's a bit hard to read"):
  // labels in plain words at 13px instead of tiny grey capitals, darker writing lines, the
  // figures larger, and the paper parted into Guest and Stay.
  const LABEL = 'block text-[13px] font-semibold text-ink-600'
  const LINE = 'w-full bg-transparent border-0 border-b-2 border-paper-300 py-2 text-[17px] font-semibold text-main placeholder:font-medium placeholder:text-paper-500 focus:outline-none focus:border-gold-400 transition-colors'
  const free = (id: string) => !units[id]

  if (logged) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
        <div className="w-full max-w-md bg-card rounded-xl shadow-softLg p-8 grid justify-items-center gap-3 text-center bw-arrive">
          <span className="w-[72px] h-[72px] rounded-full bg-emerald-50 grid place-items-center bk-pop">
            <Check className="w-9 h-9 text-emerald-600" strokeWidth={3} />
          </span>
          <h3 className="font-display font-bold text-[20px] text-main">Logged</h3>
          <p className="text-[14px] text-muted">
            {guestName.trim()} · {list.map(([id, s]) => nameOf(id, s)).join(', ')}{isShort ? ' · ' + hours + ' hours' : ''} · {paidNow > 0 ? fmtPeso(paidNow) + ' ' + method : 'nothing paid'}
          </p>
          <button type="button" onClick={reset}
            className="w-full max-w-xs min-h-[54px] mt-2 rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[16px] font-bold cursor-pointer active:scale-[0.98] transition-[background-color,transform] bw-shine">
            Log another
          </button>
          <button type="button" onClick={onClose} className="min-h-11 px-4 text-[14px] font-bold text-muted hover:text-main cursor-pointer">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/50">
      <div className="relative w-full max-w-4xl bg-card rounded-xl shadow-softLg overflow-y-auto max-h-[92vh] grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] bw-arrive">
        <button type="button" onClick={onClose} aria-label="Close"
          className="absolute top-3 right-3 z-10 w-10 h-10 rounded-full grid place-items-center text-muted hover:text-main cursor-pointer bw-x">
          <X className="w-5 h-5" />
        </button>

        {/* The paper */}
        <div className="p-6 space-y-5 min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink-900 pb-3">
            <div>
              <h3 className="font-display font-bold text-[20px] text-main">Log old booking</h3>
              <p className="text-[13px] font-medium text-muted">Copied from the paper</p>
            </div>
            <div className="grid justify-items-end gap-1 font-mono text-[13px] text-main">
              <label className="flex items-baseline gap-1.5">No.
                <input value={regNo} onChange={e => setRegNo(e.target.value)} placeholder="2549-09-0023" aria-label="Registration No. on the paper"
                  className="w-40 bg-transparent border-0 border-b-2 border-ink-900 text-right font-mono text-[15px] py-0.5 placeholder:text-paper-500 focus:outline-none focus:border-gold-400" />
              </label>
              <input type="date" value={regOn} onChange={e => setRegOn(e.target.value)} aria-label="Date on the paper"
                className="bg-transparent border-0 border-b-2 border-paper-300 text-right text-[13px] focus:outline-none focus:border-gold-400" />
            </div>
          </div>

          <Section>Guest</Section>
          <label ref={nameBox} className="block rounded-md">
            <span className={LABEL}>Name</span>
            <input value={guestName} onChange={e => setGuestName(e.target.value.toUpperCase())} placeholder="FULL NAME" className={LINE} />
          </label>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block"><span className={LABEL}>Contact no.</span>
              <input value={guestPhone} onChange={e => setGuestPhone(e.target.value)} inputMode="tel" placeholder="09xx xxx xxxx" className={LINE} />
            </label>
            <label className="block"><span className={LABEL}>Nationality</span>
              <NationalityInput value={nationality} onChange={setNationality} placeholder="Filipino" className={LINE} />
            </label>
          </div>

          {/* Address and companions are rarely on the paper, so they wait behind a link. */}
          <div ref={moreSlot}>
            {more ? (
              <div className="space-y-3">
                <label className="block"><span className={LABEL}>Address</span>
                  <input value={address} onChange={e => setAddress(e.target.value.toUpperCase())} className={LINE} />
                </label>
                {companions.map((c, i) => (
                  <div key={i} className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-2 items-end bw-rise">
                    <input value={c.name} onChange={e => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, name: e.target.value.toUpperCase() } : x))} placeholder="COMPANION" aria-label="Companion's name" className={LINE} />
                    <NationalityInput value={c.nationality || ''} onChange={v => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, nationality: v } : x))} placeholder="Nationality" className={LINE} />
                    <select value={c.sex || ''} onChange={e => setCompanions(cs => cs.map((x, j) => j === i ? { ...x, sex: e.target.value || undefined } : x))} aria-label="Sex" className={LINE}>
                      <option value="">Sex</option><option value="Male">Male</option><option value="Female">Female</option>
                    </select>
                    <button type="button" onClick={() => setCompanions(cs => cs.filter((_, j) => j !== i))} aria-label="Remove companion"
                      className="w-9 h-9 grid place-items-center text-muted hover:text-danger-600 cursor-pointer"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <div className="flex justify-between gap-3">
                  <button type="button" onClick={() => swap(() => setCompanions(cs => [...cs, { name: '' }]), moreSlot.current)}
                    className="min-h-9 text-[13px] font-bold text-gold-800 hover:underline cursor-pointer inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Companion</button>
                  <button type="button" onClick={() => swap(() => setMore(false), moreSlot.current)}
                    className="min-h-9 text-[13px] font-bold text-muted hover:text-main cursor-pointer">Hide ⌃</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => swap(() => setMore(true), moreSlot.current)}
                className="min-h-9 text-[14px] font-bold text-gold-800 hover:underline cursor-pointer">
                + Address, companions{companions.some(c => c.name.trim()) || address ? ' ·  filled in' : ''}
              </button>
            )}
          </div>

          {/* The stay. Whether it is a short stay was already said by the pick on the calendar
              — one day, or a check-in and a check-out — so there are no Overnight / Short stay
              ticks to answer again, and a short stay's room and day are the ones picked. */}
          <Section>Stay</Section>
          <div ref={staySlot} className="space-y-4 rounded-md">
            {isShort ? (
              <div>
                <span className={LABEL}>Hours</span>
                <div className="flex flex-wrap gap-2.5 mt-1">
                  {HOURS.map(h => {
                    const price = calculatePricing({ roomId: first[0], checkIn: first[1].checkIn, checkOut: nextDay(first[1].checkIn), guestEmail: '', rooms, venues, shortStayHours: h, rates: getRateConfig() }).stayTotal
                    return (
                      <Circled key={h} on={hours === h} onClick={() => { setHours(h); setPaid(null) }} className="min-w-[72px] min-h-[52px]">
                        <span className="block text-[17px] font-bold text-main">{h}</span>
                        <span className="block text-[12px] font-semibold text-muted tabular-nums">{fmtPeso(price)}</span>
                      </Circled>
                    )
                  })}
                </div>
                {/* A short stay has no ticket, so its one breakfast is a strip of its own. */}
                {rooms.find(r => r.id === first[0]) && (
                  <div className="mt-3 rounded-2xl border-[1.5px] border-paper-200 overflow-hidden [&>*]:border-t-0">
                    <BreakfastStrip room={rooms.find(r => r.id === first[0])!} on={breakfast.includes(first[0])} perNight={false} onToggle={() => toggleBreakfast(first[0])} />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {entries.length === 0 && <p className="py-2 text-[14px] text-muted">No room yet.</p>}
                {entries.map(([id, s]) => {
                  const room = s.type === 'room' ? rooms.find(r => r.id === id) : undefined
                  const p = priced.find(u => u.id === id)?.p
                  const venue = s.type === 'venue' ? venues.find(v => v.id === id) : undefined
                  const kindsOf = venueTypes(venue)
                  // A venue's kinds, the plain venue first, named short for the strip: the
                  // Vacation House's own name already heads the card.
                  const options = venue && kindsOf.length > 0
                    ? [{ key: '', label: venue.name.split(' ').pop() || venue.name, price: getEffectiveNightlyPrice(venue.base_price, venue.promo_price) },
                      ...kindsOf.map(t => ({ key: t.key, label: t.label.startsWith(venue.name + ' ') ? t.label.slice(venue.name.length + 1) : t.label, price: Number(t.price) }))]
                    : []
                  const at = Math.max(0, options.findIndex(o => o.key === (kinds[id] || '')))
                  const dateChip = (field: 'checkIn' | 'checkOut', label: string) => (
                    <label className="relative px-2.5 py-1 rounded-full bg-paper-50 border border-paper-200 hover:border-gold-400 text-[13px] font-semibold text-main cursor-pointer transition-colors focus-within:border-gold-400">
                      {s[field] ? fmtDay(s[field]) : 'Pick a day'}
                      <input type="date" value={s[field]} aria-label={label + ', ' + nameOf(id, s)}
                        onChange={e => setUnit(id, { [field]: e.target.value })}
                        onClick={e => { try { e.currentTarget.showPicker() } catch { /* the browser opens it itself */ } }}
                        className="absolute inset-0 opacity-0 cursor-pointer" />
                    </label>
                  )
                  return (
                    // ONE TICKET A STAY (the stay card mock, design B, Sebastian, 2026-10-17): the
                    // name, its two days as chips and its price on one card, and a venue's kind
                    // as a strip along that card's own bottom — the dates were two boxes that
                    // wrapped, and the kinds hung loose under the card.
                    <div key={id} data-unit className="rounded-2xl border-[1.5px] border-paper-200 bg-card overflow-hidden">
                      <div className="flex items-center gap-3 p-3">
                        <span className={'w-11 h-11 shrink-0 rounded-[11px] grid place-items-center font-display font-bold ' + (room ? 'bg-ink-900 text-white text-[17px]' : 'bg-gold-400 text-ink-900')}>
                          {room ? room.room_number : <House className="w-5 h-5" aria-hidden="true" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <b className="block text-[15px] leading-5 text-main truncate">{room ? room.name : nameOf(id, s)}</b>
                          <span className="flex flex-wrap items-center gap-1.5 mt-1 text-[13px] text-muted">
                            {dateChip('checkIn', 'Arrival')}<span aria-hidden="true">→</span>{dateChip('checkOut', 'Departure')}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-[13px] leading-4 text-muted tabular-nums">
                          <b className="block text-[17px] leading-6 text-main">{p ? fmtPeso(p.grandTotal - p.breakfastTotal) : '—'}</b>
                          {p ? p.stayQuantity + (s.type === 'venue' ? ' day' : ' night') + (p.stayQuantity !== 1 ? 's' : '') : 'check the days'}
                          {p && p.breakfastTotal > 0 && <span className="block text-[12px] font-bold text-gold-800 bw-rise">+ {fmtPeso(p.breakfastTotal)} breakfast</span>}
                        </span>
                        {entries.length > 1 && (
                          <button type="button" onClick={e => removeUnit(id, (e.currentTarget as HTMLElement).closest('[data-unit]'))} aria-label={'Take ' + nameOf(id, s) + ' off'}
                            className="w-9 h-9 -mr-1 shrink-0 rounded-full grid place-items-center text-muted hover:text-danger-600 cursor-pointer bw-x"><X className="w-4 h-4" /></button>
                        )}
                      </div>
                      {options.length > 0 && (
                        <div role="radiogroup" aria-label={venue!.name + ' type'} style={{ '--at': at, '--n': options.length } as React.CSSProperties}
                          className="relative grid grid-flow-col auto-cols-fr border-t-[1.5px] border-dashed border-paper-200 bg-paper-50">
                          <span aria-hidden="true" className="absolute bottom-0 left-0 h-[3px] w-[calc(100%/var(--n))] rounded-t bg-gold-400 [transform:translateX(calc(var(--at)*100%))] transition-transform duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)]" />
                          {options.map(o => (
                            <button key={o.key} type="button" role="radio" aria-checked={o.key === (kinds[id] || '')}
                              onClick={() => swap(() => { setKinds(k => ({ ...k, [id]: o.key })); setPaid(null) }, lineSlot.current)}
                              className={'relative min-h-12 px-1 py-2 text-[13px] font-bold leading-tight cursor-pointer transition-colors active:scale-[0.97] ' + (o.key === (kinds[id] || '') ? 'text-main' : 'text-ink-600 hover:text-main')}>
                              {o.label}
                              <span className="block text-[11px] font-semibold text-muted tabular-nums">{fmtPeso(o.price)}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {room && <BreakfastStrip room={room} on={breakfast.includes(id)} perNight onToggle={() => toggleBreakfast(id)} />}
                    </div>
                  )
                })}
                {/* One list of what is free — the Room/Venue switch and Add button it replaces said the same thing twice. */}
                <label className="relative inline-flex items-center gap-1 min-h-9 text-[14px] font-bold text-gold-800 hover:underline cursor-pointer">
                  <Plus className="w-3.5 h-3.5" /> Room or venue
                  <select value="" onChange={e => addUnit(e.target.value)} aria-label="Add a room or venue" className="absolute inset-0 opacity-0 cursor-pointer">
                    <option value="" />
                    <optgroup label="Rooms">{rooms.filter(r => free(r.id)).map(r => <option key={r.id} value={r.id}>Room {r.room_number} · {r.name}</option>)}</optgroup>
                    <optgroup label="Venues">{venues.filter(v => free(v.id)).map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
                  </select>
                </label>
              </div>
            )}

          </div>

          {/* The receptionist: the names used before written out, the one on duty circled by
              hand like the hours (the mock: "make it fit the paper design"). A new name is
              written on a line and joins them. */}
          <div>
            <span className={LABEL}>Receptionist on duty</span>
            <div role="radiogroup" aria-label="Receptionist on duty" className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 mt-1">
              {staffNames.map(n => (
                <Circled key={n} on={preparedBy === n} onClick={() => { setPreparedBy(n); setTypingStaff(false) }}
                  className={'text-[15px] font-bold tracking-[0.02em] ' + (preparedBy === n ? 'text-main' : 'text-ink-600')}>{n}</Circled>
              ))}
              {typingStaff || staffNames.length === 0 ? (
                <input autoFocus={typingStaff} placeholder="NAME" aria-label="Receptionist's name"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() } if (e.key === 'Escape') setTypingStaff(false) }}
                  onBlur={e => {
                    const v = e.currentTarget.value.trim().toUpperCase()
                    if (v) { setStaffNames(ns => ns.includes(v) ? ns : [...ns, v]); setPreparedBy(v) }
                    setTypingStaff(false)
                  }}
                  className={LINE + ' !w-40 bw-rise'} />
              ) : (
                <button type="button" onClick={() => setTypingStaff(true)}
                  className="min-h-11 text-[14px] font-bold text-gold-800 hover:underline cursor-pointer inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Someone else</button>
              )}
            </div>
          </div>
        </div>

        {/* The stub: what was charged and what was paid */}
        <div className="p-6 pt-14 md:pt-6 space-y-3.5 bg-paper-50 border-t-2 md:border-t-0 md:border-l-2 border-dashed border-paper-200 min-w-0">
          <Section>Payment</Section>
          <div ref={lineSlot} className="space-y-2">
            {priced.map(({ id, s, p }) => (
              <React.Fragment key={id}>
                <div className="flex justify-between gap-3 text-[16px] font-medium text-main tabular-nums">
                  <span>{nameOf(id, s)} · {isShort ? fmtDay(s.checkIn) + ' · ' + hours + ' hours' : p ? p.stayQuantity + (s.type === 'venue' ? ' day' : ' night') + (p.stayQuantity !== 1 ? 's' : '') : 'check the dates'}</span>
                  <b>{p ? fmtPeso(p.grandTotal - p.breakfastTotal) : '—'}</b>
                </div>
                {p && p.breakfastTotal > 0 && (
                  <div className="flex justify-between gap-3 text-[16px] font-medium text-main tabular-nums bw-rise">
                    <span>Breakfast · {nameOf(id, s)}{isShort ? '' : ' · ' + p.breakfastNights + ' × ' + fmtPeso(p.breakfastTotal / p.breakfastNights)}</span>
                    <b>{fmtPeso(p.breakfastTotal)}</b>
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
          <div className="flex justify-between items-center gap-3 text-[16px] font-medium text-main">
            <span>Paid</span>
            <label className="flex items-center gap-1.5 w-44 h-12 px-3 rounded-xl border-2 border-paper-300 bg-card focus-within:border-gold-400 focus-within:shadow-[0_0_0_4px_#F5EAD1] transition-[border-color,box-shadow]">
              <span className="font-display text-muted">₱</span>
              <NumInput value={paidNow} onChange={n => setPaid(n)} aria-label="Amount paid"
                className="flex-1 min-w-0 bg-transparent text-right font-display text-[20px] font-bold tabular-nums focus:outline-none" />
            </label>
          </div>
          <div className="flex justify-between gap-3 pt-3 border-t-2 border-ink-900 font-display text-[22px] font-bold tabular-nums">
            <span className="text-main">Balance</span>
            <span className={balance > 0 ? 'text-danger-600' : 'text-emerald-600'}>{fmtPeso(balance)}</span>
          </div>
          {paidNow > 0 && (
            <>
              <span className={LABEL + ' bw-unfold'}>How they paid</span>
              <div ref={methodBox} role="group" aria-label="How the guest paid" className="grid grid-cols-2 gap-2 rounded-xl -mt-1.5 bw-unfold">
                {PAYMENT_METHODS.map(m => (
                  <Tick key={m} boxed on={method === m} onClick={() => setMethod(m)}>{m === 'Bank transfer' ? 'Bank' : m}</Tick>
                ))}
              </div>
              <label className="block bw-unfold"><span className={LABEL}>Date paid</span>
                <input type="date" value={payDate ?? list[0]?.[1].checkIn ?? ''} onChange={e => setPayDate(e.target.value)}
                  className="mt-1 w-full h-12 px-3 rounded-xl border-[1.5px] border-paper-200 bg-card text-[15px] text-main focus:outline-none focus:border-gold-400" />
              </label>
            </>
          )}
          {error && <p className="p-2.5 bg-danger-50 border border-danger-200 text-danger-600 text-[13px] rounded-lg bw-nope">{error}</p>}
          <button type="button" onClick={handleSave}
            className="w-full min-h-[54px] mt-2 rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[16px] font-bold cursor-pointer active:scale-[0.98] transition-[background-color,transform] bw-shine">
            Log booking
          </button>
        </div>
      </div>
    </div>
  )
}

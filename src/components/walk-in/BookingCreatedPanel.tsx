import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { AnimatedNumber } from '../AnimatedNumber'
import { formatRoomNumbers } from '../../utils/roomNumbers'
import { paymentMethodLabel } from '../../utils/paymentMethod'

type Rect = { x: number; y: number; w: number; h: number }

interface BookingCreatedPanelProps {
  createdBookingList: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  /**
   * The receipt for money taken **in the booking form** (the owner's ruling, 2026-09-29).
   *
   * The form now takes the payment, so what the guest is handed at the end is the
   * **Payment Receipt** — handing a bill to somebody who has just paid was the wrong piece
   * of paper. A **Reservation** pays nothing and returns no receipt, so it still gets the
   * billing statement, exactly as before; and the statement stays one click away in the
   * booking's quick view for any guest who wants the itemised bill.
   */
  receipt?: PaymentRecord | null
  /** Where the booking form stood: this card is that card, shrinking into its new shape. */
  from?: Rect | null
  /** A saved correction says "Saved", not "Booked". */
  editing?: boolean
  onClose: () => void
}

// The flat bits that burst from the seal: where each one flies, in the app's gold and green.
const BITS = Array.from({ length: 10 }, (_, i) => {
  const a = (i / 10) * Math.PI * 2 + 0.3
  const d = 70 + (i % 3) * 22
  return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7, r: i * 47, gold: i % 3 !== 0, round: i % 2 === 1 }
})

const day = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/**
 * THE BOOKED MOMENT (the mock Sebastian approved, 2026-10-16). The booking form does not
 * vanish: the same card shrinks into this one. A green seal pops with a ring and a small
 * burst, "Booked" rises with the room and the dates, what was paid counts up, and the
 * receipt is handed up from below — never printed downwards (his earlier ruling). Done flies
 * the card into the booking's place on the calendar, where it lands as its pill, and only
 * then does the booking's panel open (card k134).
 *
 * **The receipt if money was taken here**, and the printable Guest Billing Statement
 * otherwise. Nothing else.
 */
export function BookingCreatedPanel({ createdBookingList, rooms, venues, bookings, receipt, from, editing = false, onClose }: BookingCreatedPanelProps) {
  // The payment is recorded against the first booking of the set, which is also the one
  // carrying the invoice — so that is the booking the receipt names.
  const paidBooking = createdBookingList[0]
  const card = useRef<HTMLDivElement>(null)
  const face = useRef<HTMLDivElement>(null)
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // In: from the form's size and place to this card's own. Its real width and height are
  // what move — a stretched card bent its corners and read as a cut, not a shrink (the owner,
  // 2026-10-16: "the animation between the form shrinking into the booked card isn't
  // working"). What it holds fades in once it has nearly arrived.
  useLayoutEffect(() => {
    const el = card.current
    if (!from || !el || reduced()) return
    const to = el.getBoundingClientRect()
    const dx = from.x + from.w / 2 - (to.left + to.width / 2)
    const dy = from.y + from.h / 2 - (to.top + to.height / 2)
    const shrink = el.animate([
      { width: from.w + 'px', height: from.h + 'px', maxWidth: 'none', transform: `translate(${dx}px, ${dy}px)` },
      { width: to.width + 'px', height: to.height + 'px', maxWidth: 'none', transform: 'none' },
    ], { duration: 520, easing: 'cubic-bezier(0.34, 1.15, 0.64, 1)' })
    const show = face.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 320, fill: 'backwards' })
    // Run twice (React's development check), the second run measured the card mid-shrink and
    // shrank it from 1024 to 1024: the first run's moves are taken back before it measures.
    return () => { shrink.cancel(); show?.cancel() }
  }, [from])

  // What was paid counts up once the words are in.
  const [counted, setCounted] = useState(false)
  useEffect(() => { const t = setTimeout(() => setCounted(true), 1050); return () => clearTimeout(t) }, [])

  // Out: into the booking's pill on the calendar.
  const [closing, setClosing] = useState(false)
  const closed = useRef(false)
  const close = () => {
    if (closed.current) return
    closed.current = true
    const el = card.current
    if (reduced() || !el) { onClose(); return }
    setClosing(true)
    const pill = document.querySelector<HTMLElement>('[data-pill="' + paidBooking?.id + '"]')
    const to = pill?.getBoundingClientRect()
    const at = el.getBoundingClientRect()
    if (to && to.width > 0) {
      face.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'forwards' })
      el.animate([
        { transformOrigin: '0 0', transform: 'none', opacity: 1 },
        { transformOrigin: '0 0', opacity: 1, offset: 0.7 },
        { transformOrigin: '0 0', transform: `translate(${to.left - at.left}px, ${to.top - at.top}px) scale(${to.width / at.width}, ${to.height / at.height})`, opacity: 0 },
      ], { duration: 500, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)', fill: 'forwards' })
    } else {
      // The booking is off the dates on screen: the card sinks away instead.
      el.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateY(18px) scale(0.96)' }], { duration: 300, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)', fill: 'forwards' })
    }
    setTimeout(() => {
      createdBookingList.forEach(b => {
        document.querySelector<HTMLElement>('[data-pill="' + b.id + '"]')?.animate([
          { transform: 'scale(1.18)', boxShadow: '0 0 0 0 rgb(208 171 96 / 0.75)' },
          { boxShadow: '0 0 0 14px rgb(208 171 96 / 0)', offset: 0.7 },
          { transform: 'none', boxShadow: '0 0 0 0 rgb(208 171 96 / 0)' },
        ], { duration: 650, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
      })
    }, 480)
    setTimeout(onClose, 1100)
  }

  // "Room 8 · Oct 26 → Oct 27": the rooms and venues of the set, and when.
  const numbers = createdBookingList.map(b => rooms.find(r => r.id === b.room_id)?.room_number).filter((n): n is number => typeof n === 'number')
  const venueNames = createdBookingList.map(b => venues.find(v => v.id === b.venue_id)?.name).filter(Boolean)
  const where = [formatRoomNumbers(numbers), ...venueNames].filter(Boolean).join(' · ')
  const when = paidBooking ? day(paidBooking.check_in) + ' → ' + day(paidBooking.check_out) : ''
  const paid = receipt ? Math.round(Number(receipt.amount) || 0) : 0

  return (
    <div className={'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 font-sans ' + (closing ? 'pointer-events-none' : '')} onClick={close}>
      {/* Only the shade fades on Done: when the whole layer faded, the card went with it before
          it could reach its pill (the owner, 2026-10-16: "the animation where it flies into the
          booking isn't working"). */}
      <div aria-hidden="true" className={'absolute inset-0 bg-slate-900/50 ' + (closing ? 'bp-gone' : '')} />
      <div ref={card} onClick={e => e.stopPropagation()}
        className={'relative w-full bg-card rounded-2xl shadow-softLg overflow-hidden flex flex-col max-h-[92dvh] ' + (receipt ? 'max-w-[400px]' : 'max-w-xl')}>
        <div ref={face} className="flex flex-col flex-1 min-h-0">
          <div className="relative shrink-0 bg-emerald-50 px-5 pt-6 pb-4 flex flex-col items-center text-center print:hidden">
            <span className="relative w-16 h-16">
              <span className="bk-ring absolute inset-0 rounded-full border-[3px] border-emerald-600" />
              <svg className="bk-big-seal absolute inset-0 w-16 h-16" viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="32" className="fill-emerald-600" />
                <path d="M19 33l9 9L46 22" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {BITS.map((b, i) => (
              <i key={i} aria-hidden="true" style={{ '--x': b.x + 'px', '--y': b.y + 'px', '--r': b.r + 'deg' } as React.CSSProperties}
                className={'bk-bit absolute left-1/2 top-14 w-2 h-2 ' + (b.gold ? 'bg-gold-400 ' : 'bg-emerald-600 ') + (b.round ? 'rounded-full' : 'rounded-sm')} />
            ))}
            <h2 className="bk-rise [--d:0.8s] mt-3 font-display text-[26px] leading-none font-extrabold tracking-tight text-main">{editing ? 'Saved' : 'Booked'}</h2>
            <p className="bk-rise [--d:0.9s] mt-2 text-[14px] font-medium text-main/80">{where}{where && when ? ' · ' : ''}{when}</p>
            {receipt ? (
              <p className="bk-rise [--d:1s] mt-3 inline-flex items-baseline gap-1.5 rounded-full bg-card border border-emerald-200 px-3 py-1.5 text-[13px] font-semibold text-emerald-700">
                {paymentMethodLabel(receipt.method)}
                <b className="font-display text-[17px] font-extrabold tabular-nums text-main"><AnimatedNumber value={counted ? paid : 0} duration={700} prefix="₱" /></b>
                paid
              </p>
            ) : !editing && (
              <p className="bk-rise [--d:1s] mt-3 rounded-full bg-card border border-soft px-3 py-1.5 text-[13px] font-semibold text-blue-600">No deposit</p>
            )}
          </div>

          {receipt && paidBooking ? (
            <PrintPaymentReceiptModal
              booking={paidBooking}
              record={receipt}
              rooms={rooms}
              venues={venues}
              /* The whole set, so the receipt names **every room the money paid for** rather than the one
                 carrying the invoice (the owner's ruling, 2026-09-30). */
              covered={createdBookingList}
              onClose={close}
              embedded
              card
            />
          ) : (
            <>
              <div className="bk-hand flex-1 min-h-0 overflow-y-auto">
                <PrintInvoiceModal
                  bookingsToPrint={createdBookingList}
                  rooms={rooms}
                  venues={venues}
                  bookingsList={bookings}
                  onClose={close}
                  embedded
                />
              </div>
              <div className="bk-rise [--d:1.5s] shrink-0 flex border-t border-soft px-4 py-3 print:hidden">
                <button type="button" onClick={close} className="ml-auto min-h-11 px-8 rounded-lg bg-ink-900 text-white text-[15px] font-bold hover:bg-ink-800 cursor-pointer active:scale-95 transition-transform">Done</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { X, Printer, Edit3, CalendarPlus, Undo2, ArrowRightLeft, Banknote, Check, Coffee, DoorOpen, KeyRound, ChevronDown, XCircle, LogIn } from 'lucide-react'
import { Booking, Room, Venue, PaymentRecord } from '../../types/booking'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig } from '../../utils/rateConfig'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { greetName, pillInitials, roomDisplayName, roomOptionLabel } from './bookingStyles'
import { statusAfterPayment } from '../../utils/bookingStatus'
import { hasOutstandingBalance, amountToPayNow, isBilledToAgency } from '../../utils/bookingMoney'
import { methodNeedsReference } from '../../utils/paymentMethod'
import { nextReceiptNumber } from '../../utils/receiptNumber'
import { withoutPayment } from '../walk-in/bookingPayment'
import { logRemovedPayment } from '../../utils/removedPayments'
import { recomputeBalance, pendingEarlyCharge, extendStay } from '../../utils/bookingBalance'
import { useBookingSlips } from '../../hooks/useBookingSlips'
import { closeTab, getOpenTabForBooking } from '../../utils/tabs'
import { markSlipsPaid, slipNumber, unpaidSlips, unpaySlipsOfReceipt } from '../../utils/orderSlips'
import { undoBookingCheck } from '../../utils/db'
import { BookingStageLine } from './BookingStageLine'
import { nextStep } from './bookingStep'
import { ReceiveMoney } from './ReceiveMoney'
import { BookingOrderSlips } from './BookingOrderSlips'
import { ShortStayClock } from './ShortStayClock'
import { CountPeso } from '../CountPeso'
import { stayHoursOf } from '../../utils/shortStay'
import { BreakfastPicker } from './BreakfastPicker'
import { wantsBreakfastToday, breakfastOn, breakfastSummary, breakfastAskOpen } from '../../utils/breakfastChoice'
import { dateToString } from '../../utils/helpers'
import { blockReason, isOpenEnded } from '../../utils/openBlock'
import { groupOf } from '../../utils/bookingGroup'
import { formatRoomNumbers } from '../../utils/roomNumbers'
import { BookingReceipts } from './BookingReceipts'
import { ExtendStayForm } from './ExtendStayForm'
import { MoveBookingForm } from './MoveBookingForm'
import { canMoveBooking } from '../../utils/bookingMove'
import { venueTypeOf } from '../../utils/venueTypes'
import { showToast } from '../../utils/toast'
import { askConfirm } from '../../utils/confirm'
import { confettiCannon } from '../../utils/confetti'
import { todaysDoors } from '../../utils/doors'
import { bookingLines, StatementLineItem } from '../../utils/statementLines'

interface ExtendStayModalProps {
  booking: Booking
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  /** Every booking, cancelled ones included — for receipt numbering only. */
  allBookings?: Booking[]
  extendCheckoutDate: string
  extendError: string
  onClose: () => void
  onExtendStaySubmit: (e: React.FormEvent, tabTotal: number) => void
  setExtendCheckoutDate: (date: string) => void
  onCancelBooking?: (id: string) => void
  onUpdateBooking?: (booking: Booking) => Promise<void>
  onEditBooking?: () => void
  /** A short stay whose hours have run out — the panel turns its clock red. */
  shortStayDue?: boolean
}

const fmtShort = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
const fmtPeso = (n: number) => '₱' + n.toLocaleString()

// One loud button for the next step, one quiet one for the step that is not open yet.
const BTN = 'w-full min-h-[54px] px-4 rounded-xl text-[16px] font-bold transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer '
const BTN_GOLD = BTN + 'bg-gold-400 hover:bg-gold-600 text-ink-900 shadow-sm'
const BTN_GREEN = BTN + 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
// The step that is not the next one: a size down, so the lead reads first.
const BTN_QUIET = 'w-full min-h-11 px-4 rounded-xl text-[14px] font-bold transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100'
const newReceiptId = () => 'rcpt-' + Date.now()
// The door beside Receive while money is owed (the check-in loop mock, 2026-10-18): a real
// button in the door's own colour, not the grey link it used to be.
const DOOR_BESIDE = 'w-full min-h-[54px] px-3 rounded-xl border-2 bg-card text-[16px] font-bold inline-flex items-center justify-center gap-1 transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer bw-rise '
const DOOR_BESIDE_IN = DOOR_BESIDE + 'border-emerald-600 text-emerald-700 hover:bg-emerald-50'
const DOOR_BESIDE_OUT = DOOR_BESIDE + 'border-ink-900 text-main hover:bg-paper-100'
const QUIET_LINK = 'block mx-auto min-h-11 px-3 text-[13px] font-semibold text-muted hover:text-main underline decoration-paper-300 underline-offset-4 transition-colors cursor-pointer'
// The bottom row: the smallest, lightest words on the panel, still finger-sized.
const TOOL = 'bw-tool min-h-11 inline-flex items-center gap-1.5 px-2.5 text-[12px] font-semibold text-muted hover:text-main cursor-pointer'
// A form a tool opens may land below the fold of the scroll: once the window has finished growing
// (scrolling while it grew made the Move form bounce, Sebastian 2026-10-16), bring it into view.
const showSection = (el: HTMLElement | null) => { if (el) setTimeout(() => el.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 380) }

/**
 * The booking's panel: who, where the stay stands, and the single next step.
 *
 * **It shows what this stay needs now, not every feature a booking can have** (the
 * owner's feedback, 2026-10-04: *"it looks so lazy just stacking accordions"*), and it
 * was reshaped the same day by the staff's feedback: with the guest's money in hand they
 * could not tell where to record it, what came after, or whether the booking was paid,
 * checked in or checked out. So it reads top to bottom:
 *
 *   - **three facts in a row** — payment, check-in, check-out — each said in words, with
 *     the next one marked;
 *   - **the next step itself**: the place money is received while the guest owes, then
 *     Check in, then Check out. The step that is not open yet stays on screen, quiet,
 *     and says why when it is pressed;
 *   - then only what the stay has reached — its order slips, its payments — and the
 *     quiet actions last.
 *
 * **Money is taken in one place.** Check-in and check-out ask before they act and can be
 * undone (the staff: *"prevent accidental check in and check out"*).
 *
 * Nothing smaller than 12px, and nothing to press smaller than a fingertip (44px) — the
 * desk uses a tablet as well as the PC.
 *
 * **A finished step is marked** (Sebastian, 2026-10-09: the Front desk "just changed and
 * saved, with nothing marking the moment"). Checking in, checking out and receiving money
 * each lay a seal over the panel for a moment — the same one the kitchen's "Sent" wears —
 * while the calendar behind answers: the pill's green crosses it, the bar on the room
 * grows, the amount counts down. A payment's receipt opens once its seal has been seen.
 */
export function ExtendStayModal({
  booking,
  rooms,
  venues,
  bookings,
  allBookings,
  extendCheckoutDate,
  extendError,
  onClose,
  onExtendStaySubmit,
  setExtendCheckoutDate,
  onCancelBooking,
  onUpdateBooking,
  onEditBooking,
  shortStayDue = false
}: ExtendStayModalProps) {
  const [showPrintModal, setShowPrintModal] = useState(false)
  // A door about to open asks in the panel itself (the booking window mock, 2026-10-16):
  // `ask` replaces Check in / Check out with its question; `toolAsk` replaces the tool row.
  const [ask, setAsk] = useState<'in' | 'out' | null>(null)
  const [toolAsk, setToolAsk] = useState<'undo' | 'cancel' | null>(null)
  const [toolsSinking, setToolsSinking] = useState(false)
  const [toolsBack, setToolsBack] = useState(false)
  const [printing, setPrinting] = useState(false)
  const toolsRow = useRef<HTMLDivElement>(null)
  const toolBar = useRef<HTMLSpanElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const checkOutBtn = useRef<HTMLButtonElement>(null)
  const receiveBox = useRef<HTMLDivElement>(null)
  const [closing, setClosing] = useState(false)
  const [breakfastOpen, setBreakfastOpen] = useState(false)
  const [localBooking, setLocalBooking] = useState(booking)
  // Something the pressed action could not do, said on the page beside the
  // button (e.g. checking out while money is still owed). Replaced every popup.
  const [actionNotice, setActionNotice] = useState('')
  // `closeAfterPayment` closes this whole panel once the receipt for a recorded
  // payment is dismissed — the money is in, the job here is done.
  const [closeAfterPayment, setCloseAfterPayment] = useState(false)
  // What the money is for: everything owed (`all`), one order slip (its id), or an
  // amount the desk types (`other`).
  // `null` until the desk types: the box then shows what is owed now.
  const [receiptAmount, setReceiptAmount] = useState<number | null>(null)
  const [extendOpen, setExtendOpen] = useState(false)
  // "Change room or dates" opens in the same place as Extend stay; only one is open at a time.
  const [moveOpen, setMoveOpen] = useState(false)
  // A stay billed to an agency keeps its receive step folded away until it is wanted.
  const [receiveOpen, setReceiveOpen] = useState(false)
  // The bill's lines wait behind "Bill · N lines" until opened (the owner, 2026-10-15).
  const [billOpen, setBillOpen] = useState(false)
  // Layout animation (the tools mock Sebastian approved, 2026-10-16): when something opens or
  // closes inside the window, the window grows or shrinks to its new size instead of jumping.
  const layout = (change: () => void) => {
    const el = card.current
    const from = el?.offsetHeight
    flushSync(change)
    if (!el || !from || reduced()) return
    // The Extend form fills in a moment after it mounts, so the new height is read a frame later;
    // until then the window holds its old height rather than flashing the new one.
    // While it resizes, the scroll inside is hidden: the content is briefly taller than the
    // window, and a scroll bar flashed up (Sebastian, 2026-10-16).
    el.style.height = from + 'px'
    el.setAttribute('data-resizing', '')
    requestAnimationFrame(() => {
      el.style.height = ''
      const to = el.offsetHeight
      const done = () => el.removeAttribute('data-resizing')
      if (to === from) { done(); return }
      const grow = el.animate([{ height: from + 'px' }, { height: to + 'px' }], { duration: 360, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
      grow.onfinish = done
      grow.oncancel = done
    })
  }
  // Undo and Cancel: the tools sink first, then the question rises in their place.
  const askTool = (which: 'undo' | 'cancel') => {
    setToolsSinking(true)
    setTimeout(() => layout(() => { setToolsSinking(false); setToolAsk(which) }), 170)
  }
  // The one gold bar slides to whichever of Extend and Move is open, and fades where it was.
  useLayoutEffect(() => {
    const bar = toolBar.current
    if (!bar) return
    const open = toolsRow.current?.querySelector<HTMLElement>('[aria-expanded="true"]')
    if (open) { bar.style.left = open.offsetLeft + 10 + 'px'; bar.style.width = open.offsetWidth - 20 + 'px' }
    bar.toggleAttribute('data-on', !!open)
  }, [extendOpen, moveOpen, toolAsk])
  // Nothing is preselected: how the guest paid is asked for every payment, because
  // defaulting to 'Cash' is what once printed a Cash receipt for a GCash guest.
  const [receiptMethod, setReceiptMethod] = useState('')
  const [receiptRef, setReceiptRef] = useState('')
  const [receiptFor, setReceiptFor] = useState<PaymentRecord | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)
  // The step just finished, said over the panel for a moment.
  const [seal, setSeal] = useState<{ title: string; sub: string; icon: 'in' | 'out' | 'paid' } | null>(null)
  // The seal fades for its last 300 ms instead of vanishing in one frame, so the panel
  // comes back into view before anything else moves (the owner, 2026-10-15).
  const [sealLeaving, setSealLeaving] = useState(false)
  const sealTimer = useRef<number | undefined>(undefined)
  const sealFade = useRef<number | undefined>(undefined)
  useEffect(() => () => { window.clearTimeout(sealTimer.current); window.clearTimeout(sealFade.current) }, [])
  const SEAL_MS = 1300
  // How long the money bar takes to fill; the receipt waits for it.
  const FILL_MS = 700
  const mark = (next: { title: string; sub: string; icon: 'in' | 'out' | 'paid' }) => {
    setSeal(next)
    setSealLeaving(false)
    window.clearTimeout(sealTimer.current)
    window.clearTimeout(sealFade.current)
    sealFade.current = window.setTimeout(() => setSealLeaving(true), SEAL_MS - 300)
    sealTimer.current = window.setTimeout(() => setSeal(null), SEAL_MS)
  }
  const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

  // ── THE REWARD for a check-in or check-out (the check-in loop mocks, Sebastian, 2026-10-18,
  // "cannons + fly home"). The staff forgot the doors, and doing one was not rewarding: a
  // small seal said "Checked in" and that was all. Now the panel floods green (in) or
  // charcoal (out) from below, the guest's initials spin in with a welcome, confetti fires
  // from the panel's two bottom corners, then the panel flies home into its pill, which lands
  // with a ring and a last burst. **Paid or owing, the reward is the same** (his words: "as
  // long as the staff enters a guest checking in or checking out, that's good for the
  // hotel"); what is still owed is one small line on it.
  const [party, setParty] = useState<{ kind: 'in' | 'out'; owed: number; leaving?: boolean } | null>(null)
  const PARTY_MS = 1900
  // `stay`: the bill grew at this check-out (late or early hours), so the panel does not fly
  // home — the party clears and the desk is left on the money to take. It used to skip the
  // reward altogether, so a check-out past the check-out time was never rewarded (Sebastian,
  // 2026-10-18: "the effects aren't working past the check in and checkout date").
  const celebrate = (kind: 'in' | 'out', owed: number, stay = false) => {
    setParty({ kind, owed })
    const r = card.current?.getBoundingClientRect()
    if (r) {
      confettiCannon(r.left + 8, r.bottom - 8, 60); confettiCannon(r.right - 8, r.bottom - 8, 120)
      window.setTimeout(() => { confettiCannon(r.left + 8, r.bottom - 8, 70, 22); confettiCannon(r.right - 8, r.bottom - 8, 110, 22) }, 260)
    }
    window.setTimeout(() => {
      if (!stay) { close(kind); return }
      setParty(p => p && { ...p, leaving: true })
      window.setTimeout(() => { setParty(null); setShowPrintModal(true) }, 300)
    }, reduced() ? 900 : PARTY_MS)
  }
  const firstName = greetName(booking.guest_name)

  // ── In out of its pill, back into it (the booking window mock, 2026-10-16) ──────────
  // The panel grows out of the booking's pill on the calendar, and ✕ shrinks it back into it,
  // where the pill lands with a gold ring. A booking off the dates on screen just fades.
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // Only a pill the desk can see: one scrolled off the grid, or under its room names, is not.
  const pillRect = () => {
    const pill = document.querySelector<HTMLElement>('[data-pill="' + booking.id + '"]')
    const grid = pill?.closest('[data-grid]')
    const r = pill?.getBoundingClientRect()
    if (!pill || !grid || !r || r.width === 0) return null
    const g = grid.getBoundingClientRect()
    const names = grid.querySelector('thead th')?.getBoundingClientRect().right ?? g.left
    const mid = r.left + r.width / 2
    return mid > names && mid < g.right && r.top >= g.top && r.bottom <= g.bottom ? r : null
  }
  const toPill = (from: DOMRect, to: DOMRect) =>
    `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(${to.width / from.width}, ${to.height / from.height})`
  useLayoutEffect(() => {
    const el = card.current
    if (!el || reduced()) return
    const pill = pillRect()
    const at = el.getBoundingClientRect()
    const grow = pill
      ? el.animate([{ transformOrigin: '0 0', transform: toPill(at, pill), opacity: 0.4 }, { transformOrigin: '0 0', transform: 'none', opacity: 1 }],
        { duration: 420, easing: 'cubic-bezier(0.34, 1.15, 0.64, 1)' })
      : el.animate([{ opacity: 0, transform: 'translateY(8px) scale(0.95)' }, { opacity: 1, transform: 'none' }],
        { duration: 300, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' })
    // Run twice in development (StrictMode): the first run is taken back before the second measures.
    return () => grow.cancel()
    // Once, on opening: the pill is where the panel came from.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // `home` is the door just done: the panel flies home a little slower, and the pill lands with
  // a ring in the door's own colour and a small burst of confetti (the reward, below).
  const close = (home?: 'in' | 'out') => {
    const el = card.current
    if (closing) return
    if (!el || reduced()) { onClose(); return }
    setClosing(true)
    const pill = pillRect()
    if (pill) {
      const fly = home ? 480 : 280
      const ring = home === 'in' ? '5 150 105' : home === 'out' ? '28 28 28' : '208 171 96'
      el.animate([{ transformOrigin: '0 0', transform: 'none', opacity: 1 }, { transformOrigin: '0 0', opacity: 1, offset: 0.7 }, { transformOrigin: '0 0', transform: toPill(el.getBoundingClientRect(), pill), opacity: 0 }],
        { duration: fly, easing: 'cubic-bezier(0.45, 0, 0.85, 0.5)', fill: 'forwards' })
      window.setTimeout(() => {
        const landed = document.querySelector<HTMLElement>('[data-pill="' + booking.id + '"]')
        landed?.animate([
          { transform: 'scale(1.15)', boxShadow: '0 0 0 0 rgb(' + ring + ' / 0.75)' },
          { boxShadow: '0 0 0 14px rgb(' + ring + ' / 0)', offset: 0.7 },
          { transform: 'none', boxShadow: '0 0 0 0 rgb(' + ring + ' / 0)' },
        ], { duration: 600, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' })
        const r = landed?.getBoundingClientRect()
        if (home && r) confettiCannon(r.left + r.width / 2, r.top, 90, 16)
      }, fly - 30)
      // Faster back into the pill than out of it (Sebastian, 2026-10-16: "a bit faster").
      window.setTimeout(onClose, fly + 10)
    } else {
      el.animate([{ opacity: 1 }, { opacity: 0, transform: 'scale(0.96)' }], { duration: 220, easing: 'ease-in', fill: 'forwards' })
      window.setTimeout(onClose, 230)
    }
  }

  // The panel follows the live booking: an order taken in the restaurant, or a payment
  // recorded on another screen, changes what is owed while this is open.
  useEffect(() => { queueMicrotask(() => setLocalBooking(booking)) }, [booking])

  // ── The stay's order slips (k69) ───────────────────────────────────────────
  // Read from their own tables and folded into what is owed. The reading, the
  // re-reading after a change and the balance re-sync all live in the hook.
  const { slips, amount: tabAmount, reload: reloadSlips } = useBookingSlips({
    booking: localBooking,
    rooms,
    venues,
    setBooking: setLocalBooking,
    onUpdateBooking,
  })

  const room = booking.room_id ? rooms.find(r => r.id === booking.room_id) : undefined
  const venue = booking.venue_id ? venues.find(v => v.id === booking.venue_id) : undefined

  // Which rooms — and which bookings — each receipt covers, by receipt number.
  //
  // A payment is stored on **every** room it paid for (the owner's ruling, 2026-09-30) so the desk never has
  // to hunt for it — which means this room's receipt list can show a payment that is not this room's money.
  // Naming the rooms it covers is what tells the staff that, and reprinting the receipt needs the whole set,
  // or the slip describes one room while holding every room's payment.
  const coveredRooms: Record<string, number[]> = {}
  const coveredBookings: Record<string, Booking[]> = {}
  bookings.forEach(b => {
    ;(b.payment_records || []).forEach(rec => {
      const key = rec.receipt_number
      if (!key) return
      const set = coveredBookings[key] || (coveredBookings[key] = [])
      if (!set.some(x => x.id === b.id)) set.push(b)
      const r = b.room_id ? rooms.find(x => x.id === b.room_id) : undefined
      if (!r) return
      const list = coveredRooms[key] || (coveredRooms[key] = [])
      if (!list.includes(r.room_number)) list.push(r.room_number)
    })
  })

  const unitName = booking.room_id ? roomDisplayName(room) : (venue?.name || 'Event Venue')
  const unitSub = booking.room_id && room?.name ? 'Room ' + room.room_number : ''
  const nights = booking.check_in && booking.check_out
    ? Math.max(1, Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000))
    : 1
  const due = Number(localBooking.balance_due || 0)
  const paidSoFar = Number(localBooking.downpayment_paid || 0)
  const totalCharge = paidSoFar + due
  // Early check-in money that is recorded but deliberately NOT billed yet (the owner:
  // *"just add it to their bill for when they checkout"*). Shown as its own pending line
  // so the desk can see what the guest will owe without the money word flipping and
  // without the desk chasing money at the door.
  const earlyHoursRecorded = Number(localBooking.early_check_in_hours || 0)
  const pendingEarly = pendingEarlyCharge(localBooking, { rooms, venues, tabTotal: tabAmount })
  const receiptRecords = localBooking.payment_records || []
  const hasEmail = booking.guest_email && booking.guest_email !== 'admin@daweez-booking.vercel.app'
  // "None" is the placeholder the bookings store writes when no phone was taken.
  const hasPhone = !!booking.guest_phone && booking.guest_phone.trim() !== 'None'

  // ── What the money can be for ───────────────────────────────────────────────
  // What is owed now fills the box; any other amount is typed over it. A room guest may
  // pay for their food before check-out while the rest of the bill stays open (the owner,
  // 2026-10-04): an amount that is exactly one order slip's total pays that slip, and the
  // box says so. The deposit is agreed on the STAY alone, so the food is taken out of it
  // (`amountToPayNow`).
  const dueNow = amountToPayNow(localBooking, tabAmount)
  const unpaid = unpaidSlips(slips)
  const receiveAmount = receiptAmount ?? dueNow
  const payingSlip = unpaid.find(s => s.total === receiveAmount && s.total < due)

  // Inline required-field validation for the extend-stay form (mirrors LogOldBookingModal).
  const fieldErrors = {
    extendCheckoutDate: !extendCheckoutDate
      ? 'Check-out date is required.'
      : extendCheckoutDate <= booking.check_in ? 'Check-out must be after check-in.' : '',
  }
  const showErr = (f: keyof typeof fieldErrors) => (touched[f] || trySave) ? fieldErrors[f] : ''
  const isInvalid = (f: keyof typeof fieldErrors) => Boolean(showErr(f))
  const markTouched = (f: keyof typeof fieldErrors) => () => setTouched(t => ({ ...t, [f]: true }))
  const handleExtendSubmit = (e: React.FormEvent) => {
    if (Object.values(fieldErrors).some(v => v)) { e.preventDefault(); setTrySave(true); return }
    onExtendStaySubmit(e, tabAmount)
  }

  // How the guest pays is theirs to choose — the printed bill carries the boxes they
  // tick — so a tap writes it down at once, before any money moves: the bill can then
  // show the right account to send it to. The reference saves when its box is left.
  const savePaymentMethod = async (method: string, reference: string) => {
    const updated: Booking = {
      ...localBooking,
      payment_method: method,
      payment_reference: reference || localBooking.payment_reference,
    }
    setLocalBooking(updated)
    try {
      await onUpdateBooking?.(updated)
    } catch {
      showToast('Could not save the payment method. Please try again.', 'error')
    }
  }
  const pickMethod = (m: string) => {
    setReceiptMethod(m)
    if (!methodNeedsReference(m)) setReceiptRef('')
    void savePaymentMethod(m, '')
  }

  // Money can be corrected: removing a receipt that was logged by mistake puts
  // the balance and the automatic payment status back where they belong.
  const handleRemoveReceipt = async (rec: PaymentRecord) => {
    // One payment for several rooms sits on every one of them (the owner's ruling), so
    // withdrawing it has to take it off all of them — each room giving back only its
    // own share — or the other rooms keep a receipt for money that was taken back.
    const otherRooms = (rec.receipt_number ? coveredBookings[rec.receipt_number] || [] : [])
      .filter(b => b.id !== localBooking.id)
    const ok = await askConfirm({
      title: 'Remove this ' + fmtPeso(rec.amount) + ' payment?',
      message: otherRooms.length > 0
        ? 'It paid for ' + (otherRooms.length + 1) + ' rooms. The receipt is withdrawn from all of them and each amount to pay goes back up.'
        : 'The amount to pay goes back up and the receipt is withdrawn.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    const updated = withoutPayment(localBooking, rec, otherRooms.length > 0)
    setLocalBooking(updated)
    try {
      await onUpdateBooking?.(updated)
      for (const other of otherRooms) {
        const theirs = (other.payment_records || []).find(r => r.receipt_number === rec.receipt_number)
        if (theirs) await onUpdateBooking?.(withoutPayment(other, theirs, true))
      }
      // The order slips that payment paid are unpaid again.
      if (rec.receipt_number) await unpaySlipsOfReceipt(rec.receipt_number)
      await reloadSlips()
      // Kept so the Front desk's History can still show it, struck through.
      void logRemovedPayment({
        receipt_number: rec.receipt_number, amount: Number(rec.amount || 0), method: rec.method, paid_at: rec.paid_at,
        prepared_by: rec.prepared_by, guest_name: localBooking.guest_name,
        rooms: (rec.receipt_number && coveredRooms[rec.receipt_number] || []).map(n => 'Room ' + n).join(', '),
        booking_ids: [localBooking.id, ...otherRooms.map(b => b.id)],
      }).catch(() => {})
    } catch {
      showToast('Could not remove the payment. Please try again.', 'error')
    }
  }

  // Recompute the balance after early/late hours are applied, using the
  // booking's own charges + current rates + the guest's food, so the amount
  // owed stays correct. The rule itself lives in utils/bookingBalance.ts.
  const withRecomputedBalance = (base: Booking, patch: Partial<Booking>): Booking =>
    recomputeBalance({ ...base, ...patch }, { rooms, venues, tabTotal: tabAmount })

  // **A charge can be taken off** (the owner's note, 2026-10-20). It goes at once and is
  // saved behind; Undo puts the booking back as it was for five seconds (the plan he approved).
  const [removed, setRemoved] = useState<{ label: string; amount: number; before: Booking } | null>(null)
  const removedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(removedTimer.current), [])
  const removeCharge = async (line: StatementLineItem) => {
    if (!line.remove) return
    const before = localBooking
    const updated = withRecomputedBalance(localBooking, line.remove)
    layout(() => { setLocalBooking(updated); setRemoved({ label: line.description, amount: line.amount, before }) })
    window.clearTimeout(removedTimer.current)
    removedTimer.current = window.setTimeout(() => setRemoved(null), 5000)
    try {
      await onUpdateBooking?.(updated)
    } catch {
      layout(() => { setLocalBooking(before); setRemoved(null) })
      showToast('Could not remove ' + line.description + '. Please try again.', 'error')
    }
  }
  const undoRemove = async () => {
    if (!removed) return
    window.clearTimeout(removedTimer.current)
    const { before } = removed
    layout(() => { setLocalBooking(before); setRemoved(null) })
    try { await onUpdateBooking?.(before) } catch { showToast('Could not put the charge back. Please try again.', 'error') }
  }

  const billedToAgency = isBilledToAgency(localBooking)
  const owes = hasOutstandingBalance(localBooking)
  const isBlock = localBooking.status === 'blocked'
  const openEnded = isOpenEnded(localBooking)
  const todayKey = dateToString(new Date())
  const place = booking.room_id ? (room ? 'Room ' + room.room_number : 'Room') : (venue?.name || 'Event Venue')
  const step = isBlock ? 'done' : nextStep(localBooking, owes, billedToAgency)
  const isIn = !!localBooking.actual_check_in && !localBooking.actual_check_out

  // Records the arrival time and auto-computes the early hours.
  //
  // The early hours are RECORDED here but deliberately NOT charged here: the balance
  // is left exactly as it was, so checking a fully-paid guest in never flips them back
  // to "partly paid" and never asks the desk for money at the door. The stored hours
  // are picked up by the recompute at check-out, which is where the owner wants the
  // extra night to land ("just add it to their bill for when they checkout").
  // The money is still asked for first (Receive leads), but a guest who has not paid
  // in full may be let in: the desk's choice, said plainly before it happens
  // (Sebastian, 2026-10-15: "let it be an option"). What is owed stays on the bill and
  // so does check-out now (below). **Asked in the panel, where the button was** (the booking
  // window mock, 2026-10-16), not in a pop-up over it.
  const owesAtDoor = owes && !billedToAgency
  const checkInAsk = {
    title: owesAtDoor
      ? 'Check in ' + booking.guest_name + ' with ' + fmtPeso(due) + ' still to pay?'
      : 'Check in ' + booking.guest_name + ' to ' + place + '?',
    message: ((localBooking.check_in > todayKey ? 'This booking starts on ' + fmtShort(localBooking.check_in) + '. ' : '') +
      (owesAtDoor ? 'The ' + fmtPeso(due) + ' stays on their bill.' : '')).trim(),
    yes: owesAtDoor ? 'Check in anyway' : 'Check in',
  }
  const handleCheckIn = async () => {
    setAsk(null)
    setActionNotice('')
    const actualCheckIn = new Date().toISOString()
    const rates = getRateConfig()
    // A short stay has no early/late hours at all: the room was sold for a few
    // hours at its own board price, so a 10am arrival is not "four hours early".
    const { earlyHours } = localBooking.stay_hours
      ? { earlyHours: 0 }
      : computeCheckInOutHours({
        checkIn: localBooking.check_in, checkOut: localBooking.check_out, actualCheckIn,
        standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
      })
    const updated: Booking = { ...localBooking, actual_check_in: actualCheckIn, early_check_in_hours: earlyHours, status: 'confirmed' }
    setLocalBooking(updated)
    celebrate('in', owesAtDoor ? due : 0)
    if (earlyHours > 0) {
      const hours = earlyHours + ' hour' + (earlyHours > 1 ? 's' : '')
      const why = earlyHours > rates.lateEarlyCapHours
        ? hours + ' early — past the ' + rates.lateEarlyCapHours + '-hour cap, so a night'
        : hours + ' early'
      showToast('Checked in ' + why + ' goes on the bill at check-out.', 'info')
    }
    try { await onUpdateBooking?.(updated) } catch { showToast('Could not check in. Please try again.', 'error') }
  }

  // **Check-out works like check-in without paying** (Sebastian, 2026-10-18: *"make the checkout
  // function the same as the check in without paying"*). It used to refuse while money was owed;
  // now Receive still leads, and Check out asks once, naming the amount. What is owed stays on
  // the bill, on the pill ("₱… to pay") and in the owed lists until it is received.
  const checkOutAsk = {
    title: owesAtDoor
      ? 'Check out ' + booking.guest_name + ' with ' + fmtPeso(due) + ' still to pay?'
      : 'Check out ' + booking.guest_name + ' from ' + place + '?',
    message: ((!localBooking.stay_hours && localBooking.check_out > todayKey ? 'Their stay runs until ' + fmtShort(localBooking.check_out) + '. ' : '') +
      (owesAtDoor ? 'The ' + fmtPeso(due) + ' stays on their bill.' : '')).trim(),
    yes: owesAtDoor ? 'Check out anyway' : 'Check out',
  }
  const tryCheckOut = () => setAsk('out')
  const handleCheckOut = async () => {
    setAsk(null)
    setActionNotice('')
    const actualCheckOut = new Date().toISOString()
    const rates = getRateConfig()
    // Same rule as check-in: a short stay carries no late-checkout hours.
    const { lateHours } = localBooking.stay_hours
      ? { lateHours: 0 }
      : computeCheckInOutHours({
        checkIn: booking.check_in, checkOut: booking.check_out, actualCheckOut,
        standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
      })
    const updated = withRecomputedBalance(localBooking, { actual_check_out: actualCheckOut, late_check_out_hours: lateHours })
    setLocalBooking(updated)
    // A stay that GREW at check-out (early or late hours) has money the desk was not asked
    // about: that is said, not sealed. One that already owed was checked out knowingly.
    const after = Number(updated.balance_due || 0)
    const grewHere = after > due && !billedToAgency
    celebrate('out', owesAtDoor || grewHere ? after : 0, grewHere)
    try {
      await onUpdateBooking?.(updated)
      // The guest has left, so nothing more is ordered on this stay: its open slip is
      // closed, and with nothing left to pay its slips are paid.
      const open = await getOpenTabForBooking(updated.id)
      if (open) await closeTab(open.id)
      if (!hasOutstandingBalance(updated)) {
        await markSlipsPaid(unpaid.map(s => s.tab.id), receiptRecords[receiptRecords.length - 1]?.receipt_number)
      }
      await reloadSlips()
    } catch { showToast('Could not check out. Please try again.', 'error') }
    // The bill is recomputed at check-out, and this is where the money a stay grew by
    // actually lands — a late check-out's hours AND the early check-in hours recorded
    // on arrival (the owner's rule: early check-in goes on the bill at check-out, never
    // in the desk's face at the door). That money must be settled before the guest
    // leaves, and the notice names what grew rather than blaming it all on lateness.
    if (grewHere) {
      const owed = fmtPeso(after)
      const grew = []
      if (Number(updated.early_check_in_hours || 0) > 0) grew.push('early check-in')
      if (lateHours > 0) grew.push('late check-out')
      setActionNotice(
        (grew.length ? 'Added for ' + grew.join(' and ') + '. ' : 'This stay still owes ' + owed + '. ') +
        'Receive ' + owed + ' before the guest leaves.'
      )
      // The bill opens once the party has cleared (`celebrate`).
    }
  }

  // A check-in or check-out pressed on the wrong booking is taken back here.
  const handleUndo = async (which: 'check_in' | 'check_out') => {
    // Food is only ordered by a guest who is really in the hotel.
    if (which === 'check_in' && slips.length > 0) {
      setActionNotice('This guest has order slips, so the check-in stays.')
      setToolAsk(null)
      return
    }
    setToolAsk(null)
    try {
      await undoBookingCheck(booking.id, which)
      const updated = withRecomputedBalance(localBooking, which === 'check_in'
        ? { actual_check_in: undefined, actual_check_out: undefined, early_check_in_hours: 0, late_check_out_hours: 0 }
        : { actual_check_out: undefined, late_check_out_hours: 0 })
      setLocalBooking(updated)
      setActionNotice('')
      await onUpdateBooking?.(updated)
    } catch {
      showToast('Could not undo that. Please try again.', 'error')
    }
  }

  // Record a payment: creates a receipt (date + time) only when the guest pays.
  // What is missing is shown on the Receive box itself; these only guard the save.
  const handleAddReceipt = async () => {
    const method = receiptMethod
    const reference = methodNeedsReference(method) ? receiptRef.trim() : ''
    const amount = Number(receiveAmount) || 0
    if (amount <= 0) return
    // The method is the guest's own choice, so it is never assumed: no method, no receipt.
    if (!method.trim()) return
    if (methodNeedsReference(method) && !reference) return
    const newPaid = paidSoFar + amount
    const remaining = Math.max(0, totalCharge - newPaid)
    const rec: PaymentRecord = {
      id: newReceiptId(),
      amount,
      method,
      reference: reference || undefined,
      paid_at: new Date().toISOString(),
      prepared_by: localBooking.prepared_by,
      // Stored, not derived: the receipt keeps this number even if another
      // payment is later removed. Handed the whole list so it cannot take a number another booking
      // already used this month — the payment's own records alone always start a fresh booking at 001.
      receipt_number: nextReceiptNumber(localBooking, allBookings || bookings),
      ...(payingSlip ? { slips: [slipNumber(payingSlip.tab)] } : {}),
    }
    const status = remaining <= 0 ? 'paid' as const : localBooking.payment_status === 'paid' ? 'paid' as const : 'downpayment' as const
    const updated = {
      ...localBooking,
      payment_records: [...receiptRecords, rec],
      downpayment_paid: newPaid,
      balance_due: remaining,
      payment_status: status,
      status: statusAfterPayment(localBooking.status),
      payment_method: method,
      payment_reference: reference || localBooking.payment_reference,
    }
    setLocalBooking(updated)
    setActionNotice('')
    setReceiptAmount(null); setReceiptMethod(''); setReceiptRef(''); setReceiveOpen(false)
    // The money is marked at once; then the seal fades, the green bar fills where it can be
    // seen, and only then does the receipt rise in. It once opened at 1.05 s, over the seal's
    // sparks, while the bar filled unseen behind it (the owner, 2026-10-15: "weird or broken").
    mark({ title: remaining <= 0 ? 'Paid' : 'Received', sub: fmtPeso(amount) + ' · ' + method, icon: 'paid' })
    const sealSeen = new Promise(resolve => window.setTimeout(resolve, SEAL_MS + FILL_MS))
    try {
      await onUpdateBooking?.(updated)
      await sealSeen
      setReceiptFor(rec)
      setShowReceipt(true)
      // Dismissing the receipt closes this whole panel **only when the guest has already
      // been checked in** and this was the **first money recorded**: there the payment was
      // the last errand. Before arrival it never closes — the booking is paid, the guest is
      // standing at the desk, and closing would take Check in away with it (the owner's
      // correction, 2026-09).
      setCloseAfterPayment(paidSoFar <= 0 && !!localBooking.actual_check_in)
    } catch {
      showToast('Could not record the payment. Please try again.', 'error')
      return
    }
    // Which order slips this money paid: the one it was taken for, or all of them once
    // nothing is left to pay. A paid slip is closed, so the next order starts a new one.
    try {
      const paidSlips = payingSlip ? [payingSlip] : remaining <= 0 ? unpaid : []
      if (paidSlips.length > 0) await markSlipsPaid(paidSlips.map(s => s.tab.id), rec.receipt_number)
      await reloadSlips()
    } catch {
      showToast('The payment is recorded, but the order slip was not marked as paid.', 'error')
    }
  }

  const isShortStay = stayHoursOf(localBooking) > 0
  const becomesNights = isShortStay && extendCheckoutDate && extendCheckoutDate > booking.check_in
    ? Math.max(1, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(booking.check_in).getTime()) / 86400000))
    : 0
  const extraNights = !isShortStay && !isBlock && extendCheckoutDate && extendCheckoutDate > booking.check_out
    ? Math.max(0, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(booking.check_out).getTime()) / 86400000))
    : 0
  const newBalanceDue = (() => {
    // A short stay is stored with check-out the next day, so "stay the night" keeps
    // that same date — and still changes the price, from the hours to a night.
    if (!extendCheckoutDate) return due
    if (isShortStay ? extendCheckoutDate <= booking.check_in : extendCheckoutDate <= booking.check_out) return due
    try {
      return Number(extendStay(localBooking, extendCheckoutDate, { rooms, venues, tabTotal: tabAmount }).balance_due || 0)
    } catch {
      return due
    }
  })()

  // The other rooms booked in the same sitting, named so the desk knows this is one of
  // several — the bill and the edit form cover all of them.
  const bookedTogether = groupOf(booking, bookings)
  const togetherLabel = bookedTogether.length > 1
    ? [
        formatRoomNumbers(bookedTogether.map(b => rooms.find(r => r.id === b.room_id)?.room_number).filter((n): n is number => typeof n === 'number')),
        ...bookedTogether.filter(b => b.venue_id).map(b => venues.find(v => v.id === b.venue_id)?.name || 'Venue'),
      ].filter(Boolean).join(', ')
    : ''
  // "They have left": the block ends today, so the room can be sold from tonight. A block
  // that has not started yet (or started today) is simply removed.
  const endOpenBlock = async () => {
    const today = dateToString(new Date())
    if (today <= localBooking.check_in) { onCancelBooking?.(booking.id); onClose(); return }
    try {
      await onUpdateBooking?.({ ...localBooking, check_out: today })
      onClose()
    } catch {
      showToast('Could not end the block. Please try again.', 'error')
    }
  }
  const breakfastToday = breakfastOn(booking, todayKey)

  const who = isBlock ? blockReason(localBooking) : booking.guest_name
  // Under the title: a room's own name, or which kind of venue it is (Ground, Exclusive).
  const roomType = booking.room_id && room?.name ? room.name : (venueTypeOf(venue, booking.event_addons?.venue_type)?.label || '')
  const stayLine = isBlock
    ? (openEnded ? 'From ' + fmtShort(booking.check_in) + ' · until further notice' : fmtShort(booking.check_in) + ' → ' + fmtShort(booking.check_out))
    // No dates for a stay: they are on its In and Out steps just below (the booking window
    // mock, 2026-10-16: "make sure to check for redundancies").
    : stayHoursOf(booking) > 0
      ? stayHoursOf(booking) + '-hour stay'
      : nights + (booking.room_id ? (nights === 1 ? ' night' : ' nights') : (nights === 1 ? ' day' : ' days'))
  const extendLabel = isBlock ? 'Change the dates' : isShortStay ? 'Stay longer' : 'Extend stay'
  // A stay that has ended has nothing left to extend; its dates are corrected with the pencil.
  const canExtend = !localBooking.actual_check_out
  // A booking is moved until the guest arrives (`canMoveBooking`).
  const canMove = !!onUpdateBooking && canMoveBooking(localBooking)
  const handleMove = async (moved: Booking) => {
    await onUpdateBooking?.(moved)
    // The number goes with the name: three rooms are called "Full Double".
    const movedRoom = moved.room_id ? rooms.find(r => r.id === moved.room_id) : undefined
    const where = movedRoom
      ? roomOptionLabel(movedRoom)
      : (venues.find(v => v.id === moved.venue_id)?.name || 'the venue')
    showToast('Moved to ' + where + ' · ' + fmtShort(moved.check_in) + ' → ' + fmtShort(moved.check_out), 'success')
    onClose()
  }
  // A block's dates are all it has, so they are simply on screen — no button to open
  // them. The exception is a block with no end date yet, whose one job is "They have left".
  const datesAlwaysShown = isBlock && !openEnded
  // The receive step is the loud one whenever the guest must pay before the next door
  // opens. On a stay billed to an agency it is folded behind a quiet line instead.
  const receiveShown = !isBlock && due > 0 && (step === 'payment' || receiveOpen)
  // The door that is next — and while Receive is shut and nothing is being asked, it sits
  // beside Receive instead of as a link under it.
  const doorKind: 'in' | 'out' | null = isBlock ? null : !localBooking.actual_check_in ? 'in' : isIn ? 'out' : null
  const besideReceive = receiveShown && !receiveOpen && !!doorKind && ask === null
  // **The door button glows like its pill** (the panel mock, option A, Sebastian, 2026-10-18:
  // "it's supposed to reflect what the cell is doing"). When the calendar is glowing this
  // stay's pill for a check-in or check-out, the button that does it pulses and hops the same.
  const dueDoor = todaysDoors([localBooking], new Date())[0]?.kind
  const glowIn = dueDoor === 'in' ? ' door-glow-btn-in' : ''
  const glowOut = dueDoor === 'out' ? ' door-glow-btn-out' : ''
  // Checking out before the last day is allowed, but it is not the expected next step.
  const checkOutDue = isShortStay || localBooking.check_out <= todayKey

  const badge = room ? String(room.room_number) : (venue?.name || unitName).charAt(0)
  const subLine = [booking.room_id ? roomType : [venue?.name, roomType].filter(Boolean).join(' · '), stayLine].filter(Boolean).join(' · ')
  // The biggest thing on the panel: what is owed, or that nothing is.
  const figure: { label: string; value: number | null; tone: string } | null =
    billedToAgency && due > 0 ? { label: 'Agency owes', value: due, tone: 'text-blue-700' }
      : due > 0 ? (dueNow < due
        ? { label: 'Deposit · of ' + fmtPeso(totalCharge), value: dueNow, tone: 'text-danger-600' }
        : { label: 'Left to pay', value: due, tone: 'text-danger-600' })
        : totalCharge > 0 ? { label: 'Total ' + fmtPeso(totalCharge), value: null, tone: 'text-emerald-700' } : null
  const [openedPaid] = useState(figure?.value === null)
  const [openedStep] = useState(step)
  // Something done behind a seal shows once the seal has faded.
  const wait = { '--wait': '1.1s' } as React.CSSProperties
  const stayCharge = isShortStay
    ? 'Short stay · ' + stayHoursOf(localBooking) + ' hours'
    : (booking.room_id ? 'Room' : 'Venue') + ' · ' + nights + (booking.room_id ? (nights === 1 ? ' night' : ' nights') : (nights === 1 ? ' day' : ' days'))
  const hasBill = !isBlock && (totalCharge > 0 || receiptRecords.length > 0 || slips.length > 0)
  // The bill's own rows, as the paper prints them (no food: the slips are listed below).
  // Only once the room's prices are in — without them the rows would be priced from samples.
  const charges = (booking.room_id ? room : venue)
    ? bookingLines(localBooking, { rooms, venues, bookingsList: bookings }).items
    : []
  const billLines = Math.max(1, charges.length) + slips.length + receiptRecords.length
  const breakfastWanted = wantsBreakfastToday(localBooking, todayKey)
  // After 11 AM an unasked morning is not asked any more — it reads as nothing today.
  const breakfastUnasked = breakfastWanted && !breakfastToday && breakfastAskOpen()
  const breakfastAsked = breakfastWanted && !breakfastUnasked
  const details = !isBlock && (hasPhone || hasEmail || (booking.companions?.length || 0) > 0 ||
    !!(booking.reference_number || booking.registered_on || booking.vehicle_plate || booking.company_name || booking.institution || togetherLabel))

  const modalContent = (
    <div className={'fixed inset-0 z-50 flex items-center justify-center p-4 ' + (closing ? 'pointer-events-none' : '')}>
      <div aria-hidden="true" className={'absolute inset-0 bg-slate-900/50 animate-in fade-in duration-200 motion-reduce:animate-none ' + (closing ? 'bp-gone' : '')} />
      {/* The panel is as wide as its contents, not a fixed number (the owner: *"don't
          make the width fixed"*): `w-fit` lets the widest row set the width and the short
          rows fill it. The floor keeps a block's short panel from collapsing; the cap
          stops a long name or email from stretching it across the screen. */}
      <div ref={card} className="relative w-fit min-w-[min(92vw,26rem)] max-w-[min(92vw,34rem)] bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[88vh]">
        {seal && (
          <div role="status" className={'absolute inset-0 z-10 bg-card grid place-content-center justify-items-center gap-2.5 pointer-events-none ' + (sealLeaving ? 'bp-gone' : 'bp-dim')}>
            <span className="relative w-16 h-16 grid place-items-center rounded-full bg-ink-900 text-gold-400 bp-seal">
              {seal.icon === 'in' ? <KeyRound className="w-7 h-7" /> : seal.icon === 'out' ? <DoorOpen className="w-7 h-7" /> : seal.icon === 'paid' ? <Banknote className="w-7 h-7" /> : <Check className="w-7 h-7" />}
              <i /><i /><i /><i /><i /><i />
            </span>
            <b className="font-display text-[19px] font-bold tracking-tight text-main">{seal.title}</b>
            <span className="text-[13px] text-muted">{seal.sub}</span>
          </div>
        )}

        {party && (() => {
          const words = party.kind === 'in' ? 'Welcome, ' + firstName + '!' : 'See you again!'
          return (
            <div role="status" className={(party.leaving ? 'opacity-0 ' : '') + 'transition-opacity duration-300 bw-party absolute inset-0 z-20 grid place-content-center justify-items-center gap-2 text-center text-white px-6 ' + (party.kind === 'in' ? 'bg-emerald-600' : 'bg-ink-900')}>
              <span aria-hidden="true" className={'bw-party-av w-16 h-16 grid place-items-center rounded-full bg-white font-display text-[22px] font-bold shadow-[0_0_0_6px_rgb(255_255_255_/_0.2)] ' + (party.kind === 'in' ? 'text-emerald-700' : 'text-main')}>
                {pillInitials(booking.guest_name)}
              </span>
              <b className="font-display text-[32px] font-bold tracking-tight leading-tight" aria-label={words}>
                {words.split('').map((c, i) => (
                  <span key={i} aria-hidden="true" className="bw-party-lt inline-block" style={{ animationDelay: 200 + i * 35 + 'ms' }}>{c === ' ' ? '\u00a0' : c}</span>
                ))}
              </b>
              <span className="text-[14px] font-semibold text-white/90">{party.kind === 'in' ? place + ' · checked in ' + clock() : place + ' is free'}</span>
              {party.owed > 0 && <span className="text-[12px] font-semibold bg-white/15 rounded-full px-2.5 py-0.5">{fmtPeso(party.owed)} stays on the bill</span>}
            </div>
          )
        })()}

        {/* THE VISUAL HIERARCHY (the owner's choice, 2026-10-15): four levels, each a step
            down in size, weight and colour — 1 what is owed and where the stay is, 2 the
            one thing to press, 3 the bill, folded until opened, 4 the tools along the bottom. */}
        <div className="flex items-center gap-3 pl-5 pr-1.5 pt-3 pb-1 shrink-0">
          <span aria-hidden="true" className="w-[42px] h-[42px] shrink-0 grid place-items-center rounded-[10px] bg-ink-900 text-gold-400 font-display font-bold text-[17px]">{badge}</span>
          {/* Nothing here is cut short: on a phone a long name wraps rather than reading `Angela…`. */}
          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-display font-bold text-[18px] leading-tight text-main break-words min-w-0">
                <span className="sr-only">{place} · </span>{who}
              </h3>
              {isBlock && <span className="shrink-0 text-[12px] font-bold text-muted bg-softbg border border-soft rounded-md px-2 py-0.5">Blocked</span>}
            </div>
            <p className="text-[12px] text-muted mt-0.5">{subLine}</p>
          </div>
          <div className="flex items-center shrink-0 self-start">
            {onEditBooking && !isBlock && (
              <button type="button" onClick={onEditBooking} aria-label="Edit booking" title="Edit booking"
                className="bw-pen w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-gold-700 hover:bg-softbg transition-colors cursor-pointer">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={() => close()} aria-label="Close" title="Close"
              className="bw-x w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {isBlock && <div aria-hidden="true" className="bw-hatch mt-2 shrink-0" />}
        <div className="px-5 overflow-y-auto flex-1">
          <div className="pt-3 pb-5 flex flex-col gap-[22px] empty:hidden">
            {/* What needs the desk before anything else sits on top: the short-stay clock,
                and a breakfast nobody has asked about yet. */}
            {(isShortStay || breakfastUnasked) && (
              <div className="space-y-2 empty:hidden">
                <ShortStayClock booking={localBooking} due={shortStayDue} />
                {breakfastUnasked && (
                  <button type="button" onClick={() => setBreakfastOpen(true)}
                    className="w-full min-h-11 flex items-center gap-2.5 rounded-lg bg-danger-50 px-3 text-[13px] font-bold text-danger-600 text-left hover:bg-danger-100 transition-colors cursor-pointer">
                    <span aria-hidden="true" className="w-2 h-2 rounded-full bg-current animate-pulse motion-reduce:animate-none" />
                    <Coffee aria-hidden="true" className="w-[18px] h-[18px] animate-hop" />
                    Breakfast not asked
                    <span className="ml-auto underline underline-offset-[3px]">Ask</span>
                  </button>
                )}
              </div>
            )}

            {/* LEVEL 1 — the answer: what is owed, biggest, and where the stay is under it. */}
            {!isBlock && (
              <div className="space-y-2">
                {figure && (
                  <>
                    <p className="text-[13px] font-bold text-muted">{figure.label}</p>
                    <p className={'font-display font-bold text-[40px] leading-none tracking-tight ' + figure.tone}>
                      {figure.value === null ? (
                        <span className="bw-full" style={openedPaid ? undefined : wait}>
                          {['Paid', 'in', 'full'].map((w, i) => (
                            <React.Fragment key={w}>{i > 0 && ' '}<span className="bw-word" style={{ '--i': i } as React.CSSProperties}>{w}</span></React.Fragment>
                          ))}
                        </span>
                      ) : <CountPeso value={figure.value} />}
                    </p>
                  </>
                )}
                {/* How much of the bill is in: green for what is paid, and it fills as money is received. */}
                {totalCharge > 0 && due > 0 && !billedToAgency && (
                  <div aria-hidden="true" className={'relative h-1.5 rounded-full overflow-hidden ' + (paidSoFar > 0 ? 'bg-danger-200' : 'bg-paper-300')}>
                    {/* The money in the Receive box, striped ahead of the fill: what the bar will be once it is saved. */}
                    {receiveOpen && receiveAmount > 0 && (
                      <div style={{ '--will': Math.min(1, (paidSoFar + receiveAmount) / totalCharge) } as React.CSSProperties}
                        className="absolute inset-0 rounded-full origin-left [transform:scaleX(var(--will))] transition-transform duration-500 ease-out opacity-50 bg-[repeating-linear-gradient(-45deg,#059669_0_4px,#6EE7B7_4px_8px)]" />
                    )}
                    {/* While a seal is up the fill waits for it to fade, so the money going in is seen. */}
                    {/* 1300 ms is SEAL_MS. Spelled as a property: `delay-[1300ms]` is claimed by both
                        Tailwind and tailwindcss-animate, so it is never generated. */}
                    <div style={{ '--paid': Math.min(1, paidSoFar / totalCharge) } as React.CSSProperties}
                      className={'relative h-full rounded-full bg-emerald-600 origin-left [transform:scaleX(var(--paid))] transition-transform duration-700 ease-out ' + (seal && !sealLeaving ? '[transition-delay:1300ms]' : '')} />
                  </div>
                )}
                <div className="pt-1">
                  <BookingStageLine booking={localBooking} now={step} todayKey={todayKey} />
                </div>
              </div>
            )}

            {/* LEVEL 2 — the next step. While the guest owes, that is receiving the money, and
                the door it opens — Check in, then Check out — waits under it, smaller. */}
            {(openEnded || receiveShown || (!isBlock && (!localBooking.actual_check_in || isIn || due > 0)) || pendingEarly > 0 || !!actionNotice) && (
              <div className="space-y-2">
                {/* A block with no end date has one job left: being ended. */}
                {openEnded && (
                  <button type="button" onClick={() => void endOpenBlock()} className={BTN_GOLD + ' bw-shine'}>
                    They have left
                  </button>
                )}

                {/* Recorded early check-in, not billed yet: one line saying what the guest
                    will owe and when it lands, so the money never moves in silence. */}
                {pendingEarly > 0 && (
                  <div className="flex items-center gap-1">
                    <p className="flex-1 text-[12px] font-semibold text-brand-text leading-snug">
                      Early check-in {earlyHoursRecorded} hour{earlyHoursRecorded > 1 ? 's' : ''}
                      {earlyHoursRecorded > getRateConfig().lateEarlyCapHours ? ' (past the ' + getRateConfig().lateEarlyCapHours + '-hour cap)' : ''}
                      {' — '}{fmtPeso(pendingEarly)} goes on the bill at check-out.
                    </p>
                    {/* Not on the bill yet, so it is taken off here (2026-10-20). */}
                    {onUpdateBooking && (
                      <button type="button" aria-label="Remove the early check-in charge" title="Remove the early check-in charge"
                        onClick={() => void removeCharge({ key: 'early-pending', band: 'extras', description: 'Early check-in', qty: '', unit: 'HR', price: pendingEarly, discount: 0, amount: pendingEarly, remove: { early_check_in_hours: 0 } })}
                        className="w-10 h-10 -mr-2 shrink-0 flex items-center justify-center rounded-lg text-muted hover:text-danger-600 hover:bg-danger-50 active:scale-90 transition cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Why the action just pressed did not go through — on the page, beside
                    the action, where it can be read while acting. */}
                {actionNotice && (
                  <p role="alert" key={actionNotice} className="flex items-center gap-1.5 text-[13px] font-semibold text-danger-600 leading-snug bw-arrive">
                    <XCircle aria-hidden="true" className="w-4 h-4 shrink-0" />{actionNotice}
                  </p>
                )}

                {/* **Receive leads, the door beside it** (the check-in loop mock, Sebastian, 2026-10-18).
                    The staff did not know a guest who owes could be checked in: the door was a grey
                    "pay later" link under Receive. Paying stays the big button; Check in or Check out
                    sits beside it as a real button, and asks once, naming the amount. */}
                {receiveShown && (
                  <div className={besideReceive ? 'grid grid-cols-[1.6fr_1fr] gap-2' : ''}>
                  <div ref={receiveBox} className="rounded-xl min-w-0">
                  <ReceiveMoney
                    owed={dueNow}
                    amount={receiveAmount}
                    onAmount={setReceiptAmount}
                    slipLabel={payingSlip ? 'order slip ' + slipNumber(payingSlip.tab) : undefined}
                    method={receiptMethod}
                    // Back from GCash or a bank transfer clears the choice here only; nothing is saved.
                    onMethod={m => layout(() => { if (m) pickMethod(m); else { setReceiptMethod(''); setReceiptRef('') } })}
                    reference={receiptRef}
                    onReference={setReceiptRef}
                    onReferenceCommit={() => { if (receiptRef.trim()) void savePaymentMethod(receiptMethod, receiptRef) }}
                    loud={step === 'payment'}
                    open={receiveOpen}
                    // The window grows to the amount and the ways to pay, and shrinks back, instead of snapping (Sebastian, 2026-10-17).
                    onOpen={() => layout(() => setReceiveOpen(true))}
                    onClose={() => layout(() => { setReceiveOpen(false); setReceiptAmount(null); setReceiptMethod(''); setReceiptRef('') })}
                    onReceive={() => void handleAddReceipt()}
                  />
                  </div>
                  {besideReceive && (doorKind === 'in' ? (
                    <button type="button" onClick={() => setAsk('in')} className={DOOR_BESIDE_IN + glowIn}>Check in</button>
                  ) : (
                    <button ref={checkOutBtn} type="button" onClick={tryCheckOut} className={DOOR_BESIDE_OUT + glowOut}>
                      Check out <DoorOpen aria-hidden="true" className="bw-door w-4 h-4 -mt-0.5" />
                    </button>
                  ))}
                  </div>
                )}
                {/* Check in leads once it is the next step; while money is owed it is a quiet
                    word under Receive — the desk may still let the guest in, and pay later. */}
                {!isBlock && !localBooking.actual_check_in && (ask === 'in' ? (
                  <DoorAsk title={checkInAsk.title} message={checkInAsk.message} yes={checkInAsk.yes} tone="green"
                    onYes={() => void handleCheckIn()} onBack={() => setAsk(null)} />
                  // "Pay later" goes while the money is being taken (Sebastian, 2026-10-18): it is
                  // the other way round from what the desk is doing right then.
                ) : besideReceive || (receiveOpen && step !== 'checkIn') ? null : (
                  <button type="button" onClick={() => setAsk('in')} style={step !== openedStep ? wait : undefined}
                    className={step === 'checkIn' ? BTN_GREEN + ' bw-shine' + glowIn + (step !== openedStep ? ' bw-arrive' : '') : QUIET_LINK}>
                    {step === 'checkIn' ? <><LogIn aria-hidden="true" className="w-4 h-4 -mt-0.5 mr-1.5 inline-block" />Check in</> : 'Check in, pay later'}
                  </button>
                ))}
                {!isBlock && isIn && (ask === 'out' ? (
                  <DoorAsk title={checkOutAsk.title} message={checkOutAsk.message} yes={checkOutAsk.yes} tone="ink"
                    onYes={() => void handleCheckOut()} onBack={() => setAsk(null)} />
                ) : besideReceive || (receiveOpen && owesAtDoor) ? null : (
                  <button ref={checkOutBtn} type="button" onClick={tryCheckOut} style={step !== openedStep ? wait : undefined}
                    className={(step === 'checkOut' && checkOutDue ? BTN_GOLD + ' bw-shine' + glowOut : BTN_QUIET) + (step !== openedStep ? ' bw-arrive' : '')}>
                    {owesAtDoor ? 'Check out, pay later' : 'Check out'} <DoorOpen aria-hidden="true" className="bw-door w-4 h-4 -mt-0.5 ml-0.5" />
                  </button>
                ))}
                {!isBlock && due > 0 && step !== 'payment' && !receiveOpen && (
                  <button type="button" onClick={() => layout(() => setReceiveOpen(true))} className={QUIET_LINK}>
                    Receive a payment
                  </button>
                )}
              </div>
            )}

            {/* LEVEL 3 — the bill, folded: the charge, the order slips, every payment with
                its receipt. Small and grey; opened when the desk wants the detail. The guest's
                details fold in with it (the booking window mock, 2026-10-16): one line to open,
                not a block of small print under the bill. */}
            {(hasBill || breakfastAsked || details) && (
              <div className="space-y-2">
                {(hasBill || details) && (
                  <div>
                    <button type="button" onClick={() => layout(() => setBillOpen(o => !o))} aria-expanded={billOpen}
                      className="w-full min-h-10 flex items-center justify-between text-[13px] font-bold text-muted hover:text-main transition-colors cursor-pointer">
                      <span>{hasBill ? (details ? 'Bill & details · ' : 'Bill · ') + billLines + (billLines === 1 ? ' line' : ' lines') : 'Details'}</span>
                      <ChevronDown className={'w-4 h-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ' + (billOpen ? 'rotate-180' : '')} />
                    </button>
                    {removed && (
                      <div role="status" key={removed.label} className="bw-arrive relative overflow-hidden flex items-center gap-2 h-11 my-1.5 rounded-lg bg-ink-900 text-white pl-3 pr-1.5 text-[13px] font-semibold">
                        <span className="flex-1 min-w-0 truncate">{removed.label} removed · {fmtPeso(Math.abs(removed.amount))}</span>
                        <button type="button" onClick={() => void undoRemove()}
                          className="h-8 px-3.5 rounded-md bg-gold-400 text-ink-900 text-[13px] font-bold cursor-pointer active:scale-95 transition-transform">Undo</button>
                        <span aria-hidden="true" style={{ '--ms': '5000ms' } as React.CSSProperties} className="fd-drain absolute left-0 bottom-0 h-[3px] w-full bg-gold-400" />
                      </div>
                    )}
                    {billOpen && (
                      <div className="bw-billin">
                        {hasBill && (
                          <ul>
                            {charges.length === 0 ? (
                              <li className="flex items-center justify-between gap-3 min-h-10 border-b border-dashed border-paper-300 last:border-0 text-[12px]">
                                <span className="font-semibold text-main">{stayCharge}</span>
                                <span className="font-semibold text-main tabular-nums">{fmtPeso(totalCharge - tabAmount)}</span>
                              </li>
                            ) : charges.map(line => (
                              <li key={line.key} className="flex items-center justify-between gap-2 min-h-10 border-b border-dashed border-paper-300 last:border-0 text-[12px]">
                                <span className="font-semibold text-main min-w-0">{line.band === 'room' ? stayCharge : line.description}</span>
                                <span className="flex items-center shrink-0">
                                  <span className={'font-semibold tabular-nums ' + (line.amount < 0 ? 'text-emerald-700' : 'text-main')}>
                                    {line.amount < 0 ? '−' + fmtPeso(-line.amount) : fmtPeso(line.amount)}
                                  </span>
                                  {line.remove && onUpdateBooking && (
                                    <button type="button" onClick={() => void removeCharge(line)}
                                      aria-label={'Remove ' + line.description} title={'Remove ' + line.description}
                                      className="w-10 h-10 -mr-2 flex items-center justify-center rounded-lg text-muted hover:text-danger-600 hover:bg-danger-50 active:scale-90 transition cursor-pointer">
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </span>
                              </li>
                            ))}
                            <BookingOrderSlips
                              slips={slips}
                              who={localBooking.guest_name || 'Guest'}
                              place={{ label: booking.room_id ? 'Room' : 'Venue', value: unitSub || unitName }}
                            />
                            <BookingReceipts
                              records={receiptRecords}
                              coveredRooms={coveredRooms}
                              onRemove={handleRemoveReceipt}
                              onPrint={r => { setReceiptFor(r); setShowReceipt(true) }}
                            />
                          </ul>
                        )}
                        {details && (
                          <div className={'text-[12px] text-muted space-y-1.5 pb-1 ' + (hasBill ? 'pt-2.5 border-t border-dashed border-paper-300' : '')}>
                            {/* The store writes the literal "None" when no phone was taken, so
                                treat that (and a missing email) as nothing and skip the line
                                rather than printing a row that says nothing. */}
                            {(hasPhone || hasEmail) && (
                              <p className="break-words">
                                {hasPhone && <span>{booking.guest_phone}</span>}
                                {hasPhone && hasEmail && <span> · </span>}
                                {hasEmail && <span>{booking.guest_email}</span>}
                              </p>
                            )}
                            {booking.companions && booking.companions.length > 0 && (
                              <p>
                                With{' '}
                                {booking.companions.map((comp, idx) => (
                                  <span key={idx}>
                                    {idx > 0 ? ', ' : ''}
                                    <strong className="text-main">{comp.name}</strong>
                                    {(comp.nationality || comp.sex) ? <span className="capitalize"> ({[comp.nationality, comp.sex].filter(Boolean).join(', ').toLowerCase()})</span> : null}
                                  </span>
                                ))}
                              </p>
                            )}
                            <p className="flex flex-wrap gap-x-4 gap-y-0.5 empty:hidden">
                              {booking.reference_number && <span>Paper ref <strong className="text-main">{booking.reference_number}</strong></span>}
                              {booking.registered_on && <span>Logged <strong className="text-main">{booking.registered_on}</strong></span>}
                              {booking.vehicle_plate && <span>Plate <strong className="text-main uppercase">{booking.vehicle_plate}</strong></span>}
                              {booking.company_name && <span>Company <strong className="text-main">{booking.company_name}</strong></span>}
                              {booking.institution && <span>Institution <strong className="text-main">{booking.institution}</strong></span>}
                              {togetherLabel && <span>Booked together <strong className="text-main">{togetherLabel}</strong></span>}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Breakfast is asked every morning (the owner, 2026-10-04). Unasked, it is the
                    red line at the top; answered, it is a quiet line here. The choices are read
                    from the LIVE booking — they are saved by their own writer. */}
                {breakfastAsked && (
                  <button type="button" onClick={() => setBreakfastOpen(true)}
                    className="w-full min-h-10 flex items-center justify-between gap-3 border-t border-soft text-[12px] text-left hover:text-main transition-colors cursor-pointer">
                    <span className="font-bold text-muted shrink-0">Breakfast today</span>
                    <span className="text-muted truncate">{breakfastToday ? breakfastSummary(breakfastToday) : 'Nothing today'}</span>
                  </button>
                )}
              </div>
            )}

            {(extendOpen || datesAlwaysShown) && canExtend && (
              <section ref={datesAlwaysShown ? undefined : showSection} className={datesAlwaysShown ? '' : 'bw-formin'}>
                <h4 className="text-[13px] font-bold text-main mb-1.5">{extendLabel}</h4>
                <ExtendStayForm
                  booking={localBooking}
                  extendCheckoutDate={extendCheckoutDate}
                  setExtendCheckoutDate={setExtendCheckoutDate}
                  extendError={extendError}
                  extraNights={extraNights}
                  becomesNights={becomesNights}
                  newBalanceDue={newBalanceDue}
                  showErr={showErr}
                  isInvalid={isInvalid}
                  markTouched={markTouched}
                  onSubmit={handleExtendSubmit}
                />
              </section>
            )}

            {moveOpen && canMove && (
              <section ref={showSection} className="bw-formin">
                <h4 className="text-[13px] font-bold text-main mb-1.5">Change room or dates</h4>
                <MoveBookingForm
                  booking={localBooking}
                  rooms={rooms}
                  venues={venues}
                  bookings={bookings}
                  tabTotal={tabAmount}
                  onMove={handleMove}
                />
              </section>
            )}
          </div>
        </div>

        {/* LEVEL 4 — the tools: smallest and lightest, never competing with the next step.
            Outside the scroll, so they stay put at the bottom — always open, never behind a
            "More" (Sebastian, 2026-10-16: "just keep it open"). Undo and cancel ask in this
            row before they act. */}
        {toolAsk ? (
          <div className="border-t border-soft px-4 py-1.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 shrink-0 bw-ask">
            <span className={'text-[12px] font-bold ' + (toolAsk === 'cancel' ? 'text-danger-600' : 'text-main')}>
              {toolAsk === 'undo'
                ? (localBooking.actual_check_out ? 'Undo the check-out? The guest is back in the hotel.' : 'Undo the check-in? It goes back to not checked in.')
                : isBlock ? 'Remove this block? The dates open again.'
                  : 'Cancel ' + booking.guest_name + "'s booking?" + (paidSoFar > 0 ? ' The ' + fmtPeso(paidSoFar) + ' received stays on record.' : '')}
            </span>
            <span className="flex items-center gap-1">
              <button type="button"
                onClick={() => {
                  if (toolAsk === 'undo') { void handleUndo(localBooking.actual_check_out ? 'check_out' : 'check_in'); return }
                  onCancelBooking?.(booking.id)
                  onClose()
                }}
                className={'min-h-9 px-3 rounded-lg text-[12px] font-bold text-white cursor-pointer active:scale-95 transition-transform ' + (toolAsk === 'cancel' ? 'bg-danger-600 hover:bg-danger-700' : 'bg-ink-900 hover:bg-ink-800')}>
                {toolAsk === 'undo' ? 'Undo' : isBlock ? 'Remove block' : 'Cancel booking'}
              </button>
              <button type="button" onClick={() => layout(() => { setToolAsk(null); setToolsBack(true) })} className="min-h-9 px-3 rounded-lg text-[12px] font-semibold text-muted hover:text-main cursor-pointer">
                Keep
              </button>
            </span>
          </div>
        ) : (
          <div ref={toolsRow} className={'relative border-t border-soft px-1.5 py-0.5 flex flex-wrap items-center justify-center shrink-0' + (toolsSinking ? ' bw-sink' : '') + (toolsBack ? ' bw-tools-back' : '')}>
            {canExtend && !datesAlwaysShown && (
              <button type="button" onClick={() => layout(() => { setExtendOpen(o => !o); setMoveOpen(false) })} aria-expanded={extendOpen} className={TOOL + (extendOpen ? ' !text-main' : '')}>
                <CalendarPlus data-i="cal" className="w-3.5 h-3.5" />
                {extendLabel}
              </button>
            )}
            {canMove && (
              <button type="button" onClick={() => layout(() => { setMoveOpen(o => !o); setExtendOpen(false) })} aria-expanded={moveOpen} className={TOOL + (moveOpen ? ' !text-main' : '')}>
                <ArrowRightLeft data-i="swap" className="w-3.5 h-3.5" />
                Move
              </button>
            )}
            {!isBlock && (
              <button type="button" data-printing={printing ? '' : undefined} className={TOOL}
                onClick={() => { setPrinting(true); setTimeout(() => { setPrinting(false); setShowPrintModal(true) }, 260) }}>
                <Printer data-i="print" className="w-3.5 h-3.5" />
                Print bill
              </button>
            )}
            {/* No "Take orders" here (Sebastian, 2026-10-16: "these should never have take
                orders"): an order starts with a table on the Restaurant screen, never with a room. */}
            {!isBlock && localBooking.actual_check_in && (
              <button type="button" onClick={() => askTool('undo')} className={TOOL}>
                <Undo2 data-i="undo" className="w-3.5 h-3.5" />
                {localBooking.actual_check_out ? 'Undo check-out' : 'Undo check-in'}
              </button>
            )}
            {/* Not offered once the guest is in the hotel or has left: a guest who has used
                the room is checked out, not cancelled, and cancelling a finished stay
                would take its money out of the Earnings Report. */}
            {onCancelBooking && (isBlock || !localBooking.actual_check_in) && (
              <button type="button" onClick={() => askTool('cancel')} className={TOOL + ' !text-danger-400 hover:!text-danger-600'}>
                <XCircle data-i="x" className="w-3.5 h-3.5" />
                {isBlock ? 'Remove block' : 'Cancel booking'}
              </button>
            )}
            <span ref={toolBar} aria-hidden="true" className="bw-bar" />
          </div>
        )}
      </div>

      {breakfastOpen && (
        <BreakfastPicker
          booking={booking}
          date={todayKey}
          place={unitSub || unitName}
          onClose={() => setBreakfastOpen(false)}
        />
      )}
      {showPrintModal && (
        <PrintInvoiceModal
          booking={localBooking}
          rooms={rooms}
          venues={venues}
          bookingsList={bookings}
          onClose={() => setShowPrintModal(false)}
        />
      )}
      {showReceipt && receiptFor && (
        <PrintPaymentReceiptModal
          booking={localBooking}
          record={receiptFor}
          rooms={rooms}
          venues={venues}
          /* Every room this payment covered, so a receipt found from Room 7 names Rooms 4–10 and its
             figures are the money that was actually taken (2026-09-30). */
          covered={coveredBookings[receiptFor.receipt_number || '']}
          /* The receipt for a payment just taken is the end of the errand: closing
             it closes the whole panel, so the desk is back at the calendar instead of
             holding a booking they have finished with. */
          onClose={() => {
            setShowReceipt(false)
            if (closeAfterPayment) { setCloseAfterPayment(false); close() }
          }}
        />
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}

/**
 * A door about to open, asked where its button stood (the booking window mock, Sebastian,
 * 2026-10-16) — it used to be a pop-up over the whole panel. The question names the guest and
 * the room, the second line says what follows, and Back puts the button back.
 */
function DoorAsk({ title, message, yes, tone, onYes, onBack }: {
  title: string
  message?: string
  yes: string
  tone: 'green' | 'ink'
  onYes: () => void
  onBack: () => void
}) {
  return (
    <div role="group" aria-label={title} className="rounded-xl bg-gold-100 p-3 flex flex-col gap-2.5 bw-arrive">
      <p className="text-[14px] font-bold text-main leading-snug">
        {title}
        {message && <span className="block mt-1 text-[12px] font-medium text-muted">{message}</span>}
      </p>
      <div className="grid grid-cols-[1fr_auto] gap-2">
        <button type="button" autoFocus onClick={onYes}
          className={'min-h-11 rounded-lg text-[14px] font-bold text-white active:scale-[0.98] transition-[background-color,transform] cursor-pointer ' +
            (tone === 'green' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-ink-900 hover:bg-ink-800')}>
          {yes}
        </button>
        <button type="button" onClick={onBack} className="min-h-11 px-4 rounded-lg text-[14px] font-semibold text-muted hover:text-main cursor-pointer">
          Back
        </button>
      </div>
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from '@tanstack/react-router'
import { X, Printer, Edit3, CalendarPlus, Undo2, ArrowRightLeft, Banknote, Check, DoorOpen, KeyRound } from 'lucide-react'
import { Booking, Room, Venue, PaymentRecord } from '../../types/booking'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig } from '../../utils/rateConfig'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { roomDisplayName, roomOptionLabel } from './bookingStyles'
import { statusAfterPayment } from '../../utils/bookingStatus'
import { hasOutstandingBalance, amountToPayNow, isBilledToAgency } from '../../utils/bookingMoney'
import { methodNeedsReference } from '../../utils/paymentMethod'
import { nextReceiptNumber } from '../../utils/receiptNumber'
import { withoutPayment } from '../walk-in/bookingPayment'
import { recomputeBalance, pendingEarlyCharge, extendStay } from '../../utils/bookingBalance'
import { useBookingSlips } from '../../hooks/useBookingSlips'
import { closeTab, getOpenTabForBooking } from '../../utils/tabs'
import { markSlipsPaid, slipNumber, unpaidSlips, unpaySlipsOfReceipt } from '../../utils/orderSlips'
import { undoBookingCheck } from '../../utils/db'
import { BookingStageLine } from './BookingStageLine'
import { nextStep } from './bookingStep'
import { PayChoice, ReceiveMoney } from './ReceiveMoney'
import { BookingOrderSlips } from './BookingOrderSlips'
import { ShortStayClock } from './ShortStayClock'
import { stayHoursOf } from '../../utils/shortStay'
import { BreakfastPicker } from './BreakfastPicker'
import { wantsBreakfastToday, breakfastOn, breakfastSummary } from '../../utils/breakfastChoice'
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
import { focusGuestTab } from '../../utils/restaurantFocus'

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
const BTN = 'w-full min-h-12 px-4 rounded-lg text-[15px] font-bold transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer '
const BTN_GOLD = BTN + 'bg-gold-400 hover:bg-gold-600 text-ink-900 shadow-sm'
const BTN_GREEN = BTN + 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
const BTN_QUIET = BTN + 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100'
// The bottom row: plain words, finger-sized.
const ROW_ACTION = 'min-h-11 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors cursor-pointer'

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
  const [breakfastOpen, setBreakfastOpen] = useState(false)
  const navigate = useNavigate()
  const [localBooking, setLocalBooking] = useState(booking)
  // Something the pressed action could not do, said on the page beside the
  // button (e.g. checking out while money is still owed). Replaced every popup.
  const [actionNotice, setActionNotice] = useState('')
  // `closeAfterPayment` closes this whole panel once the receipt for a recorded
  // payment is dismissed — the money is in, the job here is done.
  const [closeAfterPayment, setCloseAfterPayment] = useState(false)
  // What the money is for: everything owed (`all`), one order slip (its id), or an
  // amount the desk types (`other`).
  const [payFor, setPayFor] = useState('all')
  const [receiptAmount, setReceiptAmount] = useState(0)
  const [extendOpen, setExtendOpen] = useState(false)
  // "Change room or dates" opens in the same place as Extend stay; only one is open at a time.
  const [moveOpen, setMoveOpen] = useState(false)
  // A stay billed to an agency keeps its receive step folded away until it is wanted.
  const [receiveOpen, setReceiveOpen] = useState(false)
  // Nothing is preselected: how the guest paid is asked for every payment, because
  // defaulting to 'Cash' is what once printed a Cash receipt for a GCash guest.
  const [receiptMethod, setReceiptMethod] = useState('')
  const [receiptRef, setReceiptRef] = useState('')
  const [tryPayment, setTryPayment] = useState(false)
  const [receiptFor, setReceiptFor] = useState<PaymentRecord | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)
  // The step just finished, said over the panel for a moment.
  const [seal, setSeal] = useState<{ title: string; sub: string; icon: 'in' | 'out' | 'paid' } | null>(null)
  const sealTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(sealTimer.current), [])
  const SEAL_MS = 1300
  const mark = (next: { title: string; sub: string; icon: 'in' | 'out' | 'paid' }) => {
    setSeal(next)
    window.clearTimeout(sealTimer.current)
    sealTimer.current = window.setTimeout(() => setSeal(null), SEAL_MS)
  }
  const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

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
  // Everything owed, or one order slip on its own: a room guest may pay for their food
  // before check-out while the rest of the bill stays open (the owner, 2026-10-04). A
  // slip is only offered apart when something else is owed besides it. The deposit is
  // agreed on the STAY alone, so the food is taken out of it (`amountToPayNow`).
  const dueNow = amountToPayNow(localBooking, tabAmount)
  const unpaid = unpaidSlips(slips)
  const choices: PayChoice[] = [
    { key: 'all', label: dueNow < due ? 'Deposit' : 'Everything owed', amount: dueNow },
    ...unpaid.filter(s => s.total < due).map(s => ({ key: s.tab.id, label: 'Order slip ' + slipNumber(s.tab), amount: s.total })),
  ]
  const payingSlip = unpaid.find(s => s.tab.id === payFor && s.total < due)

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
    } catch {
      showToast('Could not remove the payment. Please try again.', 'error')
    }
  }

  // Recompute the balance after early/late hours are applied, using the
  // booking's own charges + current rates + the guest's food, so the amount
  // owed stays correct. The rule itself lives in utils/bookingBalance.ts.
  const withRecomputedBalance = (base: Booking, patch: Partial<Booking>): Booking =>
    recomputeBalance({ ...base, ...patch }, { rooms, venues, tabTotal: tabAmount })

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
  const handleCheckIn = async () => {
    // Check-in is how the money is collected at the door, so it waits for it.
    if (owes && !billedToAgency) {
      setActionNotice('This guest still owes ' + fmtPeso(due) + '. Receive it first, then check them in.')
      return
    }
    const ok = await askConfirm({
      title: 'Check in ' + booking.guest_name + ' to ' + place + '?',
      message: localBooking.check_in > todayKey ? 'This booking starts on ' + fmtShort(localBooking.check_in) + '.' : undefined,
      confirmLabel: 'Check in',
    })
    if (!ok) return
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
    mark({ title: 'Checked in', sub: place + ' · ' + clock(), icon: 'in' })
    if (earlyHours > 0) {
      const hours = earlyHours + ' hour' + (earlyHours > 1 ? 's' : '')
      const why = earlyHours > rates.lateEarlyCapHours
        ? hours + ' early — past the ' + rates.lateEarlyCapHours + '-hour cap, so a night'
        : hours + ' early'
      showToast('Checked in ' + why + ' goes on the bill at check-out.', 'info')
    }
    try { await onUpdateBooking?.(updated) } catch { showToast('Could not check in. Please try again.', 'error') }
  }

  const handleCheckOut = async () => {
    // A guest never leaves with an unpaid bill; a stay billed to an agency is the
    // exception — the agency pays later.
    if (owes && !billedToAgency) {
      setActionNotice('This guest still owes ' + fmtPeso(due) + '. Receive it first, then check them out.')
      return
    }
    const leavesEarly = !localBooking.stay_hours && localBooking.check_out > todayKey
    const ok = await askConfirm({
      title: 'Check out ' + booking.guest_name + ' from ' + place + '?',
      message: leavesEarly ? 'Their stay runs until ' + fmtShort(localBooking.check_out) + '.' : undefined,
      confirmLabel: 'Check out',
    })
    if (!ok) return
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
    // A stay that grew at check-out still has money to take: that is said, not sealed.
    if (!hasOutstandingBalance(updated) || billedToAgency) mark({ title: 'Checked out', sub: place + ' is free · ' + clock(), icon: 'out' })
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
    if (hasOutstandingBalance(updated) && !billedToAgency) {
      const owed = fmtPeso(Number(updated.balance_due || 0))
      const grew = []
      if (Number(updated.early_check_in_hours || 0) > 0) grew.push('early check-in')
      if (lateHours > 0) grew.push('late check-out')
      setActionNotice(
        (grew.length ? 'Added for ' + grew.join(' and ') + '. ' : 'This stay still owes ' + owed + '. ') +
        'Receive ' + owed + ' before the guest leaves.'
      )
      if (!showPrintModal) setShowPrintModal(true)
    }
  }

  // A check-in or check-out pressed on the wrong booking is taken back here.
  const handleUndo = async (which: 'check_in' | 'check_out') => {
    // Food is only ordered by a guest who is really in the hotel.
    if (which === 'check_in' && slips.length > 0) {
      setActionNotice('This guest has order slips, so the check-in stays.')
      return
    }
    const ok = await askConfirm({
      title: (which === 'check_in' ? 'Undo the check-in of ' : 'Undo the check-out of ') + booking.guest_name + '?',
      message: which === 'check_in' ? 'The booking goes back to not checked in.' : 'The guest is back in the hotel.',
      confirmLabel: 'Undo',
    })
    if (!ok) return
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
  const handleAddReceipt = async () => {
    const other = payFor === 'other'
    const amount = Number(other ? receiptAmount : payingSlip ? payingSlip.total : dueNow) || 0
    setTryPayment(true)
    // What is missing is said on the form itself, under the part that needs filling.
    if (amount <= 0) return
    // The method is the guest's own choice, so it is never assumed: no method, no receipt.
    if (!receiptMethod.trim()) return
    if (methodNeedsReference(receiptMethod) && !receiptRef.trim()) return
    const newPaid = paidSoFar + amount
    const remaining = Math.max(0, totalCharge - newPaid)
    const rec: PaymentRecord = {
      id: 'rcpt-' + Date.now(),
      amount,
      method: receiptMethod,
      reference: receiptRef.trim() || undefined,
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
      payment_method: receiptMethod,
      payment_reference: receiptRef.trim() || localBooking.payment_reference,
    }
    setLocalBooking(updated)
    setActionNotice('')
    setReceiptAmount(0); setPayFor('all'); setTryPayment(false); setReceiptMethod(''); setReceiptRef(''); setReceiveOpen(false)
    // The money is marked at once; its receipt opens when it is saved and the seal has been seen.
    mark({ title: remaining <= 0 ? 'Paid' : 'Received', sub: fmtPeso(amount) + ' · ' + receiptMethod, icon: 'paid' })
    const sealSeen = new Promise(resolve => window.setTimeout(resolve, SEAL_MS - 250))
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
    : stayHoursOf(booking) > 0
      ? fmtShort(booking.check_in) + ' · ' + stayHoursOf(booking) + '-hour stay'
      : fmtShort(booking.check_in) + ' → ' + fmtShort(booking.check_out) + ' · ' + nights + (nights === 1 ? ' night' : ' nights')
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
  // Checking out before the last day is allowed, but it is not the expected next step.
  const checkOutDue = isShortStay || localBooking.check_out <= todayKey

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 animate-in fade-in duration-200 motion-reduce:animate-none">
      {/* The panel is as wide as its contents, not a fixed number (the owner: *"don't
          make the width fixed"*): `w-fit` lets the widest row set the width and the short
          rows fill it. The floor keeps a block's short panel from collapsing; the cap
          stops a long name or email from stretching it across the screen. */}
      <div className="relative w-fit min-w-[min(92vw,26rem)] max-w-[min(92vw,34rem)] bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 slide-in-from-bottom-2 duration-300 motion-reduce:animate-none">
        {seal && (
          <div role="status" className="absolute inset-0 z-10 bg-card/95 grid place-content-center justify-items-center gap-2.5 pointer-events-none bp-dim">
            <span className="relative w-16 h-16 grid place-items-center rounded-full bg-ink-900 text-gold-400 bp-seal">
              {seal.icon === 'in' ? <KeyRound className="w-7 h-7" /> : seal.icon === 'out' ? <DoorOpen className="w-7 h-7" /> : seal.icon === 'paid' ? <Banknote className="w-7 h-7" /> : <Check className="w-7 h-7" />}
              <i /><i /><i /><i /><i /><i />
            </span>
            <b className="font-display text-[19px] font-bold tracking-tight text-main">{seal.title}</b>
            <span className="text-[13px] text-muted">{seal.sub}</span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2 pl-5 pr-1.5 py-1.5 border-b border-soft shrink-0">
          {/* Nothing here is cut short: on a phone a long name wraps rather than reading `Angela…`. */}
          <div className="min-w-0 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-display font-bold text-[17px] leading-tight text-main break-words min-w-0">{place} · {who}</h3>
              {isBlock && <span className="shrink-0 text-[12px] font-bold text-muted bg-softbg border border-soft rounded-md px-2 py-0.5">Blocked</span>}
            </div>
            <p className="text-[12px] text-muted mt-1">{roomType ? roomType + ' · ' : ''}{stayLine}</p>
          </div>
          <div className="flex items-center shrink-0">
            {onEditBooking && !isBlock && (
              <button type="button" onClick={onEditBooking} aria-label="Edit booking" title="Edit booking"
                className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-gold-700 hover:bg-softbg transition-colors cursor-pointer">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Close" title="Close"
              className="w-11 h-11 flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 overflow-y-auto flex-1">
          <div className="py-4 space-y-3.5 empty:hidden">
            {/* WHERE THE STAY STANDS: the money, the arrival, the departure. */}
            {!isBlock && (
              <div>
                <BookingStageLine booking={localBooking} now={step} />
                {/* How much of the bill is in: green for what is paid, and it fills as money is received. */}
                {totalCharge > 0 && (
                  <div aria-hidden="true" className={'mt-2.5 h-1.5 rounded-full overflow-hidden ' + (paidSoFar > 0 ? 'bg-danger-200' : 'bg-paper-300')}>
                    <div style={{ '--paid': Math.min(1, paidSoFar / totalCharge) } as React.CSSProperties}
                      className="h-full rounded-full bg-emerald-600 origin-left [transform:scaleX(var(--paid))] transition-transform duration-700 ease-out" />
                  </div>
                )}
                {(paidSoFar > 0 || tabAmount > 0) && totalCharge > 0 && (
                  <p className="mt-2 text-[12px] text-muted">
                    Total <strong className="text-main">{fmtPeso(totalCharge)}</strong>
                    {paidSoFar > 0 && <> · Paid <strong className="text-emerald-700">{fmtPeso(paidSoFar)}</strong></>}
                    {tabAmount > 0 && <> · Room {fmtPeso(totalCharge - tabAmount)} · Restaurant &amp; bar {fmtPeso(tabAmount)}</>}
                  </p>
                )}
              </div>
            )}

            {/* The short-stay clock: the time the room is free, and a red word once it
                has passed. Nothing renders for an ordinary stay. */}
            <ShortStayClock booking={localBooking} due={shortStayDue} />

            {/* A block with no end date has one job left: being ended. */}
            {openEnded && (
              <button type="button" onClick={() => void endOpenBlock()} className={BTN_GOLD}>
                They have left
              </button>
            )}

            {/* Recorded early check-in, not billed yet: one line saying what the guest
                will owe and when it lands, so the money never moves in silence. */}
            {pendingEarly > 0 && (
              <p className="text-[12px] font-semibold text-brand-text leading-snug">
                Early check-in {earlyHoursRecorded} hour{earlyHoursRecorded > 1 ? 's' : ''}
                {earlyHoursRecorded > getRateConfig().lateEarlyCapHours ? ' (past the ' + getRateConfig().lateEarlyCapHours + '-hour cap)' : ''}
                {' — '}{fmtPeso(pendingEarly)} goes on the bill at check-out.
              </p>
            )}

            {/* Why the action just pressed did not go through — on the page, beside
                the action, where it can be read while acting. */}
            {actionNotice && (
              <p role="alert" className="text-[13px] font-semibold text-danger-600 leading-snug">{actionNotice}</p>
            )}

            {/* THE NEXT STEP. While the guest owes, that is receiving the money, and the
                door it opens — Check in, then Check out — waits under it, quiet. */}
            {receiveShown && (
              <ReceiveMoney
                choices={choices}
                payFor={payFor}
                onPayFor={key => { setPayFor(key); setReceiptAmount(0); setTryPayment(false) }}
                otherAmount={receiptAmount}
                onOtherAmount={setReceiptAmount}
                method={receiptMethod}
                onMethod={pickMethod}
                reference={receiptRef}
                onReference={setReceiptRef}
                onReferenceCommit={() => { if (receiptRef.trim()) void savePaymentMethod(receiptMethod, receiptRef) }}
                tried={tryPayment}
                loud={step === 'payment'}
                onReceive={() => void handleAddReceipt()}
              />
            )}
            {!isBlock && !localBooking.actual_check_in && (
              <button type="button" onClick={() => void handleCheckIn()} className={step === 'checkIn' ? BTN_GREEN : BTN_QUIET}>
                Check in
              </button>
            )}
            {!isBlock && isIn && (
              <button type="button" onClick={() => void handleCheckOut()} className={step === 'checkOut' && checkOutDue ? BTN_GOLD : BTN_QUIET}>
                Check out
              </button>
            )}
            {!isBlock && due > 0 && step !== 'payment' && !receiveOpen && (
              <button type="button" onClick={() => setReceiveOpen(true)} className={ROW_ACTION + ' text-main hover:text-gold-700'}>
                Receive a payment
              </button>
            )}

            {/* Breakfast is asked every morning (the owner, 2026-10-04): today's answer, or
                that nobody has asked yet. The choices are read from the LIVE booking — they
                are saved by their own writer, not through this panel's copy. */}
            {wantsBreakfastToday(localBooking) && (
              <button
                type="button"
                onClick={() => setBreakfastOpen(true)}
                className="w-full min-h-11 flex items-center justify-between gap-3 border-y border-soft text-[13px] text-left hover:bg-softbg transition-colors cursor-pointer"
              >
                <span className="font-bold text-main shrink-0">Breakfast today</span>
                <span className={breakfastToday ? 'text-muted truncate' : 'font-semibold text-danger-600'}>
                  {breakfastToday ? breakfastSummary(breakfastToday) : 'not asked yet'}
                </span>
              </button>
            )}

            {/* Order slips only exist once the guest is IN the hotel: nobody orders
                before check-in (the owner's rule). Orders are taken on the Restaurant
                screen (k69), so this lists the slips and offers the way over — and a
                guest who has left can no longer be handed a new order. */}
            {!isBlock && localBooking.actual_check_in && (
              <BookingOrderSlips
                slips={slips}
                who={localBooking.guest_name || 'Guest'}
                place={{ label: booking.room_id ? 'Room' : 'Venue', value: unitSub || unitName }}
                onTakeOrders={localBooking.actual_check_out ? undefined : () => { focusGuestTab(booking.id); onClose(); void navigate({ to: '/restaurant' }) }}
              />
            )}

            {!isBlock && receiptRecords.length > 0 && (
              <BookingReceipts
                records={receiptRecords}
                coveredRooms={coveredRooms}
                onRemove={handleRemoveReceipt}
                onPrint={r => { setReceiptFor(r); setShowReceipt(true) }}
              />
            )}

            {!isBlock && (
              <div className="text-[12px] text-muted space-y-1.5">
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
                  {togetherLabel && <span>Booked together <strong className="text-main">{togetherLabel}</strong></span>}
                </p>
              </div>
            )}

            {(extendOpen || datesAlwaysShown) && canExtend && (
              <section>
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
              <section>
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

          {/* Quiet actions — never competing with the next step. */}
          <div className="border-t border-soft py-1 flex flex-wrap items-center gap-x-5">
            {canExtend && !datesAlwaysShown && (
              <button
                type="button"
                onClick={() => { setExtendOpen(o => !o); setMoveOpen(false) }}
                aria-expanded={extendOpen}
                className={ROW_ACTION + ' text-main hover:text-gold-700'}
              >
                <CalendarPlus className="w-4 h-4" />
                {extendLabel}
              </button>
            )}
            {canMove && (
              <button
                type="button"
                onClick={() => { setMoveOpen(o => !o); setExtendOpen(false) }}
                aria-expanded={moveOpen}
                className={ROW_ACTION + ' text-main hover:text-gold-700'}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Change room or dates
              </button>
            )}
            {!isBlock && (
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className={ROW_ACTION + ' text-main hover:text-gold-700'}
              >
                <Printer className="w-4 h-4" />
                Print billing statement
              </button>
            )}
            {!isBlock && localBooking.actual_check_in && (
              <button
                type="button"
                onClick={() => void handleUndo(localBooking.actual_check_out ? 'check_out' : 'check_in')}
                className={ROW_ACTION + ' text-main hover:text-gold-700'}
              >
                <Undo2 className="w-4 h-4" />
                {localBooking.actual_check_out ? 'Undo check-out' : 'Undo check-in'}
              </button>
            )}
            {/* Not offered once the guest is in the hotel or has left: a guest who has used
                the room is checked out, not cancelled, and cancelling a finished stay
                would take its money out of the Earnings Report. */}
            {onCancelBooking && (isBlock || !localBooking.actual_check_in) && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await askConfirm(isBlock ? {
                    title: 'Remove this block?',
                    message: 'The dates open up for booking again.',
                    confirmLabel: 'Remove block',
                    tone: 'danger',
                  } : {
                    title: 'Cancel ' + booking.guest_name + "'s booking?",
                    message: paidSoFar > 0
                      ? 'The room is freed. The booking stays in the Bookings list as Cancelled, with the ' + fmtPeso(paidSoFar) + ' already received and its receipts.'
                      : 'The room is freed. The booking stays in the Bookings list as Cancelled.',
                    confirmLabel: 'Cancel booking',
                    tone: 'danger',
                  })
                  if (!ok) return
                  onCancelBooking(booking.id)
                  onClose()
                }}
                className={ROW_ACTION + ' ml-auto text-danger-600 hover:text-danger-500'}
              >
                {isBlock ? 'Remove block' : 'Cancel booking'}
              </button>
            )}
          </div>
        </div>
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
            if (closeAfterPayment) { setCloseAfterPayment(false); onClose() }
          }}
        />
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}

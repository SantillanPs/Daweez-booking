import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue, PaymentRecord } from '../../types/booking'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig } from '../../utils/rateConfig'
import { X, Printer, Edit3, ChevronDown, Utensils, CalendarPlus } from 'lucide-react'
import { NumInput } from '../NumInput'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { SOURCE_LABELS, roomDisplayName } from './bookingStyles'
import { statusAfterPayment } from '../../utils/bookingStatus'
import { hasOutstandingBalance, amountToPayNow, getPaymentView, paymentStatusWord, isBilledToAgency, PAYMENT_BADGE_CLASSES } from '../../utils/bookingMoney'
import { paymentMethodLabel, methodNeedsReference } from '../../utils/paymentMethod'
import { nextReceiptNumber } from '../../utils/receiptNumber'
import { withoutPayment } from '../walk-in/bookingPayment'
import { GuestTabPanel } from './GuestTabPanel'
import { recomputeBalance, pendingEarlyCharge, extendStay } from '../../utils/bookingBalance'
import { useGuestTab } from '../../hooks/useGuestTab'
import { closeTab, getOpenTabForBooking } from '../../utils/tabs'
import { BookingMoneyPanel } from './BookingMoneyPanel'
import { SettledPaidTag } from './SettledPaidTag'
import { ShortStayClock } from './ShortStayClock'
import { stayHoursOf } from '../../utils/shortStay'
import { BreakfastPicker } from './BreakfastPicker'
import { wantsBreakfastToday, breakfastOn, breakfastSummary } from '../../utils/breakfastChoice'
import { dateToString } from '../../utils/helpers'
import { blockReason, isOpenEnded } from '../../utils/openBlock'
import { groupOf } from '../../utils/bookingGroup'
import { formatRoomNumbers } from '../../utils/roomNumbers'
import { BookingReceipts } from './BookingReceipts'
import { GuestMethodPicker } from './GuestMethodPicker'
import { ExtendStayForm } from './ExtendStayForm'
import { showToast } from '../../utils/toast'
import { askConfirm } from '../../utils/confirm'
import { useNavigate } from '@tanstack/react-router'
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

// What the guest agreed to pay now is shared with the money card
// (`amountToPayNow`), so the figure displayed and the figure pre-filled into the
// payment form can never drift apart.

// The two button weights the panel uses. One loud button for the next step, one quiet
// one for everything else — there used to be three styles for actions of the same weight.
const BTN_LOUD = 'min-h-11 px-4 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[13px] font-bold transition-colors cursor-pointer shadow-sm'
const BTN_QUIET = 'min-h-11 px-4 rounded-lg bg-card hover:bg-gold-100 text-main border border-soft text-[13px] font-bold transition-colors cursor-pointer'
// The bottom row: plain words, finger-sized.
const ROW_ACTION = 'min-h-11 inline-flex items-center gap-1.5 text-[13px] font-semibold transition-colors cursor-pointer'

/**
 * The booking's quick view: who, what, how much, and the single next step.
 *
 * **It shows what this stay needs now, not every feature a booking can have** (the
 * owner's feedback, 2026-10-04: *"it looks so lazy just stacking accordions"*). It used
 * to be a money box followed by closed sections — Payment receipts, Guest tab, Extend
 * stay — that were on screen whether or not they held anything, and that put a second
 * payment form and a second set of dates under the first. Now:
 *
 *   - **money is taken in one place**, the money box — a part-payment is "A different
 *     amount" there, not a second form further down;
 *   - **receipts appear once there is one**, as a plain list;
 *   - **the guest tab appears once the guest is in the hotel**;
 *   - **extending is a quiet action in the bottom row**, beside Print and Cancel, and
 *     opens one date and one button.
 *
 * Nothing smaller than 12px, and nothing to press smaller than a fingertip (44px) — the
 * desk uses a tablet as well as the PC.
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
  // The money block always shows where the money stands AND the one action that
  // writes a payment down (method · reference · `Record ₱X received`); there is no
  // separate opener button in front of it, because the staff take the money first
  // and the press only records it (the owner's correction, k132).
  // `closeAfterPayment` closes this whole slide-over once the receipt for a
  // recorded payment is dismissed — the money is in, the job here is done.
  const [closeAfterPayment, setCloseAfterPayment] = useState(false)
  // "A different amount": a part-payment, where the desk types the figure from
  // scratch. Every other payment takes its amount straight from "Amount to pay".
  const [otherAmountOpen, setOtherAmountOpen] = useState(false)
  const [receiptAmount, setReceiptAmount] = useState(0)
  // Opened from the bottom row; the guest tab's lines are opened from its own heading.
  const [extendOpen, setExtendOpen] = useState(false)
  const [tabOpen, setTabOpen] = useState(false)
  // Nothing is preselected: an empty method stays empty and the picker reads
  // "Choose…", because defaulting to 'Cash' here is what once printed a Cash
  // receipt for a guest who had paid by GCash. The desk picks what they were told.
  const [receiptMethod, setReceiptMethod] = useState(() => booking.payment_method || '')
  // A reference the guest already gave (the portal stores one) starts filled in.
  // …but not one that already sits on a recorded payment: the next payment is a new
  // transfer with a new number, and a pre-filled old one would be saved under it.
  const [receiptRef, setReceiptRef] = useState(() => {
    const known = booking.payment_reference || ''
    return (booking.payment_records || []).some(r => r.reference && r.reference === known) ? '' : known
  })
  const [tryPayment, setTryPayment] = useState(false)
  const [receiptFor, setReceiptFor] = useState<PaymentRecord | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)

  // ── The guest's food and bar tab (k69) ─────────────────────────────────────
  // Read from its own tables and folded into what is owed. The loading, the
  // reload after a change and the balance re-sync all live in the hook.
  const { lines: tabLines, amount: tabAmount, reload: reloadTab, resolveTabId } = useGuestTab({
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
  // so the desk can see what the guest will owe without the badge flipping to Partly
  // paid and without the desk chasing money at the door.
  const earlyHoursRecorded = Number(localBooking.early_check_in_hours || 0)
  const pendingEarly = pendingEarlyCharge(localBooking, { rooms, venues, tabTotal: tabAmount })
  // Every payment the guest has made, each with its own receipt to reprint.
  // This is the one place the money received is itemised (amount, method, when),
  // so the money card above does not repeat it.
  const receiptRecords = localBooking.payment_records || []
  // What the record button will write down: the amount to pay, or the figure the desk
  // typed. The deposit is agreed on the STAY alone, so the food tab is taken out of it.
  const dueNow = amountToPayNow(localBooking, tabAmount)
  const payNow = otherAmountOpen ? receiptAmount : dueNow
  // GCash and bank payments need the reference number; cash does not.
  // The guest's own payment method and reference are the money card's inputs now
  // (see `GuestMethodPicker`): how the guest pays is asked for once.
  const methodNeedsRef = methodNeedsReference(receiptMethod)
  // Missing method / reference are answered inline, under the control that needs
  // filling — never as a popup, and never by quietly writing down "Cash".
  const referenceError = tryPayment && methodNeedsRef && !receiptRef.trim()
    ? 'Enter the ' + paymentMethodLabel(receiptMethod) + ' reference number.' : ''
  const paymentError = tryPayment && !receiptMethod.trim()
    ? 'Choose how the guest paid.' : referenceError
  const amountError = tryPayment && otherAmountOpen && !(receiptAmount > 0) ? 'Enter the amount received.' : ''
  const hasEmail = booking.guest_email && booking.guest_email !== 'admin@daweez-booking.vercel.app'
  // "None" is the placeholder the bookings store writes when no phone was taken.
  const hasPhone = !!booking.guest_phone && booking.guest_phone.trim() !== 'None'
  const hasContact = !!hasPhone || !!hasEmail

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

  // The guest's own payment method (card k132 follow-up). The choice is theirs —
  // the printed bill carries the boxes they tick — and this writes down what the
  // desk was told, so the bill and the receipt can name it. No money moves here,
  // and there is no Save button in the UI: tapping a method saves it, and the
  // reference saves when the box is left. It ALSO feeds the payment being taken:
  // the first payment used to record 'Cash' whatever the guest had chosen, because
  // nothing updated the method the card had been seeded with at open.
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

  // Tapping a method: keep it for the payment about to be taken, and write it down.
  const pickGuestMethod = (m: string) => {
    setReceiptMethod(m)
    void savePaymentMethod(m, receiptRef)
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
    } catch {
      showToast('Could not remove the payment. Please try again.', 'error')
    }
  }

  // Recompute the balance after early/late hours are applied, using the
  // booking's own charges + current rates + the guest's food tab, so the amount
  // owed stays correct. The rule itself lives in utils/bookingBalance.ts.
  const withRecomputedBalance = (base: Booking, patch: Partial<Booking>, tabTotalOverride?: number): Booking =>
    recomputeBalance({ ...base, ...patch }, { rooms, venues, tabTotal: tabTotalOverride ?? tabAmount })

  // Records the arrival time and auto-computes the early hours. `base` is the
  // booking to check in — the live one normally, or the just-paid copy when the
  // check-in follows a payment.
  //
  // The early hours are RECORDED here but deliberately NOT charged here: the balance
  // is left exactly as it was, so checking a fully-paid guest in never flips them back
  // to "partly paid" and never asks the desk for money at the door. The stored hours
  // are picked up by the recompute at check-out, which is where the owner wants the
  // extra night to land ("just add it to their bill for when they checkout").
  const performCheckIn = async (base: Booking) => {
    const actualCheckIn = new Date().toISOString()
    const rates = getRateConfig()
    // A short stay has no early/late hours at all: the room was sold for a few
    // hours at its own board price, so a 10am arrival is not "four hours early".
    const { earlyHours } = base.stay_hours
      ? { earlyHours: 0 }
      : computeCheckInOutHours({
        checkIn: base.check_in, checkOut: base.check_out, actualCheckIn,
        standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
      })
    const updated: Booking = { ...base, actual_check_in: actualCheckIn, early_check_in_hours: earlyHours, status: 'confirmed' }
    setLocalBooking(updated)
    if (earlyHours > 0) {
      const hours = earlyHours + ' hour' + (earlyHours > 1 ? 's' : '')
      const why = earlyHours > rates.lateEarlyCapHours
        ? hours + ' early — past the ' + rates.lateEarlyCapHours + '-hour cap, so a night'
        : hours + ' early'
      showToast('Checked in ' + why + ' goes on the bill at check-out.', 'info')
    }
    try { await onUpdateBooking?.(updated) } catch { showToast('Could not check in. Please try again.', 'error') }
  }

  // Check-in / check-out — records the actual time and auto-computes the early /
  // late hours against the standard 2 PM check-in / 12 PM check-out times.
  const handleCheckIn = async () => {
    // Guard only: the Check in button is not rendered while money is owed, so
    // this is the backstop.
    if (hasOutstandingBalance(localBooking) && !billedToAgency) return
    await performCheckIn(localBooking)
  }
  const handleCheckOut = async () => {
    // Normally nothing is owed by now — the balance was taken at check-in, and
    // check-in refuses to run while money is outstanding. This stays as the
    // backstop for a stay that grew afterwards (extra nights, per-day
    // breakfast), so a guest never leaves with an unpaid bill.
    if (hasOutstandingBalance(localBooking) && !billedToAgency) {
      const owed = fmtPeso(Number(localBooking.balance_due || 0))
      // Said on the page, next to the button that was pressed — and the card
      // opens its payment panel so the money can be taken right there.
      setActionNotice('This guest still owes ' + owed + '. Receive it first, then check them out.')
      return
    }
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
    try {
      await onUpdateBooking?.(updated)
      // The guest has left, so their tab leaves the till. The bill and any reprint
      // still read it — they follow the booking's tab whatever its status.
      const open = await getOpenTabForBooking(updated.id)
      if (open) await closeTab(open.id)
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

  // Record a payment: creates a receipt (date + time) only when the guest pays.
  const handleAddReceipt = async (thenCheckIn = false) => {
    // The amount to pay, or the figure the desk typed under "A different amount".
    const amount = Number(otherAmountOpen ? receiptAmount : amountToPayNow(localBooking, tabAmount)) || 0
    setTryPayment(true)
    // Missing amount / reference are shown inline on the form itself, under the
    // box that needs filling — not as a popup that hides which box it means.
    if (amount <= 0) return
    // The method is the guest's own choice, so it is never assumed: no method,
    // no receipt. Writing down "Cash" by default is what printed the wrong method.
    if (!receiptMethod.trim()) return
    // The reference lives on the money card for GCash / bank, and in the form
    // for the booking deposit — either way it is the same `receiptRef`.
    if (methodNeedsRef && !receiptRef.trim()) return
    const paidSoFar = Number(localBooking.downpayment_paid || 0)
    const totalCharge = paidSoFar + Number(localBooking.balance_due || 0)
    const newPaid = paidSoFar + amount
    const remaining = Math.max(0, totalCharge - newPaid)
    const rec = {
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
    }
    const records = [...(localBooking.payment_records || []), rec]
    const status = remaining <= 0 ? 'paid' as const : localBooking.payment_status === 'paid' ? 'paid' as const : 'downpayment' as const
    const updated = {
      ...localBooking,
      payment_records: records,
      downpayment_paid: newPaid,
      balance_due: remaining,
      payment_status: status,
      status: statusAfterPayment(localBooking.status),
      payment_method: receiptMethod,
      payment_reference: receiptRef.trim() || localBooking.payment_reference,
    }
    setLocalBooking(updated)
    setActionNotice('')
    setReceiptAmount(0); setOtherAmountOpen(false); setTryPayment(false)
    try {
      await onUpdateBooking?.(updated)
      setReceiptFor(rec)
      setShowReceipt(true)
      // Dismissing the receipt closes this whole slide-over **only when the guest has
      // already been checked in** and this was the **first money recorded** (unpaid →
      // partly paid): there the payment was the last errand, and the desk goes back to
      // the calendar instead of staring at a booking they have finished with. Taking the
      // REST of a partly-paid bill never closes it (the desk may still extend the stay,
      // print a statement or settle the tab).
      //
      // The test is **the guest has not arrived yet**, NOT **it is a short stay** — the
      // owner's correction, 2026-09: the rule was written for short stays, whose clock only
      // starts at the Check in press, but an ordinary booking nobody has arrived for is in
      // exactly the same position — the booking is paid, the guest is standing at the desk,
      // and closing the panel took the **Check in** button away with it.
      const notArrivedYet = !localBooking.actual_check_in
      setCloseAfterPayment(paidSoFar <= 0 && !notArrivedYet)
      // Arrival payment (thenCheckIn): now the money is in, finish the check-in
      // in the same action — one button, no second trip. Never on a booking
      // deposit, which is paid long before the guest arrives.
      if (thenCheckIn && remaining <= 0 && !localBooking.actual_check_in) {
        await performCheckIn(updated)
      }
    } catch {
      showToast('Could not record the payment. Please try again.', 'error')
    }
  }

  // The same plain-language status the calendar's payment dot stands for, said
  // in words here so staff never have to decode a colour.
  //
  // **One word, not two.** The header used to carry a booking-status chip beside it
  // (`Confirmed` / `Unpaid`), so a reservation read `CONFIRMED  RESERVED` and an unpaid
  // walk-in `UNPAID  OWES` — two vocabularies for one fact. The money is the status
  // (`docs/why/money.md`), so the money word is the one that stays.
  const payView = getPaymentView(localBooking)
  const statusChip = localBooking.status === 'blocked'
    ? <span className="shrink-0 text-[12px] font-bold text-muted bg-softbg border border-soft rounded-md px-2 py-0.5">Blocked</span>
    : (
      <span className={'shrink-0 text-[12px] font-bold rounded-md px-2 py-0.5 ' + PAYMENT_BADGE_CLASSES[payView.tone]}>
        {paymentStatusWord(localBooking)}
      </span>
    )

  const isShortStay = stayHoursOf(localBooking) > 0
  const becomesNights = isShortStay && extendCheckoutDate && extendCheckoutDate > booking.check_in
    ? Math.max(1, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(booking.check_in).getTime()) / 86400000))
    : 0
  const extraNights = !isShortStay && localBooking.status !== 'blocked' && extendCheckoutDate && extendCheckoutDate > booking.check_out
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
  const isBlock = localBooking.status === 'blocked'
  const openEnded = isOpenEnded(localBooking)
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
  const todayKey = dateToString(new Date())
  const breakfastToday = breakfastOn(booking, todayKey)
  // Billed to an agency: the agency pays later by check or bank, so the door is not
  // held shut on the money (the owner, 2026-10-04).
  const billedToAgency = isBilledToAgency(localBooking)
  const canCheckIn = localBooking.status !== 'blocked' && !localBooking.actual_check_in
  const canCheckOut = localBooking.status !== 'blocked' && !!localBooking.actual_check_in && !localBooking.actual_check_out

  // The title names the place and the person: `Room 7 · Noel Bautista`. The unit still
  // leads — it is what staff clicked — but as the number they say out loud, with the
  // room's type under it. It used to be the type alone (`Bunk Bed 3`) above a second,
  // larger title carrying the guest's name.
  const place = booking.room_id ? (room ? 'Room ' + room.room_number : 'Room') : (venue?.name || 'Event Venue')
  const who = isBlock ? blockReason(localBooking) : booking.guest_name
  const roomType = booking.room_id && room?.name ? room.name : ''
  const stayLine = isBlock
    ? (openEnded ? 'From ' + fmtShort(booking.check_in) + ' · until further notice' : fmtShort(booking.check_in) + ' → ' + fmtShort(booking.check_out))
    : stayHoursOf(booking) > 0
      ? fmtShort(booking.check_in) + ' · ' + stayHoursOf(booking) + '-hour stay'
      : fmtShort(booking.check_in) + ' → ' + fmtShort(booking.check_out) + ' · ' + nights + (nights === 1 ? ' night' : ' nights')
  const extendLabel = isBlock ? 'Change the dates' : isShortStay ? 'Stay longer' : 'Extend stay'
  // A stay that has ended has nothing left to extend; its dates are corrected with the pencil.
  const canExtend = !localBooking.actual_check_out
  // A block's dates are all it has, so they are simply on screen — no button to open
  // them. The exception is a block with no end date yet, whose one job is "They have left".
  const datesAlwaysShown = isBlock && !openEnded

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      {/* The panel is as wide as its contents, not a fixed number (the owner: *"don't
          make the width fixed of the entire fucking quick review"*). A fixed max-width
          meant every short row ended in dead space to the right. `w-fit` lets the widest
          row set the width and the short rows fill it, and the cap only stops a long guest
          name or email from stretching the panel across the screen. */}
      <div className="w-fit max-w-[min(92vw,34rem)] bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[88vh]">

        <div className="flex items-start justify-between gap-2 pl-5 pr-1.5 py-1.5 border-b border-soft shrink-0">
          {/* Nothing here is cut short: on a phone a long name wraps and the status word
              drops under it, rather than the guest reading `Angela…`. */}
          <div className="min-w-0 py-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h3 className="font-display font-bold text-[17px] leading-tight text-main break-words min-w-0">{place} · {who}</h3>
              {statusChip}
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
          {/* ONE COLUMN (the owner's correction), top to bottom in the order the desk
              needs it: who, the money or `Fully paid ✓`, then only what this stay has
              reached — its receipts, its tab — and the quiet actions last. */}
          <div className="py-3.5 space-y-3 empty:hidden">
            {!isBlock && (
              <div className="text-[12px] text-muted space-y-1.5">
                {/* The store writes the literal "None" when no phone was taken, so
                    treat that (and a missing email) as nothing and skip the line
                    rather than printing a row that says nothing. */}
                {hasContact && (
                  <p className="break-words">
                    {hasPhone && <span>{booking.guest_phone}</span>}
                    {hasPhone && hasEmail && <span> · </span>}
                    {hasEmail && <span>{booking.guest_email}</span>}
                  </p>
                )}
                {booking.companions && booking.companions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {booking.companions.map((comp, idx) => (
                      <span key={idx} className="text-main bg-page border border-soft rounded-md px-2 py-0.5">
                        {comp.name}{comp.nationality ? <span className="text-muted capitalize"> ({comp.nationality})</span> : null}
                      </span>
                    ))}
                  </div>
                )}
                <p className="flex flex-wrap gap-x-4 gap-y-0.5">
                  <span>Booked from <strong className="text-main">{SOURCE_LABELS[booking.source] || booking.source}</strong></span>
                  {booking.reference_number && <span>Paper ref <strong className="text-main">{booking.reference_number}</strong></span>}
                  {booking.registered_on && <span>Logged <strong className="text-main">{booking.registered_on}</strong></span>}
                  {booking.vehicle_plate && <span>Plate <strong className="text-main uppercase">{booking.vehicle_plate}</strong></span>}
                  {booking.company_name && <span>Company <strong className="text-main">{booking.company_name}</strong></span>}
                  {togetherLabel && <span>Booked together <strong className="text-main">{togetherLabel}</strong></span>}
                </p>
              </div>
            )}

            {/* SETTLED: no money block at all — one line and the next step. */}
            {totalCharge > 0 && due <= 0 && (
              <SettledPaidTag
                paid={paidSoFar}
                action={canCheckIn ? (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    className="shrink-0 min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold transition-colors cursor-pointer shadow-sm"
                  >
                    Check in
                  </button>
                ) : canCheckOut ? (
                  <button type="button" onClick={handleCheckOut} className={BTN_LOUD + ' shrink-0'}>
                    Check out
                  </button>
                ) : undefined}
              />
            )}

            {/* The short-stay clock: the time the room is free, and a red word once it
                has passed. Nothing renders for an ordinary stay. */}
            <ShortStayClock booking={localBooking} due={shortStayDue} />

            {/* A block with no end date has one job left: being ended. */}
            {openEnded && (
              <button type="button" onClick={() => void endOpenBlock()} className={BTN_LOUD + ' w-full'}>
                They have left
              </button>
            )}

            {/* Breakfast is asked every morning (the owner, 2026-10-04): today's answer, or
                that nobody has asked yet. The choices are read from the LIVE booking — they
                are saved by their own writer, not through this panel's copy. */}
            {wantsBreakfastToday(localBooking) && (
              <button
                type="button"
                onClick={() => setBreakfastOpen(true)}
                className="w-full min-h-11 flex items-center justify-between gap-3 rounded-lg border border-soft bg-page hover:border-gold-400 px-3 text-[13px] text-left transition-colors cursor-pointer"
              >
                <span className="font-bold text-main shrink-0">Breakfast today</span>
                <span className={breakfastToday ? 'text-muted truncate' : 'font-semibold text-danger-600'}>
                  {breakfastToday ? breakfastSummary(breakfastToday) : 'not asked yet'}
                </span>
              </button>
            )}

            {/* Recorded early check-in, not billed yet: one amber line saying what the
                guest will owe and when it lands, so the money never moves in silence and
                the desk can quote it — without the badge flipping to Partly paid and
                without asking for it at the door (the owner's rule). */}
            {pendingEarly > 0 && (
              <p className="rounded-lg border border-gold-200 bg-gold-100/50 px-3 py-2 text-[12px] font-semibold text-brand-text leading-snug">
                Early check-in {earlyHoursRecorded} hour{earlyHoursRecorded > 1 ? 's' : ''}
                {earlyHoursRecorded > getRateConfig().lateEarlyCapHours ? ' (past the ' + getRateConfig().lateEarlyCapHours + '-hour cap)' : ''}
                {' — '}{fmtPeso(pendingEarly)} goes on the bill at check-out.
              </p>
            )}

            {/* Why the action just pressed did not go through — on the page, beside
                the action, where it can be read while acting. */}
            {actionNotice && (
              <p className="text-[12px] font-semibold text-danger-600 leading-snug">{actionNotice}</p>
            )}

            {/* THE MONEY, while something is still owed — and the ONE place it is taken.
                The receive step's controls are on screen with it, no opener button in
                front of them (the owner's correction: the money is taken by the desk
                BEFORE anything is pressed, so the press is only the writing-down). One
                thing per line, so nothing wraps on a narrow screen: the method, the
                reference under it, then one full-width button. Check in / Check out are
                not here — a settled booking carries them in its own strip above. */}
            {totalCharge > 0 && due > 0 && (
              <div className="space-y-2.5">
                <BookingMoneyPanel localBooking={localBooking} tabTotal={tabAmount} />

                {billedToAgency && (canCheckIn || canCheckOut) && (
                  <button
                    type="button"
                    onClick={canCheckIn ? handleCheckIn : handleCheckOut}
                    className={canCheckIn
                      ? 'w-full min-h-11 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[13px] font-bold transition-colors cursor-pointer shadow-sm'
                      : BTN_LOUD + ' w-full'}
                  >
                    {canCheckIn ? 'Check in' : 'Check out'}
                  </button>
                )}
                <GuestMethodPicker
                  method={receiptMethod}
                  reference={receiptRef}
                  error={paymentError}
                  onPick={pickGuestMethod}
                  onReference={setReceiptRef}
                  onReferenceCommit={() => { if (receiptRef.trim()) void savePaymentMethod(receiptMethod, receiptRef) }}
                />
                {/* A part-payment: the desk types what was actually handed over. This
                    replaced the second payment form that used to sit under Payment
                    receipts, a few lines below this button. */}
                {otherAmountOpen && (
                  <label className="block">
                    <span className="block text-[12px] font-semibold text-muted">Amount received (₱)</span>
                    <NumInput value={receiptAmount} onChange={setReceiptAmount} aria-label="Amount received"
                      className={'mt-1 w-full h-11 bg-card border text-main px-3 rounded-lg text-[13px] focus:outline-none ' +
                        (amountError ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')} />
                  </label>
                )}
                {amountError && <p className="text-[12px] font-semibold text-danger-600">{amountError}</p>}
                <button
                  type="button"
                  onClick={() => handleAddReceipt()}
                  className={(billedToAgency ? BTN_QUIET : BTN_LOUD) + ' w-full'}
                >
                  {payNow > 0 ? 'Record ' + fmtPeso(payNow) + ' received' : 'Record the payment'}
                </button>
                <button
                  type="button"
                  onClick={() => { setOtherAmountOpen(o => !o); setReceiptAmount(0); setTryPayment(false) }}
                  className="w-full min-h-11 -mt-1.5 text-[13px] font-semibold text-muted hover:text-main transition-colors cursor-pointer"
                >
                  {otherAmountOpen ? 'Back to ' + fmtPeso(dueNow) : 'A different amount'}
                </button>
              </div>
            )}

            {!isBlock && receiptRecords.length > 0 && (
              <BookingReceipts
                records={receiptRecords}
                coveredRooms={coveredRooms}
                onRemove={handleRemoveReceipt}
                onPrint={r => { setReceiptFor(r); setShowReceipt(true) }}
              />
            )}

            {/* The guest tab only exists once the guest is IN the hotel: nobody
                orders before check-in (the owner's rule), so it is absent rather than
                shown locked. The till lives in the Restaurant screen (k69), so this
                shows the food and offers the way over — and a guest who has left can
                no longer be handed a new order. */}
            {localBooking.actual_check_in && (
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="text-[13px] font-bold text-main">Guest tab</h4>
                    <p className="text-[12px] text-muted truncate">
                      {tabLines.length > 0
                        ? tabLines.length + ' line' + (tabLines.length > 1 ? 's' : '') + ' · ' + fmtPeso(tabAmount)
                        : 'Nothing on the tab'}
                    </p>
                  </div>
                  {!localBooking.actual_check_out && (
                    <button
                      type="button"
                      onClick={() => { focusGuestTab(booking.id); onClose(); void navigate({ to: '/restaurant' }) }}
                      className={BTN_QUIET + ' shrink-0 inline-flex items-center gap-1.5'}
                    >
                      <Utensils className="w-4 h-4" /> Take orders
                    </button>
                  )}
                </div>
                {tabLines.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTabOpen(o => !o)}
                    aria-expanded={tabOpen}
                    className={ROW_ACTION + ' text-muted hover:text-main'}
                  >
                    {tabOpen ? 'Hide the orders' : 'Show the orders'}
                    <ChevronDown className={'w-4 h-4 transition-transform ' + (tabOpen ? 'rotate-180' : '')} />
                  </button>
                )}
                {tabOpen && tabLines.length > 0 && (
                  <GuestTabPanel
                    resolveTabId={resolveTabId}
                    lines={tabLines}
                    tabTotal={tabAmount}
                    onChanged={reloadTab}
                    locked={false}
                    slip={{
                      who: localBooking.guest_name || 'Guest',
                      place: { label: booking.room_id ? 'Room' : 'Venue', value: unitSub || unitName },
                      note: booking.room_id ? 'Settles with the room bill at check-out.' : 'Settles with the bill at check-out.',
                    }}
                    ordering={false}
                  />
                )}
              </section>
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
          </div>

          {/* Quiet actions — never competing with the next step. Extending lives here
              (it used to be a section of its own): pressing it opens its one date just
              above this row. */}
          <div className="border-t border-soft py-1 flex flex-wrap items-center gap-x-5">
            {canExtend && !datesAlwaysShown && (
              <button
                type="button"
                onClick={() => setExtendOpen(o => !o)}
                aria-expanded={extendOpen}
                className={ROW_ACTION + ' text-main hover:text-gold-700'}
              >
                <CalendarPlus className="w-4 h-4" />
                {extendLabel}
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
            {/* Not offered once the guest has checked out: cancelling a finished stay
                would take its money out of the Earnings Report. */}
            {onCancelBooking && !localBooking.actual_check_out && (
              <button
                type="button"
                onClick={async () => {
                  // A guest who is in the hotel is checked out, not cancelled — they
                  // have used the room and may have food on their tab.
                  if (!isBlock && localBooking.actual_check_in && !localBooking.actual_check_out) {
                    setActionNotice('This guest is checked in. Check them out instead of cancelling.')
                    return
                  }
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
             it closes the whole quick view, so the desk is back at the calendar
             instead of holding a booking they have finished with. */
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
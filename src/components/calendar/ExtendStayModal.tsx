import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue, PaymentRecord } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig } from '../../utils/rateConfig'
import { X, Printer, Edit3 } from 'lucide-react'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { SOURCE_LABELS, roomDisplayName } from './bookingStyles'
import { statusAfterPayment } from '../../utils/bookingStatus'
import { hasOutstandingBalance, amountToPayNow, getPaymentView, paymentStatusWord, PAYMENT_BADGE_CLASSES } from '../../utils/bookingMoney'
import { paymentMethodLabel, methodNeedsReference } from '../../utils/paymentMethod'
import { nextReceiptNumber } from '../../utils/receiptNumber'
import { SlideOverSection } from './SlideOverSection'
import { GuestTabPanel } from './GuestTabPanel'
import { recomputeBalance, pendingEarlyCharge } from '../../utils/bookingBalance'
import { useGuestTab } from '../../hooks/useGuestTab'
import { BookingMoneyPanel } from './BookingMoneyPanel'
import { SettledPaidTag } from './SettledPaidTag'
import { ShortStayClock } from './ShortStayClock'
import { stayHoursOf } from '../../utils/shortStay'
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
  extendCheckoutDate: string
  extendError: string
  onClose: () => void
  onExtendStaySubmit: (e: React.FormEvent) => void
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

// Reservation details slide-over: who, what, how much, and the single next step.
// Layout is a folio, not a stack of cards — one focal money card, everything else
// separated by hairlines and collapsed until needed.
export function ExtendStayModal({
  booking,
  rooms,
  venues,
  bookings,
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
  const [addReceiptOpen, setAddReceiptOpen] = useState(false)
  // Only used by the Payment receipts block for an in-stay charge or a
  // part-payment, where the staff member types the amount from scratch. Every
  // other payment takes its amount straight from the card's "Amount to pay".
  const [receiptAmount, setReceiptAmount] = useState(() => amountToPayNow(booking))
  // Nothing is preselected: an empty method stays empty and the picker reads
  // "Choose…", because defaulting to 'Cash' here is what once printed a Cash
  // receipt for a guest who had paid by GCash. The desk picks what they were told.
  const [receiptMethod, setReceiptMethod] = useState(() => booking.payment_method || '')
  // A reference the guest already gave (the portal stores one) starts filled in.
  const [receiptRef, setReceiptRef] = useState(() => booking.payment_reference || '')
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

  // The deposit is agreed on the STAY alone, so the food tab is taken out of it.
  // The "record a payment" box in Payment receipts is filled from that figure when
  // it is opened (see its `setOpen` below) rather than from an effect — the tab
  // arrives a moment after the first render, and an effect writing state on every
  // tab change was both a lint error and a re-render.

  const room = booking.room_id ? rooms.find(r => r.id === booking.room_id) : undefined
  const venue = booking.venue_id ? venues.find(v => v.id === booking.venue_id) : undefined
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
  const receiptTotal = receiptRecords.reduce((a, r) => a + (r.amount || 0), 0)
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
  // The position in one line, said while the Payment accordion is shut — the same
  // fact the header chip carries, in words, with the numbers.
  const paymentSummary = (() => {
    const paidNow = Number(localBooking.downpayment_paid || 0)
    const owedNow = Number(localBooking.balance_due || 0)
    if (owedNow <= 0) return 'Fully paid · ' + fmtPeso(paidNow) + ' received'
    if (paidNow > 0) return 'Partly paid · ' + fmtPeso(paidNow) + ' of ' + fmtPeso(paidNow + owedNow) + ' received'
    return 'Nothing received yet · ' + fmtPeso(owedNow) + ' owed'
  })()
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
    onExtendStaySubmit(e)
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
    const ok = await askConfirm({
      title: 'Remove this ' + fmtPeso(rec.amount) + ' payment?',
      message: 'The amount to pay goes back up and the receipt is withdrawn.',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    const records = (localBooking.payment_records || []).filter(r => r.id !== rec.id)
    const newPaid = records.reduce((a, r) => a + (r.amount || 0), 0)
    const remaining = Math.max(0, totalCharge - newPaid)
    const updated: Booking = {
      ...localBooking,
      payment_records: records,
      downpayment_paid: newPaid,
      balance_due: remaining,
      payment_status: remaining <= 0 ? 'paid' : newPaid > 0 ? 'downpayment' : 'unpaid',
    }
    setLocalBooking(updated)
    try {
      await onUpdateBooking?.(updated)
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
    if (hasOutstandingBalance(localBooking)) return
    await performCheckIn(localBooking)
  }
  const handleCheckOut = async () => {
    // Normally nothing is owed by now — the balance was taken at check-in, and
    // check-in refuses to run while money is outstanding. This stays as the
    // backstop for a stay that grew afterwards (extra nights, per-day
    // breakfast), so a guest never leaves with an unpaid bill.
    if (hasOutstandingBalance(localBooking)) {
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
    try { await onUpdateBooking?.(updated) } catch { showToast('Could not check out. Please try again.', 'error') }
    // The bill is recomputed at check-out, and this is where the money a stay grew by
    // actually lands — a late check-out's hours AND the early check-in hours recorded
    // on arrival (the owner's rule: early check-in goes on the bill at check-out, never
    // in the desk's face at the door). That money must be settled before the guest
    // leaves, and the notice names what grew rather than blaming it all on lateness.
    if (hasOutstandingBalance(updated)) {
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
  const handleAddReceipt = async (amountOverride?: number, thenCheckIn = false) => {
    // Only a real number counts as an override. A DOM event must never be read
    // as one: `Number(event)` is NaN, which silently zeroed the amount the form
    // was already showing and blocked the save.
    const amount = Number(typeof amountOverride === 'number' ? amountOverride : receiptAmount) || 0
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
      // payment is later removed.
      receipt_number: nextReceiptNumber(localBooking),
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
    setReceiptAmount(0); setAddReceiptOpen(false); setTryPayment(false)
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
  const payView = getPaymentView(localBooking)
  const paymentChip = localBooking.status === 'blocked' ? null : (
    <span className={'shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-md px-2 py-0.5 ' + PAYMENT_BADGE_CLASSES[payView.tone]}>
      {paymentStatusWord(localBooking)}
    </span>
  )

  const statusBadge = localBooking.status === 'confirmed'
    ? <span className="shrink-0 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">Confirmed</span>
    : localBooking.status === 'pending'
      ? <span className="shrink-0 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">Unpaid</span>
      : <span className="shrink-0 text-[10px] font-bold uppercase text-muted bg-softbg border border-soft rounded-md px-2 py-0.5">Blocked</span>

  const extraNights = extendCheckoutDate && extendCheckoutDate > booking.check_out
    ? Math.max(0, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(booking.check_out).getTime()) / 86400000))
    : 0
  const newBalanceDue = (() => {
    if (!extendCheckoutDate || extendCheckoutDate <= booking.check_out) return due
    try {
      return syncEngine.calculatePricing({
        roomId: booking.room_id,
        venueId: booking.venue_id,
        checkIn: booking.check_in,
        checkOut: extendCheckoutDate,
        guestEmail: booking.guest_email,
        breakfastOrders: booking.breakfast_orders,
        companions: booking.companions,
        bookingsList: bookings,
        rooms,
        venues
      }).balanceDue + tabAmount
    } catch {
      return due
    }
  })()

  const canCheckIn = localBooking.status !== 'blocked' && !localBooking.actual_check_in
  const canCheckOut = localBooking.status !== 'blocked' && !!localBooking.actual_check_in && !localBooking.actual_check_out

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      {/* The panel is as wide as its contents, not a fixed number (the owner: *"don't
          make the width fixed of the entire fucking quick review"*). A fixed max-width
          meant every short row — `EXTEND STAY  Check-out Sep 22`, the guest row — ended
          in dead space to the right. `w-fit` lets the widest row set the width and the
          short rows fill it, and the cap only stops a long guest name or email from
          stretching the panel across the screen. */}
      <div className="w-fit max-w-[min(92vw,34rem)] bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header — the unit is what staff clicked, so it leads. */}
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-soft shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-main truncate">{unitName}</h3>
              {statusBadge}
              {paymentChip}
            </div>
            <p className="text-[11px] text-muted mt-1 truncate">
              {unitSub ? unitSub + ' · ' : ''}{stayHoursOf(booking) > 0
                ? fmtShort(booking.check_in) + ' · ' + stayHoursOf(booking) + '-hour stay'
                : fmtShort(booking.check_in) + ' → ' + fmtShort(booking.check_out) + ' · ' + nights + (nights === 1 ? ' night' : ' nights')}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 pt-0.5">
            {onEditBooking && (
              <button onClick={onEditBooking} className="text-muted hover:text-gold-700 transition-colors cursor-pointer" title="Edit booking">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-main transition-colors cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 overflow-y-auto flex-1">
          {/* ONE COLUMN (the owner's correction): guest, then the money while it is
              still owed, then the collapsed blocks. There is no side-by-side any
              more — the money column made the panel wide and left the left column
              half empty.

              A SETTLED booking has no money block at all: `Fully paid ✓` and the next
              step sit beside the guest's name, because a paid booking has nothing
              left to explain. */}
          {/* Who is staying — with the settled money and its action on the right */}
          <div className="pt-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
            <p className="font-display font-bold text-[19px] text-main leading-tight">{booking.guest_name}</p>
            {/* The store writes the literal "None" when no phone was taken, so
                treat that (and a missing email) as nothing and skip the line
                rather than printing a row that says nothing. */}
            {hasContact && (
              <p className="text-[12px] text-muted mt-1 break-words">
                {hasPhone && <span>{booking.guest_phone}</span>}
                {hasPhone && hasEmail && <span className="text-muted"> · </span>}
                {hasEmail && <span className="text-muted">{booking.guest_email}</span>}
              </p>
            )}
            {booking.companions && booking.companions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2.5">
                {booking.companions.map((comp, idx) => (
                  <span key={idx} className="text-[11px] bg-page border border-soft rounded-md px-2 py-0.5">
                    {comp.name}{comp.nationality ? <span className="text-muted capitalize"> ({comp.nationality})</span> : null}
                  </span>
                ))}
              </div>
            )}
            <p className="text-[11px] text-muted mt-2.5 flex flex-wrap gap-x-4 gap-y-0.5">
              <span>Booked from <strong className="text-main">{SOURCE_LABELS[booking.source] || booking.source}</strong></span>
              {booking.reference_number && <span>Paper ref <strong className="text-main">{booking.reference_number}</strong></span>}
              {booking.registered_on && <span>Logged <strong className="text-main">{booking.registered_on}</strong></span>}
              {booking.vehicle_plate && <span>Plate <strong className="text-main uppercase">{booking.vehicle_plate}</strong></span>}
              {booking.company_name && <span>Company <strong className="text-main">{booking.company_name}</strong></span>}
            </p>
            </div>
            {totalCharge > 0 && due <= 0 && (
              <SettledPaidTag
                paid={paidSoFar}
                action={canCheckIn ? (
                  <button
                    type="button"
                    onClick={handleCheckIn}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11.5px] font-bold rounded-md px-2.5 py-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    Check in
                  </button>
                ) : canCheckOut ? (
                  <button
                    type="button"
                    onClick={handleCheckOut}
                    className="bg-gold-400 hover:bg-gold-600 text-ink-900 text-[11.5px] font-bold rounded-md px-2.5 py-1.5 transition-colors cursor-pointer shadow-sm"
                  >
                    Check out
                  </button>
                ) : undefined}
              />
            )}
          </div>

          {/* The short-stay clock: the time the room is free, and a red word once it
              has passed. Nothing renders for an ordinary stay. */}
          <div className="mt-2"><ShortStayClock booking={localBooking} due={shortStayDue} /></div>

          {/* Recorded early check-in, not billed yet: one amber line saying what the
              guest will owe and when it lands, so the money never moves in silence and
              the desk can quote it — without the badge flipping to Partly paid and
              without asking for it at the door (the owner's rule). */}
          {pendingEarly > 0 && (
            <p className="mt-2 rounded-md border border-gold-200 bg-gold-100/50 px-2.5 py-1.5 text-[11px] font-semibold text-brand-text leading-snug">
              Early check-in {earlyHoursRecorded} hour{earlyHoursRecorded > 1 ? 's' : ''}
              {earlyHoursRecorded > getRateConfig().lateEarlyCapHours ? ' (past the ' + getRateConfig().lateEarlyCapHours + '-hour cap)' : ''}
              {' — '}{fmtPeso(pendingEarly)} goes on the bill at check-out.
            </p>
          )}

          {/* Why the action just pressed did not go through — on the page, beside
              the action, where it can be read while acting. */}
          {actionNotice && (
            <p className="text-[11px] font-semibold text-danger-600 leading-snug mt-2">{actionNotice}</p>
          )}

          {/* The money, while something is still owed: the compact panel (four rows
              and the bar) with the receive step under it. A settled booking never
              reaches here — its single line lives beside the guest's name. */}
          {totalCharge > 0 && due > 0 && (
            <div className="mt-3">
              <SlideOverSection title="Payment" summary={paymentSummary} hideSummaryWhenOpen forceOpenOnDesktop>
                <div className="space-y-2.5">
                  <BookingMoneyPanel
                    localBooking={localBooking}
                    tabTotal={tabAmount}
                  />

                  {/* While money is owed, the receive step is the block's one action.
                      Its controls are on screen as soon as the block is open — no
                      opener button in front of them (the owner's correction: the
                      drawing he approved showed them together, and the money is taken
                      by the desk BEFORE anything is pressed, so the press is only the
                      writing-down). One thing per line, so nothing wraps on a narrow
                      screen: the method list, the reference under it, then one
                      full-width button. Check in / Check out are not here — a settled
                      booking carries them beside the guest's name. */}
                  <div className="space-y-2">
                    <GuestMethodPicker
                      method={receiptMethod}
                      reference={receiptRef}
                      error={paymentError}
                      onPick={pickGuestMethod}
                      onReference={setReceiptRef}
                      onReferenceCommit={() => { if (receiptRef.trim()) void savePaymentMethod(receiptMethod, receiptRef) }}
                    />
                    <button
                      type="button"
                      onClick={() => handleAddReceipt(amountToPayNow(localBooking, tabAmount))}
                      className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-[13px] font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm"
                    >
                      Record {fmtPeso(due)} received
                    </button>
                  </div>
                </div>
              </SlideOverSection>
            </div>
          )}

          <div className="mt-3">
            <SlideOverSection
              title="Payment receipts"
              summary={receiptRecords.length > 0
                ? receiptRecords.length + ' payment' + (receiptRecords.length > 1 ? 's' : '') + ' · ' + fmtPeso(receiptTotal) + ' received'
                : 'None yet'}
              defaultOpen={addReceiptOpen}
            >
              <BookingReceipts
                records={receiptRecords}
                showAdd={due > 0}
                open={addReceiptOpen}
                setOpen={o => {
                  setAddReceiptOpen(o)
                  // Opening the box fills it with what is actually due — the agreed
                  // deposit while nothing is paid, the rest afterwards, with the
                  // guest's food tab taken back out of it.
                  if (o) setReceiptAmount(amountToPayNow(localBooking, tabAmount))
                }}
                amount={receiptAmount}
                setAmount={setReceiptAmount}
                method={receiptMethod}
                setMethod={setReceiptMethod}
                reference={receiptRef}
                setReference={setReceiptRef}
                referenceRequired={methodNeedsRef}
                referenceError={referenceError}
                onAdd={handleAddReceipt}
                onRemove={handleRemoveReceipt}
                onPrint={r => { setReceiptFor(r); setShowReceipt(true) }}
              />
            </SlideOverSection>

            {/* The guest tab only exists once the guest is IN the hotel: nobody
                orders before check-in (the owner's rule), so the block is hidden
                rather than shown locked. */}
            {localBooking.actual_check_in && (
              <SlideOverSection
                title="Guest tab"
                summary={tabLines.length > 0
                  ? tabLines.length + ' line' + (tabLines.length > 1 ? 's' : '') + ' · ' + fmtPeso(tabAmount)
                  : 'Nothing on the tab'}
              >
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
                /* The till lives in the Restaurant screen (k69): this panel shows the
                   food and offers the way over, instead of squeezing a menu in here. */
                ordering={false}
                onOpenTill={() => { focusGuestTab(booking.id); onClose(); void navigate({ to: '/restaurant' }) }}
              />
              </SlideOverSection>
            )}



            <SlideOverSection title="Extend stay" summary={'Check-out ' + fmtShort(booking.check_out)}>
              <ExtendStayForm
                booking={booking}
                extendCheckoutDate={extendCheckoutDate}
                setExtendCheckoutDate={setExtendCheckoutDate}
                extendError={extendError}
                extraNights={extraNights}
                newBalanceDue={newBalanceDue}
                showErr={showErr}
                isInvalid={isInvalid}
                markTouched={markTouched}
                onSubmit={handleExtendSubmit}
              />
            </SlideOverSection>
          </div>

          {/* Quiet utility actions — never competing with the next step */}
          <div className="border-t border-soft py-3 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowPrintModal(true)}
              className="text-[12px] font-semibold text-main hover:text-gold-700 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              Print billing statement
            </button>
            {onCancelBooking && (
              <button
                type="button"
                onClick={async () => {
                  const ok = await askConfirm({
                    title: 'Cancel ' + booking.guest_name + "'s booking?",
                    message: 'The room is freed and this cannot be undone.',
                    confirmLabel: 'Cancel booking',
                    tone: 'danger',
                  })
                  if (!ok) return
                  onCancelBooking(booking.id)
                  onClose()
                }}
                className="text-[12px] font-semibold text-danger-600 hover:text-danger-500 transition-colors cursor-pointer"
              >
                Cancel booking
              </button>
            )}
          </div>
        </div>
      </div>

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
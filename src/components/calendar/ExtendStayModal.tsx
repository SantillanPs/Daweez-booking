import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue, PaymentRecord } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig } from '../../utils/rateConfig'
import { dateToString } from '../../utils/helpers'
import { X, Printer, Edit3 } from 'lucide-react'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { SOURCE_LABELS, roomDisplayName } from './bookingStyles'
import { statusAfterPayment } from '../../utils/bookingStatus'
import { hasOutstandingBalance, amountToPayNow, hasPaymentRecorded, getPaymentView, paymentStatusWord, PAYMENT_BADGE_CLASSES } from '../../utils/bookingMoney'
import { paymentMethodLabel, methodNeedsReference } from '../../utils/paymentMethod'
import { nextReceiptNumber } from '../../utils/receiptNumber'
import { SlideOverSection } from './SlideOverSection'
import { GuestTabPanel } from './GuestTabPanel'
import { recomputeBalance } from '../../utils/bookingBalance'
import { useGuestTab } from '../../hooks/useGuestTab'
import { BookingMoneyPanel } from './BookingMoneyPanel'
import { BookingReceipts } from './BookingReceipts'
import { ReceivePaymentStep } from './ReceivePaymentStep'
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
}

const fmtShort = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
const fmtPeso = (n: number) => '₱' + n.toLocaleString()

// How the guest said they would pay, matched to the form's own option labels.
function agreedMethod(b: Booking): string {
  return paymentMethodLabel(b.payment_method)
}

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
  onEditBooking
}: ExtendStayModalProps) {
  const [showPrintModal, setShowPrintModal] = useState(false)
  const navigate = useNavigate()
  const [localBooking, setLocalBooking] = useState(booking)
  const [payFlash, setPayFlash] = useState(false)
  // Something the pressed action could not do, said on the page beside the
  // button (e.g. checking out while money is still owed). Replaced every popup.
  const [actionNotice, setActionNotice] = useState('')
  // Taking money is a DECISION, not a default: a deposit booking sits quietly as
  // "partly paid" until the staff press Receive money / Check in, and only then
  // does the card open up and ask for the method, the reference and the amount.
  const [takingPayment, setTakingPayment] = useState(false)
  const [addReceiptOpen, setAddReceiptOpen] = useState(false)
  // Only used by the Payment receipts block for an in-stay charge or a
  // part-payment, where the staff member types the amount from scratch. Every
  // other payment takes its amount straight from the card's "Amount to pay".
  const [receiptAmount, setReceiptAmount] = useState(() => amountToPayNow(booking))
  const [receiptMethod, setReceiptMethod] = useState(() => agreedMethod(booking))
  const [receiptRef, setReceiptRef] = useState('')
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
  // The tab arrives a moment after the first render, so the pre-filled amount has
  // to be worked out again once it is known — otherwise a deposit booking with a
  // lunch on it would ask at the desk for half the food as well.
  useEffect(() => {
    if (!hasPaymentRecorded(localBooking)) setReceiptAmount(amountToPayNow(localBooking, tabAmount))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabAmount])

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
  // Every payment the guest has made, each with its own receipt to reprint.
  // This is the one place the money received is itemised (amount, method, when),
  // so the money card above does not repeat it.
  const receiptRecords = localBooking.payment_records || []
  // The guest agreed to a 50% deposit or the full amount when they booked.
  const plan = booking.payment_plan === 'full' ? 'full' : booking.payment_plan === 'deposit' ? 'deposit' : ''
  // GCash and bank payments need the reference number; cash does not.
  const methodNeedsRef = methodNeedsReference(receiptMethod)
  // The card only OPENS by itself while nothing has been recorded: right after a
  // booking the payment is expected, so the panel is shown with the amount, the
  // agreed method and — for GCash/bank — the reference. Every later payment is
  // taken through the guided step below, when the staff start it.
  const nothingRecordedYet = !hasPaymentRecorded(localBooking)
  const showPaymentForm = due > 0 && nothingRecordedYet
  const paymentOpen = due > 0 && nothingRecordedYet
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
  const performCheckIn = async (base: Booking) => {
    const actualCheckIn = new Date().toISOString()
    const rates = getRateConfig()
    const { earlyHours } = computeCheckInOutHours({
      checkIn: base.check_in, checkOut: base.check_out, actualCheckIn,
      standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
    })
    const updated = withRecomputedBalance(base, { actual_check_in: actualCheckIn, early_check_in_hours: earlyHours, status: 'confirmed' as const })
    setLocalBooking(updated)
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
      setTakingPayment(true)
      return
    }
    setActionNotice('')
    const actualCheckOut = new Date().toISOString()
    const rates = getRateConfig()
    const { lateHours } = computeCheckInOutHours({
      checkIn: booking.check_in, checkOut: booking.check_out, actualCheckOut,
      standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
    })
    const updated = withRecomputedBalance(localBooking, { actual_check_out: actualCheckOut, late_check_out_hours: lateHours })
    setLocalBooking(updated)
    try { await onUpdateBooking?.(updated) } catch { showToast('Could not check out. Please try again.', 'error') }
    // A late check-out adds hours, which can put the guest back in debt — that
    // debt must be settled too before they leave.
    if (hasOutstandingBalance(updated)) {
      setActionNotice('Late check-out added ' + fmtPeso(Number(updated.balance_due || 0)) + ' to this stay. Record the payment before the guest leaves.')
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
    setTakingPayment(false)
    setReceiptAmount(0); setReceiptRef(''); setAddReceiptOpen(false); setTryPayment(false)
    setPayFlash(true); setTimeout(() => setPayFlash(false), 1500)
    try {
      await onUpdateBooking?.(updated)
      setReceiptFor(rec)
      setShowReceipt(true)
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

  // Breakfast is no longer recorded day by day (card k140): it is one charge,
  // ₱150 × the room's beds, already inside the room rate.
  const stayDays = (() => {
    const arr: string[] = []
    const d = new Date(booking.check_in)
    const end = new Date(booking.check_out)
    while (d < end) { arr.push(dateToString(d)); d.setDate(d.getDate() + 1) }
    return arr
  })()

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

  const receiptTotal = receiptRecords.reduce((a, r) => a + (r.amount || 0), 0)
  const breakfastRecords = localBooking.breakfast_records || []
  const canCheckIn = localBooking.status !== 'blocked' && !localBooking.actual_check_in
  const canCheckOut = localBooking.status !== 'blocked' && !!localBooking.actual_check_in && !localBooking.actual_check_out

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-md bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header — the unit is what staff clicked, so it leads. */}
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-soft shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-main truncate">{unitName}</h3>
              {statusBadge}
              {paymentChip}
            </div>
            <p className="text-[11px] text-muted mt-1 truncate">
              {unitSub ? unitSub + ' · ' : ''}{fmtShort(booking.check_in)} → {fmtShort(booking.check_out)} · {nights} {nights === 1 ? 'night' : 'nights'}
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
          {/* Who is staying */}
          <div className="pt-4">
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

          {/* The money card: a quiet status strip normally, the full payment
              panel only while money is actually being taken. */}
          {totalCharge > 0 && (
            <div className="mt-4">
              <BookingMoneyPanel
                localBooking={localBooking}
                payFlash={payFlash}
                tabTotal={tabAmount}
                open={paymentOpen}
                method={receiptMethod} setMethod={setReceiptMethod}
                reference={receiptRef} setReference={setReceiptRef}
                referenceError={tryPayment && methodNeedsRef && !receiptRef.trim()
                  ? 'Enter the ' + receiptMethod + ' reference number.' : ''}
              />
            </div>
          )}

          {/* One loud action, right below the card, and never two. Taking money
              at the door is the staff's decision: pressing "Receive money &
              check in" starts a guided step they have to finish — choose how the
              guest pays, enter the reference where one is needed, then confirm. */}
          {(canCheckOut || canCheckIn || showPaymentForm) && (
            <div className="mt-3 space-y-2.5">
              {takingPayment && due > 0 ? (
                <ReceivePaymentStep
                  amount={due}
                  method={receiptMethod} setMethod={setReceiptMethod}
                  reference={receiptRef} setReference={setReceiptRef}
                  referenceError={tryPayment && methodNeedsRef && !receiptRef.trim()
                    ? 'Enter the ' + receiptMethod + ' reference number.' : ''}
                  submitLabel={localBooking.actual_check_in
                    ? 'Receive ' + fmtPeso(due)
                    : 'Receive ' + fmtPeso(due) + ' & check in'}
                  note={localBooking.actual_check_in
                    ? 'The stay grew after check-in — take the payment before the guest leaves.'
                    : 'Guest is at the desk. Take the payment and they are checked in.'}
                  onSubmit={() => handleAddReceipt(due, !localBooking.actual_check_in)}
                  onCancel={() => { setActionNotice(''); setTakingPayment(false); setTryPayment(false) }}
                />
              ) : canCheckOut ? (
                <button type="button" onClick={handleCheckOut}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm">
                  Check out now
                </button>
              ) : showPaymentForm && !localBooking.actual_check_in ? (
                /* Nothing recorded yet: the booking is expected to be paid for
                   now. The agreed deposit (or the full amount) is already the
                   card's "Amount to pay". */
                <button type="button" onClick={() => handleAddReceipt(amountToPayNow(localBooking, tabAmount))}
                  className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm">
                  {plan === 'full' ? 'Confirm full payment & print receipt' : plan === 'deposit' ? 'Confirm deposit paid & print receipt' : 'Save payment & print receipt'}
                </button>
              ) : canCheckIn && due > 0 ? (
                /* The deposit is in and the guest has not arrived. Nothing is
                   asked for here — the card just says the stay is partly paid.
                   Taking the rest is the staff's decision, when they walk in. */
                <button type="button" onClick={() => { setActionNotice(''); setTakingPayment(true) }}
                  className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-bold py-3 rounded-xl transition-colors shadow-sm cursor-pointer">
                  Receive money & check in
                </button>
              ) : canCheckIn && due <= 0 ? (
                /* The check-in button appears ONLY once the whole bill is paid.
                   Nothing owed means paid — including a booking whose money was
                   recorded before receipts existed (imported / old paper logs),
                   which must never be left without an arrival button. */
                <button type="button" onClick={handleCheckIn}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-sm cursor-pointer">
                  Check in now
                </button>
              ) : null}
              {/* Why the button just pressed did not go through — on the page,
                  under the button, where it can be read while acting. */}
              {actionNotice && (
                <p className="text-[11px] font-semibold text-danger-600 leading-snug">{actionNotice}</p>
              )}
            </div>
          )}

          {/* Collapsed detail blocks — opened only when needed */}
          <div className="mt-4">
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
                setOpen={setAddReceiptOpen}
                amount={receiptAmount}
                setAmount={setReceiptAmount}
                method={receiptMethod}
                setMethod={setReceiptMethod}
                reference={receiptRef}
                setReference={setReceiptRef}
                referenceRequired={methodNeedsRef}
                referenceError={tryPayment && methodNeedsRef && !receiptRef.trim() ? 'Enter the ' + receiptMethod + ' reference number.' : ''}
                onAdd={handleAddReceipt}
                onRemove={handleRemoveReceipt}
                onPrint={r => { setReceiptFor(r); setShowReceipt(true) }}
              />
            </SlideOverSection>

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
                locked={!localBooking.actual_check_in}
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
          onClose={() => setShowReceipt(false)}
        />
      )}
    </div>
  )

  return createPortal(modalContent, document.body)
}
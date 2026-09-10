import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue, PaymentRecord, BreakfastRecord } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig, getBreakfastMenu } from '../../utils/rateConfig'
import { dateToString } from '../../utils/helpers'
import { BreakfastRecorder } from './BreakfastRecorder'
import { X, Printer, Edit3 } from 'lucide-react'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { PaymentStatusOption } from '../billing/PaymentStatusSelect'
import { SOURCE_LABELS, roomDisplayName } from './bookingStyles'
import { statusAfterPayment } from '../../utils/bookingStatus'
import { SlideOverSection } from './SlideOverSection'
import { BookingMoneyPanel } from './BookingMoneyPanel'
import { BookingReceipts } from './BookingReceipts'
import { ExtendStayForm } from './ExtendStayForm'

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
  onConfirmReservation?: (id: string) => void
  onCancelBooking?: (id: string) => void
  onUpdateBooking?: (booking: Booking) => Promise<void>
  isConfirming?: boolean
  onEditBooking?: () => void
}

const fmtShort = (d: string) => (d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—')
const fmtPeso = (n: number) => '₱' + n.toLocaleString()

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
  onConfirmReservation,
  onCancelBooking,
  onUpdateBooking,
  isConfirming = false,
  onEditBooking
}: ExtendStayModalProps) {
  const [showPrintModal, setShowPrintModal] = useState(false)
  const [localBooking, setLocalBooking] = useState(booking)
  const [payFlash, setPayFlash] = useState(false)
  const [addReceiptOpen, setAddReceiptOpen] = useState(false)
  const [receiptAmount, setReceiptAmount] = useState(0)
  const [receiptMethod, setReceiptMethod] = useState('Cash')
  const [receiptRef, setReceiptRef] = useState('')
  const [receiptFor, setReceiptFor] = useState<PaymentRecord | null>(null)
  const [showReceipt, setShowReceipt] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [trySave, setTrySave] = useState(false)

  const room = booking.room_id ? rooms.find(r => r.id === booking.room_id) : undefined
  const venue = booking.venue_id ? venues.find(v => v.id === booking.venue_id) : undefined
  const unitName = booking.room_id ? roomDisplayName(room) : (venue?.name || 'Event Venue')
  const unitSub = booking.room_id && room?.name ? 'Room ' + room.room_number : ''
  const nights = booking.check_in && booking.check_out
    ? Math.max(1, Math.ceil((new Date(booking.check_out).getTime() - new Date(booking.check_in).getTime()) / 86400000))
    : 1
  const due = Number(localBooking.balance_due || 0)
  const hasEmail = booking.guest_email && booking.guest_email !== 'admin@daweez-booking.vercel.app'

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

  const handleQuickPayment = async (b: Booking, status: PaymentStatusOption) => {
    const updated = { ...b, payment_status: status, status: status === 'unpaid' ? b.status : statusAfterPayment(b.status), balance_due: status === 'paid' ? 0 : b.balance_due }
    setLocalBooking(updated)
    setPayFlash(true)
    setTimeout(() => setPayFlash(false), 1500)
    try {
      await onUpdateBooking?.(updated)
    } catch {
      window.alert('Could not update the payment. Please try again.')
    }
  }

  // Recompute the balance after early/late hours are applied, using the
  // booking's own charges + current rates, so the amount owed stays correct.
  const withRecomputedBalance = (base: Booking, patch: Partial<Booking>): Booking => {
    const merged = { ...base, ...patch }
    const pricing = syncEngine.calculatePricing({
      roomId: merged.room_id,
      venueId: merged.venue_id,
      checkIn: merged.check_in,
      checkOut: merged.check_out,
      guestEmail: merged.guest_email,
      breakfastOrders: merged.breakfast_orders,
      equipmentRentals: merged.equipment_rentals,
      eventAddons: merged.event_addons,
      companions: merged.companions,
      contractRateOverride: merged.contract_rate_override,
      venueExcessHours: merged.venue_excess_hours,
      appliedDiscount: merged.applied_discount,
      earlyCheckInHours: merged.early_check_in_hours,
      lateCheckOutHours: merged.late_check_out_hours,
      venueDayBlocks: merged.venue_day_blocks,
      breakfastDays: merged.breakfast_days,
      breakfastRecords: merged.breakfast_records,
      usePromo: (merged as Booking & { promo_applied?: boolean }).promo_applied === true,
      rooms,
      venues,
      rates: getRateConfig(),
    })
    const paid = Number(merged.downpayment_paid || 0)
    const remaining = Math.max(0, pricing.grandTotal - paid)
    return { ...merged, balance_due: remaining, payment_status: remaining <= 0 ? 'paid' as const : merged.payment_status }
  }

  // Check-in / check-out — records the actual time and auto-computes the early /
  // late hours against the standard 2 PM check-in / 12 PM check-out times.
  const handleCheckIn = async () => {
    const actualCheckIn = new Date().toISOString()
    const rates = getRateConfig()
    const { earlyHours } = computeCheckInOutHours({
      checkIn: booking.check_in, checkOut: booking.check_out, actualCheckIn,
      standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
    })
    const updated = withRecomputedBalance(booking, { actual_check_in: actualCheckIn, early_check_in_hours: earlyHours, status: 'confirmed' as const })
    setLocalBooking(updated)
    try { await onUpdateBooking?.(updated) } catch { window.alert('Could not check in. Please try again.') }
  }
  const handleCheckOut = async () => {
    const actualCheckOut = new Date().toISOString()
    const rates = getRateConfig()
    const { lateHours } = computeCheckInOutHours({
      checkIn: booking.check_in, checkOut: booking.check_out, actualCheckOut,
      standardCheckInTime: rates.standardCheckInTime, standardCheckOutTime: rates.standardCheckOutTime,
    })
    const updated = withRecomputedBalance(booking, { actual_check_out: actualCheckOut, late_check_out_hours: lateHours })
    setLocalBooking(updated)
    try { await onUpdateBooking?.(updated) } catch { window.alert('Could not check out. Please try again.') }
    // If money is still owed, bring up the billing statement right away.
    if (Number(updated.balance_due || 0) > 0 && !showPrintModal) setShowPrintModal(true)
  }

  // Record a payment: creates a receipt (date + time) only when the guest pays.
  const handleAddReceipt = async () => {
    const amount = Number(receiptAmount) || 0
    if (amount <= 0) { window.alert('Enter a payment amount.'); return }
    const paidSoFar = Number(localBooking.downpayment_paid || 0)
    const totalCharge = paidSoFar + Number(localBooking.balance_due || 0)
    const newPaid = paidSoFar + amount
    const remaining = Math.max(0, totalCharge - newPaid)
    const rec = { id: 'rcpt-' + Date.now(), amount, method: receiptMethod, reference: receiptRef.trim() || undefined, paid_at: new Date().toISOString(), prepared_by: localBooking.prepared_by }
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
    setReceiptAmount(0); setReceiptRef(''); setAddReceiptOpen(false)
    setPayFlash(true); setTimeout(() => setPayFlash(false), 1500)
    try {
      await onUpdateBooking?.(updated)
      setReceiptFor(rec)
      setShowReceipt(true)
    } catch {
      window.alert('Could not record the payment. Please try again.')
    }
  }

  // Breakfast is recorded day by day during the stay, then charged at check-out.
  const breakfastMenu = getBreakfastMenu()
  const stayDays = (() => {
    const arr: string[] = []
    const d = new Date(booking.check_in)
    const end = new Date(booking.check_out)
    while (d < end) { arr.push(dateToString(d)); d.setDate(d.getDate() + 1) }
    return arr
  })()
  const saveBreakfastRecords = async (records: BreakfastRecord[]) => {
    const updated = withRecomputedBalance(localBooking, { breakfast_records: records })
    setLocalBooking(updated)
    try { await onUpdateBooking?.(updated) } catch { window.alert('Could not save breakfast. Please try again.') }
  }

  const statusBadge = booking.status === 'confirmed'
    ? <span className="shrink-0 text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">Confirmed</span>
    : booking.status === 'pending'
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
      }).balanceDue
    } catch {
      return due
    }
  })()

  const receiptRecords = localBooking.payment_records || []
  const receiptTotal = receiptRecords.reduce((a, r) => a + (r.amount || 0), 0)
  const breakfastRecords = localBooking.breakfast_records || []
  const canCheckIn = booking.status !== 'blocked' && !booking.actual_check_in
  const canCheckOut = booking.status !== 'blocked' && !!booking.actual_check_in && !booking.actual_check_out

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-md bg-card rounded-xl shadow-softLg overflow-hidden flex flex-col max-h-[88vh]">

        {/* Header — the unit is what staff clicked, so it leads. */}
        <div className="flex items-start justify-between gap-3 px-5 py-3.5 border-b border-soft shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-display font-bold text-main truncate">{unitName}</h3>
              {statusBadge}
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
            <p className="text-[12px] text-muted mt-1 break-words">
              {booking.guest_phone}
              {hasEmail && <span className="text-muted"> · {booking.guest_email}</span>}
            </p>
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

          {/* The one focal card */}
          <div className="mt-4">
            <BookingMoneyPanel booking={booking} localBooking={localBooking} payFlash={payFlash} onQuickPayment={handleQuickPayment} />
          </div>

          {/* The single next step for this booking */}
          {(booking.status === 'pending' || canCheckIn || canCheckOut) && (
            <div className="mt-3">
              {booking.status === 'pending' ? (
                <button
                  type="button"
                  disabled={isConfirming}
                  onClick={() => onConfirmReservation && onConfirmReservation(booking.id)}
                  className="w-full bg-gold-400 hover:bg-gold-600 disabled:bg-softbg disabled:text-muted text-ink-900 text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm"
                >
                  {isConfirming ? 'Confirming…' : 'Confirm reservation'}
                </button>
              ) : canCheckOut ? (
                <button type="button" onClick={handleCheckOut}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm">
                  Check out now
                </button>
              ) : (
                <button type="button" onClick={handleCheckIn}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm">
                  Check in now
                </button>
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
                open={addReceiptOpen}
                setOpen={setAddReceiptOpen}
                amount={receiptAmount}
                setAmount={setReceiptAmount}
                method={receiptMethod}
                setMethod={setReceiptMethod}
                reference={receiptRef}
                setReference={setReceiptRef}
                onAdd={handleAddReceipt}
                onPrint={r => { setReceiptFor(r); setShowReceipt(true) }}
              />
            </SlideOverSection>

            {booking.room_id && (
              <SlideOverSection
                title="Breakfast during the stay"
                summary={breakfastRecords.length > 0 ? breakfastRecords.length + ' recorded' : 'None recorded'}
              >
                <BreakfastRecorder
                  menu={breakfastMenu}
                  records={breakfastRecords}
                  stayDays={stayDays}
                  onChange={saveBreakfastRecords}
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
                onClick={() => {
                  if (window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
                    onCancelBooking(booking.id)
                    onClose()
                  }
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
          booking={booking}
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
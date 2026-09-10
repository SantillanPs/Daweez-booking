import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue, PaymentRecord, BreakfastRecord } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { computeCheckInOutHours } from '../../utils/checkInOut'
import { getRateConfig, getBreakfastMenu } from '../../utils/rateConfig'
import { dateToString } from '../../utils/helpers'
import { BreakfastRecorder } from './BreakfastRecorder'
import { NumInput } from '../NumInput'
import { X, Users, AlertCircle, Printer, Edit3 } from 'lucide-react'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'
import { PaymentStatusSelect, PaymentStatusOption } from '../billing/PaymentStatusSelect'
import { SOURCE_LABELS, roomDisplayName } from './bookingStyles'

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

// Reservation details popup: who, what, how much, and what to do next.
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
  const paid = Number(localBooking.downpayment_paid || 0)
  const due = Number(localBooking.balance_due || 0)
  const payRef = booking.payment_reference || booking.event_addons?.payment_reference
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

  const baseField = 'w-full bg-page border text-main px-2.5 py-2 rounded-lg text-xs font-mono outline-none'
  const field = baseField + ' border-sea-300 focus:bg-card focus:border-sea-500'
  const fieldErr = baseField + ' border-coral-400 focus:bg-card focus:border-coral-500'

  const handleQuickPayment = async (b: Booking, status: PaymentStatusOption) => {
    const updated = { ...b, payment_status: status, balance_due: status === 'paid' ? 0 : b.balance_due }
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
    ? <span className="text-[10px] font-bold uppercase text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">Confirmed</span>
    : booking.status === 'pending'
      ? <span className="text-[10px] font-bold uppercase text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-0.5">On hold</span>
      : <span className="text-[10px] font-bold uppercase text-muted bg-softbg border border-soft rounded-md px-2 py-0.5">Blocked</span>

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

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="w-full max-w-md bg-card rounded-xl shadow-softLg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-soft bg-sea-50">
          <div className="flex items-center gap-2.5">
            <h3 className="font-display font-bold text-main">Reservation</h3>
            {statusBadge}
          </div>
          <div className="flex items-center gap-3">
            {onEditBooking && (
              <button onClick={onEditBooking} className="text-muted hover:text-sea-700 transition-colors cursor-pointer" title="Edit booking">
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-muted hover:text-main transition-colors cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Guest & stay */}
          <div className="bg-page border border-soft rounded-xl p-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Guest</p>
                <p className="font-display font-bold text-[17px] text-main leading-tight">{booking.guest_name}</p>
                <p className="text-[12px] text-muted mt-1">{booking.guest_phone}</p>
                {hasEmail && <p className="text-[12px] text-muted truncate" title={booking.guest_email}>{booking.guest_email}</p>}
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">Stay</p>
                <p className="text-[13px] font-bold text-main">{unitName}</p>
                {unitSub && <p className="text-[11px] text-muted">{unitSub}</p>}
                <div className="flex items-center gap-1.5 mt-1.5">
                  <span className="text-[9px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5">In {fmtShort(booking.check_in)}</span>
                  <span className="text-[9px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-100 rounded px-1.5 py-0.5">Out {fmtShort(booking.check_out)}</span>
                </div>
                <p className="text-[11px] text-muted mt-1">{nights} {nights === 1 ? 'night' : 'nights'}</p>
              </div>
            </div>
            <div className="border-t border-soft/70 pt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
              <span>Booked from: <strong className="text-main">{SOURCE_LABELS[booking.source] || booking.source}</strong></span>
              {booking.reference_number && <span>Paper ref: <strong className="text-main">{booking.reference_number}</strong></span>}
              {booking.registered_on && <span>Logged: <strong className="text-main">{booking.registered_on}</strong></span>}
              {booking.vehicle_plate && <span>Plate: <strong className="text-main uppercase">{booking.vehicle_plate}</strong></span>}
              {booking.company_name && <span>Company: <strong className="text-main">{booking.company_name}</strong></span>}
            </div>
            {booking.companions && booking.companions.length > 0 && (
              <div className="border-t border-soft/70 pt-2.5">
                <p className="text-[10px] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sea-600" /> {booking.companions.length + 1} guests staying
                </p>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {booking.companions.map((comp, idx) => (
                    <span key={idx} className="text-[11px] bg-card border border-soft rounded-md px-2 py-0.5">
                      {comp.name}{comp.nationality ? <span className="text-muted capitalize"> ({comp.nationality})</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Money */}
          <div className="bg-sand-50 border border-sand-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Payment</p>
              <div className="flex items-center gap-2">
                {payFlash && <span className="text-[10px] font-bold text-emerald-600 animate-in fade-in">Saved ✓</span>}
                <PaymentStatusSelect booking={localBooking} onChange={handleQuickPayment} />
              </div>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted">Total</span>
              <span className="font-semibold text-main">{fmtPeso(paid + due)}</span>
            </div>
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted">Paid so far</span>
              <span className="font-semibold text-emerald-600">−{fmtPeso(paid)}</span>
            </div>
            <div className="flex items-end justify-between border-t border-soft pt-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">Amount to pay</span>
              <span className={'font-display text-[22px] font-extrabold leading-none ' + (due > 0 ? 'text-coral-600' : 'text-sea-700')}>{fmtPeso(due)}</span>
            </div>
            {(booking.payment_method || payRef) && (
              <p className="text-[11px] text-muted pt-1.5 border-t border-soft/60">
                {booking.payment_method && <>Paid with <strong className="text-main">{booking.payment_method}</strong></>}
                {payRef && <> · Ref <strong className="font-mono text-main">{payRef}</strong></>}
              </p>
            )}
          </div>

          {/* Payment receipts */}
          <div className="border-t border-soft pt-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Payment receipts</p>
              <button type="button" onClick={() => setAddReceiptOpen(v => !v)}
                className="text-[11px] font-bold text-sea-700 bg-sea-50 border border-sea-200 hover:bg-sea-100 rounded-md px-2.5 py-1 transition-colors cursor-pointer">
                {addReceiptOpen ? 'Cancel' : '+ Record a payment'}
              </button>
            </div>
            {addReceiptOpen && (
              <div className="p-3 bg-page border border-soft rounded-lg space-y-2">
                <label className="text-[10px] text-muted font-bold block">Amount (PHP)</label>
                <NumInput value={receiptAmount} onChange={setReceiptAmount} placeholder="0"
                  className="w-full bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm font-mono focus:outline-none focus:border-sea-500" />
                <div className="grid grid-cols-2 gap-2">
                  <select value={receiptMethod} onChange={e => setReceiptMethod(e.target.value)} className="bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-sea-500">
                    <option>Cash</option><option>GCash</option><option>Bank transfer</option><option>Other</option>
                  </select>
                  <input value={receiptRef} onChange={e => setReceiptRef(e.target.value)} placeholder="Reference (optional)" className="bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-sea-500" />
                </div>
                <button type="button" onClick={handleAddReceipt} className="w-full bg-sea-600 hover:bg-sea-700 text-white text-xs font-bold py-2 rounded-lg transition-colors cursor-pointer">Save receipt</button>
              </div>
            )}
            {localBooking.payment_records && localBooking.payment_records.length > 0 ? (
              <ul className="space-y-1.5">
                {localBooking.payment_records.map(r => (
                  <li key={r.id} className="flex items-center justify-between gap-2 bg-card border border-soft rounded-md px-2.5 py-1.5 text-[12px]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-emerald-600 shrink-0">+{fmtPeso(r.amount)}</span>
                      <span className="text-muted shrink-0">{r.method}</span>
                      <span className="text-muted text-[10px] truncate">{r.paid_at ? new Date(r.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''}</span>
                    </div>
                    <button type="button" onClick={() => { setReceiptFor(r); setShowReceipt(true) }} className="text-sea-600 hover:text-sea-700 p-1 cursor-pointer shrink-0" aria-label="Print receipt">
                      <Printer className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-muted">No payments yet — a receipt is created each time the guest pays.</p>
            )}
          </div>

          {/* Breakfast (during the stay) — room stays only */}
          {booking.room_id && (
            <BreakfastRecorder
              menu={breakfastMenu}
              records={localBooking.breakfast_records || []}
              stayDays={stayDays}
              onChange={saveBreakfastRecords}
            />
          )}

          {/* Check-in / check-out */}
          {(booking.status === 'confirmed' || booking.status === 'pending') && (
            <div className="grid grid-cols-2 gap-2">
              {!booking.actual_check_in && (
                <button type="button" onClick={handleCheckIn}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm">
                  Check in now
                </button>
              )}
              {booking.actual_check_in && !booking.actual_check_out && (
                <button type="button" onClick={handleCheckOut}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm">
                  Check out now
                </button>
              )}
            </div>
          )}

          {/* Extend stay */}
          <form onSubmit={handleExtendSubmit} className="border-t border-soft pt-4 space-y-3">
            {extendError && (
              <div className="p-2.5 bg-coral-50 border border-coral-200 text-coral-600 text-xs flex items-center gap-2 rounded-lg">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{extendError}</span>
              </div>
            )}
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Extend stay</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted font-bold block mb-1">Check-in</label>
                <input type="date" readOnly value={booking.check_in}
                  className="w-full bg-softbg border border-soft text-muted px-2.5 py-2 rounded-lg text-xs font-mono outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-sea-700 font-bold block mb-1">New check-out <span className="text-coral-600">*</span></label>
                <input type="date" min={booking.check_in} value={extendCheckoutDate}
                  onChange={e => setExtendCheckoutDate(e.target.value)}
                  onBlur={markTouched('extendCheckoutDate')}
                  className={isInvalid('extendCheckoutDate') ? fieldErr : field} />
                {showErr('extendCheckoutDate') && <p className="text-[10px] text-coral-600 mt-1">{showErr('extendCheckoutDate')}</p>}
              </div>
            </div>
            {extraNights > 0 && (
              <div className="p-3 bg-sea-50 border border-sea-200 rounded-lg text-[12px] space-y-1">
                <div className="flex justify-between text-muted">
                  <span>Extra nights</span>
                  <span className="font-mono text-main font-semibold">+{extraNights}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-sea-200/70 pt-1">
                  <span className="text-muted">New amount to pay</span>
                  <span className={'font-mono ' + (newBalanceDue > 0 ? 'text-coral-600' : 'text-emerald-600')}>{fmtPeso(newBalanceDue)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowPrintModal(true)}
                className="flex-1 bg-card hover:bg-sea-50 text-main border border-soft text-xs font-bold py-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-sea-600" />
                Print invoice
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
                  className="flex-1 bg-coral-50 hover:bg-coral-100 text-coral-600 border border-coral-200 text-xs font-medium py-2.5 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel booking
                </button>
              )}
            </div>
            {booking.status === 'pending' ? (
              <button
                type="button"
                disabled={isConfirming}
                onClick={() => onConfirmReservation && onConfirmReservation(booking.id)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 text-white text-sm font-bold py-3 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                {isConfirming ? 'Confirming…' : 'Confirm reservation'}
              </button>
            ) : (
              <button
                type="submit"
                disabled={extendCheckoutDate === booking.check_out}
                className="w-full bg-sea-600 hover:bg-sea-700 disabled:bg-softbg disabled:text-muted text-white text-sm font-bold py-3 rounded-lg transition-colors cursor-pointer shadow-sm"
              >
                Save extension
              </button>
            )}
          </form>
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

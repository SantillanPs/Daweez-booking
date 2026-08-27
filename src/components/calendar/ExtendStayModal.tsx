import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { Booking, Room, Venue } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { X, Users, AlertCircle, Printer, Edit3 } from 'lucide-react'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
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
                      {comp.name} <span className="text-muted capitalize">({comp.gender})</span>
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

          {/* Extend stay */}
          <form onSubmit={onExtendStaySubmit} className="border-t border-soft pt-4 space-y-3">
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
                <label className="text-[10px] text-sea-700 font-bold block mb-1">New check-out</label>
                <input type="date" required min={booking.check_in} value={extendCheckoutDate}
                  onChange={e => setExtendCheckoutDate(e.target.value)}
                  className="w-full bg-page border border-sea-300 text-main px-2.5 py-2 rounded-lg text-xs font-mono outline-none focus:bg-card focus:border-sea-500" />
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
    </div>
  )

  return createPortal(modalContent, document.body)
}

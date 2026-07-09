import React, { useState } from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { X, Users, AlertCircle, Mail, Printer } from 'lucide-react'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'

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
  isConfirming?: boolean
}

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
  isConfirming = false
}: ExtendStayModalProps) {
  const [showPrintModal, setShowPrintModal] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-card rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-soft">
          <h3 className="text-sm font-semibold text-main">Reservation Details</h3>
          <button onClick={onClose} className="text-muted hover:text-main cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="bg-page p-3 rounded-lg border border-soft space-y-1 text-xs">
            <h3 className="text-sm font-semibold text-main">{booking.guest_name}</h3>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-muted">
              <div>
                <span className="text-muted block">Unit:</span> 
                <span className="font-medium text-main">
                  {booking.room_id ? (rooms.find(r => r.id === booking.room_id)?.name || 'Room') : (venues.find(v => v.id === booking.venue_id)?.name || 'Event Venue')}
                </span>
              </div>
              <div>
                <span className="text-muted block">Source:</span> 
                <span className="font-medium text-main uppercase">{booking.source}</span>
              </div>
              <div>
                <span className="text-muted block">Phone:</span> 
                <span className="font-medium text-main font-mono">{booking.guest_phone}</span>
              </div>
              <div>
                <span className="text-muted block">Email:</span> 
                <span className="font-medium text-main truncate block" title={booking.guest_email}>
                  {booking.guest_email}
                </span>
              </div>
            </div>
          </div>

          {/* GCash Reference Code Display */}
          {booking.event_addons?.payment_reference && (
            <div className="bg-[#FAF6EE] p-3 rounded-lg border border-[#EADFC9] text-xs space-y-1">
              <span className="text-slate-550 font-medium block">GCash Reference Code:</span>
              <strong className="text-sm font-mono text-brand-text block">{booking.event_addons.payment_reference}</strong>
            </div>
          )}

          {/* Companions Registry Display */}
          {booking.companions && booking.companions.length > 0 && (
            <div className="bg-page/50 border border-soft p-3 rounded-lg space-y-2">
              <div className="text-[10px] text-muted font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-primary" /> Companions ({booking.companions.length + 1} total guests)
              </div>
              <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                {booking.companions.map((comp, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] bg-card border border-soft px-2.5 py-1 rounded">
                    <span className="font-medium text-main">{comp.name}</span>
                    <span className="text-muted capitalize">{comp.gender}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onExtendStaySubmit} className="space-y-3.5 border-t border-soft pt-3">
            {extendError && (
              <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-lg">
                <AlertCircle className="w-4 h-4" /><span>{extendError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted font-medium block mb-1">Check-in</label>
                <input type="date" readOnly value={booking.check_in}
                   className="w-full bg-softbg border border-soft text-muted px-2.5 py-1.5 rounded text-xs font-mono outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-brand-primary font-semibold block mb-1">Check-out (Extend)</label>
                <input type="date" required min={booking.check_in} value={extendCheckoutDate}
                  onChange={e => setExtendCheckoutDate(e.target.value)}
                  className="w-full bg-page border border-brand-primary text-main px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:bg-card" />
              </div>
            </div>

            {extendCheckoutDate && extendCheckoutDate !== booking.check_out && (
              <div className="p-3 bg-brand-bg border border-brand-border rounded-lg text-xs space-y-1 text-muted font-medium">
                <div className="flex justify-between">
                  <span>Extended Nights:</span>
                  <span className="font-mono">
                    {Math.max(0, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(booking.check_out).getTime()) / 86400000))}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-main border-t border-soft/40 pt-1">
                  <span>New Total Balance Due:</span>
                  <span className="font-mono text-brand-text">
                    ₱{(() => {
                      try {
                        return syncEngine.calculatePricing({
                          roomId: booking.room_id,
                          venueId: booking.venue_id,
                          checkIn: booking.check_in,
                          checkOut: extendCheckoutDate,
                          guestEmail: booking.guest_email,
                          breakfastOrders: booking.breakfast_orders,
                          companions: booking.companions,
                          bookingsList: bookings
                        }).balanceDue.toLocaleString()
                      } catch {
                        return '0'
                      }
                    })()}
                  </span>
                </div>
              </div>
            )}

            <div className="border-t border-soft pt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  alert("This feature is under development.")
                }}
                className="flex-1 bg-card hover:bg-page text-main border border-soft text-[10px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
              >
                <Mail className="w-3.5 h-3.5 text-brand-primary" />
                Email Invoice
              </button>
               <button
                type="button"
                onClick={() => {
                  setShowPrintModal(true)
                }}
                className="flex-1 bg-card hover:bg-page text-main border border-soft text-[10px] font-bold py-1.5 px-2 rounded flex items-center justify-center gap-1.5 transition-all cursor-pointer select-none"
              >
                <Printer className="w-3.5 h-3.5 text-brand-primary" />
                Print Invoice
              </button>
            </div>

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-page hover:bg-softbg text-muted text-xs font-medium py-2.5 rounded-lg border border-soft transition-colors cursor-pointer">
                Cancel
              </button>
              {booking.status === 'pending' ? (
                <button 
                  type="button" 
                  disabled={isConfirming}
                  onClick={() => onConfirmReservation && onConfirmReservation(booking.id)}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-200 text-white text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer shadow-sm select-none"
                >
                  {isConfirming ? 'Confirming...' : 'Confirm Reservation'}
                </button>
              ) : (
                <button type="submit" disabled={extendCheckoutDate === booking.check_out}
                  className="flex-1 bg-brand-primary hover:bg-brand-text disabled:bg-softbg disabled:text-muted text-white text-xs font-medium py-2.5 rounded-lg transition-colors cursor-pointer">
                  Save Extension
                </button>
              )}
            </div>
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
}

import React from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { X, Users, AlertCircle } from 'lucide-react'

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
  setExtendCheckoutDate
}: ExtendStayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Reservation Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 space-y-1 text-xs">
            <h3 className="text-sm font-semibold text-slate-800">{booking.guest_name}</h3>
            <div className="grid grid-cols-2 gap-2 pt-2 text-[11px] text-slate-500">
              <div>
                <span className="text-slate-400 block">Unit:</span> 
                <span className="font-medium text-slate-800">
                  {booking.room_id ? (rooms.find(r => r.id === booking.room_id)?.name || 'Room') : (venues.find(v => v.id === booking.venue_id)?.name || 'Event Venue')}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Source:</span> 
                <span className="font-medium text-slate-800 uppercase">{booking.source}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Phone:</span> 
                <span className="font-medium text-slate-800 font-mono">{booking.guest_phone}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Email:</span> 
                <span className="font-medium text-slate-800 truncate block" title={booking.guest_email}>
                  {booking.guest_email}
                </span>
              </div>
            </div>
          </div>

          {/* Companions Registry Display */}
          {booking.companions && booking.companions.length > 0 && (
            <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-lg space-y-2">
              <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#B89251]" /> Companions ({booking.companions.length + 1} total guests)
              </div>
              <div className="space-y-1.5 max-h-[100px] overflow-y-auto pr-1">
                {booking.companions.map((comp, idx) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] bg-white border border-slate-100 px-2.5 py-1 rounded">
                    <span className="font-medium text-slate-700">{comp.name}</span>
                    <span className="text-slate-400 capitalize">{comp.gender}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={onExtendStaySubmit} className="space-y-3.5 border-t border-slate-100 pt-3">
            {extendError && (
              <div className="p-2 bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2 rounded-lg">
                <AlertCircle className="w-4 h-4" /><span>{extendError}</span>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 font-medium block mb-1">Check-in</label>
                <input type="date" readOnly value={booking.check_in}
                   className="w-full bg-slate-100 border border-slate-200 text-slate-500 px-2.5 py-1.5 rounded text-xs font-mono outline-none" />
              </div>
              <div>
                <label className="text-[10px] text-[#B89251] font-semibold block mb-1">Check-out (Extend)</label>
                <input type="date" required min={booking.check_in} value={extendCheckoutDate}
                  onChange={e => setExtendCheckoutDate(e.target.value)}
                  className="w-full bg-slate-50 border border-[#B89251] text-slate-800 px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:bg-white" />
              </div>
            </div>

            {extendCheckoutDate && extendCheckoutDate !== booking.check_out && (
              <div className="p-3 bg-[#FDFBF7] border border-[#E5D5C0] rounded-lg text-xs space-y-1 text-slate-600 font-medium">
                <div className="flex justify-between">
                  <span>Extended Nights:</span>
                  <span className="font-mono">
                    {Math.max(0, Math.ceil((new Date(extendCheckoutDate).getTime() - new Date(booking.check_out).getTime()) / 86400000))}
                  </span>
                </div>
                <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200/40 pt-1">
                  <span>New Total Balance Due:</span>
                  <span className="font-mono text-[#9A783E]">
                    ₱{(() => {
                      try {
                        return syncEngine.calculatePricing({
                          roomId: booking.room_id,
                          venueId: booking.venue_id,
                          checkIn: booking.check_in,
                          checkOut: extendCheckoutDate,
                          guestEmail: booking.guest_email,
                          breakfastOrders: booking.breakfast_orders,
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

            <div className="flex gap-2 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-medium py-2.5 rounded-lg border border-slate-200 transition-colors cursor-pointer">
                Cancel
              </button>
              <button type="submit" disabled={extendCheckoutDate === booking.check_out}
                className="flex-1 bg-[#B89251] hover:bg-[#9A783E] disabled:bg-slate-100 disabled:text-slate-400 text-white text-xs font-medium py-2.5 rounded-lg transition-colors cursor-pointer">
                Save Extension
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

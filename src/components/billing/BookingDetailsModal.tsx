import React from 'react'
import { createPortal } from 'react-dom'
import { X, Printer, MapPin, Building, Phone, Mail } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { PrintInvoiceModal } from './PrintInvoiceModal'
import { PaymentStatusSelect } from './PaymentStatusSelect'
import { getPaymentView, PAYMENT_BADGE_CLASSES } from '../../utils/bookingMoney'

interface BookingDetailsModalProps {
  booking: Booking
  rooms: Room[]
  venues: Venue[]
  bookingsList: Booking[]
  onClose: () => void
  onPaymentStatusChange: (booking: Booking, status: 'unpaid' | 'downpayment' | 'paid') => void
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function BookingDetailsModal({ booking, rooms, venues, bookingsList, onClose, onPaymentStatusChange }: BookingDetailsModalProps) {
  const [showPrint, setShowPrint] = React.useState(false)
  const pay = getPaymentView(booking)
  const isVenue = !!booking.venue_id
  const unitName = booking.room_id
    ? (rooms.find(r => r.id === booking.room_id)?.name || 'Room')
    : (venues.find(v => v.id === booking.venue_id)?.name || 'Venue')

  const modal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="w-full max-w-md bg-card rounded-lg shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-soft">
          <h3 className="text-sm font-semibold text-main">Booking details</h3>
          <button onClick={onClose} className="text-muted hover:text-main cursor-pointer transition-colors" title="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h4 className="text-lg font-bold text-main">{booking.guest_name}</h4>
            {booking.status !== 'blocked' && (
              <span className={`px-3 py-1.5 rounded-lg text-sm font-extrabold ${PAYMENT_BADGE_CLASSES[pay.tone]}`}>
                {pay.label}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
            <div>
              <div className="text-muted mb-0.5">Stay</div>
              <div className="font-medium text-main">{fmtDate(booking.check_in)} → {fmtDate(booking.check_out)}</div>
            </div>
            <div>
              <div className="text-muted mb-0.5">Unit</div>
              <div className="font-medium text-main flex items-center gap-1">
                {isVenue
                  ? <MapPin className="w-3.5 h-3.5 text-emerald-500" />
                  : <Building className="w-3.5 h-3.5 text-blue-500" />}
                {unitName}
              </div>
            </div>
            <div>
              <div className="text-muted mb-0.5">Invoice</div>
              <div className="font-mono text-main">{booking.invoice_number || 'N/A'}</div>
            </div>
            <div>
              <div className="text-muted mb-0.5">Source</div>
              <div className="font-medium text-main capitalize">{booking.source}</div>
            </div>
            <div>
              <div className="text-muted mb-0.5">Phone</div>
              <div className="font-medium text-main flex items-center gap-1">
                <Phone className="w-3 h-3 text-muted" /> {booking.guest_phone || '—'}
              </div>
            </div>
            <div>
              <div className="text-muted mb-0.5">Email</div>
              <div className="font-medium text-main truncate flex items-center gap-1" title={booking.guest_email}>
                <Mail className="w-3 h-3 text-muted shrink-0" /> {booking.guest_email || '—'}
              </div>
            </div>
          </div>

          {booking.event_addons?.payment_reference && (
            <div className="bg-[#FAF6EE] p-3 rounded-lg border border-[#EADFC9] text-xs">
              <span className="text-muted block">GCash reference</span>
              <strong className="font-mono text-brand-text">{booking.event_addons.payment_reference}</strong>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-2 border-t border-soft">
            <button
              onClick={() => setShowPrint(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-soft bg-card text-main hover:bg-page transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-brand-primary" /> Print invoice
            </button>
            {booking.status !== 'blocked' && (
              <PaymentStatusSelect booking={booking} onChange={onPaymentStatusChange} />
            )}
          </div>
        </div>
      </div>

      {showPrint && (
        <PrintInvoiceModal
          booking={booking}
          rooms={rooms}
          venues={venues}
          bookingsList={bookingsList}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  )

  return createPortal(modal, document.body)
}

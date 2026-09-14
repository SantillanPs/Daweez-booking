import { Booking, Room, Venue } from '../../types/booking'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'

interface BookingCreatedPanelProps {
  createdBookingList: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  onClose: () => void
}

// Shown right after a booking is created: the printable Guest Billing Statement
// to hand to the guest — and nothing else. No money is taken here. The guest is
// given the statement first; the payment is recorded afterwards from the booking
// itself (the quick view), which is what prints their Payment Receipt.
export function BookingCreatedPanel({ createdBookingList, rooms, venues, bookings, onClose }: BookingCreatedPanelProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 flex flex-col items-center" onClick={onClose}>
      <div className="w-full max-w-3xl mb-8" onClick={e => e.stopPropagation()}>
        <PrintInvoiceModal
          bookingsToPrint={createdBookingList}
          rooms={rooms}
          venues={venues}
          bookingsList={bookings}
          onClose={onClose}
          embedded
        />
      </div>
    </div>
  )
}

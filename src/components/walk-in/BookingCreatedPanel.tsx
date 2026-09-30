import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'

interface BookingCreatedPanelProps {
  createdBookingList: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  /**
   * The receipt for money taken **in the booking form** (the owner's ruling, 2026-09-29).
   *
   * The form now takes the payment, so what the guest is handed at the end is the
   * **Payment Receipt** — handing a bill to somebody who has just paid was the wrong piece
   * of paper. A **Reservation** pays nothing and returns no receipt, so it still gets the
   * billing statement, exactly as before; and the statement stays one click away in the
   * booking's quick view for any guest who wants the itemised bill.
   */
  receipt?: PaymentRecord | null
  onClose: () => void
}

// Shown right after a booking is created: **the receipt if money was taken here**, and the
// printable Guest Billing Statement otherwise. Nothing else.
export function BookingCreatedPanel({ createdBookingList, rooms, venues, bookings, receipt, onClose }: BookingCreatedPanelProps) {
  // The payment is recorded against the first booking of the set, which is also the one
  // carrying the invoice — so that is the booking the receipt names.
  const paidBooking = createdBookingList[0]

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 flex flex-col items-center" onClick={onClose}>
      <div className="w-full max-w-3xl mb-8" onClick={e => e.stopPropagation()}>
        {receipt && paidBooking ? (
          <PrintPaymentReceiptModal
            booking={paidBooking}
            record={receipt}
            rooms={rooms}
            venues={venues}
            /* The whole set, so the receipt names **every room the money paid for** rather than the one
               carrying the invoice (the owner's ruling, 2026-09-30). */
            covered={createdBookingList}
            onClose={onClose}
            embedded
          />
        ) : (
          <PrintInvoiceModal
            bookingsToPrint={createdBookingList}
            rooms={rooms}
            venues={venues}
            bookingsList={bookings}
            onClose={onClose}
            embedded
          />
        )}
      </div>
    </div>
  )
}

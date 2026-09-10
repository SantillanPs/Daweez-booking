import { Booking, Room, Venue, PaymentRecord } from '../../types/booking'
import { PrintInvoiceModal } from '../billing/PrintInvoiceModal'
import { PrintPaymentReceiptModal } from '../billing/PrintPaymentReceiptModal'

interface BookingCreatedPanelProps {
  createdDue: number
  payAmount: string
  setPayAmount: (v: string) => void
  payMethod: string
  setPayMethod: (v: string) => void
  payReference: string
  setPayReference: (v: string) => void
  payDate: string
  setPayDate: (v: string) => void
  recordPayment: () => void
  isRecordingPay: boolean
  createdBookingList: Booking[]
  rooms: Room[]
  venues: Venue[]
  bookings: Booking[]
  onClose: () => void
  receiptRecord: PaymentRecord | null
  receiptBooking: Booking | null
  setReceiptRecord: (v: PaymentRecord | null) => void
}

// Shown right after a booking is created: record a payment, print the Guest
// Billing Statement, and print the payment receipt.
export function BookingCreatedPanel({
  createdDue, payAmount, setPayAmount, payMethod, setPayMethod,
  payReference, setPayReference, payDate, setPayDate,
  recordPayment, isRecordingPay, createdBookingList,
  rooms, venues, bookings, onClose, receiptRecord, receiptBooking, setReceiptRecord,
}: BookingCreatedPanelProps) {
  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 p-4 flex flex-col items-center" onClick={onClose}>
        <div className="w-full max-w-3xl mb-8" onClick={e => e.stopPropagation()}>
          <div className="bg-base-100 border border-base-300 rounded-xl p-4 shadow-sm mb-4">
            <h4 className="text-xs font-bold text-base-content uppercase tracking-wider mb-1">Record a payment</h4>
            <p className="text-[10px] text-base-content/60 mb-3">Total due: <b className="text-success font-mono">₱{createdDue.toLocaleString()}</b></p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2.5">
              <label className="text-[10px] text-base-content/60 font-bold block">Amount (₱)
                <input type="text" inputMode="decimal" value={payAmount || String(createdDue || '')} onChange={e => setPayAmount(e.target.value)} placeholder={String(createdDue || 0)} className="input input-bordered w-full mt-1" />
              </label>
              <label className="text-[10px] text-base-content/60 font-bold block">Method
                <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="select select-bordered w-full mt-1">
                  <option value="Cash">Cash</option>
                  <option value="GCash">GCash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                </select>
              </label>
              <label className="text-[10px] text-base-content/60 font-bold block">Reference
                <input type="text" value={payReference} onChange={e => setPayReference(e.target.value)} placeholder="Optional" className="input input-bordered w-full mt-1" />
              </label>
              <label className="text-[10px] text-base-content/60 font-bold block">Date
                <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="input input-bordered w-full mt-1" />
              </label>
            </div>
            <button type="button" onClick={recordPayment} disabled={isRecordingPay || !(parseFloat(payAmount) || createdDue)} className="btn btn-primary btn-block">
              {isRecordingPay ? 'Recording…' : 'Record a payment'}
            </button>
          </div>

          <PrintInvoiceModal
            bookingsToPrint={createdBookingList}
            rooms={rooms}
            venues={venues}
            bookingsList={bookings}
            onClose={onClose}
            embedded
          />
        </div>
        {receiptRecord && receiptBooking && (
          <PrintPaymentReceiptModal booking={receiptBooking} record={receiptRecord} rooms={rooms} venues={venues} onClose={() => setReceiptRecord(null)} />
        )}
      </div>
    </>
  )
}

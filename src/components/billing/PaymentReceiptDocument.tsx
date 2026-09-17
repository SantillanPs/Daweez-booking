import React from 'react'
import { Printer, X } from 'lucide-react'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { receiptNumberFor, paymentBreakdown } from '../../utils/receiptNumber'

interface PaymentReceiptDocumentProps {
  booking: Booking
  record: PaymentRecord
  rooms: Room[]
  venues: Venue[]
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}

const money = (n: number) => '₱' + n.toLocaleString()
const fmtDateTime = (d?: string) => (d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex items-end gap-2 border-b border-slate-400/60 pb-0.5">
      <span className="text-[11px] font-bold whitespace-nowrap text-main">{label}:</span>
      <span className="flex-1 text-[13px] text-main min-h-[18px] break-words">{value || ''}</span>
    </div>
  )
}

// A filled-in payment receipt. Unlike the blank paper form it only shows the
// payment method actually used, the actual payment-for reason, and the real
// status — never a full list of checkboxes.
export function PaymentReceiptDocument({ booking, record, rooms, venues, onClose, onPrint, embedded = false }: PaymentReceiptDocumentProps) {
  const isRoom = !!booking.room_id
  const room = rooms.find(r => r.id === booking.room_id)
  const venue = venues.find(v => v.id === booking.venue_id)
  const unitLabel = isRoom ? 'Room ' + (room?.room_number ?? '') : (venue?.name || '')

  const receiptNo = receiptNumberFor(booking, record)
  // The deposit captured at booking lives in downpayment_paid, not in the
  // payment records, so back it out to reconstruct each receipt's balances.
  const { paidBefore } = paymentBreakdown(booking, record)
  const totalCharge = (Number(booking.downpayment_paid) || 0) + (Number(booking.balance_due) || 0)
  const amountPaid = Number(record.amount) || 0
  const remainingAfter = Math.max(0, totalCharge - (paidBefore + amountPaid))
  const previousBalance = Math.max(0, totalCharge - paidBefore)

  const isFirstPay = paidBefore === 0
  const paymentFor = remainingAfter <= 0 ? (isRoom ? 'Room Accommodation' : 'Event Venue Reservation')
    : isFirstPay ? 'Reservation'
    : 'Partial Payment'
  const statusLine = remainingAfter <= 0 ? 'Paid in Full'
    : paidBefore > 0 ? 'Partially Paid'
    : (isRoom ? 'Booked Confirmed' : 'Venue or Room Reserved')

  const rawMethod = (record.method || '').trim()
  const kind = paymentKind(rawMethod)
  const methodLabel = paymentMethodLabel(rawMethod)
  const showRef = (kind === 'gcash' || kind === 'bank') && !!record.reference

  return (
    <div className={'bg-card w-full max-w-3xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none ' + (embedded ? 'my-0 shadow-xl' : 'my-8')}>
      <div className="flex items-center justify-between px-5 py-3 bg-slate-800 text-white shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-white text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Payment receipt</span>
          <span className="text-xs font-mono text-white/70">{receiptNo}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-6 md:p-10 overflow-y-auto print:p-6 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-4">
          <div>
            <h1 className="font-display font-extrabold text-lg md:text-xl text-slate-800 uppercase tracking-tight">Daweez Pension House</h1>
            <p className="text-[11px] text-slate-600 mt-0.5">San Agustin Sur, Tandag City, Surigao del Sur</p>
            <p className="text-[11px] text-slate-600">Email Address: daweezpensionhouse@gmail.com</p>
            <p className="text-[11px] text-slate-600">Mobile No: 0910-7163830</p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="font-display font-bold text-[15px] text-slate-800 uppercase tracking-widest">Payment Receipt</h2>
            <div className="mt-2 text-[12px] text-slate-700 space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Receipt / Payment No.:</span>
                <span className="font-mono border-b border-slate-400/60">{receiptNo}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Date:</span>
                <span className="font-mono border-b border-slate-400/60">{fmtDateTime(record.paid_at)}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t-2 border-slate-700 my-2" />

        {/* "Received From" is a heading, not a field: it says what the lines
            under it are — who the money came from. Filling it with the guest's
            name printed that name twice and told the reader nothing. */}
        <div className="py-3">
          <p className="text-[12px] font-bold uppercase tracking-wider text-main mb-2">Received From</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-8 gap-y-2">
            <Field label="Guest" value={booking.guest_name} />
            <Field label="Room No" value={unitLabel} />
            <Field label="Status" value={statusLine} />
          </div>
        </div>

        <div className="border-t border-soft py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
          <div className="space-y-2">
            <Field label="Amount Received" value={money(amountPaid)} />
          </div>
          <div className="space-y-2">
            <Field label="Payment For" value={paymentFor} />
            <Field label="Bill / Invoice No." value={booking.invoice_number} />
          </div>
        </div>

        <div className="border-t border-soft py-3 grid grid-cols-3 gap-2">
          <Field label="Previous Balance" value={money(previousBalance)} />
          <Field label="Amount Paid" value={money(amountPaid)} />
          <Field label="Remaining Balance" value={money(remainingAfter)} />
        </div>

        <div className="border-t border-soft py-3 space-y-2">
          <Field label="Payment Method" value={methodLabel} />
          {showRef ? <Field label={kind === 'gcash' ? 'GCash Ref No.' : 'Bank Transfer Ref No.'} value={record.reference} /> : null}
        </div>

        <div className="border-t border-soft py-3 grid grid-cols-2 gap-8">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-main mb-6">Received By</p>
            <p className="border-b border-slate-400/60 text-[11px] text-main min-h-[18px]">{record.prepared_by || booking.prepared_by || ''}</p>
          </div>
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-main mb-6">Guest Signature</p>
            <p className="border-b border-slate-400/60 text-[11px] text-main min-h-[18px]"></p>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-slate-300 text-center">
          <p className="font-display font-bold text-[14px] text-slate-800">Thank you for staying at</p>
          <p className="font-display font-extrabold text-[15px] text-slate-800 uppercase mt-0.5">Daweez Pension House</p>
          <p className="text-[11px] text-slate-500 mt-2">Guest copy · {statusLine}</p>
        </div>
      </div>
    </div>
  )
}

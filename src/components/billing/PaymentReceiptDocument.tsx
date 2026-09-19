import React from 'react'
import { Printer, X } from 'lucide-react'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { receiptNumberFor, paymentBreakdown } from '../../utils/receiptNumber'
import { Block, Row, Rule, fmtDateTime, money } from './receiptPrimitives'

interface PaymentReceiptDocumentProps {
  booking: Booking
  record: PaymentRecord
  rooms: Room[]
  venues: Venue[]
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}

// A filled-in payment receipt, sized for the hotel's 58 mm thermal roll: ONE
// column, no side-by-side tables, black on white (the printer is 1-bit, so grey
// text just dithers into fuzz), and nothing wider than the paper.
//
// The screen preview is the same 58 mm slip rather than a wide page, so what
// staff see is what comes out of the printer.
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
    <div className={'flex flex-col items-center ' + (embedded ? '' : 'w-full')}>
      {!embedded && (
        <div className="w-full max-w-md mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-white print:hidden">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-white text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase shrink-0">Payment receipt</span>
            <span className="text-xs font-mono text-white/70 truncate">{receiptNo}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* The 58 mm slip. Printed width comes from the @page box the modal sets,
          so in print it simply fills that page instead of a fixed 58 mm. */}
      <div className={((embedded ? 'my-0 ' : 'my-2 ') + 'w-[58mm] max-w-full bg-white text-black font-sans leading-snug px-2.5 py-3 ' +
        'print:w-auto print:max-w-none print:px-0 print:py-0 print:my-0 print:shadow-none print:rounded-none')}>
        <div className="text-center">
          <h1 className="font-display font-extrabold text-[13px] uppercase leading-tight">Daweez Pension House</h1>
          <p className="text-[8.5px] mt-0.5">San Agustin Sur, Tandag City</p>
          <p className="text-[8.5px]">Surigao del Sur</p>
          <p className="text-[8.5px] break-all">daweezpensionhouse@gmail.com</p>
          <p className="text-[8.5px]">Mobile No: 0910-7163830</p>
        </div>

        <Rule />

        <div className="text-center">
          <h2 className="font-display font-bold text-[11px] uppercase tracking-widest">Payment Receipt</h2>
          <p className="font-mono text-[10px] font-bold mt-1">{receiptNo}</p>
          <p className="text-[8.5px] mt-0.5">{fmtDateTime(record.paid_at)}</p>
        </div>

        <Rule />

        {/* "Received From" is a heading, not a field: it says what the lines
            under it are — who the money came from. */}
        <p className="text-[8px] font-bold uppercase tracking-wider">Received From</p>
        <Block label="Guest" value={booking.guest_name} />
        <Block label="Room No" value={unitLabel} />
        <Block label="Status" value={statusLine} />

        <Rule />

        <div className="text-center">
          <p className="text-[8px] font-bold uppercase tracking-wider">Amount Received</p>
          <p className="font-display text-[17px] font-extrabold leading-none mt-1">{money(amountPaid)}</p>
        </div>

        <Rule />

        <Block label="Payment For" value={paymentFor} />
        <Block label="Invoice" value={booking.invoice_number} />

        <Rule />

        <Row label="Previous Balance" value={money(previousBalance)} />
        <Row label="Amount Paid" value={money(amountPaid)} />
        <Row label="Remaining Balance" value={money(remainingAfter)} strong />

        <Rule />

        <Row label="Payment Method" value={methodLabel} />
        {showRef ? <Row label={kind === 'gcash' ? 'GCash Ref No.' : 'Bank Ref No.'} value={record.reference || ''} /> : null}

        <Rule />

        <p className="text-[8px] font-bold uppercase tracking-wider">Received By</p>
        <p className="text-[10px] font-semibold mt-0.5 min-h-[12px]">{record.prepared_by || booking.prepared_by || ''}</p>
        <p className="text-[8px] font-bold uppercase tracking-wider mt-2">Guest Signature</p>
        <div className="border-b border-black h-4 mt-0.5" />

        <Rule />

        <div className="text-center">
          <p className="text-[8.5px]">Thank you for staying at</p>
          <p className="font-display font-extrabold text-[10px] uppercase mt-0.5">Daweez Pension House</p>
          <p className="text-[8px] mt-1">Guest copy · {statusLine}</p>
        </div>
      </div>
    </div>
  )
}

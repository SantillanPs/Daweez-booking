import React, { useRef, useState } from 'react'
import { Printer, X } from 'lucide-react'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { receiptNumberFor, paymentBreakdown } from '../../utils/receiptNumber'
import { formatRoomNumbers } from '../../utils/roomNumbers'
import { fmtDateTime, fmtDay, money } from './receiptText'
import { guestEmailOf } from '../../utils/emailDocument'
import { EmailBar, EmailButton } from './EmailBar'

interface PaymentReceiptDocumentProps {
  booking: Booking
  record: PaymentRecord
  rooms: Room[]
  venues: Venue[]
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
  /**
   * Every booking this payment covered, when it covered more than one.
   *
   * **A multi-room payment is one amount written onto every room it paid for**, so the slip must describe the
   * SET — the rooms and their combined balance. Given only the one booking it printed `Room No: Room 2` beside
   * a ₱4,200 payment that had covered four rooms, with a Previous Balance of ₱950 (the owner's receipt,
   * 2026-09-30). Omit it for a single-room payment and the slip is exactly what it always was.
   */
  covered?: Booking[]
}

/** One line of the slip: what it is on the left, the fact on the right. A blank fact prints nothing. */
function SlipRow({ label, value, mono = false }: { label: string; value?: string; mono?: boolean }) {
  const shown = (value ?? '').trim()
  if (!shown) return null
  return (
    <div className="flex items-baseline justify-between gap-2 text-[10px]">
      <span className="shrink-0">{label}</span>
      <span className={'font-bold text-right break-words min-w-0 ' + (mono ? 'font-mono' : '')}>{shown}</span>
    </div>
  )
}

// A filled-in payment receipt, sized for the hotel's 58 mm thermal roll: ONE
// column, no side-by-side tables, black on white (the printer is 1-bit, so grey
// text just dithers into fuzz), and nothing wider than the paper.
//
// The screen preview is the same 58 mm slip rather than a wide page, so what
// staff see is what comes out of the printer.
export function PaymentReceiptDocument({ booking, record, rooms, venues, onClose, onPrint, embedded = false, covered }: PaymentReceiptDocumentProps) {
  const isRoom = !!booking.room_id
  const room = rooms.find(r => r.id === booking.room_id)
  const venue = venues.find(v => v.id === booking.venue_id)

  // **The rooms this payment covered — this one included** (the owner's ruling, 2026-09-30).
  //
  // A multi-room payment is stored on every room it paid for, so the slip has to describe the SET. Without
  // it the receipt printed `Room No: Room 2` beside a **₱4,200** payment that had covered four rooms, with a
  // Previous Balance of **₱950** — one room's figure next to the whole payment, which reads as nonsense (the
  // owner's own receipt, 2026-09-30: *"this is what the receipt says when I book more than 1 room"*).
  const set = covered && covered.length > 1 ? covered : [booking]
  const multi = set.length > 1

  const roomNumbers = set.map(b => rooms.find(r => r.id === b.room_id)?.room_number)
    .filter((n): n is number => typeof n === 'number')
  const venueNames = set.filter(b => b.venue_id)
    .map(b => venues.find(v => v.id === b.venue_id)?.name || '')
    .filter(Boolean)
  const unitLabel = multi
    ? (roomNumbers.length === set.length
        ? formatRoomNumbers(roomNumbers)
        : [...roomNumbers.map(n => 'Room ' + n), ...venueNames].join(', '))
    : isRoom ? 'Room ' + (room?.room_number ?? '') : (venue?.name || '')

  const receiptNo = receiptNumberFor(booking, record)
  // The deposit captured at booking lives in downpayment_paid, not in the
  // payment records, so back it out to reconstruct each receipt's balances.
  // Summed over the SET: the money this receipt answers for is the money that stood against every room it
  // covered, never one room's share of it.
  const totalCharge = set.reduce((sum, b) =>
    sum + (Number(b.downpayment_paid) || 0) + (Number(b.balance_due) || 0), 0)
  const paidBefore = set.reduce((sum, b) => sum + paymentBreakdown(b, record).paidBefore, 0)
  const amountPaid = Number(record.amount) || 0
  const remainingAfter = Math.max(0, totalCharge - (paidBefore + amountPaid))
  const previousBalance = Math.max(0, totalCharge - paidBefore)

  const isFirstPay = paidBefore === 0
  // A payment taken for order slips alone says so, by their numbers.
  const paymentFor = record.slips && record.slips.length > 0 ? 'Order Slip ' + record.slips.join(', ')
    : remainingAfter <= 0 ? (isRoom ? 'Room Accommodation' : 'Event Venue Reservation')
    : isFirstPay ? 'Reservation'
    : 'Partial Payment'

  const rawMethod = (record.method || '').trim()
  const kind = paymentKind(rawMethod)
  const methodLabel = paymentMethodLabel(rawMethod)
  const showRef = (kind === 'gcash' || kind === 'bank') && !!record.reference

  // The slip itself — what is attached when the receipt is emailed.
  const lab = 'text-[8px] font-bold uppercase tracking-[0.1em]'
  const slip = useRef<HTMLDivElement>(null)
  const [emailing, setEmailing] = useState(false)

  return (
    <div className="flex flex-col items-center w-full">
      {/* **The control bar is ALWAYS drawn, embedded or not** — the same rule `StatementShell`
          follows. It used to be hidden while `embedded`, and the booking form hands the
          receipt over embedded, so the receipt that appears after a paid booking arrived with
          **no way to print it and no way to close it** (the owner, 2026-09-29: *"what happened
          to the header? I can't choose to close or print it"*). Whoever shows the paper does
          not also supply the chrome — the document owns it. */}
      <div className="w-full max-w-md mb-3 flex items-center justify-between gap-3 rounded-xl bg-slate-800 px-4 py-2.5 text-white print:hidden">
        <div className="flex items-center gap-2 min-w-0">
          <span className="bg-white text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase shrink-0">Payment receipt</span>
          <span className="text-xs font-mono text-white/70 truncate">{receiptNo}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <EmailButton tone="slate" onClick={() => setEmailing(open => !open)} />
          <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" /> Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {emailing && (
        <EmailBar target={{ kind: 'receipt', number: receiptNo, guestName: booking.guest_name, bookingId: booking.id, to: guestEmailOf(booking) }}
          paper={() => slip.current} size="slip" onClose={() => setEmailing(false)}
          className="w-full max-w-md mb-3 rounded-xl border border-soft px-4 py-3" />
      )}

      {/* The 58 mm slip. Printed width comes from the @page box the modal sets,
          so in print it simply fills that page instead of a fixed 58 mm. */}
      <div ref={slip} className={((embedded ? 'my-0 ' : 'my-2 ') + 'print-slip w-[58mm] max-w-full bg-white text-black font-sans leading-snug px-2.5 py-3 ' +
        'print:w-auto print:max-w-none print:px-0 print:py-0 print:my-0 print:shadow-none print:rounded-none')}>
        <div className="text-center">
          <h1 className="font-display font-extrabold text-[13px] uppercase leading-[1.15]">Daweez<br />Pension House</h1>
          <p className="text-[8.5px] mt-1">San Agustin Sur, Tandag City</p>
          <p className="text-[8.5px]">0910-7163830</p>
        </div>

        <div className="border-t-2 border-black my-2" />

        <div className="flex items-baseline justify-between gap-1.5">
          <span className={lab}>Payment receipt</span>
          <span className="font-mono text-[10.5px] font-bold">{receiptNo}</span>
        </div>
        <p className="text-[8.5px] text-right">{fmtDateTime(record.paid_at)}</p>

        {/* THE AMOUNT, first and largest, white on black (the owner's pick from the drawings,
            2026-10-13). **The black is a border, not a background**: a browser throws
            backgrounds away when it prints, and a slip is deliberately left out of
            `print-color-adjust` (see `index.css`), so a black background would come off the
            roll as white paper with white figures on it — an empty receipt. A border always
            prints. */}
        <div className="relative my-2">
          <div className="border-t-[46px] border-black" />
          <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
            <span className={lab}>Received</span>
            <span className="font-display text-[25px] font-extrabold leading-none mt-1">{money(amountPaid)}</span>
          </div>
        </div>

        <div className="space-y-[3px]">
          <SlipRow label="From" value={booking.guest_name} />
          <SlipRow label={multi ? 'Rooms' : 'Room'} value={unitLabel} />
          {/* A short stay says WHICH day and HOW LONG, so the slip the guest keeps proves
              what was bought — "Room Accommodation" alone could be 3 hours or a night. */}
          {booking.stay_hours ? <SlipRow label="Stay" value={fmtDay(booking.check_in) + ' · ' + booking.stay_hours + ' hours'} /> : null}
          <SlipRow label="For" value={paymentFor} />
          <SlipRow label="Paid by" value={methodLabel} />
          {showRef ? <SlipRow label={kind === 'gcash' ? 'GCash ref no.' : 'Bank ref no.'} value={record.reference || ''} mono /> : null}
          <SlipRow label="Bill no." value={booking.invoice_number} mono />
        </div>

        {/* A settled stay says so once, in a box; a stay with money left shows the sum in plain
            words. The amount is no longer printed twice. */}
        {remainingAfter <= 0 ? (
          <p className="my-2 border-2 border-black py-1.5 text-center font-display text-[13px] font-extrabold uppercase tracking-[0.12em]">Paid in full</p>
        ) : (
          <>
            <div className="border-t border-dashed border-black my-2" />
            <div className="space-y-[3px]">
              <SlipRow label="Bill before" value={money(previousBalance)} mono />
              <SlipRow label="This payment" value={'−' + money(amountPaid)} mono />
              <div className="flex items-baseline justify-between gap-2 border-t-2 border-black pt-1 mt-1 text-[12.5px] font-extrabold">
                <span>Still to pay</span>
                <span className="font-mono">{money(remainingAfter)}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-black my-2" />
          </>
        )}

        {/* No guest signature on the slip (his ruling, 2026-10-13). */}
        <p className={lab}>Received by</p>
        <p className="text-[10.5px] font-bold min-h-[13px]">{record.prepared_by || booking.prepared_by || ''}</p>

        <p className="text-center text-[8.5px] mt-2.5">Thank you for staying with us.</p>
        <p className="text-center text-[8.5px]">Guest copy</p>
      </div>
    </div>
  )
}

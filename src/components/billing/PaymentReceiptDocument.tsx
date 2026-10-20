import React, { useRef, useState } from 'react'
import { Mail, Printer, X } from 'lucide-react'
import { Booking, PaymentRecord, Room, Venue } from '../../types/booking'
import { paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { receiptNumberFor, paymentBreakdown } from '../../utils/receiptNumber'
import { formatRoomNumbers } from '../../utils/roomNumbers'
import { fmtDay, money } from './receiptText'
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
  /** On the Booked card: no dark bar, and Print, Email and Done along the bottom. */
  card?: boolean
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
    <div className="flex items-baseline justify-between gap-2 text-[9px]">
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
export function PaymentReceiptDocument({ booking, record, rooms, venues, onClose, onPrint, embedded = false, covered, card = false }: PaymentReceiptDocumentProps) {
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
  // The label names the kind once and the value is only the numbers. It printed "Room · Room 3"
  // (the receipt trim, 2026-10-18), and a venue was labelled "Room".
  const allRooms = roomNumbers.length === set.length
  const unitTitle = multi ? (allRooms ? 'Rooms' : 'Booked') : isRoom ? 'Room' : 'Venue'
  const unitLabel = multi
    ? (allRooms
        ? formatRoomNumbers(roomNumbers).replace(/^Rooms? /, '')
        : [...roomNumbers.map(n => 'Room ' + n), ...venueNames].join(', '))
    : isRoom ? String(room?.room_number ?? '') : (venue?.name || '')

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

  // Only a payment for order slips says what it was for, by their numbers. "Room Accommodation" /
  // "Partial Payment" repeated what Paid in full or Still to pay already says (the receipt trim, 2026-10-18).
  const slipNumbers = record.slips && record.slips.length > 0 ? record.slips.join(', ') : ''
  // No year: it has to share a line with the receipt number on the 42 mm the roll prints.
  const paidAt = record.paid_at ? new Date(record.paid_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

  const rawMethod = (record.method || '').trim()
  const kind = paymentKind(rawMethod)
  const methodLabel = paymentMethodLabel(rawMethod)
  const showRef = (kind === 'gcash' || kind === 'bank') && !!record.reference

  // The slip itself — what is attached when the receipt is emailed.
  const lab = 'text-[8px] font-bold uppercase tracking-[0.1em]'
  const slip = useRef<HTMLDivElement>(null)
  const [emailing, setEmailing] = useState(false)

  // The slip — the same in the window and on the Booked card. **On screen it is the paper's own
  // size**: the XP-58H prints 48 mm, less the 2 mm / 4 mm sides the print copy gets in `index.css`.
  // At the old 58 mm the window had room the roll did not, so lines that fit on screen wrapped on
  // paper (the receipt number, the owner's photo, 2026-10-18).
  const paper = (
      <div ref={slip} className={((embedded ? 'my-0 ' : 'my-2 ') + 'print-slip w-[48mm] max-w-full bg-white text-black font-sans leading-snug pl-[2mm] pr-[4mm] py-3 ' +
        'print:w-auto print:max-w-none print:px-0 print:py-0 print:my-0 print:shadow-none print:rounded-none')}>
        <div className="text-center">
          <h1 className="font-display font-extrabold text-[12px] uppercase leading-[1.15]">Daweez<br />Pension House</h1>
          <p className="text-[8.5px] mt-1">San Agustin Sur, Tandag City</p>
          <p className="text-[8.5px]">0910-7163830</p>
        </div>

        <div className="border-t-2 border-black my-2" />

        {/* "Payment receipt" up here and "Received" in the box said the same thing; the box
            now says it once (the receipt trim, 2026-10-18). */}
        <div className="flex items-baseline justify-between gap-1 whitespace-nowrap">
          <span className="font-mono text-[9px] font-bold">{receiptNo}</span>
          <span className="text-[8.5px]">{paidAt}</span>
        </div>

        {/* THE AMOUNT, first and largest, in a heavy black frame. It was white on solid black
            (the owner's pick, 2026-10-13), but the XP-58H could not hold it: a thermal head
            streaks a large black block and fills in the thin white strokes, so ₱1,000 came out
            as the tops of its digits (the owner's photo, 2026-10-18). Black figures on white
            print sharp. The frame is a border because a browser drops backgrounds in print. */}
        <div className="my-2 border-[3px] border-black py-1.5 flex flex-col items-center">
          <span className={lab}>Payment received</span>
          <span className="font-display text-[22px] font-extrabold leading-none mt-1">{money(amountPaid)}</span>
        </div>

        <div className="space-y-[3px]">
          <SlipRow label="From" value={booking.guest_name} />
          <SlipRow label={unitTitle} value={unitLabel} />
          {/* A short stay says WHICH day and HOW LONG, so the slip the guest keeps proves
              what was bought — "Room Accommodation" alone could be 3 hours or a night. */}
          {booking.stay_hours ? <SlipRow label="Stay" value={fmtDay(booking.check_in) + ' · ' + booking.stay_hours + ' hours'} /> : null}
          <SlipRow label="For" value={record.purpose || ''} />
          <SlipRow label="Order slip" value={slipNumbers} />
          <SlipRow label="Paid by" value={methodLabel} />
          {showRef ? <SlipRow label={kind === 'gcash' ? 'GCash ref no.' : 'Bank ref no.'} value={record.reference || ''} mono /> : null}
          <SlipRow label="Bill no." value={booking.invoice_number} mono />
        </div>

        {/* A settled stay says so once, in a box; a stay with money left shows the sum in plain
            words. The amount is no longer printed twice. */}
        {remainingAfter <= 0 ? (
          <p className="my-2 border-2 border-black py-1.5 text-center font-display text-[12px] font-extrabold uppercase tracking-[0.12em]">Paid in full</p>
        ) : (
          <>
            <div className="border-t border-dashed border-black my-2" />
            <div className="space-y-[3px]">
              <SlipRow label="Bill before" value={money(previousBalance)} mono />
              <div className="flex items-baseline justify-between gap-2 border-t-2 border-black pt-1 mt-1 text-[11.5px] font-extrabold">
                <span>Still to pay</span>
                <span className="font-mono">{money(remainingAfter)}</span>
              </div>
            </div>
            <div className="border-t border-dashed border-black my-2" />
          </>
        )}

        {/* No guest signature on the slip (his ruling, 2026-10-13). */}
        <p className={lab}>Received by</p>
        <p className="text-[9.5px] font-bold min-h-[13px]">{record.prepared_by || booking.prepared_by || ''}</p>

        {/* No "Guest copy": only one copy is ever printed (the receipt trim, 2026-10-18). */}
        <p className="text-center text-[8.5px] mt-2.5">Thank you for staying with us.</p>
      </div>
  )

  // ON THE BOOKED CARD (the Booked moment mock, 2026-10-16) the slip is handed up from below
  // inside the card, and the card's own row carries Print, Email and Done — the dark bar
  // above it would have said the same thing twice.
  if (card) return (
    <div className="flex flex-col flex-1 min-h-0 w-full">
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex justify-center px-4 pt-4">
        <div className="bk-hand self-start rounded-t-lg border border-b-0 border-soft shadow-sm bg-white">{paper}</div>
      </div>
      {emailing && (
        <EmailBar target={{ kind: 'receipt', number: receiptNo, guestName: booking.guest_name, bookingId: booking.id, to: guestEmailOf(booking) }}
          paper={() => slip.current} size="slip" onClose={() => setEmailing(false)}
          className="border-t border-soft px-4 py-3 print:hidden" />
      )}
      <div className="bk-rise [--d:1.5s] flex items-center gap-2 border-t border-soft px-4 py-3 print:hidden">
        <button type="button" onClick={onPrint} className="min-h-11 px-4 rounded-lg border border-soft text-[14px] font-bold text-main hover:bg-softbg inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-transform">
          <Printer className="w-4 h-4" /> Print
        </button>
        <button type="button" onClick={() => setEmailing(open => !open)} aria-expanded={emailing}
          className={'min-h-11 px-4 rounded-lg border text-[14px] font-bold text-main inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition-[transform,background-color] ' + (emailing ? 'border-gold-400 bg-gold-100' : 'border-soft hover:bg-softbg')}>
          <Mail className="w-4 h-4" /> Email
        </button>
        <button type="button" onClick={onClose} className="ml-auto min-h-11 px-6 flex-1 rounded-lg bg-ink-900 text-white text-[15px] font-bold hover:bg-ink-800 cursor-pointer active:scale-95 transition-transform">Done</button>
      </div>
    </div>
  )

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

      {paper}
    </div>
  )
}

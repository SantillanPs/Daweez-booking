import React from 'react'
import { Printer, X } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getRateConfig } from '../../utils/rateConfig'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { paymentKind, paymentMethodLabel } from '../../utils/paymentMethod'
import { paymentPlanLabel } from '../../utils/bookingMoney'
import { HOTEL_POLICY } from '../../utils/hotelPolicy'
import { shortStayLine, stayHoursOf } from '../../utils/shortStay'
import { fmtTime, fmtStayTime } from './stayLines'
import { StatementChargesTable } from './StatementChargesTable'

interface InvoiceDocumentProps {
  primaryBooking: Booking
  rooms: Room[]
  venues: Venue[]
  statement: Statement
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}

const money = (n: number) => '₱' + n.toLocaleString()

// One labelled line, like the paper form. A field the booking does not hold is
// skipped completely — never printed as an empty labelled blank, which just ate
// vertical space on the statement. (The only deliberate blanks left are the two
// signature lines, which the guest signs by hand.)
function Line({ label, value, className = '' }: { label: string; value?: string; className?: string }) {
  const shown = (value ?? '').toString().trim()
  if (!shown) return null
  return (
    <div className={'flex items-end gap-2 border-b border-slate-400/60 pb-0.5 ' + className}>
      <span className="text-[11px] font-bold whitespace-nowrap text-main">{label}:</span>
      <span className="flex-1 text-[13px] text-main min-h-[18px] break-words">{shown}</span>
    </div>
  )
}

// The printable "Guest Billing Statement" — mirrors the paper form staff fill
// in for walk-ins / Facebook calls, so the printed output looks familiar.
export function InvoiceDocument({ primaryBooking, rooms, venues, statement, onClose, onPrint, embedded = false }: InvoiceDocumentProps) {
  const rates = getRateConfig()
  const payAcct = getPaymentAccounts()
  const b = primaryBooking
  const isRoom = !!b.room_id
  const room = rooms.find(r => r.id === b.room_id)
  const venue = venues.find(v => v.id === b.venue_id)
  const roomType = isRoom ? (room?.name || '') : (venue?.name || '')
  const roomNo = isRoom ? String(room?.room_number ?? '') : ''

  const guestCount = 1 + (b.companions ? b.companions.length : 0)
  const hasCompanions = !!(b.companions && b.companions.length > 0)
  const stayHours = stayHoursOf(b)

  const method = (statement.paymentMethod || '').trim()
  const kind = paymentKind(method)
  const isBank = kind === 'bank'
  const isGcash = kind === 'gcash'
  const methodLabel = method ? paymentMethodLabel(method) : ''

  // The guest's own choice at booking, printed so the statement can never look
  // like it is asking for the whole stay when only a deposit was agreed. A CUSTOM plan
  // names the figure itself — `Custom · ₱1,000 now` — because the word alone says nothing
  // (the owner's ruling, 2026-09); what is due now IS that figure while nothing is paid.
  const planLabel = statement.paymentPlan === 'custom'
    ? 'Custom · ' + money(statement.downpaymentPaid > 0 ? statement.downpaymentPaid : statement.amountDue) + ' now'
    : paymentPlanLabel(statement.paymentPlan || undefined)
  // What the big "Amount Due" figure actually is, spelled out under its label.
  const dueLabel =
    statement.paymentPlan === 'deposit' && statement.downpaymentPaid === 0 ? 'Deposit (50%)'
    : statement.downpaymentPaid > 0 && statement.balanceAfter > 0 ? 'Remaining balance'
    : ''

  return (
    <div className={'print-page bg-card w-full max-w-3xl mx-auto rounded-xl shadow-2xl overflow-hidden flex flex-col print:my-0 print:shadow-none print:rounded-none print:w-full print:max-w-none ' + (embedded ? 'my-0 shadow-xl' : 'my-8')}>
      {/* Modal controls (hidden when printing) */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-800 text-white shrink-0 print:hidden">
        <div className="flex items-center gap-2">
          <span className="bg-white text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Billing statement</span>
          <span className="text-xs font-mono text-white/70">{statement.invoiceNumber}</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onPrint} className="bg-white hover:bg-slate-100 text-slate-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors cursor-pointer">
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors p-1 cursor-pointer" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Printable body */}
      <div className="p-6 md:p-10 overflow-y-auto print:p-6 print:overflow-visible flex-1 bg-card font-sans text-main leading-relaxed print:static">
        {/* Brand header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-3 pb-4">
          <div>
            <h1 className="font-display font-extrabold text-lg md:text-xl text-slate-800 uppercase tracking-tight">Daweez Pension House</h1>
            <p className="text-[11px] text-slate-600 mt-0.5">San Agustin Sur, Tandag City, Surigao del Sur</p>
            <p className="text-[11px] text-slate-600">Email Address: daweezpensionhouse@gmail.com</p>
            <p className="text-[11px] text-slate-600">Mobile No: 0910-7163830</p>
          </div>
          <div className="text-left sm:text-right">
            <h2 className="font-display font-bold text-[15px] text-slate-800 uppercase tracking-widest">Guest Billing Statement</h2>
            <div className="mt-2 text-[12px] text-slate-700 space-y-1">
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Bill / Invoice No.:</span>
                <span className="font-mono border-b border-slate-400/60">{statement.invoiceNumber}</span>
              </div>
              <div className="flex items-center gap-2 justify-end">
                <span className="text-[11px] font-bold whitespace-nowrap">Date Issued:</span>
                <span className="font-mono border-b border-slate-400/60">{statement.dateIssued}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t-2 border-slate-700 my-2" />

        {/* Guest info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 py-3">
          <div className="space-y-2">
            <Line label="Guest's Name" value={b.guest_name} />
            <Line label="Address" value={b.guest_address} />
            <Line label="Email Address" value={b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''} />
            <Line label="Nationality" value={b.guest_nationality} />
          </div>
          <div className="space-y-2">
            <Line label="Birth Date" value={b.birthdate} />
            <Line label="Sex" value={b.guest_gender} />
            <Line label="Contact No." value={b.guest_phone} />
            <Line label="Plate No." value={b.vehicle_plate} />
            <div className="flex items-end gap-2 pb-0.5">
              <span className="text-[11px] font-bold whitespace-nowrap text-main">No. of Guests:</span>
              <span className="text-[13px]">Total <span className="font-mono">{guestCount}</span></span>
            </div>
          </div>
        </div>

        {/* Stay. A SHORT STAY is hours, not nights (the owner's S3 ruling): the stored
            check-out is the next day because the room is taken for the whole day, so
            printing it would name a check-out the guest never had. Before the desk
            presses Check in the bill says `3 hours from arrival`; after that it says
            when the hours run out. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 py-2 border-t border-soft">
          <Line label="Room No." value={roomNo} />
          <Line label="Room Type" value={roomType} />
          <Line label="Check In Date &amp; Time" value={fmtStayTime(b.check_in, b.actual_check_in)} />
          {stayHours > 0 ? (
            <Line label="Short Stay" value={shortStayLine(b.actual_check_in, stayHours)} />
          ) : (
            <>
              <Line label="Check Out Date &amp; Time" value={fmtStayTime(b.check_out, b.actual_check_out)} />
              <Line label="Standard Check-in / Out" value={fmtTime(rates.standardCheckInTime) + ' / ' + fmtTime(rates.standardCheckOutTime)} />
            </>
          )}
        </div>

        {/* Companions — only when there are companions to list. With nobody
            listed the block is dropped entirely rather than printed as an empty
            table, which just ate vertical space on the statement. */}
        {hasCompanions && (
          <div className="py-3 border-t border-soft">
            <p className="text-[12px] font-bold uppercase tracking-wider text-main mb-1.5">Companion</p>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-slate-400/60 text-left text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="py-1 px-1 font-bold w-1/2">Name</th>
                  <th className="py-1 px-1 font-bold w-1/2">Nationality</th>
                </tr>
              </thead>
              <tbody>
                {b.companions!.map((c, i) => (
                  <tr key={i} className="border-b border-slate-300/60">
                    <td className="py-1 px-1 text-[13px]">{c.name}</td>
                    <td className="py-1 px-1 text-[13px] capitalize">{c.nationality || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Charges */}
        <StatementChargesTable items={statement.lineItems} />

        {/* Payment + totals */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-3 border-t-2 border-slate-700">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-main mb-1.5">Payment Method</p>
            {/* The method is chosen during booking (a required field), so the
                statement names one. Older bookings saved before that had no
                method, so they print every way to pay rather than a blank. */}
            {methodLabel ? (
              <div className="flex items-center gap-1.5 text-[12.5px]">
                <span className="inline-flex w-4 h-4 items-center justify-center border border-slate-400 text-[11px] font-bold">✓</span>
                <span className="font-semibold">{methodLabel}</span>
              </div>
            ) : (
              <ul className="space-y-1 text-[12.5px]">
                <li className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 border border-slate-400" /><span className="font-semibold">Cash</span></li>
                <li className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 border border-slate-400" /><span className="font-semibold">GCash</span></li>
                <li className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 border border-slate-400" /><span className="font-semibold">{payAcct.bankName ? payAcct.bankName + ' Transfer' : 'Bank Transfer'}</span></li>
              </ul>
            )}

            {/* What the guest agreed to pay when they booked. Without it the
                statement read as though the whole stay were due at once. */}
            {planLabel && (
              <p className="mt-2 text-[12.5px]">
                <span className="font-bold">Payment Plan:</span>{' '}
                <span className="font-semibold">{planLabel}</span>
              </p>
            )}

            {/* Account details only for the method actually chosen. Nothing to
                transfer to when the guest pays in cash. Older bookings with no
                method at all show every account under "Where to pay". */}
            {isGcash && (
              <div className="mt-3 pt-2 border-t border-dashed border-slate-400 space-y-0.5 text-[11px] text-slate-600">
                <p className="text-[10px] font-bold uppercase tracking-wider text-main mb-1">Account Details</p>
                <p>GCash Name: <strong className="text-main">{payAcct.gcashName}</strong></p>
                <p>GCash No: <strong className="font-mono text-main">{payAcct.gcashNumber}</strong></p>
              </div>
            )}
            {isBank && (
              <div className="mt-3 pt-2 border-t border-dashed border-slate-400 space-y-0.5 text-[11px] text-slate-600">
                <p className="text-[10px] font-bold uppercase tracking-wider text-main mb-1">Account Details</p>
                <p>{payAcct.bankName} Name: <strong className="text-main">{payAcct.bankAccountName}</strong></p>
                <p>{payAcct.bankName} Account No: <strong className="font-mono text-main">{payAcct.bankAccountNumber}</strong></p>
              </div>
            )}
            {!methodLabel && (
              <div className="mt-3 pt-2 border-t border-dashed border-slate-400 space-y-1 text-[11px] text-slate-600">
                <p className="text-[10px] font-bold uppercase tracking-wider text-main">Where to pay</p>
                <p>Cash — at the front desk.</p>
                <p>GCash — <strong className="text-main">{payAcct.gcashName}</strong> · <strong className="font-mono text-main">{payAcct.gcashNumber}</strong></p>
                <p>{payAcct.bankName || 'Bank'} — <strong className="text-main">{payAcct.bankAccountName}</strong> · <strong className="font-mono text-main">{payAcct.bankAccountNumber}</strong></p>
              </div>
            )}
          </div>
          <div className="space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-slate-600">Sub-Total</span><span className="font-mono">{money(statement.subTotal)}</span></div>
            {statement.downpaymentPaid > 0 && (
              <div className="flex justify-between"><span className="text-slate-600">Less: Downpayment/Deposit</span><span className="font-mono">−{money(statement.downpaymentPaid)}</span></div>
            )}
            {statement.partialPayment > 0 && (
              <div className="flex justify-between"><span className="text-slate-600">Less: Partial Payment</span><span className="font-mono">−{money(statement.partialPayment)}</span></div>
            )}
            {statement.other > 0 && (
              <div className="flex justify-between"><span className="text-slate-600">Less: Other</span><span className="font-mono">−{money(statement.other)}</span></div>
            )}
            {statement.securityDeposit > 0 && (
              <div className="flex justify-between"><span className="text-slate-600">Add: Security Deposit</span><span className="font-mono">{money(statement.securityDeposit)}</span></div>
            )}
            <div className="flex justify-between border-t border-slate-400 pt-1.5">
              <span className="font-bold uppercase tracking-wider text-main">
                Amount Due
                {/* Names the figure: the agreed deposit, or what is left of it. */}
                {dueLabel && (
                  <span className="block text-[10px] font-semibold normal-case tracking-normal text-slate-600">{dueLabel}</span>
                )}
              </span>
              <span className="font-display text-[22px] font-extrabold text-slate-900">{money(statement.amountDue)}</span>
            </div>
            {/* The owner read "Balance on arrival" as a second demand on the same
                page. A deposit bill says what is due NOW (named under the figure,
                Deposit (50%)); the rest is the guest's own payment plan, and the
                desk explains it. No second line. */}
          </div>
        </div>

        {/* Pension Policies — the hotel's own wording, VERBATIM (the owner's ruling):
            the guest must read the same text on the bill as on the form they signed.
            Never paraphrase it, and never let the figures drift from the form. */}
        <div className="mt-5 border-t border-dashed border-slate-400 pt-3 space-y-1 text-[9.5px] text-slate-600 leading-snug">
          <p className="text-[10px] font-bold uppercase tracking-wider text-main">Pension Policies</p>
          <p>{HOTEL_POLICY}</p>
        </div>

        {/* Prepared by + Guest Signature */}
        <div className="grid grid-cols-2 gap-6 mt-5 pt-4 border-t border-dashed border-slate-400">
          <div className="flex items-end gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Prepared by:</span>
            <span className="flex-1 text-[12px] font-semibold text-main border-b border-slate-400 min-h-[24px] pb-0.5">{(b.prepared_by || '').trim()}</span>
          </div>
          <div className="flex items-end gap-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Guest Signature:</span>
            <div className="flex-1 border-b border-slate-400 h-6" />
          </div>
        </div>
        <p className="mt-2 text-[9.5px] text-slate-500 italic">By signing this form, I understand and agree to the Pension Policies.</p>
      </div>
    </div>
  )
}
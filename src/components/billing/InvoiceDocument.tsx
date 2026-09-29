import React from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getRateConfig } from '../../utils/rateConfig'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { paymentKind, paymentMethodLabel, shortBankName } from '../../utils/paymentMethod'
import { paymentPlanLabel } from '../../utils/bookingMoney'
import { HOTEL_POLICY } from '../../utils/hotelPolicy'
import { shortStayLine, stayHoursOf } from '../../utils/shortStay'
import { fmtTime, fmtStayTime } from './stayLines'
import { StatementChargesTable } from './StatementChargesTable'
import { StatementShell, BrandHeader, Line } from './StatementShell'

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

// The printable "Guest Billing Statement" for an ordinary booking — the paper form
// staff fill in for walk-ins / Facebook calls. Its charges table is the hotel's own
// (banded, one row per room) since the owner's 2026-09 ruling; everything else is
// exactly as it has always been. **An agency booking does NOT use this document** — it
// gets its own (see `AgencyInvoiceDocument`).
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
  // names the figure itself — `Custom · ₱1,000 now` — because the word alone says nothing.
  const planLabel = statement.paymentPlan === 'custom'
    ? 'Custom · ' + money(statement.downpaymentPaid > 0 ? statement.downpaymentPaid : statement.amountDue) + ' now'
    : paymentPlanLabel(statement.paymentPlan || undefined)
  // What the big "Amount Due" figure actually is, spelled out under its label.
  const dueLabel =
    statement.paymentPlan === 'deposit' && statement.downpaymentPaid === 0 ? 'Deposit (50%)'
    : statement.downpaymentPaid > 0 && statement.balanceAfter > 0 ? 'Remaining balance'
    : ''

  return (
    <StatementShell label="Billing statement" invoiceNumber={statement.invoiceNumber} onClose={onClose} onPrint={onPrint} embedded={embedded}>
      <BrandHeader invoiceNumber={statement.invoiceNumber} dateIssued={statement.dateIssued} />

      {/* Guest and Stay are ONE two-column grid (card k144, the owner's ruling,
          2026-09-29). Every block on this page used to be `grid-cols-1 sm:grid-cols-2`,
          and **A5 is 559px wide while `sm` starts at 640px** — so on paper the breakpoint
          never fired and EVERY block collapsed to a single column. That is why the bill ran
          to 1.4 pages and the bottom was cut. Paired, the same fields take half the height,
          and the guest's two or three lines no longer leave the right half of the sheet
          empty: a field the booking does not hold returns null and the row simply closes
          up, so the stay's fields move left into that space on their own.

          A SHORT STAY is hours, not nights (the owner's S3 ruling): the stored check-out is
          the next day because the room is taken for the whole day, so printing it would name
          a check-out the guest never had. **No rule above this block** — the owner took the
          long line between the guest's name and Room No. out (2026-09), so the two read as
          one form, the way the paper does. */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
        <Line label="Name" value={b.guest_name} />
        <Line label="Room No." value={roomNo} />
        <Line label="Address" value={b.guest_address} />
        <Line label="Type" value={roomType} />
        <Line label="Email" value={b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''} />
        <Line label="Check In" value={fmtStayTime(b.check_in, b.actual_check_in)} />
        <Line label="Nationality" value={b.guest_nationality} />
        {stayHours > 0 ? (
          <Line label="Short Stay" value={shortStayLine(b.actual_check_in, stayHours)} />
        ) : (
          <Line label="Check Out" value={fmtStayTime(b.check_out, b.actual_check_out)} />
        )}
        <Line label="Birth Date" value={b.birthdate} />
        {stayHours === 0 && (
          <Line label="Standard" value={fmtTime(rates.standardCheckInTime) + ' / ' + fmtTime(rates.standardCheckOutTime)} />
        )}
        <Line label="Sex" value={b.guest_gender} />
        <Line label="Guests" value={'Total ' + guestCount} />
        <Line label="Contact" value={b.guest_phone} />
        <Line label="Plate No." value={b.vehicle_plate} />
      </div>

      {/* Companions — only when there are companions to list. */}
      {hasCompanions && (
        <div className="pt-2 border-t border-soft">
          <p className="text-[12px] font-bold uppercase tracking-wider text-main mb-1.5">Companion</p>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-y border-ink-300 text-left text-[10px] uppercase tracking-wider text-ink-600">
                <th className="py-1 px-1 font-bold w-1/2">Name</th>
                <th className="py-1 px-1 font-bold w-1/2">Nationality</th>
              </tr>
            </thead>
            <tbody>
              {b.companions!.map((c, i) => (
                <tr key={i} className="border-b border-ink-200">
                  <td className="py-1 px-1 text-[13px]">{c.name}</td>
                  <td className="py-1 px-1 text-[13px] capitalize">{c.nationality || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StatementChargesTable items={statement.lineItems} />

      {/* Payment + totals, side by side: the tick boxes used to stack down a full-width
          column while the totals sat under them (card k144). The method list is itself two
          columns of ticks, so the block costs half the height it did. */}
      <div className="grid grid-cols-2 gap-6 pt-2 border-t-2 border-ink-700">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-main mb-1.5">Payment Method</p>
          {/* The method is the guest's own choice, so a statement printed before any money
              arrives names none and lists every way to pay instead of a blank. */}
          {methodLabel ? (
            <div className="flex items-center gap-1.5 text-[12.5px]">
              <span className="inline-flex w-4 h-4 items-center justify-center border border-ink-300 text-[11px] font-bold">✓</span>
              <span className="font-semibold">{methodLabel}</span>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[12.5px]">
              <li className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 border border-ink-300" /><span className="font-semibold">Cash</span></li>
              <li className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 border border-ink-300" /><span className="font-semibold">GCash</span></li>
              <li className="flex items-start gap-1.5"><span className="inline-flex w-4 h-4 border border-ink-300 shrink-0" /><span className="font-semibold">{shortBankName(payAcct.bankName) + ' Transfer'}</span></li>
              <li className="flex items-center gap-1.5"><span className="inline-flex w-4 h-4 border border-ink-300" /><span className="font-semibold">Check</span></li>
            </ul>
          )}

          {planLabel && (
            <p className="mt-2 text-[12.5px]">
              <span className="font-bold">Payment Plan:</span>{' '}
              <span className="font-semibold">{planLabel}</span>
            </p>
          )}

          {/* Account details only for the method actually chosen. Nothing to transfer to
              when the guest pays in cash or by check. */}
          {isGcash && (
            <div className="mt-2 pt-1.5 border-t border-dashed border-ink-300 space-y-0.5 text-[11px] text-ink-600">
              <p className="text-[10px] font-bold uppercase tracking-wider text-main mb-1">Account Details</p>
              <p>GCash Name: <strong className="text-main">{payAcct.gcashName}</strong></p>
              <p>GCash No: <strong className="font-mono text-main">{payAcct.gcashNumber}</strong></p>
            </div>
          )}
          {isBank && (
            <div className="mt-2 pt-1.5 border-t border-dashed border-ink-300 space-y-0.5 text-[11px] text-ink-600">
              <p className="text-[10px] font-bold uppercase tracking-wider text-main mb-1">Account Details</p>
              <p>{payAcct.bankName} Name: <strong className="text-main">{payAcct.bankAccountName}</strong></p>
              <p>{payAcct.bankName} Account No: <strong className="font-mono text-main">{payAcct.bankAccountNumber}</strong></p>
            </div>
          )}
          {!methodLabel && (
            <div className="mt-2 pt-1.5 border-t border-dashed border-ink-300 text-[11px] text-ink-600">
              <p className="text-[10px] font-bold uppercase tracking-wider text-main mb-0.5">Where to pay</p>
              {/* One line, not three (card k144): the fallback only shows while no method has
                  been chosen, and three bulleted lines cost 44px of a sheet that had none. */}
              <p>Cash at the front desk · GCash <strong className="text-main">{payAcct.gcashName}</strong> {payAcct.gcashNumber} · {shortBankName(payAcct.bankName)} <strong className="text-main">{payAcct.bankAccountName}</strong> {payAcct.bankAccountNumber}</p>
            </div>
          )}
        </div>
        <div className="space-y-1.5 text-[13px]">
          <div className="flex justify-between"><span className="text-ink-600">Sub-Total</span><span className="font-mono">{money(statement.subTotal)}</span></div>
          {statement.downpaymentPaid > 0 && (
            <div className="flex justify-between"><span className="text-ink-600">Less: Downpayment/Deposit</span><span className="font-mono">−{money(statement.downpaymentPaid)}</span></div>
          )}
          {statement.partialPayment > 0 && (
            <div className="flex justify-between"><span className="text-ink-600">Less: Partial Payment</span><span className="font-mono">−{money(statement.partialPayment)}</span></div>
          )}
          {statement.other > 0 && (
            <div className="flex justify-between"><span className="text-ink-600">Less: Other</span><span className="font-mono">−{money(statement.other)}</span></div>
          )}
          {statement.securityDeposit > 0 && (
            <div className="flex justify-between"><span className="text-ink-600">Add: Security Deposit</span><span className="font-mono">{money(statement.securityDeposit)}</span></div>
          )}
          <div className="flex justify-between border-t border-ink-300 pt-1.5">
            <span className="font-bold uppercase tracking-wider text-main">
              Amount Due
              {dueLabel && (
                <span className="block text-[10px] font-semibold normal-case tracking-normal text-ink-600">{dueLabel}</span>
              )}
            </span>
            <span className="font-display text-[22px] font-extrabold text-ink-900">{money(statement.amountDue)}</span>
          </div>
        </div>
      </div>

      {/* Pension Policies — the hotel's own wording, VERBATIM (the owner's ruling):
          the guest must read the same text on the bill as on the form they signed. */}
      <div className="pt-2 border-t border-dashed border-ink-300 space-y-1 text-[9.5px] text-ink-600 leading-snug">
        <p className="text-[10px] font-bold uppercase tracking-wider text-main">Pension Policies</p>
        <p>{HOTEL_POLICY}</p>
      </div>

      <div className="grid grid-cols-2 gap-6 pt-3 border-t border-dashed border-ink-300">
        <div className="flex items-end gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Prepared by:</span>
          <span className="flex-1 text-[12px] font-semibold text-main border-b border-ink-300 min-h-[24px] pb-0.5">{(b.prepared_by || '').trim()}</span>
        </div>
        <div className="flex items-end gap-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Guest Signature:</span>
          <div className="flex-1 border-b border-ink-300 h-6" />
        </div>
      </div>
      <p className="text-[9.5px] text-ink-500 italic">By signing this form, I understand and agree to the Pension Policies.</p>
    </StatementShell>
  )
}

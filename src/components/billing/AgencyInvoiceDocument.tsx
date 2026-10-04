import React from 'react'
import { Booking } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { guestEmailOf } from '../../utils/emailDocument'
import { StatementChargesTable } from './StatementChargesTable'
import { StatementShell, BrandHeader, Line } from './StatementShell'

const money = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * The **agency's** Guest Billing Statement — the owner's own document (2026-09), read line
 * by line from the hotel's real Provincial Governor's Office bill.
 *
 * It is the hotel's paper, not ours: the charges are the paper's own table (banded, one row
 * per room), the money line is **`TOTAL`** and nothing else, the ways to pay name **both**
 * bank accounts and the GCash number, and the page ends with **`Prepared by`** and the
 * thank-you line — **no Pension Policies and no guest signature**, because a government
 * office files this copy and the guest never signs it.
 *
 * Everything it does NOT do is deliberate: no Sub-Total, no deposit lines, no Amount Due
 * (the office is billed for the whole stay), and `Prepared by` is the very same field the
 * normal bill prints — whoever made the booking, as the owner asked. The normal statement
 * is untouched by any of this and stays in `InvoiceDocument`.
 */
export function AgencyInvoiceDocument({ primaryBooking, statement, onClose, onPrint, embedded = false }: {
  primaryBooking: Booking
  statement: Statement
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}) {
  const acct = getPaymentAccounts()
  const b = primaryBooking

  return (
    <StatementShell label="Billing statement" invoiceNumber={statement.invoiceNumber} onClose={onClose} onPrint={onPrint} embedded={embedded}
      email={{ kind: 'statement', number: statement.invoiceNumber, guestName: statement.companyName, bookingId: b.id, to: guestEmailOf(b) }}>
      {/* The paper's own head: the bill number, and no issue date — the office's copy
          carries `Bill No.` alone. */}
      <BrandHeader invoiceNumber={statement.invoiceNumber} showDate={false} />

      {/* COMPANY above NAME OF GUEST, the guest as `c/o …` — the paper's own order, with
          the paper's own fields: address, email, contact no. and the vehicle plate.
          Two columns with **no `sm:` breakpoint** (card k144): A5 is 559px wide and `sm`
          starts at 640px, so the `sm:grid-cols-2` this used to carry never fired on paper
          and the agency bill stacked too. */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-0.5">
        <div className="space-y-1">
          <Line label="Company" value={statement.companyName} />
          <Line label="Name of Guest" value={'c/o ' + (b.guest_name || '')} />
          <Line label="Address" value={statement.companyAddress || b.guest_address} />
          <Line label="Email Address" value={b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''} />
        </div>
        <div className="space-y-1">
          <Line label="Contact No." value={statement.companyContact || b.guest_phone} />
          <Line label="Vehicle Plate #" value={b.vehicle_plate} />
        </div>
      </div>

      <StatementChargesTable items={statement.lineItems} />

      {/* TOTAL — the whole stay, and nothing about deposits or what is left. */}
      <div className="flex justify-end pt-2 border-t-2 border-ink-700">
        <div className="flex items-baseline gap-6">
          <span className="font-bold uppercase tracking-wider text-main">Total</span>
          <span className="font-display text-[20px] font-extrabold text-ink-900">{money(statement.subTotal)}</span>
        </div>
      </div>

      <div className="pt-3 border-t border-ink-300 space-y-1 text-[12px] text-ink-700">
        <p className="text-[11px] font-bold uppercase tracking-wider text-main">Payment Method: Bank Transfer / Cash / Check</p>
        <p>Bank Name: <strong className="text-main">{acct.bankName}</strong> · Account Name: <strong className="text-main">{acct.bankAccountName}</strong> · Account Number: <strong className="font-mono text-main">{acct.bankAccountNumber}</strong></p>
        {acct.bank2Name && (
          <p>Bank Name: <strong className="text-main">{acct.bank2Name}</strong> · Account Name: <strong className="text-main">{acct.bank2AccountName}</strong> · Account Number: <strong className="font-mono text-main">{acct.bank2AccountNumber}</strong></p>
        )}
        <p>GCash No.: <strong className="font-mono text-main">{acct.gcashNumber}</strong> · Name: <strong className="text-main">{acct.gcashName}</strong></p>
      </div>

      {/* Prepared by — the SAME field the normal bill prints (the owner's note): whoever
          made the booking. No policies, no signature line on this copy.
          `mt-6 pt-4` was **40px** — the biggest single gap in either bill (card k144);
          the two bills now share one spacing scale instead of two. */}
      <div className="pt-3 border-t border-dashed border-ink-300 flex items-end gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-main whitespace-nowrap">Prepared by</span>
        <span className="flex-1 text-[12px] font-semibold text-main border-b border-ink-300 min-h-[24px] pb-0.5">{(b.prepared_by || '').trim()}</span>
      </div>

      <p className="text-center text-[10px] font-bold tracking-wider text-brand-text uppercase">Thank you for choosing Daweez Pension House</p>
    </StatementShell>
  )
}

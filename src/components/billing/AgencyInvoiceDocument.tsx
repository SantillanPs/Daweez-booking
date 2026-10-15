import React from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { getRateConfig } from '../../utils/rateConfig'
import { shortBankName } from '../../utils/paymentMethod'
import { guestEmailOf } from '../../utils/emailDocument'
import { StatementChargesTable } from './StatementChargesTable'
import { StatementGuestStay } from './StatementGuestStay'
import { StatementShell, BrandHeader, SectionName } from './StatementShell'

const money = (n: number) => '₱' + n.toLocaleString()

/**
 * The **agency's** Guest Billing Statement — the owner's own document (2026-09), read line
 * by line from the hotel's real Provincial Governor's Office bill, redrawn on 2026-10-15 in
 * the look of the guest bill (`InvoiceDocument`): the same letterhead, the same three kinds of
 * text, the same table.
 *
 * What makes it the agency's: **Bill to** the agency with the guest as `c/o`, the money line
 * is **`Total`** and nothing else (the office is billed for the whole stay — no Sub-total, no
 * deposit lines, no Amount due), the ways to pay name **both** bank accounts and the GCash
 * number, and the page ends with `Prepared by`, a `Received by` line for the agency, and the
 * thank-you line — **no Pension Policies and no guest signature**, because the office files
 * this copy and the guest never signs it.
 *
 * Each fact is said once (the owner, 2026-10-15): the dates in Stay, not on every row; the
 * rooms in the table, not in Stay.
 */
export function AgencyInvoiceDocument({ primaryBooking, rooms, venues, statement, onClose, onPrint, embedded = false }: {
  primaryBooking: Booking
  rooms: Room[]
  venues: Venue[]
  statement: Statement
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}) {
  const acct = getPaymentAccounts()
  const b = primaryBooking
  const email = b.guest_email && b.guest_email !== 'admin@daweez-booking.vercel.app' ? b.guest_email : ''
  const phone = (b.guest_phone || '').trim() === 'None' ? '' : (b.guest_phone || '').trim()

  const accounts = [
    { name: shortBankName(acct.bankName), holder: acct.bankAccountName, number: acct.bankAccountNumber },
    ...(acct.bank2Name ? [{ name: shortBankName(acct.bank2Name), holder: acct.bank2AccountName || '', number: acct.bank2AccountNumber || '' }] : []),
    { name: 'GCash', holder: acct.gcashName, number: acct.gcashNumber },
  ]

  const label = 'text-[10px] text-muted'

  return (
    <StatementShell label="Billing statement" invoiceNumber={statement.invoiceNumber} onClose={onClose} onPrint={onPrint} embedded={embedded}
      email={{ kind: 'statement', number: statement.invoiceNumber, guestName: statement.companyName, bookingId: b.id, to: guestEmailOf(b) }}>
      {/* The office's copy carries `Bill no.` alone, no issue date. */}
      <BrandHeader invoiceNumber={statement.invoiceNumber} showDate={false} />

      <StatementGuestStay booking={b} rooms={rooms} venues={venues} rates={getRateConfig()}
        billTo={{
          name: statement.companyName,
          lines: [
            statement.companyAddress || (b.guest_address || '').trim(),
            [statement.companyContact || phone, email].filter(Boolean).join(' · '),
          ],
        }} />

      <StatementChargesTable items={statement.lineItems} dates={false} />

      <div className="grid grid-cols-[1fr_200px] gap-6 items-start">
        <div>
          <SectionName>Pay by bank, check or cash</SectionName>
          {/* A bank account number that wraps is how a payer mistypes it (card k144). */}
          {accounts.map((a, i) => (
            <div key={a.name + i} className={i > 0 ? 'mt-1 pt-1 border-t border-ink-200' : ''}>
              <p className="text-[11px] font-bold text-ink-900">{a.name}</p>
              <p className="text-[10.5px] flex gap-2"><span className={label + ' w-[52px] shrink-0'}>Name</span><span className="font-semibold text-ink-900">{a.holder}</span></p>
              <p className="text-[10.5px] flex gap-2"><span className={label + ' w-[52px] shrink-0'}>{a.name === 'GCash' ? 'No.' : 'Acct no.'}</span><span className="font-mono font-semibold text-ink-900 whitespace-nowrap">{a.number}</span></p>
            </div>
          ))}
        </div>

        {/* TOTAL — the whole stay, the one figure the office pays. `print-color-adjust` keeps
            the band black on paper. */}
        <div className="mt-[18px] px-3 py-2 flex items-center justify-between gap-2.5 bg-ink-900 text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">Total</span>
          <span className="font-display text-[22px] font-extrabold leading-none">{money(statement.subTotal)}</span>
        </div>
      </div>

      {/* Prepared by — the same field the guest bill prints: whoever made the booking. */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="h-5 flex items-end pb-0.5 border-b border-ink-900 text-[12px] font-bold text-ink-900">{(b.prepared_by || '').trim()}</p>
          <p className={label + ' mt-0.5'}>Prepared by</p>
        </div>
        <div>
          <p className="h-5 border-b border-ink-900" />
          <p className={label + ' mt-0.5'}>Received by (agency)</p>
        </div>
      </div>

      <p className="pt-1.5 border-t border-ink-200 text-center text-[9.5px] font-bold tracking-[0.12em] text-ink-900 uppercase">Thank you for choosing Daweez Pension House</p>
    </StatementShell>
  )
}

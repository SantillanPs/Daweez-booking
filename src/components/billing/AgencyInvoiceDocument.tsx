import React, { useState } from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { getRateConfig } from '../../utils/rateConfig'
import { paymentMethodLabel, shortBankName } from '../../utils/paymentMethod'
import { guestEmailOf } from '../../utils/emailDocument'
import { StatementChargesTable } from './StatementChargesTable'
import { StatementGuestStay } from './StatementGuestStay'
import { StatementShell, BrandHeader, SectionName } from './StatementShell'
import { AddCharge, BillDeskActions, WritePayment } from './BillDesk'
import { FixPayment } from './FixPayment'
import { CountPeso } from '../CountPeso'

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
 *
 * **The desk works on it like the guest bill** (Sebastian, 2026-10-20: Receive on an agency's
 * stay still opened the old box, "not updated to the current work flow"): a charge is added
 * under the rows, and the money the agency sends is written under Total. Both are the
 * screen's only — the office's paper is still Total and nothing else.
 */
export function AgencyInvoiceDocument({ primaryBooking, rooms, venues, statement, onClose, onPrint, embedded = false, desk }: {
  primaryBooking: Booking
  rooms: Room[]
  venues: Venue[]
  statement: Statement
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
  desk?: BillDeskActions
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
  const figure = 'font-mono text-[11.5px] font-bold text-ink-900'
  const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  // What was on the bill when it opened: anything written after settles in like ink.
  const [opened] = useState(() => new Set([...statement.lineItems.map(i => i.key), ...statement.payments.map(p => p.key)]))
  const isNew = (key: string) => !!desk && !opened.has(key)
  // A payment being written folds the ones above it into one line (the "what for" mock's 3).
  const [writing, setWriting] = useState(false)
  const [column, setColumn] = useState<HTMLDivElement | null>(null)
  const paidUp = statement.amountDue === 0 && statement.payments.length > 0

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
        }} move={desk?.move} />

      <StatementChargesTable items={statement.lineItems} dates={false} onRemove={desk?.onRemove} canRemove={desk?.owns} isNew={isNew} move={desk?.move}>
        {desk?.removed && (
          <tr data-screen key={desk.removed.label} className="print:hidden">
            <td colSpan={4} className="pt-1 text-[10.5px] font-semibold text-muted bw-rise">
              {desk.removed.label} taken off · <button type="button" onClick={desk.onUndo}
                className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
            </td>
          </tr>
        )}
        {desk?.move?.moved && (
          <tr data-screen key={desk.move.moved.label} className="print:hidden">
            <td colSpan={4} className="pt-1 text-[10.5px] font-semibold text-muted bw-rise">
              {desk.move.moved.label} · <button type="button" onClick={desk.move.onUndo}
                className="font-bold text-gold-800 underline underline-offset-2 cursor-pointer">Undo</button>
            </td>
          </tr>
        )}
        {desk && <AddCharge onCharge={desk.onCharge} cols={4} />}
      </StatementChargesTable>

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
        <div className="mt-[18px] flex flex-col gap-2">
        {/* A frame, not a solid black band, to save ink (the owner, 2026-10-24). */}
        <div className="px-3 py-2 flex items-center justify-between gap-2.5 border-[2.5px] border-ink-900 text-ink-900">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">Total</span>
          <span className="font-display text-[22px] font-extrabold leading-none">{money(statement.subTotal)}</span>
        </div>
        {/* What the agency has sent and what it still owes: the desk's, never on paper. */}
        {desk && (
          <div ref={setColumn} data-screen className="relative print:hidden flex flex-col gap-0.5">
            {statement.payments.length > 0 && <p className={label}>Received</p>}
            {writing && statement.payments.length > 0 && (
              <button type="button" data-screen onClick={() => setWriting(false)}
                className="print:hidden w-full flex justify-between items-baseline gap-2.5 py-0.5 border-b border-dashed border-ink-200 text-left cursor-pointer bw-unfold">
                <span className={label}>{statement.payments.length} payment{statement.payments.length === 1 ? '' : 's'} received</span>
                <span className={figure + ' shrink-0'}>−{money(statement.payments.reduce((s, p) => s + p.amount, 0))}</span>
              </button>
            )}
            {statement.payments.map(p => desk.onFix ? (
              <div key={p.key} className={(isNew(p.key) ? 'bill-ink' : '') + (writing ? ' hidden' : '')}>
                <FixPayment p={p} sheet={column} onFix={patch => desk.onFix?.(p.key, patch)} onReceipt={desk.onReceipt} />
              </div>
            ) : (
              <div key={p.key} className={'flex justify-between items-baseline gap-2.5 ' + (isNew(p.key) ? 'bill-ink' : '') + (writing ? ' hidden print:flex' : '')}>
                <span className={label + ' min-w-0'}>
                  {shortDay(p.paidAt)} · {paymentMethodLabel(p.method)}
                  {p.purpose && <> · <span className="font-bold text-ink-900">{p.purpose}</span></>}
                  {p.receipt && <span className="whitespace-nowrap"> · {p.receipt}</span>}
                  {p.receipt && <button type="button" onClick={() => desk.onReceipt(p.receipt)}
                    className="ml-1.5 font-semibold text-gold-800 underline underline-offset-2 cursor-pointer">Receipt</button>}
                </span>
                <span className={figure + ' shrink-0'}>−{money(p.amount)}</span>
              </div>
            ))}
            {statement.amountDue > 0 && (
              <WritePayment key={statement.payments.length} open={writing} onOpen={setWriting} onPay={desk.onPay} again={statement.payments.length > 0} />
            )}
            <div className={'mt-1 flex items-center justify-between gap-2.5 font-bold transition-colors duration-500 ' + (paidUp ? 'text-emerald-700' : 'text-blue-700')}>
              <span className="text-[10px] uppercase tracking-[0.1em]">{paidUp ? 'Paid in full' : 'Agency owes'}</span>
              <span className="font-display text-[18px] font-extrabold leading-none"><CountPeso value={statement.amountDue} /></span>
            </div>
          </div>
        )}
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

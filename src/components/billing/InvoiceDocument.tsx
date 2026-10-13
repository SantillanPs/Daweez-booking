import React from 'react'
import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getRateConfig } from '../../utils/rateConfig'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { paymentKind, paymentMethodLabel, shortBankName } from '../../utils/paymentMethod'
import { paymentPlanLabel } from '../../utils/bookingMoney'
import { HOTEL_POLICY } from '../../utils/hotelPolicy'
import { guestEmailOf } from '../../utils/emailDocument'
import { StatementChargesTable } from './StatementChargesTable'
import { StatementGuestStay } from './StatementGuestStay'
import { StatementShell, BrandHeader, SectionName } from './StatementShell'

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
const shortDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')

// The printable "Guest Billing Statement" for an ordinary booking — the paper form
// staff fill in for walk-ins / Facebook calls. Its charges table is the hotel's own
// (banded, one row per room) since the owner's 2026-09 ruling; everything else is
// exactly as it has always been. **An agency booking does NOT use this document** — it
// gets its own (see `AgencyInvoiceDocument`).
export function InvoiceDocument({ primaryBooking, rooms, venues, statement, onClose, onPrint, embedded = false }: InvoiceDocumentProps) {
  const rates = getRateConfig()
  const payAcct = getPaymentAccounts()
  const b = primaryBooking

  // Everything about the guest's and the stay's own fields — which fields, in what order,
  // under which heading — lives in `StatementGuestStay`. This file no longer needs the
  // room lookup, the stay hours or the email guard that only those sections used.
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
  // Money received with no numbered receipt behind it (old and imported bookings).
  const earlierPaid = Math.max(0, statement.downpaymentPaid - statement.payments.reduce((sum, p) => sum + p.amount, 0))
  // What the big "Amount Due" figure actually is, spelled out under its label.
  const dueLabel =
    statement.paymentPlan === 'deposit' && statement.downpaymentPaid === 0 ? 'Deposit (50%)'
    : statement.downpaymentPaid > 0 && statement.balanceAfter > 0 ? 'Remaining balance'
    : ''

  // The page's three kinds of text (see `SectionName`): a grey label, the black information,
  // and a black figure.
  const label = 'text-[10px] text-muted'
  const info = 'text-[11.5px] font-semibold text-ink-900'
  const figure = 'font-mono text-[11.5px] font-bold text-ink-900'

  return (
    <StatementShell label="Billing statement" invoiceNumber={statement.invoiceNumber} onClose={onClose} onPrint={onPrint} embedded={embedded}
      email={{ kind: 'statement', number: statement.invoiceNumber, guestName: b.guest_name, bookingId: b.id, to: guestEmailOf(b) }}>
      <BrandHeader invoiceNumber={statement.invoiceNumber} dateIssued={statement.dateIssued} />

      {/* GUEST beside STAY, the companions with the guest. Everything about their arrangement
          lives in `StatementGuestStay`. */}
      <StatementGuestStay booking={b} rooms={rooms} venues={venues} rates={rates} roomsLabel={statement.roomsLabel} />

      {/* No name over the table: he found a lone `Charges` *"out of place … taking so much
          space for itself"* (2026-10-13). Its column names say what it is. */}
      <StatementChargesTable items={statement.lineItems} />

      {/* PAYMENT beside the totals, always two columns (card k144: A5 never reaches `sm`).
          The page's one rule holds here too: a grey label, then the black information. */}
      <div className="grid grid-cols-[1fr_236px] gap-6 items-start">
        <div>
          <SectionName>Payment</SectionName>
          <div className="grid grid-cols-[auto_1fr] items-baseline gap-x-2.5 gap-y-[3px]">
            {/* Only the method that was chosen is named, and only its account is shown — the
                sheet prints only what applies. */}
            {methodLabel && <><span className={label}>Paid by</span><span className={info}>{methodLabel}</span></>}
            {planLabel && <><span className={label}>Plan</span><span className={info}>{planLabel}</span></>}
            {isGcash && (
              <>
                <span className={label}>GCash name</span><span className={info}>{payAcct.gcashName}</span>
                <span className={label}>GCash no.</span><span className={info + ' font-mono whitespace-nowrap'}>{payAcct.gcashNumber}</span>
              </>
            )}
            {isBank && (
              <>
                <span className={label}>{shortBankName(payAcct.bankName)} name</span><span className={info}>{payAcct.bankAccountName}</span>
                <span className={label}>Account no.</span><span className={info + ' font-mono whitespace-nowrap'}>{payAcct.bankAccountNumber}</span>
              </>
            )}
            {/* No method yet: every way to pay, one row each. **A bank account number that
                wraps is how a guest mistypes it** (card k144), so the numbers never wrap. */}
            {!methodLabel && (
              <>
                <span className={label}>Cash</span><span className={info}>at the front desk</span>
                <span className={label}>GCash</span>
                <span className={info}>{payAcct.gcashName} · <span className="font-mono whitespace-nowrap">{payAcct.gcashNumber}</span></span>
                <span className={label}>{shortBankName(payAcct.bankName)}</span>
                <span className={info}>{payAcct.bankAccountName} · <span className="font-mono whitespace-nowrap">{payAcct.bankAccountNumber}</span></span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-0.5">
          <div className="flex justify-between gap-2.5"><span className={label}>Sub-total</span><span className={figure}>{money(statement.subTotal)}</span></div>
          {/* The bill lists the payments already received (the staff, 2026-10-04: it showed
              what was still to pay but not what had been paid). Money received before
              receipts were numbered has no line of its own, so it keeps its single figure. */}
          {statement.payments.length > 0 && (
            <div>
              <p className={label}>Less: payments received</p>
              {statement.payments.map(p => (
                <div key={p.key} className="flex justify-between gap-2.5">
                  <span className={label + ' min-w-0'}>
                    {shortDay(p.paidAt)} · {paymentMethodLabel(p.method)}
                    {p.receipt && <span className="whitespace-nowrap"> · {p.receipt}</span>}
                  </span>
                  <span className={figure + ' shrink-0'}>−{money(p.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {earlierPaid > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Less: downpayment / deposit</span><span className={figure}>−{money(earlierPaid)}</span></div>
          )}
          {statement.partialPayment > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Less: partial payment</span><span className={figure}>−{money(statement.partialPayment)}</span></div>
          )}
          {statement.other > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Less: other</span><span className={figure}>−{money(statement.other)}</span></div>
          )}
          {statement.securityDeposit > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Add: security deposit</span><span className={figure}>{money(statement.securityDeposit)}</span></div>
          )}
          {/* THE CONCLUSION: one solid band, the largest thing on the page. It reaches 12px
              past the column on both sides so its words and its figure line up with the
              rows above and with the table's Total column (he called the first drawing's
              band *"crooked"*). `print-color-adjust` keeps it black on paper. */}
          <div className="mt-1 -mx-3 px-3 py-1.5 flex items-center justify-between gap-2.5 bg-ink-900 text-white [print-color-adjust:exact] [-webkit-print-color-adjust:exact]">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">
              Amount due
              {dueLabel && <span className="block text-[9px] font-normal normal-case tracking-normal mt-px">{dueLabel}</span>}
            </span>
            <span className="font-display text-[24px] font-extrabold leading-none">{money(statement.amountDue)}</span>
          </div>
        </div>
      </div>

      {/* PENSION POLICIES — word for word from the paper form (`utils/hotelPolicy.ts`): the
          guest must read the same text on the bill as on the form they signed. */}
      <div className="pt-1.5 border-t border-ink-200 text-[9px] text-ink-800 leading-tight">
        <SectionName bare>Pension Policies</SectionName>
        <p>{HOTEL_POLICY}</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="h-5 flex items-end pb-0.5 border-b border-ink-900 text-[12px] font-bold text-ink-900">{(b.prepared_by || '').trim()}</p>
          <p className={label + ' mt-0.5'}>Prepared by</p>
        </div>
        <div>
          <p className="h-5 border-b border-ink-900" />
          <p className={label + ' mt-0.5'}>Guest signature</p>
        </div>
      </div>
      <p className="text-[8.5px] text-ink-600 italic">By signing this form, I understand and agree to the Pension Policies.</p>
    </StatementShell>
  )
}

import { Booking, Room, Venue } from '../../types/booking'
import { Statement } from '../../utils/statement'
import { getRateConfig } from '../../utils/rateConfig'
import { getPaymentAccounts } from '../../utils/paymentAccounts'
import { paymentKind, paymentMethodLabel, shortBankName } from '../../utils/paymentMethod'
import { paymentPlanLabel } from '../../utils/bookingMoney'
import { HOTEL_POLICY } from '../../utils/hotelPolicy'
import { guestEmailOf } from '../../utils/emailDocument'
import React from 'react'
import { StatementChargesTable, PaperExtras } from './StatementChargesTable'
import { foldAlikeRooms } from '../../utils/statementLines'
import { StatementGuestStay } from './StatementGuestStay'
import { StatementShell, BrandHeader, SectionName } from './StatementShell'
import { CancelledStamp } from './CancelledStamp'
import { peso } from '../../utils/helpers'

interface InvoiceDocumentProps {
  primaryBooking: Booking
  rooms: Room[]
  venues: Venue[]
  statement: Statement
  onClose: () => void
  onPrint: () => void
  embedded?: boolean
}

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
  // names the figure itself — `Deposit · ₱1,000 now` (it was `Custom` until 2026-10-21) — because the word alone says nothing.
  const planLabel = statement.paymentPlan === 'custom'
    ? 'Deposit · ' + peso(statement.downpaymentPaid > 0 ? statement.downpaymentPaid : statement.amountDue) + ' now'
    : paymentPlanLabel(statement.paymentPlan || undefined)
  // Money received with no numbered receipt behind it (old and imported bookings).
  const earlierPaid = Math.max(0, statement.downpaymentPaid - statement.payments.reduce((sum, p) => sum + p.amount, 0))
  // What the big "Amount Due" figure actually is, spelled out under its label.
  const dueLabel = statement.paymentPlan === 'deposit' && statement.downpaymentPaid === 0 ? 'Deposit (50%)'
    : statement.downpaymentPaid > 0 && statement.balanceAfter > 0 ? 'Remaining balance'
    : ''
  // More received than the bill comes to: below zero, in green, as on the bill on screen (2026-11-13).
  const over = primaryBooking.status !== 'cancelled' && statement.subTotal > 0 && statement.amountDue === 0
    ? Math.max(0, statement.downpaymentPaid - statement.subTotal) : 0

  // The page's three kinds of text (see `SectionName`): a grey label, the black information,
  // and a black figure.
  const label = 'text-[10px] text-muted'
  const info = 'text-[11.5px] font-semibold text-ink-900'
  const figure = 'font-mono text-[11.5px] font-bold text-ink-900 tabular-nums whitespace-nowrap'
  const group = 'mt-1 pb-px border-b border-ink-200 text-[8.5px] font-extrabold uppercase tracking-[0.12em] text-ink-900'
  const item = 'min-w-0 truncate text-[10.5px] font-semibold text-ink-900 leading-snug'

  // Alike rooms share a row on paper, and the discounts leave the table for the totals.
  const lines = foldAlikeRooms(statement.lineItems)
  const discounts = lines.filter(i => i.band === 'discount')
  const discountOff = -discounts.reduce((s, d) => s + d.amount, 0)

  return (
    <StatementShell label="Billing statement" invoiceNumber={statement.invoiceNumber} onClose={onClose} onPrint={onPrint} embedded={embedded}
      email={{ kind: 'statement', number: statement.invoiceNumber, guestName: b.guest_name, bookingId: b.id, to: guestEmailOf(b) }}>
      <BrandHeader invoiceNumber={statement.invoiceNumber} dateIssued={statement.dateIssued} />

      {/* GUEST beside STAY, the companions with the guest. Everything about their arrangement
          lives in `StatementGuestStay`. */}
      <StatementGuestStay booking={b} rooms={rooms} venues={venues} rates={rates} roomsLabel={statement.roomsLabel} />

      {/* No name over the table: he found a lone `Charges` *"out of place … taking so much
          space for itself"* (2026-10-13). Its column names say what it is. */}
      <StatementChargesTable items={lines} paper />

      {/* PAYMENT beside the totals, always two columns (card k144: A5 never reaches `sm`).
          The page's one rule holds here too: a grey label, then the black information. */}
      {/* PAYMENT, the Pension Policies and the signatures are for the paper (Sebastian,
          2026-10-20: *"This should only show up when printed"*); on screen the totals, where
          the desk works, stand alone. The emailed copy is the paper (`data-paper`). The extras
          sit above Payment, in the room the totals leave beside it (the long-bill mock). */}
      <div className="grid grid-cols-[1fr_262px] gap-6 items-start">
        <div className="flex flex-col gap-2">
        <PaperExtras items={lines} />
        <div data-paper className="hidden print:block">
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
        </div>

        {/* THE TOTALS IN THREE STEPS (Sebastian, 2026-11-06, the long-bill mock: "add some visual
            hierarchy … I want the payments and discount to be easily readable"): what it came to,
            what was taken off, what was paid. A small capital name over each group, the item in ink,
            the date and receipt quiet, every figure in one right-hand column. */}
        <div className="relative col-start-2 flex flex-col gap-px">
          <CancelledStamp booking={b} />
          <div className="flex justify-between gap-2.5"><span className={label}>Sub-total</span><span className={figure}>{peso(statement.subTotal + discountOff)}</span></div>
          {discounts.length > 0 && (
            <>
              <span className={group}>Discount</span>
              {discounts.map(d => (
                <div key={d.key} className="flex justify-between items-baseline gap-2.5">
                  <span className={item}>{d.description}</span><span className={figure}>{peso(d.amount)}</span>
                </div>
              ))}
            </>
          )}
          {/* The bill lists the payments already received (the staff, 2026-10-04: it showed
              what was still to pay but not what had been paid). Money received before
              receipts were numbered has no line of its own, so it keeps its single figure.
              How it was paid shows only when it is not the bill's own Paid by. */}
          {statement.payments.length > 0 && (
            <>
              <span className={group}>Payments <span className="ml-0.5 font-bold text-muted">{statement.payments.length}</span></span>
              <div className="grid grid-cols-[auto_1fr_auto_auto] items-baseline gap-x-2">
                {statement.payments.map(p => (
                  <React.Fragment key={p.key}>
                    <span className="font-mono text-[9.5px] text-muted whitespace-nowrap">{shortDay(p.paidAt)}</span>
                    <span className={item}>
                      {p.purpose || paymentMethodLabel(p.method)}
                      {p.purpose && p.method && p.method !== method && <span className="font-medium text-muted"> · {paymentMethodLabel(p.method)}</span>}
                    </span>
                    <span className="font-mono text-[8.5px] text-muted whitespace-nowrap">{p.receipt}</span>
                    <span className={figure + ' justify-self-end'}>−{peso(p.amount)}</span>
                  </React.Fragment>
                ))}
              </div>
              {statement.payments.length > 1 && (
                <div className="mt-0.5 pt-0.5 flex justify-between gap-2.5 border-t-[1.5px] border-ink-900">
                  <span className="text-[10px] font-bold text-ink-900">Total paid</span>
                  <span className={figure}>−{peso(statement.payments.reduce((s, p) => s + p.amount, 0))}</span>
                </div>
              )}
            </>
          )}
          {earlierPaid > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Less: downpayment / deposit</span><span className={figure}>−{peso(earlierPaid)}</span></div>
          )}
          {statement.partialPayment > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Less: partial payment</span><span className={figure}>−{peso(statement.partialPayment)}</span></div>
          )}
          {statement.other > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Less: other</span><span className={figure}>−{peso(statement.other)}</span></div>
          )}
          {statement.securityDeposit > 0 && (
            <div className="flex justify-between gap-2.5"><span className={label}>Add: security deposit</span><span className={figure}>{peso(statement.securityDeposit)}</span></div>
          )}
          {/* THE CONCLUSION: one framed band, the largest thing on the page. It reaches 12px
              past the column on both sides so its words and its figure line up with the
              rows above and with the table's Total column (he called the first drawing's
              band *"crooked"*). A frame, not a solid black band, so a bill does not spend
              the ink (the owner, 2026-10-24: "make the total hollow"). */}
          <div className={'mt-1 -mx-3 px-3 py-1.5 flex items-center justify-between gap-2.5 border-[2.5px] border-ink-900 text-ink-900'}>
            <span className="text-[9.5px] font-bold uppercase tracking-[0.1em]">
              Amount due
              {dueLabel && <span className="block text-[9px] font-normal normal-case tracking-normal mt-px">{dueLabel}</span>}
            </span>
            <span className={'font-display text-[24px] font-extrabold leading-none' + (over > 0 ? ' text-emerald-700' : '')}>{over > 0 ? '−' + peso(over) : peso(statement.amountDue)}</span>
          </div>
        </div>
      </div>

      {/* PENSION POLICIES — word for word from the paper form (`utils/hotelPolicy.ts`): the
          guest must read the same text on the bill as on the form they signed. */}
      <div data-paper className="hidden print:block pt-1.5 border-t border-ink-200 text-[9px] text-ink-800 leading-tight">
        <SectionName bare>Pension Policies</SectionName>
        {/* The signing line ends the policies' last line instead of taking a row of its own: a
            group's bill was 15px past one A5 sheet (the long-bill check, 2026-11-06). */}
        <p>{HOTEL_POLICY} <span className="text-[8.5px] text-ink-600 italic">By signing this form, I understand and agree to the Pension Policies.</span></p>
      </div>

      <div data-paper className="hidden print:block"><div className="grid grid-cols-2 gap-6">
        <div>
          <p className="h-5 flex items-end pb-0.5 border-b border-ink-900 text-[12px] font-bold text-ink-900">{(b.prepared_by || '').trim()}</p>
          <p className={label + ' mt-0.5'}>Prepared by</p>
        </div>
        <div>
          <p className="h-5 border-b border-ink-900" />
          <p className={label + ' mt-0.5'}>Guest signature</p>
        </div>
      </div>
      </div>
    </StatementShell>
  )
}

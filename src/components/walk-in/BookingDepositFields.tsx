import React from 'react'
import { Wallet, type LucideIcon } from 'lucide-react'
import { NumInput } from '../NumInput'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind } from '../../utils/paymentMethod'

export type PayPlan = 'deposit' | 'full' | 'custom' | 'reservation'
/** A way to pay, or `''` for "the desk has not picked yet" — a real, deliberate state. */
export type PayMethod = (typeof PAYMENT_METHODS)[number] | ''

interface BookingDepositFieldsProps {
  /** What the stay comes to — half of it is the deposit, all of it is Full pay. */
  estTotal: number
  /** Deposit (the default) · Full pay · Custom — the owner's ruling, 2026-09. */
  plan: PayPlan
  setPlan: (plan: PayPlan) => void
  /** What the guest hands over now. Only Custom is typed; the other two are read-only. */
  agreedDeposit: number
  setAgreedDeposit: (v: number) => void
  /**
   * **How the guest pays** (the owner's ruling, 2026-09-29). The form now takes the money
   * as well as the plan, because that is what really happens: the guest is asked deposit
   * or full pay **and how they will pay it** in the same breath, and the desk writes both
   * down. Empty until the desk picks — a silent `Cash` is how a GCash guest once got a Cash
   * receipt.
   */
  method: PayMethod
  setMethod: (m: PayMethod) => void
  /** GCash and bank transfers only; the form refuses to finish without it. */
  reference: string
  setReference: (r: string) => void
  /**
   * **A short stay (the printed rate board)** — already paid in full at the counter, so
   * there is no plan to choose and no figure to work out: the gold notice above this card
   * states the amount, and all that is left here is **how the guest paid**. The card
   * therefore shows the `Paid by` row alone. (Without this the method row was never
   * rendered for a short stay while the form still demanded one, so the form could never
   * be confirmed at all.)
   */
  shortStay?: boolean
  /** Correcting an existing booking: its invoice number and its figures. */
  isEditMode: boolean
  formInvoiceNumber: string
  setFormInvoiceNumber: (v: string) => void
  formDownpaymentPaid: number
  setFormDownpaymentPaid: (v: number) => void
  formBalanceDue: number | null
  setFormBalanceDue: (v: number | null) => void
  formSecurityDeposit: number | null
  setFormSecurityDeposit: (v: number | null) => void
}

const peso = (n: number) => '₱' + Math.round(n || 0).toLocaleString()
const input = 'input input-bordered w-full text-sm'
const label = 'text-[10px] text-base-content/60 font-bold'
/** Every row of the money block starts with this one fixed column. */
const LABEL_COL = 'flex items-center gap-1.5 shrink-0 w-[104px]'

/**
 * The label cell every row shares, so `Discount`, `Pays now` and `Paid by` line up and
 * `None`, `Deposit` and `Cash` all begin on the same vertical line. A row without a mark
 * gets an empty 16px slot rather than no slot, which is what keeps that line straight.
 */
function RowLabel({ icon: Icon, children }: { icon?: LucideIcon; children: React.ReactNode }) {
  return (
    <span className={LABEL_COL}>
      {Icon ? (
        <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-2.5 h-2.5" />
        </span>
      ) : (
        <span className="w-4 h-4 shrink-0" aria-hidden="true" />
      )}
      <span className="text-[10px] font-bold text-base-content/70 whitespace-nowrap">{children}</span>
    </span>
  )
}

/**
 * What the guest pays now, and how (cards k126, k130 and the owner's 2026-09 rulings).
 *
 * **Every row is one line, on one line-up** (the owner's 2026-09-29 layout fix, after he
 * saw the first build and said *"it looks messy. everything is all over the place"*): a
 * 104px label column, then a [SegmentedControl] that **fills the rest**, so the three
 * choosers share both edges instead of each ending somewhere different. The figures moved
 * to their own right-hand line — they used to ride the `Pays now` row and jumped when the
 * plan changed. The grey sentence that explained the method row is **gone**: it was a row
 * spent on a sentence, and the red line under Confirm already says the same words.
 *
 * - **Deposit is the standard** and already chosen; **Deposit and Full pay are READ-ONLY**
 *   figures (half the stay, or the whole stay) — only Custom is typed, on its own row.
 * - **Nothing is preselected on the method row**, and the form refuses to finish without
 *   one; GCash and bank also wait for the reference the guest is reading out.
 * - **A Reservation pays nothing**, so it asks for no method and prints no figure.
 */
export function BookingDepositFields({
  estTotal,
  plan,
  setPlan,
  agreedDeposit,
  setAgreedDeposit,
  method,
  setMethod,
  reference,
  setReference,
  shortStay = false,
  isEditMode,
  formInvoiceNumber,
  setFormInvoiceNumber,
  formDownpaymentPaid,
  setFormDownpaymentPaid,
  formBalanceDue,
  setFormBalanceDue,
  formSecurityDeposit,
  setFormSecurityDeposit,
}: BookingDepositFieldsProps) {
  const half = Math.max(0, Math.round(estTotal / 2))
  const now = plan === 'full' ? Math.round(estTotal) : plan === 'deposit' ? half : plan === 'reservation' ? 0 : Math.round(agreedDeposit)
  const options: SegmentOption<PayPlan>[] = [
    { key: 'deposit', label: 'Deposit', hint: `Half the stay — ${peso(half)}. The rest is collected at check-out.` },
    { key: 'full', label: 'Full pay', hint: `The whole stay — ${peso(estTotal)}. Nothing left at check-out.` },
    { key: 'custom', label: 'Custom', hint: 'Any figure the guest hands over now. The rest stays owed with the stay.' },
    // The owner's ruling, 2026-09-28: a room held for somebody the staff personally know
    // and trust. Nothing is paid and nothing is agreed, so no figure is shown anywhere —
    // the stay reads **Reserved**, not Unpaid, until the guest arrives.
    { key: 'reservation', label: 'Reservation', hint: 'A hold for a guest the staff know — nothing paid now. They settle when they arrive to check in.' },
  ]

  // A Reservation pays nothing, so there is no method to ask for.
  const asksForMoney = shortStay || plan !== 'reservation'
  const needsRef = methodNeedsReference(method || undefined)
  const methodOptions: SegmentOption<PayMethod>[] = PAYMENT_METHODS.map(m => ({ key: m as PayMethod, label: m }))
  const refLabel = paymentKind(method || undefined) === 'gcash' ? 'GCash ref no.' : 'Reference no.'

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-2 space-y-2">
      {/* What the guest pays now — a short stay already paid in full has no plan to choose. */}
      {!shortStay && (
        <div className="flex items-center gap-2">
          <RowLabel icon={Wallet}>Pays now</RowLabel>
          <SegmentedControl options={options} value={plan} onChange={setPlan} label="What the guest pays now" />
        </div>
      )}

      {/* ── How the guest pays — the row that takes the money (2026-09-29) ── */}
      {asksForMoney && (
        <div className="flex items-center gap-2">
          <RowLabel>Paid by</RowLabel>
          <SegmentedControl options={methodOptions} value={method} onChange={setMethod} label="How the guest pays" />
        </div>
      )}

      {/* GCash and bank transfers only, and only once one of them is picked. */}
      {needsRef && (
        <div className="flex items-center gap-2">
          <RowLabel>{refLabel}</RowLabel>
          <input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="From the guest's phone"
            aria-label={refLabel}
            className="input input-bordered input-sm flex-1 min-w-0 font-mono"
          />
        </div>
      )}

      {/* The money, on its own right-hand line — a stable home, so it never jumps when the
          plan changes. Only Custom is typed, and it is typed on the row above this one. */}
      {!shortStay && (
        plan === 'custom' ? (
          <div className="flex items-center gap-2">
            <RowLabel>Amount</RowLabel>
            <NumInput value={agreedDeposit} onChange={setAgreedDeposit} aria-label="Amount the guest pays now"
              className="input input-bordered input-sm flex-1 min-w-0 text-right font-mono" />
          </div>
        ) : plan === 'reservation' ? (
          <p className="text-right text-[10px] font-semibold text-base-content/60">nothing now · pays at check-in</p>
        ) : (
          <p className="text-right flex items-baseline justify-end gap-1.5">
            <b className="font-mono font-bold text-[15px] text-base-content">{peso(now)}</b>
            <i className="not-italic text-[10px] font-semibold text-base-content/60">
              {plan === 'full' ? 'paid in full' : `of ${peso(estTotal)}`}
            </i>
          </p>
        )
      )}

      {isEditMode && (
        <div className="border border-base-300 rounded-lg p-2.5 bg-base-100/40 space-y-2">
          <p className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">Correcting this booking</p>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className={label}>Already received (₱)</span>
              <input type="text" inputMode="decimal" value={formDownpaymentPaid || ''}
                onChange={e => setFormDownpaymentPaid(parseFloat(e.target.value) || 0)} className={input} />
            </label>
            <label className="block">
              <span className={label}>Balance due (₱)</span>
              <input type="text" inputMode="decimal" value={formBalanceDue ?? ''}
                onChange={e => setFormBalanceDue(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Worked out from the stay" className={input} />
            </label>
            <label className="block">
              <span className={label}>Security deposit (₱)</span>
              <input type="text" inputMode="decimal" value={formSecurityDeposit ?? ''}
                onChange={e => setFormSecurityDeposit(e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="Optional" className={input} />
            </label>
            <label className="block">
              <span className={label}>Invoice number</span>
              <input value={formInvoiceNumber} onChange={e => setFormInvoiceNumber(e.target.value)}
                placeholder="Given one if left empty" className={input} />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

import React from 'react'
import { Wallet } from 'lucide-react'
import { NumInput } from '../NumInput'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'

export type PayPlan = 'deposit' | 'full' | 'custom'

interface BookingDepositFieldsProps {
  /** What the stay comes to — half of it is the deposit, all of it is Full pay. */
  estTotal: number
  /** Deposit (the default) · Full pay · Custom — the owner's ruling, 2026-09. */
  plan: PayPlan
  setPlan: (plan: PayPlan) => void
  /** What the guest hands over now. Only Custom is typed; the other two are read-only. */
  agreedDeposit: number
  setAgreedDeposit: (v: number) => void
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

/**
 * What the guest pays now (cards k126, k130 and the owner's 2026-09 rulings).
 *
 * **ONE ROW**: `Pays now` · three joined choices · the figure. The owner's rules, drawn
 * for him and approved:
 *
 *  - **Deposit is the standard** and is already chosen — nothing to tap for the usual case;
 *  - **Deposit and Full pay are READ-ONLY figures** (half the stay, or the whole stay) —
 *    only Custom is typed, and its box stands where the figure stands so the row never grows.
 *    **Nothing is printed after that box** (the owner, 2026-09, after seeing `0 · ₱950 after`
 *    wrap onto a second line): the typed figure is the whole message, and the row stays one
 *    line at every width;
 *  - the stay total rides beside the figure (`₱475 of ₱950`) instead of a sentence under the
 *    card — that sentence was the third row, and he will not spend a row on it;
 *  - it still takes **no money** and asks for **no payment method** — the guest gets the
 *    statement, and the payment is recorded from the quick view.
 */
export function BookingDepositFields({
  estTotal,
  plan,
  setPlan,
  agreedDeposit,
  setAgreedDeposit,
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
  const now = plan === 'full' ? Math.round(estTotal) : plan === 'deposit' ? half : Math.round(agreedDeposit)
  const options: SegmentOption<PayPlan>[] = [
    { key: 'deposit', label: 'Deposit', hint: `Half the stay — ${peso(half)}. The rest is collected at check-out.` },
    { key: 'full', label: 'Full pay', hint: `The whole stay — ${peso(estTotal)}. Nothing left at check-out.` },
    { key: 'custom', label: 'Custom', hint: 'Any figure the guest hands over now. The rest stays owed with the stay.' },
  ]

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 shrink-0">
          <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Wallet className="w-2.5 h-2.5" />
          </span>
          <span className="text-[10px] font-bold text-base-content/70 whitespace-nowrap">Pays now</span>
        </span>

        <SegmentedControl options={options} value={plan} onChange={setPlan} label="What the guest pays now" />

        {plan === 'custom' ? (
          <span className="ml-auto shrink-0">
            <NumInput value={agreedDeposit} onChange={setAgreedDeposit} aria-label="Amount the guest pays now"
              className="w-[72px] bg-card border border-base-300 text-main px-2 py-1 rounded-lg text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
          </span>
        ) : (
          <span className="ml-auto flex items-baseline gap-1.5 shrink-0">
            <b className="font-mono font-bold text-[15px] text-base-content whitespace-nowrap">{peso(now)}</b>
            <i className="not-italic text-[10px] font-semibold text-base-content/60 whitespace-nowrap">
              {plan === 'full' ? 'paid in full' : `of ${peso(estTotal)}`}
            </i>
          </span>
        )}
      </div>

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

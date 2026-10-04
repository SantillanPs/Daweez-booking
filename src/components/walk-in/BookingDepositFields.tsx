import { NumInput } from '../NumInput'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'
import { AnimatedNumber } from '../AnimatedNumber'
import { Field } from './Field'
import { FIELD, LABEL, REVEAL } from './formStyles'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind } from '../../utils/paymentMethod'

export type PayPlan = 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
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
   * The form will not finish without a method (and a reference, for GCash or bank). The
   * form decides this — it is the same test that keeps Confirm asleep — so the mark on
   * the row and the line beside the button can never disagree.
   */
  methodRequired: boolean
  /**
   * **A short stay (the printed rate board)** — already paid in full at the counter, so
   * there is no plan to choose and no figure to work out: the gold notice above this card
   * states the amount, and all that is left here is **how the guest paid**. The card
   * therefore shows the `Paid by` row alone. (Without this the method row was never
   * rendered for a short stay while the form still demanded one, so the form could never
   * be confirmed at all.)
   */
  shortStay?: boolean
  /** An agency is on the booking, so it can simply be billed to them. */
  agency?: boolean
  /**
   * What the guest hands over in this form — the figure the column leads with. Left out
   * while a saved booking is being corrected: correcting takes no money, so the column
   * leads with what the stay comes to instead.
   */
  payNow?: number
}

const peso = (n: number) => '₱' + Math.round(n || 0).toLocaleString()

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
 * - **The row the form is waiting on carries the red star** (the design review,
 *   2026-10-04) — `Paid by`, and the reference once GCash or bank is picked.
 * - **Nothing is red before a mistake has been made** (the staff's feedback, the same day:
 *   the form was hard to read). `Paid by` used to open with a red edge, so a form nobody
 *   had touched yet already looked wrong.
 * - **The money leads.** The column opens with what the guest hands over now, in the
 *   largest figures on the form, and what the whole stay comes to under it. It was one
 *   small figure at the bottom right of the form.
 * - **Every chooser has its label above it** and fills the column, so the choosers share
 *   both edges.
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
  methodRequired,
  shortStay = false,
  agency = false,
  payNow,
}: BookingDepositFieldsProps) {
  const half = Math.max(0, Math.round(estTotal / 2))
  const options: SegmentOption<PayPlan>[] = [
    // An agency pays by check or bank, often months later (the owner, 2026-10-04) — so
    // the first choice on an agency booking takes nothing at the desk.
    ...(agency ? [{ key: 'agency' as const, label: 'Bill agency', hint: `Nothing is taken now. ${peso(estTotal)} is billed to the agency, which pays by check or bank.` }] : []),
    { key: 'deposit', label: 'Deposit', hint: `Half the stay — ${peso(half)}. The rest is collected at check-out.` },
    { key: 'full', label: 'Full pay', hint: `The whole stay — ${peso(estTotal)}. Nothing left at check-out.` },
    { key: 'custom', label: 'Custom', hint: 'Any figure the guest hands over now. The rest stays owed with the stay.' },
    // The owner's ruling, 2026-09-28: a room held for somebody the staff personally know
    // and trust. Nothing is paid and nothing is agreed, so no figure is shown anywhere —
    // the stay reads **Reserved**, not Unpaid, until the guest arrives.
    // Left off an agency booking: "Bill agency" already takes nothing at the desk, and
    // five choices do not fit on the row — the last one was cut off at "Re". It stays
    // when the booking being corrected is itself a Reservation.
    ...(agency && plan !== 'reservation' ? [] : [{ key: 'reservation' as const, label: 'Reservation', hint: 'A hold for a guest the staff know — nothing paid now. They settle when they arrive to check in.' }]),
  ]

  // A Reservation pays nothing, so there is no method to ask for.
  const asksForMoney = shortStay || (plan !== 'reservation' && plan !== 'agency')
  const needsRef = methodNeedsReference(method || undefined)
  const methodOptions: SegmentOption<PayMethod>[] = PAYMENT_METHODS.map(m => ({ key: m as PayMethod, label: m }))
  const refLabel = paymentKind(method || undefined) === 'gcash' ? 'GCash reference no.' : 'Reference no.'
  const total = Math.max(0, Math.round(estTotal))
  const taking = payNow !== undefined
  const lead = taking ? Math.max(0, Math.round(payNow)) : total

  return (
    <div className="space-y-4">
      {/* The figure follows the plan as it is changed, so the desk sees it move. */}
      <div>
        <p className={LABEL}>{taking ? 'To pay now' : 'Total'}</p>
        <p className="mt-1 font-display text-[34px] leading-none font-extrabold tracking-tight tabular-nums text-base-content">
          <AnimatedNumber value={lead} duration={350} prefix="₱" />
        </p>
        {taking && lead !== total && (
          <p className="mt-1.5 text-[13px] text-base-content/70 tabular-nums">of {peso(total)} for the stay</p>
        )}
      </div>

      {/* What the guest pays now — a short stay already paid in full has no plan to choose. */}
      {!shortStay && (
        <Field group label="Pays now">
          <SegmentedControl options={options} value={plan} onChange={setPlan} label="What the guest pays now" />
        </Field>
      )}

      {/* Only Custom is typed. */}
      {!shortStay && plan === 'custom' && (
        <Field label="Amount (₱)" className={REVEAL}>
          <NumInput value={agreedDeposit} onChange={setAgreedDeposit} aria-label="Amount the guest pays now"
            className={FIELD + ' text-right tabular-nums'} />
        </Field>
      )}

      {/* ── How the guest pays — the row that takes the money (2026-09-29) ── */}
      {asksForMoney && (
        <Field group label="Paid by" required={methodRequired}>
          <SegmentedControl options={methodOptions} value={method} onChange={setMethod} label="How the guest pays" />
        </Field>
      )}

      {/* GCash and bank transfers only, and only once one of them is picked. */}
      {asksForMoney && needsRef && (
        <Field label={refLabel} required={methodRequired} className={REVEAL}>
          <input
            value={reference}
            onChange={e => setReference(e.target.value)}
            placeholder="From the guest's phone"
            autoComplete="off"
            className={FIELD + ' tabular-nums'}
          />
        </Field>
      )}
    </div>
  )
}

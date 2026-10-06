import { NumInput } from '../NumInput'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'
import { AnimatedNumber } from '../AnimatedNumber'
import { Field } from './Field'
import { FIELD, LABEL, REVEAL } from './formStyles'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind } from '../../utils/paymentMethod'

export type PayPlan = 'deposit' | 'full' | 'custom' | 'reservation' | 'agency'
/** A way to pay, or `''` for "the desk has not picked yet" — a real, deliberate state. */
export type PayMethod = (typeof PAYMENT_METHODS)[number] | ''

/** The three things the desk can choose. Every other `PayPlan` is one of these to the eye. */
type DepositChoice = 'custom' | 'full' | 'reservation'

interface BookingDepositFieldsProps {
  /** What the stay comes to — half of it fills the Custom box, all of it is Full pay. */
  estTotal: number
  /**
   * How the deposit was decided. It is still stored with the booking, because the rest of
   * the system reads it: `custom` is a figure (half the stay until the desk changes it),
   * `full` is the whole stay, `reservation` is no deposit. `deposit` and `agency` are only
   * read back from bookings made before 2026-10-06 and are shown as Custom and No deposit.
   */
  plan: PayPlan
  /**
   * Has the desk chosen one of the three? **A new booking opens with none chosen**, and
   * until one is, no amount, no note and no `Paid by` is drawn — there is nothing yet to
   * pay or to say how.
   */
  chosen: boolean
  setPlan: (plan: PayPlan) => void
  /** What the guest hands over now, by the plan. For `custom` it is what is in the box. */
  agreedDeposit: number
  setAgreedDeposit: (v: number) => void
  /** The desk's note beside a Custom deposit. Only a Custom deposit has one. */
  note: string
  setNote: (note: string) => void
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
  /** A new booking must say what the deposit is — a figure, or none. The form decides. */
  depositRequired?: boolean
  /**
   * **A short stay (the printed rate board)** — already paid in full at the counter, so
   * there is no deposit to decide: all that is left here is **how the guest paid**. (Without
   * this the method row was never rendered for a short stay while the form still demanded
   * one, so the form could never be confirmed at all.)
   */
  shortStay?: boolean
}

const choiceOf = (plan: PayPlan): DepositChoice =>
  plan === 'full' ? 'full' : plan === 'reservation' || plan === 'agency' ? 'reservation' : 'custom'

/**
 * What the guest pays now, and how (cards k126, k130 and the owner's 2026-09 rulings).
 *
 * **Three choices, one toggle, called `Payment`** (Sebastian, 2026-10-06): **Custom**,
 * **Full pay** and **No deposit**, the same for every booking — an agency booking has no
 * choice of its own, the agency only changes the price and who the bill is addressed to.
 * The deposit used to be a box that was always there with shortcuts beside it, and an
 * agency booking had a fourth choice, "Bill the agency".
 *
 * **None of the three is chosen when the form opens** (the same day: *"don't default to
 * custom. let it be unselected between the 3"*), for the reason nothing is chosen on `Paid
 * by`: a payment the form picked by itself is a payment nobody agreed. The form waits.
 *
 * - **Custom** opens the amount, **already filled with half the stay** (and it follows the
 *   stay while the desk has not typed over it). It also opens a **Notes** box, which exists
 *   for a custom deposit and for nothing else — it is where the desk writes why the amount
 *   is what it is. Choosing Full pay or No deposit takes the box away and the note with it.
 * - **Full pay** and **No deposit** are only the toggle: the figure they mean is not a
 *   thing to type, so no box is drawn.
 *
 * - **A booking with no deposit is still what the system calls a reservation** — it reads
 *   `No Deposit` on the calendar, owes nothing until the guest arrives, and pays at check-in.
 * - **Nothing is preselected on the method row**, and the form refuses to finish without
 *   one; GCash and bank also wait for the reference the guest is reading out. No deposit
 *   asks for no method.
 * - **The row the form is waiting on carries the red star**, and **nothing is red before a
 *   mistake has been made** (the staff's feedback, 2026-10-04: the form was hard to read).
 * - **The column leads with what the stay comes to**, in the largest figures on the form:
 *   it is what the guest is told first. What they hand over now is the box under it.
 */
export function BookingDepositFields({
  estTotal,
  plan,
  chosen,
  setPlan,
  agreedDeposit,
  setAgreedDeposit,
  note,
  setNote,
  method,
  setMethod,
  reference,
  setReference,
  methodRequired,
  depositRequired = false,
  shortStay = false,
}: BookingDepositFieldsProps) {
  const total = Math.max(0, Math.round(estTotal))
  const choice = choiceOf(plan)

  // `''` is "none chosen yet" — a real state, the same as on the `Paid by` row.
  const picked: DepositChoice | '' = chosen ? choice : ''
  const choices: SegmentOption<DepositChoice | ''>[] = [
    { key: 'custom', label: 'Custom', hint: 'The guest pays an amount now. Half the stay is filled in; change it if they agree to something else.' },
    { key: 'full', label: 'Full pay', hint: 'The whole stay is paid now. Nothing left at check-out.' },
    { key: 'reservation', label: 'No deposit', hint: 'Nothing is paid now. The room is held, and the guest pays when they arrive to check in.' },
  ]

  // A booking with no deposit pays nothing, and one with no choice yet has nothing to pay,
  // so there is no method to ask for.
  const asksForMoney = shortStay || (chosen && choice !== 'reservation')
  const needsRef = methodNeedsReference(method || undefined)
  const methodOptions: SegmentOption<PayMethod>[] = PAYMENT_METHODS.map(m => ({ key: m as PayMethod, label: m }))
  const refLabel = paymentKind(method || undefined) === 'gcash' ? 'GCash reference no.' : 'Reference no.'
  // The star shows only while the form is actually waiting: nothing chosen yet, or a Custom
  // box that has been emptied.
  const waitingOnPayment = depositRequired && (!chosen || (choice === 'custom' && agreedDeposit <= 0))

  return (
    <div className="space-y-4">
      {/* The figure follows the stay as it is changed, so the desk sees it move. */}
      <div>
        <p className={LABEL}>{shortStay ? 'To pay now' : 'Total'}</p>
        <p className="mt-1 font-display text-[34px] leading-none font-extrabold tracking-tight tabular-nums text-main">
          <AnimatedNumber value={total} duration={350} prefix="₱" />
        </p>
      </div>

      {/* What the guest hands over now — a short stay already paid in full has none to decide. */}
      {!shortStay && (
        <div className="space-y-3">
          <Field group label="Payment" required={waitingOnPayment}>
            <SegmentedControl options={choices} value={picked} onChange={k => { if (k) setPlan(k) }} label="How much the guest pays now" />
          </Field>

          {chosen && choice === 'custom' && (
            <div className={'space-y-3 ' + REVEAL}>
              <span className="relative block">
                <NumInput value={agreedDeposit} aria-label="Deposit the guest pays now"
                  onChange={v => { setPlan('custom'); setAgreedDeposit(v) }}
                  className={'peer ' + FIELD + ' text-right text-[17px] font-bold tabular-nums'} />
                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted">₱</span>
              </span>
              <Field label="Notes">
                <input
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  autoComplete="off"
                  className={FIELD}
                />
              </Field>
            </div>
          )}
        </div>
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

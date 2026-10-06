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
  /** What the stay comes to — half of it is the Half shortcut, all of it is Full pay. */
  estTotal: number
  /**
   * How the deposit was decided. It is still stored with the booking, because the rest of
   * the system reads it: `custom` is a typed figure, `deposit` is half, `full` is the whole
   * stay, `reservation` is no deposit, `agency` is billed to the agency.
   */
  plan: PayPlan
  setPlan: (plan: PayPlan) => void
  /** What the guest hands over now, by the plan. For `custom` it is what was typed. */
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
  /** A new booking must say what the deposit is — a figure, or none. The form decides. */
  depositRequired?: boolean
  /**
   * **A short stay (the printed rate board)** — already paid in full at the counter, so
   * there is no deposit to decide: all that is left here is **how the guest paid**. (Without
   * this the method row was never rendered for a short stay while the form still demanded
   * one, so the form could never be confirmed at all.)
   */
  shortStay?: boolean
  /** An agency is on the booking, so it can simply be billed to them. */
  agency?: boolean
}

const peso = (n: number) => '₱' + Math.round(n || 0).toLocaleString()

/**
 * What the guest pays now, and how (cards k126, k130 and the owner's 2026-09 rulings).
 *
 * **The deposit is typed** (Sebastian, 2026-10-05). It was a row of four choices — Deposit,
 * Full pay, Custom, Reservation — with Deposit (half the stay) already chosen. *"The
 * deposit feature is a bit of a nuisance since most of the time the staff would do custom
 * priced deposit"*: nearly every booking began by switching away from what the form had
 * chosen. And a Reservation could take no money at all, while *"sometimes they allow no
 * deposit on reservations and sometimes they do."* So there is no longer a kind of booking
 * called Reservation to choose: every booking has a deposit, which is whatever the desk
 * types — and **Half**, **Full pay** and **No deposit** are shortcuts under the box for
 * the three figures that need no typing.
 *
 * **Nothing is chosen when the form opens**, for the reason nothing is chosen on `Paid by`:
 * a figure the form picked by itself is a figure nobody agreed. The form waits for one.
 *
 * - **A booking with no deposit is still what the system calls a reservation** — it reads
 *   `Reserved` on the calendar, owes nothing until the guest arrives, and pays at check-in.
 *   Nothing downstream changed; only how the desk says it.
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
  setPlan,
  agreedDeposit,
  setAgreedDeposit,
  method,
  setMethod,
  reference,
  setReference,
  methodRequired,
  depositRequired = false,
  shortStay = false,
  agency = false,
}: BookingDepositFieldsProps) {
  const total = Math.max(0, Math.round(estTotal))
  const half = Math.max(0, Math.round(estTotal / 2))

  // The figures that need no typing. `hint` is for a mouse; the words carry it without.
  const shortcuts: { key: PayPlan; label: string; amount?: number; hint: string }[] = [
    // An agency pays by check or bank, often months later (the owner, 2026-10-04) — so
    // the first choice on an agency booking takes nothing at the desk.
    ...(agency ? [{ key: 'agency' as const, label: 'Bill the agency', hint: `Nothing is taken now. ${peso(total)} is billed to the agency, which pays by check or bank.` }] : []),
    { key: 'deposit', label: 'Half', amount: half, hint: 'Half the stay. The rest is collected at check-out.' },
    { key: 'full', label: 'Full pay', amount: total, hint: 'The whole stay. Nothing left at check-out.' },
    // Left off an agency booking: "Bill the agency" already takes nothing at the desk. It
    // stays when the booking being corrected was itself made with no deposit.
    ...(agency && plan !== 'reservation' ? [] : [{ key: 'reservation' as const, label: 'No deposit', hint: 'Nothing is paid now. The room is held, and the guest pays when they arrive to check in.' }]),
  ]

  // A Reservation pays nothing, so there is no method to ask for.
  const asksForMoney = shortStay || (plan !== 'reservation' && plan !== 'agency')
  const needsRef = methodNeedsReference(method || undefined)
  const methodOptions: SegmentOption<PayMethod>[] = PAYMENT_METHODS.map(m => ({ key: m as PayMethod, label: m }))
  const refLabel = paymentKind(method || undefined) === 'gcash' ? 'GCash reference no.' : 'Reference no.'
  // An empty box says what empty means, the way the boxes in Settings do.
  const emptySays = plan === 'reservation' ? 'No deposit' : plan === 'agency' ? 'Billed to the agency' : ''

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
        <div>
          <Field label="Deposit" required={depositRequired}>
            <span className="relative block">
              <NumInput value={agreedDeposit} placeholder={emptySays} aria-label="Deposit the guest pays now"
                onChange={v => { setPlan('custom'); setAgreedDeposit(v) }}
                className={'peer ' + FIELD + ' text-right text-[17px] font-bold tabular-nums'} />
              <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted">₱</span>
            </span>
          </Field>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {shortcuts.map(s => {
              const on = plan === s.key
              return (
                <button key={s.key} type="button" aria-pressed={on} title={s.hint} onClick={() => setPlan(s.key)}
                  className={'h-9 px-3 inline-flex items-center gap-1.5 rounded-md border text-[14px] font-semibold cursor-pointer transition-colors duration-150 active:scale-[0.97] ' +
                    (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400')}>
                  {s.label}
                  {s.amount !== undefined && <span className={'tabular-nums ' + (on ? '' : 'text-muted')}>{peso(s.amount)}</span>}
                </button>
              )
            })}
          </div>
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

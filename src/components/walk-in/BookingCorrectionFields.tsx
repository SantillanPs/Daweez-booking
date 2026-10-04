import { Field } from './Field'
import { FIELD, SECTION, SECTION_TITLE } from './formStyles'

/**
 * The figures a correction may change — only ever shown while CORRECTING a saved
 * booking, never on a new one.
 *
 * It was a box inside the money block (`BookingDepositFields`). It is its own part of
 * the form now, under the stay (the design review, 2026-10-04): the four boxes made the
 * money column three times the height of everything beside it.
 */
export function BookingCorrectionFields({
  formInvoiceNumber, setFormInvoiceNumber,
  formDownpaymentPaid, setFormDownpaymentPaid,
  formBalanceDue, setFormBalanceDue,
  formSecurityDeposit, setFormSecurityDeposit,
}: {
  formInvoiceNumber: string
  setFormInvoiceNumber: (v: string) => void
  formDownpaymentPaid: number
  setFormDownpaymentPaid: (v: number) => void
  formBalanceDue: number | null
  setFormBalanceDue: (v: number | null) => void
  formSecurityDeposit: number | null
  setFormSecurityDeposit: (v: number | null) => void
}) {
  return (
    <section className={SECTION + ' font-sans'}>
      <h4 className={SECTION_TITLE}>Correcting this booking</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
        <Field label="Already received (₱)">
          <input type="text" inputMode="decimal" value={formDownpaymentPaid || ''}
            onChange={e => setFormDownpaymentPaid(parseFloat(e.target.value) || 0)} className={FIELD + ' tabular-nums'} />
        </Field>
        <Field label="Balance due (₱)">
          <input type="text" inputMode="decimal" value={formBalanceDue ?? ''}
            onChange={e => setFormBalanceDue(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Worked out from the stay" className={FIELD + ' tabular-nums'} />
        </Field>
        <Field label="Security deposit (₱)">
          <input type="text" inputMode="decimal" value={formSecurityDeposit ?? ''}
            onChange={e => setFormSecurityDeposit(e.target.value ? parseFloat(e.target.value) : null)}
            placeholder="Optional" className={FIELD + ' tabular-nums'} />
        </Field>
        <Field label="Invoice number">
          <input value={formInvoiceNumber} onChange={e => setFormInvoiceNumber(e.target.value)}
            placeholder="Given one if left empty" className={FIELD} />
        </Field>
      </div>
    </section>
  )
}

import { useState } from 'react'
import { NumInput } from '../NumInput'
import { methodNeedsReference } from '../../utils/paymentMethod'

interface RecordPaymentFormProps {
  amount: number
  setAmount: (v: number) => void
  method: string
  setMethod: (v: string) => void
  reference: string
  setReference: (v: string) => void
  onSubmit: () => void
  submitLabel?: string
  /** GCash / bank payments need a reference number; cash does not. */
  referenceRequired?: boolean
  /** Inline note shown under the reference box when it is missing. */
  referenceError?: string
  /**
   * The one short line saying what this money is for — e.g.
   * "Deposit (50%) · GCash" or "Arrival balance". Sits right under the title.
   */
  note?: string
  /** Optional override for the title (default "Record a payment"). */
  title?: string
  /**
   * When given, a quiet Cancel sits under the submit button so an opened form
   * can be dismissed. Needed when the form is revealed by another button, so
   * two equally loud buttons are never on screen at once.
   */
  onCancel?: () => void
}

// Records money the guest actually handed over. Saving appends a dated receipt
// and prints it, so this is the step that produces the guest's Payment Receipt.
//
// The amount is always filled in by the caller: at booking it is what the guest
// agreed to pay (their deposit, or the full amount), and at check-in it is the
// balance. There are deliberately NO "50% deposit" / "Full amount" shortcuts —
// that decision belongs to the booking form, so offering it again here asked the
// same question twice. The Amount box stays editable for a part-payment.
export function RecordPaymentForm({
  amount, setAmount, method, setMethod, reference, setReference,
  onSubmit, submitLabel = 'Save payment & print receipt',
  referenceRequired = false, referenceError = '',
  note = '', title = 'Record a payment', onCancel,
}: RecordPaymentFormProps) {
  // An empty Amount is answered right under the box, not with a popup.
  const [tried, setTried] = useState(false)
  const amountMissing = tried && !(amount > 0)
  // The method is the guest's own choice, so nothing is preselected and the
  // record is refused until the desk says which one it was — assuming "Cash" is
  // what once printed a Cash receipt for a guest who had paid by GCash.
  const methodMissing = tried && !method.trim()
  const submit = () => {
    setTried(true)
    if (!(amount > 0) || !method.trim()) return
    onSubmit()
  }

  return (
    <div className="rounded-xl border border-gold-200 bg-gold-100/60 p-3.5 space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-main">{title}</p>
        {note && <p className="text-[11px] text-muted mt-0.5">{note}</p>}
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <label className="text-[10px] text-muted font-bold block">Amount (₱)
          <NumInput value={amount} onChange={setAmount} placeholder="0"
            className={'w-full mt-1 bg-card border text-main px-2.5 py-2 rounded-lg text-sm font-mono focus:outline-none ' +
              (amountMissing ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')} />
        </label>
        <label className="text-[10px] text-muted font-bold block">Method
          <select value={method} onChange={e => setMethod(e.target.value)}
            className={'w-full mt-1 bg-card border text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500 ' +
              (methodMissing ? 'border-danger-400 focus:border-danger-500' : 'border-soft')}>
            <option value="" disabled>Choose…</option>
            <option>Cash</option><option>GCash</option><option>Bank transfer</option>
          </select>
        </label>
      </div>
      {amountMissing && <p className="text-[10px] font-semibold text-danger-600">Enter the payment amount.</p>}
      {methodMissing && <p className="text-[10px] font-semibold text-danger-600">Choose how the guest paid.</p>}

      <label className="text-[10px] text-muted font-bold block">
        Reference No.{referenceRequired ? <span className="text-danger-500"> *</span> : ' (optional)'}
        <input value={reference} onChange={e => setReference(e.target.value)}
          placeholder={methodNeedsReference(method) ? 'e.g. ' + method + ' ref no.' : 'e.g. OR number'}
          className={'w-full mt-1 bg-card border text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none ' +
            (referenceError ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')} />
      </label>
      {referenceError && <p className="text-[10px] font-semibold text-danger-600">{referenceError}</p>}

      {/* Wrapped in an arrow on purpose: passing `onSubmit` straight to onClick
          hands the click EVENT to it as the first argument, which a caller that
          reads an optional amount then treats as "no amount entered". */}
      <button type="button" onClick={submit}
        className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer">
        {submitLabel}
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}
          className="w-full text-[11px] font-semibold text-muted hover:text-main transition-colors cursor-pointer">
          Cancel
        </button>
      )}
    </div>
  )
}

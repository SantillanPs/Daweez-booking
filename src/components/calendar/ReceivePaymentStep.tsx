import { methodNeedsReference } from '../../utils/paymentMethod'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()
// Cash, GCash, Bank transfer — "Other" was removed (card k132 follow-up).
const METHODS = ['Cash', 'GCash', 'Bank transfer']

interface ReceivePaymentStepProps {
  /** What the staff must take from the guest. Fixed: it is the rest of the bill. */
  amount: number
  method: string
  setMethod: (v: string) => void
  reference: string
  setReference: (v: string) => void
  referenceError?: string
  /** The one loud action, worded for the step ("Receive ₱700 & check in"). */
  submitLabel: string
  note: string
  onSubmit: () => void
  onCancel: () => void
}

// The arrival step, as a process rather than a panel that just appears: what to
// receive, what to choose, what to enter, then one confirm. Pressing "Receive
// money & check in" opens THIS, and it does not finish until the staff have been
// through it — so a partly-paid booking cannot be checked in with the money
// unaccounted for.
//
// The method is asked again here (unlike the first payment, which is fixed to
// what the booking agreed): the guest settles the rest however they like.
export function ReceivePaymentStep({
  amount, method, setMethod, reference, setReference, referenceError = '',
  submitLabel, note, onSubmit, onCancel,
}: ReceivePaymentStepProps) {
  const needsRef = methodNeedsReference(method)
  const step = (n: number, label: string) => (
    <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
      <span className="inline-flex items-center justify-center w-3.5 h-3.5 mr-1.5 rounded-full bg-gold-400 text-ink-900 text-[8px] font-extrabold align-middle">{n}</span>
      {label}
    </span>
  )

  return (
    <div className="rounded-xl border border-gold-200 bg-gold-100/60 p-3.5 space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-main">Receive {fmtPeso(amount)}</p>
        <p className="text-[11px] text-muted mt-0.5">{note}</p>
      </div>

      <label className="block">
        {step(1, 'How the guest pays *')}
        <select value={method} onChange={e => setMethod(e.target.value)}
          className="w-full mt-1 bg-card border border-soft text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none focus:border-gold-500 cursor-pointer">
          {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </label>

      {needsRef && (
        <label className="block">
          {step(2, method + ' reference no. *')}
          <input value={reference} onChange={e => setReference(e.target.value)}
            placeholder="e.g. 1234 567 890123"
            className={'w-full mt-1 bg-card border text-main px-2.5 py-2 rounded-lg text-sm focus:outline-none ' +
              (referenceError ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')} />
          {referenceError && <span className="block text-[10px] font-semibold text-danger-600 mt-1">{referenceError}</span>}
        </label>
      )}

      <div>
        {step(needsRef ? 3 : 2, 'Amount to receive')}
        <p className="font-display text-[20px] font-extrabold text-ink-900 mt-0.5">{fmtPeso(amount)}</p>
      </div>

      <button type="button" onClick={onSubmit}
        className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-sm font-bold py-3 rounded-xl transition-colors cursor-pointer shadow-sm">
        {submitLabel}
      </button>
      <button type="button" onClick={onCancel}
        className="w-full text-[11px] font-semibold text-muted hover:text-main transition-colors cursor-pointer">
        Cancel
      </button>
    </div>
  )
}

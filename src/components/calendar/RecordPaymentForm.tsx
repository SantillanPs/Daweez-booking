import { NumInput } from '../NumInput'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

interface RecordPaymentFormProps {
  totalDue: number
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
}

// Records money the guest actually handed over — a 50% deposit or the full
// amount, by cash, GCash or bank transfer. Saving appends a dated receipt and
// prints it, so this is the step that produces the guest's Payment Receipt.
export function RecordPaymentForm({
  totalDue, amount, setAmount, method, setMethod, reference, setReference,
  onSubmit, submitLabel = 'Save payment & print receipt',
  referenceRequired = false, referenceError = '',
}: RecordPaymentFormProps) {
  return (
    <div className="rounded-xl border border-gold-200 bg-gold-100/60 p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Record a payment</span>
        <span className="text-[11px] text-muted">Total due <strong className="text-main font-mono">{fmtPeso(totalDue)}</strong></span>
      </div>

      <div className="flex gap-1.5">
        <button type="button" onClick={() => setAmount(Math.round(totalDue / 2))}
          className="flex-1 text-[11px] font-bold text-gold-700 bg-card border border-gold-200 hover:bg-gold-100 rounded-md px-2 py-1.5 transition-colors cursor-pointer">
          50% deposit
        </button>
        <button type="button" onClick={() => setAmount(totalDue)}
          className="flex-1 text-[11px] font-bold text-gold-700 bg-card border border-gold-200 hover:bg-gold-100 rounded-md px-2 py-1.5 transition-colors cursor-pointer">
          Full amount
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[10px] text-muted font-bold block">Amount (₱)
          <NumInput value={amount} onChange={setAmount} placeholder="0"
            className="w-full mt-1 bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm font-mono focus:outline-none focus:border-gold-500" />
        </label>
        <label className="text-[10px] text-muted font-bold block">Method
          <select value={method} onChange={e => setMethod(e.target.value)}
            className="w-full mt-1 bg-card border border-soft text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none focus:border-gold-500">
            <option>Cash</option><option>GCash</option><option>Bank transfer</option><option>Other</option>
          </select>
        </label>
      </div>

      <label className="text-[10px] text-muted font-bold block">
        Reference No.{referenceRequired ? <span className="text-danger-500"> *</span> : ' (optional)'}
        <input value={reference} onChange={e => setReference(e.target.value)}
          placeholder={method.toLowerCase().includes('cash') ? 'e.g. OR number' : 'e.g. ' + method + ' ref no.'}
          className={'w-full mt-1 bg-card border text-main px-2.5 py-1.5 rounded-lg text-sm focus:outline-none ' +
            (referenceError ? 'border-danger-400 focus:border-danger-500' : 'border-soft focus:border-gold-500')} />
      </label>
      {referenceError && <p className="text-[10px] font-semibold text-danger-600">{referenceError}</p>}

      <button type="button" onClick={onSubmit}
        className="w-full bg-gold-400 hover:bg-gold-600 text-ink-900 text-xs font-bold py-2.5 rounded-lg transition-colors cursor-pointer">
        {submitLabel}
      </button>
    </div>
  )
}

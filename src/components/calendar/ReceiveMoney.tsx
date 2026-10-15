import { NumInput } from '../NumInput'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind, paymentMethodChoice } from '../../utils/paymentMethod'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

/** One thing the money can be for: everything owed, or one order slip on its own. */
export interface PayChoice {
  key: string
  label: string
  amount: number
}

interface ReceiveMoneyProps {
  /** Everything owed first, then each unpaid order slip. One entry means there is nothing to choose. */
  choices: PayChoice[]
  /** The chosen entry's key, or `'other'` for an amount the desk types. */
  payFor: string
  onPayFor: (key: string) => void
  otherAmount: number
  onOtherAmount: (n: number) => void
  /** How the guest paid. Empty until the desk picks — never assumed. */
  method: string
  onMethod: (m: string) => void
  reference: string
  onReference: (r: string) => void
  /** Saves the reference typed so far, on the way out of the box. */
  onReferenceCommit: () => void
  /** True once Receive was pressed with something missing: the missing part says so. */
  tried: boolean
  /** False when another step is the loud one (a stay billed to an agency). */
  loud?: boolean
  onReceive: () => void
}

/**
 * Where money is written down — the one place on the booking panel (the owner's ruling:
 * *"money is taken in one place"*), rebuilt after the staff's feedback of 2026-10-04:
 * with the guest's money in hand they could not tell where to record it.
 *
 * It reads top to bottom as the desk does it: what the money is for (only asked when
 * there is a choice), then how the guest paid beside one button carrying the amount. How
 * they paid starts empty — a silent `Cash` is how a GCash guest once got a Cash receipt.
 */
export function ReceiveMoney({
  choices, payFor, onPayFor, otherAmount, onOtherAmount, method, onMethod,
  reference, onReference, onReferenceCommit, tried, loud = true, onReceive,
}: ReceiveMoneyProps) {
  const other = payFor === 'other'
  const amount = other ? otherAmount : (choices.find(c => c.key === payFor) || choices[0])?.amount || 0
  const chosen = paymentMethodChoice(method)
  const needsRef = methodNeedsReference(method)
  const isGcash = paymentKind(method) === 'gcash'
  const refLabel = isGcash ? 'GCash reference no.' : 'Reference no.'

  const missing = !tried ? ''
    : other && !(otherAmount > 0) ? 'Enter the amount received.'
      : !chosen ? 'Choose how the guest paid.'
        : needsRef && !reference.trim() ? (isGcash ? 'Enter the GCash reference number.' : 'Enter the reference number.')
          : ''

  return (
    <div className="space-y-2">
      {choices.length > 1 && (
        <div role="radiogroup" aria-label="What the guest is paying for" className="flex flex-wrap gap-1.5">
          {choices.map(c => {
            const on = payFor === c.key
            return (
              <button key={c.key} type="button" role="radio" aria-checked={on} onClick={() => onPayFor(c.key)}
                className={'min-h-9 px-3 rounded-full border-[1.5px] text-[12px] font-bold transition-colors cursor-pointer ' +
                  (on ? 'border-ink-900 text-main' : 'border-soft text-muted hover:text-main')}>
                {c.label} {fmtPeso(c.amount)}
              </button>
            )
          })}
        </div>
      )}

      {other && (
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">Amount received (₱)</span>
          <NumInput value={otherAmount} onChange={onOtherAmount} aria-label="Amount received"
            className="mt-1 w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[16px] focus:outline-none focus:border-gold-500" />
        </label>
      )}

      {/* How they paid sits beside the button that takes the money, so the two are read
          as one act. It starts empty — never a silent Cash. */}
      <div className="grid grid-cols-[minmax(0,7.5rem)_1fr] gap-2">
        <select value={chosen} onChange={e => onMethod(e.target.value)} aria-label="How the guest paid"
          className={'min-h-[54px] w-full pl-3 pr-2 rounded-xl border bg-card text-[14px] font-bold cursor-pointer focus:outline-none focus:border-gold-500 ' +
            (tried && !chosen ? 'border-danger-400 text-danger-600' : chosen ? 'border-soft text-main' : 'border-soft text-muted')}>
          <option value="" disabled>Paid by…</option>
          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <button type="button" onClick={onReceive}
          className={'min-h-[54px] px-4 rounded-xl text-[16px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer ' +
            (loud ? 'bg-gold-400 hover:bg-gold-600 text-ink-900' : 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
          {amount > 0 ? 'Receive ' + fmtPeso(amount) : 'Receive money'}
        </button>
      </div>

      {needsRef && (
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">{refLabel}</span>
          <input
            value={reference}
            onChange={e => onReference(e.target.value)}
            onBlur={onReferenceCommit}
            placeholder="From the guest's phone"
            className="mt-1 w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[16px] font-mono focus:outline-none focus:border-gold-500"
          />
        </label>
      )}

      {missing && <p className="text-[12px] font-semibold text-danger-600">{missing}</p>}

      <button type="button" onClick={() => onPayFor(other ? choices[0].key : 'other')}
        className="block mx-auto min-h-11 px-2 text-[13px] font-semibold text-muted hover:text-main transition-colors cursor-pointer">
        {other ? 'Back to ' + fmtPeso(choices[0]?.amount || 0) : 'A different amount'}
      </button>
    </div>
  )
}

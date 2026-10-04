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
 * there is a choice), how the guest paid, then one button carrying the amount. How they
 * paid is four buttons, none chosen for them — a silent `Cash` is how a GCash guest once
 * got a Cash receipt.
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
    <div className="space-y-2.5">
      {choices.length > 1 && (
        <ul role="radiogroup" aria-label="What the guest is paying for" className="border-y border-soft divide-y divide-soft">
          {choices.map(c => {
            const on = payFor === c.key
            return (
              <li key={c.key}>
                <button type="button" role="radio" aria-checked={on} onClick={() => onPayFor(c.key)}
                  className="w-full min-h-11 flex items-center justify-between gap-3 text-[13px] cursor-pointer">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className={'w-4 h-4 shrink-0 rounded-full border-2 ' + (on ? 'border-ink-900 bg-ink-900 shadow-[inset_0_0_0_3px_white]' : 'border-paper-400')} />
                    <span className={'truncate ' + (on ? 'font-bold text-main' : 'text-main')}>{c.label}</span>
                  </span>
                  <span className={'shrink-0 ' + (on ? 'font-bold text-main' : 'text-muted')}>{fmtPeso(c.amount)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {other && (
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">Amount received (₱)</span>
          <NumInput value={otherAmount} onChange={onOtherAmount} aria-label="Amount received"
            className="mt-1 w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[14px] focus:outline-none focus:border-gold-500" />
        </label>
      )}

      <div role="radiogroup" aria-label="How the guest paid" className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {PAYMENT_METHODS.map(m => (
          <button key={m} type="button" role="radio" aria-checked={chosen === m} onClick={() => onMethod(m)}
            className={'min-h-11 px-2 rounded-lg border text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ' +
              (chosen === m ? 'bg-ink-900 border-ink-900 text-white' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
            {m}
          </button>
        ))}
      </div>

      {needsRef && (
        <label className="block">
          <span className="block text-[12px] font-semibold text-muted">{refLabel}</span>
          <input
            value={reference}
            onChange={e => onReference(e.target.value)}
            onBlur={onReferenceCommit}
            placeholder="From the guest's phone"
            className="mt-1 w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[14px] font-mono focus:outline-none focus:border-gold-500"
          />
        </label>
      )}

      {missing && <p className="text-[12px] font-semibold text-danger-600">{missing}</p>}

      <button type="button" onClick={onReceive}
        className={'w-full min-h-12 px-4 rounded-lg text-[15px] font-bold transition-colors cursor-pointer ' +
          (loud ? 'bg-gold-400 hover:bg-gold-600 text-ink-900 shadow-sm' : 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100')}>
        {amount > 0 ? 'Receive ' + fmtPeso(amount) : 'Receive money'}
      </button>

      <button type="button" onClick={() => onPayFor(other ? choices[0].key : 'other')}
        className="w-full min-h-11 -mt-1 text-[13px] font-semibold text-muted hover:text-main transition-colors cursor-pointer">
        {other ? 'Back to ' + fmtPeso(choices[0]?.amount || 0) : 'A different amount'}
      </button>
    </div>
  )
}

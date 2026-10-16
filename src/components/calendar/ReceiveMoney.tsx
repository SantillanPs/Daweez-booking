import { useRef, useState } from 'react'
import { X } from 'lucide-react'
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
  /** Opened from "Receive a payment": the ways to pay show at once. */
  startOpen?: boolean
  /** Takes the money. A way to pay that needs no reference is handed straight in. */
  onReceive: (method?: string) => void
}

const BTN = 'min-h-[54px] px-4 rounded-xl text-[16px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer '
const LOUD = 'bg-gold-400 hover:bg-gold-600 text-ink-900'
const QUIET = 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100'
const BACK = 'min-h-[54px] rounded-xl border border-soft bg-card text-muted hover:text-main grid place-items-center cursor-pointer bw-x'

/**
 * Where money is written down — the one place on the booking panel (the owner's ruling:
 * *"money is taken in one place"*), rebuilt after the staff's feedback of 2026-10-04:
 * with the guest's money in hand they could not tell where to record it.
 *
 * **It opens one step at a time** (the booking window mock, Sebastian, 2026-10-16: "what
 * would it look like with progressive disclosure?"). At first it is one button, Receive —
 * the amount is the big figure right above it, so the button does not say it again.
 * Pressed, it opens into the ways to pay. Cash or Check is the payment itself; GCash or a
 * bank transfer asks for its reference number first. How they paid is still never
 * assumed — a silent `Cash` is how a GCash guest once got a Cash receipt.
 */
export function ReceiveMoney({
  choices, payFor, onPayFor, otherAmount, onOtherAmount, method, onMethod,
  reference, onReference, onReferenceCommit, tried, loud = true, startOpen = false, onReceive,
}: ReceiveMoneyProps) {
  const [open, setOpen] = useState(startOpen)
  const amountBox = useRef<HTMLLabelElement>(null)
  const refBox = useRef<HTMLLabelElement>(null)
  const other = payFor === 'other'
  const amount = other ? otherAmount : (choices.find(c => c.key === payFor) || choices[0])?.amount || 0
  // The figure above already says the first amount; any other one is said here.
  const differs = other || payFor !== choices[0]?.key
  const sum = differs ? (amount > 0 ? fmtPeso(amount) + ' · ' : '') : ''
  const chosen = paymentMethodChoice(method)
  const needsRef = methodNeedsReference(method)
  const isGcash = paymentKind(method) === 'gcash'

  // What is missing glows gold and shakes, and gets the cursor (the booking form's `bk-want`).
  const want = (el: HTMLElement | null) => {
    if (!el) return
    // Taken off and put back after a reflow, so a second miss shakes again.
    el.classList.remove('bw-want', 'bw-nope'); el.getBoundingClientRect(); el.classList.add('bw-want', 'bw-nope')
    el.querySelector('input')?.focus()
  }
  const pay = (m: string) => {
    if (other && !(otherAmount > 0)) { want(amountBox.current); return }
    if (methodNeedsReference(m)) { onMethod(m); return }
    onReceive(m)
  }
  const receive = () => {
    if (other && !(otherAmount > 0)) { want(amountBox.current); return }
    if (!reference.trim()) { want(refBox.current); return }
    onReceive()
  }

  const missing = !tried ? ''
    : other && !(otherAmount > 0) ? 'Enter the amount received.'
      : !chosen ? 'Choose how the guest paid.'
        : needsRef && !reference.trim() ? (isGcash ? 'Enter the GCash reference number.' : 'Enter the reference number.')
          : ''

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={'w-full ' + BTN + (loud ? LOUD + ' bw-shine' : QUIET)}>
        {differs && amount > 0 ? 'Receive ' + fmtPeso(amount) : 'Receive'}
      </button>
    )
  }

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
        <label ref={amountBox} className="block rounded-lg bw-unfold">
          <span className="block text-[12px] font-semibold text-muted">Amount received (₱)</span>
          <NumInput value={otherAmount} onChange={onOtherAmount} aria-label="Amount received"
            className="mt-1 w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[16px] focus:outline-none focus:border-gold-500" />
        </label>
      )}

      {needsRef ? (
        // GCash or a bank transfer: its reference number, then Receive.
        <>
          <p className="text-[12px] font-bold text-muted bw-rise">{sum}By {chosen === 'Bank transfer' ? 'bank transfer' : chosen}</p>
          <label ref={refBox} className="block rounded-lg bw-unfold">
            <span className="sr-only">{isGcash ? 'GCash reference no.' : 'Reference no.'}</span>
            <input
              autoFocus
              value={reference}
              onChange={e => onReference(e.target.value)}
              onBlur={onReferenceCommit}
              placeholder={isGcash ? 'GCash reference no.' : 'Reference no.'}
              className="w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[16px] font-mono focus:outline-none focus:border-gold-500"
            />
          </label>
          <div className="grid grid-cols-[1fr_54px] gap-1.5">
            <button type="button" onClick={receive} className={BTN + LOUD + ' bw-in'}>
              {differs && amount > 0 ? 'Receive ' + fmtPeso(amount) : 'Receive'}
            </button>
            <button type="button" onClick={() => onMethod('')} aria-label="Back to the ways to pay" className={BACK + ' bw-in [--i:1]'}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-[12px] font-bold text-muted bw-rise">{sum}Paid by</p>
          <div role="group" aria-label="How the guest paid" className="grid grid-cols-[repeat(4,minmax(0,1fr))_44px] gap-1.5">
            {PAYMENT_METHODS.map((m, i) => (
              <button key={m} type="button" onClick={() => pay(m)} style={{ '--i': i } as React.CSSProperties}
                className={'bw-in min-h-[54px] px-1 rounded-xl bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold transition-[background-color,transform] duration-200 active:scale-95 cursor-pointer'}>
                {m === 'Bank transfer' ? 'Bank' : m}
              </button>
            ))}
            <button type="button" onClick={() => { setOpen(false); onPayFor(choices[0]?.key || 'all') }} aria-label="Close the ways to pay"
              className={BACK + ' bw-in [--i:4]'}>
              <X className="w-4 h-4" />
            </button>
          </div>
        </>
      )}

      {missing && <p className="text-[12px] font-semibold text-danger-600">{missing}</p>}

      <button type="button" onClick={() => onPayFor(other ? choices[0].key : 'other')}
        className="block mx-auto min-h-11 px-2 text-[13px] font-semibold text-muted hover:text-main transition-colors cursor-pointer">
        {other ? 'Back to ' + fmtPeso(choices[0]?.amount || 0) : 'A different amount'}
      </button>
    </div>
  )
}

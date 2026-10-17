import { useRef } from 'react'
import { X } from 'lucide-react'
import { NumInput } from '../NumInput'
import { CountPeso } from '../CountPeso'
import { PAYMENT_METHODS, methodNeedsReference, paymentKind, paymentMethodChoice } from '../../utils/paymentMethod'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

interface ReceiveMoneyProps {
  /** What is owed now — the amount box starts filled with it. */
  owed: number
  /** The amount in the box. */
  amount: number
  onAmount: (n: number) => void
  /** The order slip this amount pays on its own, when it is exactly one slip's total. */
  slipLabel?: string
  /** How the guest paid. Empty until the desk picks — never assumed. */
  method: string
  onMethod: (m: string) => void
  reference: string
  onReference: (r: string) => void
  /** Saves the reference typed so far, on the way out of the box. */
  onReferenceCommit: () => void
  /** False when another step is the loud one (a stay billed to an agency). */
  loud?: boolean
  /** Shut, it is one Receive button; pressed, it opens into the amount and the ways to pay. */
  open: boolean
  onOpen: () => void
  onClose: () => void
  onReceive: () => void
}

const LOUD = 'bg-gold-400 hover:bg-gold-600 text-ink-900'
const QUIET = 'bg-card border border-soft text-main hover:border-gold-400 hover:bg-gold-100'

/**
 * Where money is written down — the one place on the booking panel (the owner's ruling:
 * *"money is taken in one place"*).
 *
 * **The amount is always there** (the Receive mock, design A, Sebastian, 2026-10-17: "keep
 * the custom pay a default"): a box filled with what is owed, typed over for any other
 * amount. Before it, four loud ways to pay each recorded the money in one tap, and the
 * amount hid behind "A different amount". Now the way to pay is picked on a sliding
 * control and one gold button says exactly what will be saved. How they paid is still
 * never assumed — a silent `Cash` is how a GCash guest once got a Cash receipt.
 */
export function ReceiveMoney({
  owed, amount, onAmount, slipLabel, method, onMethod, reference, onReference, onReferenceCommit,
  loud = true, open, onOpen, onClose, onReceive,
}: ReceiveMoneyProps) {
  const amountBox = useRef<HTMLLabelElement>(null)
  const seg = useRef<HTMLDivElement>(null)
  const refBox = useRef<HTMLLabelElement>(null)
  const chosen = paymentMethodChoice(method)
  const at = PAYMENT_METHODS.indexOf(chosen as (typeof PAYMENT_METHODS)[number])
  const needsRef = methodNeedsReference(method)
  const isGcash = paymentKind(method) === 'gcash'

  // What is missing glows gold and shakes, and gets the cursor (the booking form's `bk-want`).
  const want = (el: HTMLElement | null) => {
    if (!el) return
    // Taken off and put back after a reflow, so a second miss shakes again.
    el.classList.remove('bw-want', 'bw-nope'); el.getBoundingClientRect(); el.classList.add('bw-want', 'bw-nope')
    el.querySelector('input')?.focus()
  }
  const receive = () => {
    if (!(amount > 0)) { want(amountBox.current); return }
    if (!chosen) { want(seg.current); return }
    if (needsRef && !reference.trim()) { want(refBox.current); return }
    onReceive()
  }

  // Said under the box, so the desk knows what the figure will do before pressing.
  const hint = slipLabel ? 'Pays ' + slipLabel
    : amount > owed ? fmtPeso(amount - owed) + ' more than what is owed'
      : amount > 0 && amount < owed ? fmtPeso(owed - amount) + ' left after this'
        : ''

  // It opens one step at a time (the booking window mock, 2026-10-16): at first one button,
  // Receive — the amount is the big figure right above it (Sebastian, 2026-10-17: the box
  // "is only supposed to show when they click on the receive button first").
  if (!open) {
    return (
      <button type="button" onClick={onOpen}
        className={'w-full min-h-[54px] px-4 rounded-xl text-[16px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer ' + (loud ? LOUD + ' bw-shine' : QUIET)}>
        Receive
      </button>
    )
  }

  return (
    <div className="space-y-2.5">
      <label ref={amountBox} className="flex items-center gap-1.5 pl-3.5 pr-2 py-1.5 rounded-xl border-[1.5px] border-soft bg-card transition-[border-color,box-shadow] duration-200 focus-within:border-gold-400 focus-within:shadow-[0_0_0_4px_#F5EAD1] bw-rise">
        <span aria-hidden="true" className="font-display text-[22px] text-muted">₱</span>
        <NumInput value={amount} onChange={onAmount} aria-label="Amount received"
          className="flex-1 min-w-0 h-11 bg-transparent text-main font-display text-[22px] font-bold tabular-nums focus:outline-none" />
        {amount > 0 && (
          <button type="button" onClick={e => { e.preventDefault(); onAmount(0); amountBox.current?.querySelector('input')?.focus() }}
            aria-label="Clear the amount"
            className="shrink-0 w-11 h-11 rounded-full grid place-items-center text-muted hover:text-main transition-transform active:scale-90 cursor-pointer">
            <span className="w-8 h-8 rounded-full bg-paper-100 grid place-items-center"><X className="w-3.5 h-3.5" /></span>
          </button>
        )}
      </label>
      {hint && <p key={hint} className="-mt-1 text-[12px] font-bold text-gold-800 bw-rise">{hint}</p>}

      {/* The ways to pay: one dark pill slides to the one picked. */}
      <div ref={seg} role="group" aria-label="How the guest paid"
        className="relative grid grid-cols-4 gap-1 p-1 rounded-xl bg-paper-100 bw-rise [--i:1]">
        <span aria-hidden="true" style={{ '--at': Math.max(0, at) } as React.CSSProperties}
          className={'absolute top-1 bottom-1 left-1 w-[calc((100%-20px)/4)] rounded-lg bg-ink-900 [transform:translateX(calc(var(--at)*(100%+4px)))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.3,1.4,0.5,1)] ' + (at < 0 ? 'opacity-0' : 'opacity-100')} />
        {PAYMENT_METHODS.map(m => (
          <button key={m} type="button" aria-pressed={chosen === m} onClick={() => onMethod(m)}
            className={'relative min-h-[46px] rounded-lg text-[14px] font-bold transition-colors duration-200 cursor-pointer ' + (chosen === m ? 'text-white' : 'text-main')}>
            {m === 'Bank transfer' ? 'Bank' : m}
          </button>
        ))}
      </div>

      {needsRef && (
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
      )}

      <div className="grid grid-cols-[1fr_54px] gap-1.5">
        <button type="button" onClick={receive}
          className={'w-full min-h-[54px] px-4 rounded-xl text-[16px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer bw-rise [--i:2] ' + (loud ? LOUD + ' bw-shine' : QUIET)}>
          Receive {amount > 0 && <CountPeso value={amount} />}{chosen && ' · ' + (chosen === 'Bank transfer' ? 'Bank' : chosen)}
        </button>
        <button type="button" onClick={onClose} aria-label="Put the payment away"
          className="min-h-[54px] rounded-xl border border-soft bg-card text-muted hover:text-main grid place-items-center cursor-pointer bw-x bw-rise [--i:2]">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

import React, { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { PAYMENT_METHODS, methodNeedsReference } from '../../utils/paymentMethod'
import { dateToString } from '../../utils/helpers'
import { StatementLineItem } from '../../utils/statementLines'

const digits = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0

/**
 * What the desk can do on the bill itself (Sebastian, 2026-10-20: *"most of the time the staff
 * likes to work on payments on the guest billing paper"*). Given only when the bill is opened
 * from a booking the desk can change; a bill opened to print has none of it.
 */
export interface BillDeskActions {
  onPay: (p: { amount: number; method: string; reference: string; date: string; purpose: string }) => void
  onCharge: (name: string, amount: number) => void
  onRemove: (line: StatementLineItem) => void
  /** Whether a line (by its key) is this booking's own: on a bill of several rooms, another
   *  room's charge is taken off from that room's panel. */
  owns?: (key: string) => boolean
  /** A charge just taken off, which Undo puts back. */
  removed: { label: string } | null
  onUndo: () => void
  /** Prints the 58 mm receipt of the payment with this number. */
  onReceipt: (receipt: string) => void
}

// What is missing glows gold and shakes, and gets the cursor (the Receive box's `want`).
const want = (el: HTMLElement | null) => {
  if (!el) return
  el.classList.remove('bw-want', 'bw-nope'); el.getBoundingClientRect(); el.classList.add('bw-want', 'bw-nope')
  ;(el.matches('input') ? el : el.querySelector('input'))?.focus()
}
const SLOT = 'min-w-0 bg-transparent border-0 border-b-[1.5px] border-ink-900 rounded-none px-0.5 py-px text-[12px] font-bold text-ink-900 focus:outline-none focus:border-gold-400'
const GO = 'rounded-md bg-gold-400 hover:bg-gold-600 text-ink-900 text-[12px] font-bold py-1.5 px-3 active:scale-[0.97] transition-[background-color,transform] cursor-pointer'
const SHUT = 'rounded-md bg-card text-muted hover:text-main px-2 grid place-items-center active:scale-90 transition-transform cursor-pointer'
const BLANK = 'bill-blank w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md border-[1.5px] border-dashed text-[11px] cursor-pointer transition-colors'

/**
 * **The blank line under the payments** (the mock's "Blank line", his pick), in two rows (the
 * "what for" mock's C, Sebastian, 2026-10-20): what it was for and how much, then how they paid
 * and Record. The words are asked every time and print on the bill and the receipt. The amount
 * starts at 0, and the day is always today: there is no day to pick.
 * `open` is the bill's, so the payments above can fold away while one is written.
 */
export function WritePayment({ open, onOpen, onPay, again }: { open: boolean; onOpen: (open: boolean) => void; onPay: BillDeskActions['onPay']; again: boolean }) {
  const [purpose, setPurpose] = useState('')
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [miss, setMiss] = useState('')
  const forBox = useRef<HTMLInputElement>(null)
  const amountBox = useRef<HTMLInputElement>(null)
  const ways = useRef<HTMLDivElement>(null)
  const refBox = useRef<HTMLInputElement>(null)
  const needsRef = methodNeedsReference(method)
  const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)
  const picked = PAYMENT_METHODS.findIndex(m => m === method)

  if (!open) return (
    <button type="button" onClick={() => onOpen(true)}
      className={BLANK + ' my-0.5 border-gold-400 bg-paper-50 text-gold-800 font-bold hover:bg-gold-100'}>
      <Plus aria-hidden="true" className="w-3.5 h-3.5" />{again ? 'Another payment' : 'Write a payment'}
    </button>
  )
  const stop = (why: string, el: HTMLElement | null) => { setMiss(why); want(el) }
  const record = () => {
    if (!purpose.trim()) return stop('Write what it was for', forBox.current)
    if (!(amount > 0)) return stop('Type the amount received', amountBox.current)
    if (!method) return stop('Pick how they paid', ways.current)
    if (needsRef && !reference.trim()) return stop('Type the ' + short(method) + ' ref. no.', refBox.current)
    onPay({ amount, method, reference: needsRef ? reference.trim() : '', date: dateToString(new Date()), purpose: purpose.trim() })
    onOpen(false); setPurpose(''); setAmount(0); setMethod(''); setReference(''); setMiss('')
  }
  return (
    <form onSubmit={e => { e.preventDefault(); record() }} className="my-0.5 -mx-1.5 p-1.5 rounded-lg bg-gold-100 flex flex-col gap-1.5 bw-unfold">
      <div className="grid grid-cols-[minmax(0,1fr)_84px] gap-2 items-end">
        <input ref={forBox} autoFocus value={purpose} onChange={e => { setPurpose(e.target.value); setMiss('') }}
          placeholder="What for" aria-label="What the payment was for" className={SLOT + ' w-full text-[12.5px] font-semibold'} />
        <label className="flex items-baseline gap-0.5 border-b-2 border-ink-900 focus-within:border-gold-400 transition-colors">
          <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
          <input ref={amountBox} inputMode="numeric" placeholder="0" aria-label="Amount received"
            value={amount ? amount.toLocaleString() : ''} onChange={e => { setAmount(digits(e.target.value)); setMiss('') }}
            className="min-w-0 w-full bg-transparent border-0 p-0 text-right font-display text-[16px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        </label>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_30px_22px] gap-1">
        {/* How they paid: the dark thumb slides to the one picked. */}
        <div ref={ways} role="group" aria-label="How the guest paid" className="relative grid grid-cols-4 p-0.5 rounded-lg bg-card shadow-[inset_0_0_0_1.5px_#1C1C1C]">
          <span aria-hidden="true" style={{ '--i': Math.max(picked, 0) } as React.CSSProperties}
            className={'absolute top-0.5 bottom-0.5 left-0.5 w-[calc((100%-4px)/4)] rounded-md bg-ink-900 translate-x-[calc(var(--i)*100%)] transition-[transform,opacity] duration-[380ms] ease-[cubic-bezier(.34,1.4,.64,1)] ' + (picked < 0 ? 'opacity-0 scale-75' : '')} />
          {PAYMENT_METHODS.map(m => (
            <button key={m} type="button" aria-pressed={method === m}
              onClick={() => { setMethod(m); setMiss(''); if (!methodNeedsReference(m)) setReference('') }}
              className={'relative min-h-7 rounded-md text-[10.5px] font-bold transition-[color,transform] active:scale-90 cursor-pointer ' + (method === m ? 'text-white' : 'text-ink-900')}>
              {short(m)}
            </button>
          ))}
        </div>
        <button type="submit" aria-label="Record the payment"
          className="grid place-items-center rounded-lg bg-ink-900 hover:bg-ink-700 text-white active:scale-90 transition-[background-color,transform] cursor-pointer">
          <Check className="w-3.5 h-3.5" strokeWidth={3} />
        </button>
        <button type="button" onClick={() => { onOpen(false); setMiss('') }} aria-label="Not now"
          className="grid place-items-center rounded-md text-gold-800 hover:bg-white/60 active:scale-90 transition-transform cursor-pointer">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {needsRef && (
        <input ref={refBox} autoFocus value={reference} onChange={e => { setReference(e.target.value); setMiss('') }}
          placeholder={short(method) + ' ref. no.'} aria-label="Reference no."
          className={SLOT + ' font-mono text-[11px] bw-unfold'} />
      )}
      {miss && <span role="alert" className="text-[10px] font-semibold text-red-700">{miss}</span>}
    </form>
  )
}

/**
 * **"Add a charge"** under the bill's rows (Sebastian, 2026-10-20: *"staff should also be able
 * to add a bill in the billing statement. for example: DINNER - 300 pesos"*): what for and
 * how much, and it goes under Extras.
 */
export function AddCharge({ onCharge, cols }: { onCharge: BillDeskActions['onCharge']; cols: number }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const nameBox = useRef<HTMLInputElement>(null)
  const amountBox = useRef<HTMLInputElement>(null)
  const add = () => {
    if (!name.trim()) { want(nameBox.current); return }
    if (!(amount > 0)) { want(amountBox.current); return }
    onCharge(name.trim(), amount)
    setOpen(false); setName(''); setAmount(0)
  }
  return (
    <tr data-screen className="print:hidden">
      <td colSpan={cols} className="pt-1.5">
        {!open ? (
          <button type="button" onClick={() => setOpen(true)}
            className={BLANK + ' [animation:none] border-ink-200 text-muted font-semibold hover:border-gold-400 hover:text-gold-800 hover:bg-paper-50'}>
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />Add a charge
          </button>
        ) : (
          <form onSubmit={e => { e.preventDefault(); add() }} className="p-1.5 rounded-md bg-gold-100 flex items-center gap-1.5 bw-unfold">
            <input ref={nameBox} autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="What for · e.g. Dinner"
              aria-label="What the charge is for" className={SLOT + ' flex-1 font-semibold'} />
            <span className="text-[10px] text-muted">₱</span>
            <input ref={amountBox} inputMode="numeric" aria-label="Amount" value={amount ? amount.toLocaleString() : ''}
              onChange={e => setAmount(digits(e.target.value))} className={SLOT + ' w-16 text-right font-mono text-[13px]'} />
            <button type="submit" className={GO}>Add</button>
            <button type="button" onClick={() => { setOpen(false); setName(''); setAmount(0) }} aria-label="Not now" className={SHUT + ' self-stretch'}>
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        )}
      </td>
    </tr>
  )
}

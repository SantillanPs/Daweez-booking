import React, { useRef, useState } from 'react'
import { Check, ChevronDown, Plus } from 'lucide-react'
import { Floating } from '../calendar/BillRoomLines'
import { PAYMENT_METHODS, methodNeedsReference } from '../../utils/paymentMethod'
import { dateToString } from '../../utils/helpers'
import { useLateFocus, want } from './want'

/** A payment as the blank line writes it. */
export type PayInput = { amount: number; method: string; reference: string; date: string; purpose: string }

const digits = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0
/** `2026-09-14` → `Sep 14`, from the date's own parts. */
const shortDay = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return y ? new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '' }

const SLOT = 'min-w-0 bg-transparent border-0 border-b-[1.5px] border-ink-900 rounded-none px-0.5 py-px text-[12px] font-bold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-gold-400'
const BLANK = 'bill-blank w-full flex items-center gap-1.5 px-1.5 py-1 rounded-md border-[1.5px] border-dashed text-[11px] cursor-pointer transition-colors'
const OK = 'shrink-0 w-[30px] h-7 grid place-items-center rounded-lg bg-ink-900 hover:bg-ink-700 text-white active:scale-90 transition-[background-color,transform] cursor-pointer'
const LI = 'w-full flex items-center gap-2 px-2 py-[6px] rounded-lg text-left text-[11.5px] font-semibold text-ink-900 cursor-pointer hover:bg-gold-100 focus-visible:bg-gold-100 focus-visible:outline-none active:scale-[0.98] transition-[background-color,transform] bw-rise'
const MONEY = 'flex items-baseline gap-0.5 border-b-2 border-ink-900 focus-within:border-gold-400 transition-colors'
const MONEY_IN = 'min-w-0 w-20 bg-transparent border-0 p-0 text-right font-display text-[16px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none'

/**
 * **A payment, written in a box that floats over the bill** (Sebastian, 2026-10-27, the "Bill pop-ups"
 * mock: "I like how editing these shows a pop up. I want to apply that to everything editable in the
 * billing statement"). What it was for, then the amount with how they paid beside it and the ✓, then
 * the ref. no. under them when the way has one. How they paid shows only the one picked; a tap on it
 * lists the four (the mock's B). Nothing is picked for them: a silent Cash on a GCash guest is the
 * mistake `paymentMethodChoice` was written against. The day is today, except on a paper booking.
 * `open` is the bill's, so the payments above can fold away while one is written.
 */
export function WritePayment({ open, onOpen, onPay, again, paidOn, fills, sheet }: {
  open: boolean; onOpen: (open: boolean) => void; onPay: (p: PayInput) => void; again: boolean
  /** **Quick fills** — the booking form's deposit choices on a new booking's bill (Deposit, Full
   *  pay): a tap writes what for and how much. */
  fills?: { label: string; amount: number }[]
  /** **The day it was paid, as a chip** — only on a paper booking being logged, whose money was
   *  not taken today (the log-on-the-bill mock, Sebastian, 2026-10-23). Opens on this day. */
  paidOn?: string
  /** What the box floats in. */
  sheet: HTMLElement | null
}) {
  const [purpose, setPurpose] = useState('')
  const [day, setDay] = useState(paidOn ?? '')
  const [amount, setAmount] = useState(0)
  const [method, setMethod] = useState('')
  const [choosing, setChoosing] = useState(false)
  const [reference, setReference] = useState('')
  const [miss, setMiss] = useState('')
  const blank = useRef<HTMLButtonElement>(null)
  const forBox = useRef<HTMLInputElement>(null)
  const amountBox = useRef<HTMLInputElement>(null)
  const way = useRef<HTMLButtonElement>(null)
  const refBox = useRef<HTMLInputElement>(null)
  const needsRef = methodNeedsReference(method)
  const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)
  useLateFocus(forBox, open)
  useLateFocus(refBox, needsRef)

  const stop = (why: string, el: HTMLElement | null) => { setMiss(why); want(el) }
  const shut = () => { onOpen(false); setMiss(''); setChoosing(false) }
  const record = () => {
    if (!purpose.trim()) return stop('Write what it was for', forBox.current)
    if (!(amount > 0)) return stop('Type the amount received', amountBox.current)
    if (!method) { setChoosing(true); return stop('Pick how they paid', way.current) }
    if (needsRef && !reference.trim()) return stop('Type the ' + short(method) + ' ref. no.', refBox.current)
    onPay({ amount, method, reference: needsRef ? reference.trim() : '', date: paidOn ? day || paidOn : dateToString(new Date()), purpose: purpose.trim() })
    shut(); setPurpose(''); setAmount(0); setMethod(''); setReference('')
  }
  return (
    <>
      <button ref={blank} type="button" onClick={() => (open ? shut() : onOpen(true))} aria-expanded={open}
        className={BLANK + ' my-0.5 border-gold-400 bg-paper-50 text-gold-800 font-bold hover:bg-gold-100 aria-expanded:bg-gold-100 aria-expanded:border-solid'}>
        <Plus aria-hidden="true" className="w-3.5 h-3.5" />{again ? 'Another payment' : 'Write a payment'}
      </button>
      {open && sheet && (
        <Floating at={() => blank.current!} sheet={sheet} right label="A payment" onClose={shut}>
          <form onSubmit={e => { e.preventDefault(); record() }} className="w-[236px] flex flex-col gap-1.5 p-1">
            {fills && fills.length > 0 && (
              <div className="flex gap-1">
                {fills.map(f => {
                  const on = purpose === f.label && amount === f.amount
                  return (
                    <button key={f.label} type="button" aria-pressed={on} onClick={() => { setPurpose(f.label); setAmount(f.amount); setMiss('') }}
                      className={'flex-1 min-h-7 px-2 rounded-lg border-[1.5px] text-[10.5px] font-bold active:scale-95 transition-[border-color,background-color,color,transform] cursor-pointer ' +
                        (on ? 'border-ink-900 bg-ink-900 text-white' : 'border-gold-400 bg-paper-50 text-ink-900 hover:bg-white')}>
                      {f.label} <span className="font-mono font-semibold opacity-70">₱{f.amount.toLocaleString()}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {paidOn && (
              <label className="relative self-start flex items-center gap-1 min-h-7 px-2.5 rounded-lg bg-gold-400 hover:bg-gold-500 text-ink-900 text-[10.5px] font-bold whitespace-nowrap cursor-pointer transition-colors">
                Paid on {shortDay(day || paidOn)}
                <input type="date" value={day || paidOn} onChange={e => e.target.value && setDay(e.target.value)} aria-label="Day it was paid"
                  onClick={e => { try { e.currentTarget.showPicker() } catch { /* the browser opens it itself */ } }}
                  className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            )}
            <input ref={forBox} value={purpose} onChange={e => { setPurpose(e.target.value); setMiss('') }}
              placeholder="What for · e.g. Deposit" aria-label="What the payment was for" className={SLOT + ' w-full text-[16px] font-semibold'} />
            <div className="flex items-center gap-1.5">
              <label className={MONEY + ' flex-1'}>
                <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
                <input ref={amountBox} inputMode="numeric" placeholder="0" aria-label="Amount received"
                  value={amount ? amount.toLocaleString() : ''} onChange={e => { setAmount(digits(e.target.value)); setMiss('') }} className={MONEY_IN + ' flex-1'} />
              </label>
              <button ref={way} type="button" onClick={() => setChoosing(c => !c)} aria-expanded={choosing} aria-label="How the guest paid"
                className={'group shrink-0 inline-flex items-center gap-0.5 min-h-7 px-0.5 border-b-[1.5px] border-dashed border-gold-400 text-[11.5px] font-bold active:scale-95 transition-transform cursor-pointer ' + (method ? 'text-ink-900' : 'text-gold-800')}>
                <span key={method} className="inline-block bw-rise">{method ? short(method) : 'How paid?'}</span>
                <ChevronDown aria-hidden="true" className="w-3 h-3 text-gold-600 transition-transform duration-300 group-aria-expanded:rotate-180" />
              </button>
              <button type="submit" aria-label="Record the payment" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3} /></button>
            </div>
            {needsRef && (
              <input ref={refBox} value={reference} onChange={e => { setReference(e.target.value); setMiss('') }}
                placeholder="Ref no. · e.g. 4012 3381 22" aria-label={short(method) + ' ref. no.'}
                className={SLOT + ' w-full text-[16px] font-semibold bw-unfold'} />
            )}
            {miss && <span role="alert" className="text-[10px] font-semibold text-red-700">{miss}</span>}
          </form>
        </Floating>
      )}
      {/* How they paid opens a popup of its own beside the box, so the box keeps its size. */}
      {open && choosing && sheet && (
        <Floating at={() => way.current!} sheet={sheet} right nested label="How the guest paid" onClose={() => setChoosing(false)}>
          <div role="radiogroup" aria-label="How the guest paid" className="w-[140px]">
            {PAYMENT_METHODS.map((m, i) => (
              <button key={m} type="button" role="radio" aria-checked={method === m} style={{ '--i': i } as React.CSSProperties}
                onClick={() => { setMethod(m); setChoosing(false); setMiss(''); if (!methodNeedsReference(m)) setReference('') }} className={LI}>
                {m}{method === m && <span aria-hidden="true" className="ml-auto">✓</span>}
              </button>
            ))}
          </div>
        </Floating>
      )}
    </>
  )
}

/**
 * **"Add a charge"** under the bill's rows (Sebastian, 2026-10-20: *"staff should also be able
 * to add a bill in the billing statement. for example: DINNER - 300 pesos"*): what for and
 * how much, and it goes under Extras. Written in a box that floats over the bill (2026-10-27).
 */
export function AddCharge({ onCharge, cols, beside, presets, sheet }: {
  onCharge: (name: string, amount: number) => void; cols: number
  /** Blanks that sit to its left — a logged paper's Breakfast. */
  beside?: React.ReactNode
  /** Ready-priced extras offered as chips when it opens (a new booking's Foam, Pillow…); each tap
   *  adds one more. "Something else" is the ordinary name and price. */
  presets?: { label: string; price: number; onPick: () => void }[]
  /** What the box floats in. */
  sheet: HTMLElement | null
}) {
  const [other, setOther] = useState(false)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState(0)
  const blank = useRef<HTMLButtonElement>(null)
  const nameBox = useRef<HTMLInputElement>(null)
  const amountBox = useRef<HTMLInputElement>(null)
  const typing = open && (!presets || other)
  useLateFocus(nameBox, typing)
  const shut = () => { setOpen(false); setOther(false); setName(''); setAmount(0) }
  const add = () => {
    if (!name.trim()) { want(nameBox.current); return }
    if (!(amount > 0)) { want(amountBox.current); return }
    onCharge(name.trim(), amount)
    shut()
  }
  return (
    <tr data-screen className="print:hidden">
      <td colSpan={cols} className="pt-1.5">
        <div className="flex gap-1.5">
          {beside}
          <button ref={blank} type="button" onClick={() => (open ? shut() : setOpen(true))} aria-expanded={open}
            className={BLANK + ' flex-1 [animation:none] border-ink-200 text-muted font-semibold hover:border-gold-400 hover:text-gold-800 hover:bg-paper-50 aria-expanded:border-gold-400 aria-expanded:text-gold-800 aria-expanded:bg-gold-100'}>
            <Plus aria-hidden="true" className="w-3.5 h-3.5" />Add a charge
          </button>
        </div>
        {open && sheet && (
          <Floating at={() => blank.current!} sheet={sheet} label="Add a charge" onClose={shut}>
            {!typing ? (
              <div className="flex flex-wrap items-center gap-1.5 p-1 max-w-[300px]">
                {presets!.map(p => (
                  <button key={p.label} type="button" onClick={p.onPick}
                    className="min-h-8 px-2.5 rounded-md border-[1.5px] border-gold-400 bg-paper-50 hover:bg-white text-[11px] font-bold text-ink-900 active:scale-90 transition-[background-color,transform] cursor-pointer">
                    {p.label} <span className="font-mono text-[10px] font-semibold text-muted">₱{p.price}</span>
                  </button>
                ))}
                <button type="button" onClick={() => setOther(true)}
                  className="min-h-8 px-2.5 rounded-md border-[1.5px] border-dashed border-gold-400 text-[11px] font-bold text-gold-800 hover:bg-gold-100 active:scale-95 transition-[background-color,transform] cursor-pointer">Something else…</button>
              </div>
            ) : (
              <form onSubmit={e => { e.preventDefault(); add() }} className="flex items-end gap-1.5 p-1">
                <input ref={nameBox} value={name} onChange={e => setName(e.target.value)} placeholder="What for · e.g. Dinner"
                  aria-label="What the charge is for" className={SLOT + ' w-40 text-[16px] font-semibold'} />
                <label className={MONEY}>
                  <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
                  <input ref={amountBox} inputMode="numeric" placeholder="300" aria-label="Amount" value={amount ? amount.toLocaleString() : ''}
                    onChange={e => setAmount(digits(e.target.value))} className={MONEY_IN + ' !w-16'} />
                </label>
                <button type="submit" aria-label="Add the charge" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3} /></button>
              </form>
            )}
          </Floating>
        )}
      </td>
    </tr>
  )
}

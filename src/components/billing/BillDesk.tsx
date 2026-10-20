import { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { PAYMENT_METHODS, methodNeedsReference } from '../../utils/paymentMethod'
import { dateToString } from '../../utils/helpers'
import { StatementLineItem } from '../../utils/statementLines'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()
const digits = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0

/**
 * What the desk can do on the bill itself (Sebastian, 2026-10-20: *"most of the time the staff
 * likes to work on payments on the guest billing paper"*). Given only when the bill is opened
 * from a booking the desk can change; a bill opened to print has none of it.
 */
export interface BillDeskActions {
  onPay: (p: { amount: number; method: string; reference: string; date: string }) => void
  onCharge: (name: string, amount: number) => void
  onRemove: (line: StatementLineItem) => void
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
 * **The blank line under the payments** (the mock's "Blank line", his pick): the payment is
 * written where the paper lists them — the day, the amount, how they paid — then Record.
 * The amount starts at what is due and is typed over for any other figure; the day is today
 * unless the desk is catching up on a payment taken earlier.
 */
export function WritePayment({ due, onPay, again }: { due: number; onPay: BillDeskActions['onPay']; again: boolean }) {
  const today = dateToString(new Date())
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(due)
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [date, setDate] = useState(today)
  const amountBox = useRef<HTMLInputElement>(null)
  const ways = useRef<HTMLDivElement>(null)
  const refBox = useRef<HTMLInputElement>(null)
  const needsRef = methodNeedsReference(method)
  const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)

  if (!open) return (
    <button type="button" onClick={() => { setAmount(due); setOpen(true) }}
      className={BLANK + ' my-0.5 border-gold-400 bg-paper-50 text-gold-800 font-bold hover:bg-gold-100'}>
      <Plus aria-hidden="true" className="w-3.5 h-3.5" />{again ? 'Another payment' : 'Write a payment'}
    </button>
  )
  const record = () => {
    if (!(amount > 0)) { want(amountBox.current); return }
    if (!method) { want(ways.current); return }
    if (needsRef && !reference.trim()) { want(refBox.current); return }
    onPay({ amount, method, reference: needsRef ? reference.trim() : '', date })
    setOpen(false); setMethod(''); setReference(''); setDate(today)
  }
  const dayWord = date === today ? 'Today' : new Date(date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <div className="my-0.5 -mx-1.5 p-1.5 rounded-md bg-gold-100 flex flex-col gap-1 bw-unfold">
      <div className="flex items-baseline gap-1">
        {/* The day: today, or the day the guest really paid when it is written in later. */}
        <label className="relative cursor-pointer">
          <span className={SLOT + ' inline-block'}>{dayWord} ▾</span>
          <input type="date" value={date} max={today} onChange={e => e.target.value && setDate(e.target.value)}
            aria-label="Day it was paid" className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <span className="ml-auto text-[10px] text-muted">−₱</span>
        <input ref={amountBox} autoFocus inputMode="numeric" aria-label="Amount received"
          value={amount ? amount.toLocaleString() : ''} onChange={e => setAmount(digits(e.target.value))}
          onFocus={e => e.target.select()}
          className={SLOT + ' w-16 text-right font-mono text-[13px]'} />
      </div>
      <div ref={ways} role="group" aria-label="How the guest paid" className="grid grid-cols-4 gap-0.5 rounded-md">
        {PAYMENT_METHODS.map(m => (
          <button key={m} type="button" aria-pressed={method === m} onClick={() => { setMethod(m); if (!methodNeedsReference(m)) setReference('') }}
            className={'min-h-7 rounded-[5px] border-[1.5px] border-ink-900 text-[10.5px] font-bold transition-[background-color,color,transform] active:scale-90 cursor-pointer ' +
              (method === m ? 'bg-ink-900 text-white' : 'bg-card text-ink-900')}>
            {short(m)}
          </button>
        ))}
      </div>
      {needsRef && (
        <input ref={refBox} autoFocus value={reference} onChange={e => setReference(e.target.value)}
          placeholder={method === 'GCash' ? 'GCash ref. no.' : 'Ref. no.'} aria-label="Reference no."
          className={SLOT + ' font-mono text-[11px] bw-unfold'} />
      )}
      <div className="flex gap-1">
        <button type="button" onClick={record} className={GO + ' flex-1'}>
          Record {fmtPeso(amount)}{method && ' · ' + short(method)}
        </button>
        <button type="button" onClick={() => setOpen(false)} aria-label="Not now" className={SHUT}>
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
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

import { CSSProperties, FormEvent, ReactNode, useEffect, useRef, useState } from 'react'
import { Banknote, Check, ChevronLeft, ChevronRight, FileText, Landmark, Smartphone, Trash2, X } from 'lucide-react'
import { dateToString } from '../../utils/helpers'
import { hotelDay, MoneyInLine } from '../../utils/dailyReport'
import { PAYMENT_METHODS, methodNeedsReference, paymentMethodChoice } from '../../utils/paymentMethod'
import type { PaymentPatch } from '../walk-in/bookingPayment'

type Method = (typeof PAYMENT_METHODS)[number]

const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)

// Sebastian, 2026-11-01: "make the color and icons consistent with the system's theme and style".
// So every way to pay is one line icon in one colour; the tints it had are gone from this slip.
const Mark = ({ method }: { method: Method }) => (
  method === 'GCash' ? <Smartphone aria-hidden="true" className="w-3.5 h-3.5" />
    : method === 'Cash' ? <Banknote aria-hidden="true" className="w-3.5 h-3.5" />
      : method === 'Check' ? <FileText aria-hidden="true" className="w-3.5 h-3.5" />
        : <Landmark aria-hidden="true" className="w-3.5 h-3.5" />
)
// The method and the day are one kind of chip: paper ground, ink words, the sign in gold.
export const CHIP = 'inline-flex items-center gap-1 h-7 rounded-lg bg-paper-100 text-ink-900 text-[12px] font-bold aria-expanded:shadow-[inset_0_0_0_1.5px_#1C1C1C] active:scale-95 transition-[box-shadow,transform] cursor-pointer'

// Every piece of the second row is 28 tall with one corner; the tap reaches a little past it.
export const TAP_AREA = "relative after:content-[''] after:absolute after:-inset-y-1.5 after:-inset-x-0.5"

// The day as a small month: nothing after today can be picked.
export function MonthGrid({ day, today, onPick }: { day: string; today: string; onPick: (day: string) => void }) {
  const [month, setMonth] = useState(day.slice(0, 7))
  const [y, m] = month.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const count = new Date(y, m, 0).getDate()
  const step = (by: number) => setMonth(dateToString(new Date(y, m - 1 + by, 1)).slice(0, 7))
  const nav = 'w-7 h-7 grid place-items-center rounded-lg text-gold-800 hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer'
  return (
    <div className="pt-2 max-w-[232px]">
      <div className="flex items-center justify-between h-7 font-display text-[12px] font-bold text-main">
        <button type="button" onClick={() => step(-1)} aria-label="Month before" className={nav}><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span key={month} className="bw-rise">{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        {month < today.slice(0, 7)
          ? <button type="button" onClick={() => step(1)} aria-label="Month after" className={nav}><ChevronRight className="w-3.5 h-3.5" /></button>
          : <span className="w-7" />}
      </div>
      <div className="grid grid-cols-7 pb-0.5 text-center text-[9.5px] font-bold text-muted">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: first.getDay() }, (_, i) => <span key={'b' + i} />)}
        {Array.from({ length: count }, (_, i) => {
          const iso = month + '-' + String(i + 1).padStart(2, '0')
          if (iso > today) return <span key={iso} className="h-7 grid place-items-center text-[12px] font-semibold text-paper-400">{i + 1}</span>
          return (
            <button key={iso} type="button" aria-pressed={iso === day} onClick={() => onPick(iso)}
              className={'h-7 grid place-items-center rounded-lg text-[12px] font-semibold hover:bg-gold-100 aria-pressed:bg-ink-900 aria-pressed:text-white aria-pressed:font-extrabold active:scale-[.88] transition-[background-color,transform] cursor-pointer ' + (iso === today ? 'shadow-[inset_0_0_0_1.5px_#D0AB60]' : '')}>
              {i + 1}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * **A payment fixed from Money in** (Sebastian, 2026-11-01, B of the mock: "make the income editable when
 * the staff click on an edit button for a payment"). A small slip floats under the pencil and pushes
 * nothing. What it was for and the amount come first, on one line; how they paid and the day show only
 * what they are now, and a tap unfolds the choices ("the payment method and date should be contextual").
 * Nothing changes until ✓, and then only the parts that were really changed. The save happens behind it.
 */
export function PaymentEdit({ line, today, onSave, onRemove, onClose }: {
  line: MoneyInLine
  today: string
  /** `label` is the name of money in linked to nothing, which has no "what for" of its own. */
  onSave: (patch: PaymentPatch, label?: string) => void
  /** Takes the payment back off everything it paid for. */
  onRemove: () => void
  onClose: () => void
}) {
  const plain = line.slip && !!line.hand && !line.place
  const was = {
    what: plain ? line.who : line.purpose || '',
    method: (paymentMethodChoice(line.method) || 'Cash') as Method,
    reference: line.reference || '',
    day: hotelDay(line.paidAt) || today,
  }
  const [what, setWhat] = useState(was.what)
  const [amount, setAmount] = useState(String(line.amount))
  const [method, setMethod] = useState<Method>(was.method)
  const [reference, setReference] = useState(was.reference)
  const [day, setDay] = useState(was.day)
  const [open, setOpen] = useState<'method' | 'day' | null>(null)
  const [tried, setTried] = useState(false)
  // Remove asks once, right where it was tapped: the bin turns into the word, a second tap means it.
  const [removing, setRemoving] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const amountRef = useRef<HTMLInputElement>(null)
  const refRef = useRef<HTMLInputElement>(null)

  const value = parseFloat(amount) || 0
  const needsRef = methodNeedsReference(method)
  const problem = !tried ? '' : value <= 0 ? 'Write the amount.' : needsRef && !reference.trim() ? 'Write the ref no.' : ''

  useEffect(() => { amountRef.current?.select() }, [])
  // The month can reach past the bottom of the screen, so the page moves to show it.
  useEffect(() => { form.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }) }, [open])

  // A tap anywhere else shuts it, and that tap does nothing else (it would otherwise open the bill
  // behind). Another payment's pencil still works, so going from one to the next takes one tap.
  useEffect(() => {
    const away = (e: MouseEvent) => {
      const at = e.target as Element
      if (form.current?.contains(at) || at.closest?.('[data-pay-pen]')) return
      e.stopPropagation()
      onClose()
    }
    document.addEventListener('click', away, true)
    return () => document.removeEventListener('click', away, true)
  }, [onClose])

  const typeAmount = (raw: string) => {
    let s = raw.replace(/[^0-9.]/g, '')
    const dot = s.indexOf('.')
    if (dot !== -1) s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, '')
    setAmount(s)
  }
  const pickMethod = (m: Method) => {
    setMethod(m)
    setOpen(null)
    if (methodNeedsReference(m)) setTimeout(() => refRef.current?.focus())
  }
  const save = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (value <= 0) { amountRef.current?.focus(); return }
    if (needsRef && !reference.trim()) { refRef.current?.focus(); return }
    const patch: PaymentPatch = {}
    const name = what.trim()
    if (!plain && name !== was.what) patch.purpose = name || undefined
    if (value !== line.amount) patch.amount = value
    if (method !== was.method) patch.method = method
    const ref = needsRef ? reference.trim() : ''
    if (ref !== (methodNeedsReference(was.method) ? was.reference : '')) patch.reference = ref || undefined
    // A new day keeps the time of day it was written, the way the bill moves a payment.
    if (day !== was.day) {
      const [y, m, d] = day.split('-').map(Number)
      const at = new Date(line.paidAt || day + 'T12:00:00')
      at.setFullYear(y, m - 1, d)
      patch.paid_at = at.toISOString()
    }
    const label = plain && name !== was.what ? name || 'Money in' : undefined
    if (Object.keys(patch).length === 0 && label === undefined) { onClose(); return }
    onSave(patch, label)
  }

  const [, monthNum, dayNum] = day.split('-').map(Number)
  const monthWord = new Date(2000, monthNum - 1, 1).toLocaleDateString('en-US', { month: 'short' })
  const unfold = (body: ReactNode) => <div className="bw-unfold">{body}</div>

  return (
    <form ref={form} onSubmit={save} role="dialog" aria-label="Edit this payment"
      onClick={e => e.stopPropagation()}
      onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); if (open) setOpen(null); else onClose() } }}
      className="absolute right-[-4px] top-[calc(100%-2px)] z-20 scroll-mb-24 lg:scroll-mb-4 w-[252px] max-w-[calc(100vw-40px)] bg-card rounded-lg shadow-softLg ring-1 ring-gold-100 px-2.5 pt-1.5 pb-2.5 text-left [animation:bp-slide_.22s_cubic-bezier(.16,1,.3,1)]">
      {/* Label and amount are one line on one rule, so they read as one thing. */}
      <div className="flex items-center gap-2 h-8 border-b-[1.5px] border-ink-900 focus-within:border-gold-400 transition-colors">
        <input value={what} onChange={e => setWhat(e.target.value)} aria-label="What it was for"
          placeholder={plain ? 'e.g. Sold old bedsheets' : 'e.g. Balance'}
          className="flex-1 min-w-0 bg-transparent border-0 p-0 font-sans text-[16px] md:text-[14px] font-bold text-ink-900 placeholder:text-[13px] placeholder:font-medium placeholder:text-paper-400 focus:outline-none" />
        <label className="flex-none flex items-baseline gap-0.5">
          <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
          <input ref={amountRef} inputMode="decimal" value={amount} onChange={e => typeAmount(e.target.value)} placeholder="1,200" aria-label="Amount received"
            className="w-[72px] min-w-0 bg-transparent border-0 p-0 text-right font-display text-[18px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        </label>
      </div>
      <div className="flex items-center gap-2 mt-2">
        <button type="button" aria-expanded={open === 'method'} aria-label={'How they paid: ' + method} onClick={() => setOpen(o => (o === 'method' ? null : 'method'))}
          className={TAP_AREA + ' pl-1.5 pr-2 ' + CHIP}>
          <span key={method} className="inline-flex items-center gap-1 [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]"><span className="text-gold-800"><Mark method={method} /></span>{short(method)}</span>
        </button>
        {/* The month stands where the method's icon stands, so the day never needs saying twice. */}
        <button type="button" aria-expanded={open === 'day'} aria-label={'Day it was paid: ' + monthWord + ' ' + dayNum} onClick={() => setOpen(o => (o === 'day' ? null : 'day'))}
          className={TAP_AREA + ' px-2 ' + CHIP}>
          <span key={day} className="inline-flex items-center gap-1 [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">
            <i className="not-italic text-gold-800 text-[9px] font-extrabold tracking-[.05em] uppercase">{monthWord}</i>
            {dayNum}
          </span>
        </button>
        <span className="ml-auto flex-none flex items-center gap-1">
          {/* Armed, Remove stands where the bin and ✕ stood, at their width, so nothing else in the row moves
              (Sebastian, 2026-11-03: the wider word pushed ✓ out of the slip). A tap anywhere else puts them back. */}
          {removing ? (
            <button type="button" onClick={onRemove} onBlur={() => setRemoving(false)} autoFocus
              className={TAP_AREA + ' w-[60px] h-7 grid place-items-center rounded-lg bg-danger-600 hover:bg-danger-500 text-white text-[12px] font-bold active:scale-90 transition-[background-color,transform] cursor-pointer [animation:bp-ready_.35s_cubic-bezier(.34,1.56,.64,1)]'}>
              Remove
            </button>
          ) : (
            <>
              <button type="button" onClick={() => { setOpen(null); setRemoving(true) }} aria-label="Remove this payment"
                className={TAP_AREA + ' w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-danger-600 hover:bg-danger-50 active:scale-90 transition-[background-color,color,transform] cursor-pointer'}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={onClose} aria-label="Close" className={TAP_AREA + ' w-7 h-7 grid place-items-center rounded-lg text-muted hover:text-main hover:bg-page cursor-pointer'}>
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button type="submit" aria-label="Save" className={TAP_AREA + ' w-8 h-7 grid place-items-center rounded-lg bg-ink-900 hover:bg-ink-700 text-white active:scale-90 transition-[background-color,transform] cursor-pointer'}>
            <Check className="w-3.5 h-3.5" strokeWidth={3} />
          </button>
        </span>
      </div>
      {open === 'method' && unfold(
        <div role="group" aria-label="How they paid" className="grid grid-cols-4 gap-1 pt-2">
          {PAYMENT_METHODS.map((m, i) => (
            <button key={m} type="button" aria-pressed={m === method} onClick={() => pickMethod(m)} style={{ '--i': i } as CSSProperties}
              className="bw-rise group flex flex-col items-center justify-center gap-0.5 min-h-[44px] rounded-lg text-[10.5px] font-bold text-muted aria-pressed:text-ink-900 hover:bg-gold-100 active:scale-[.93] transition-[background-color,transform] cursor-pointer">
              <span className="w-6 h-6 grid place-items-center rounded-[7px] bg-paper-100 text-gold-800 group-aria-pressed:bg-ink-900 group-aria-pressed:text-white transition-colors"><Mark method={m} /></span>
              {short(m)}
            </button>
          ))}
        </div>,
      )}
      {open === 'day' && unfold(<MonthGrid day={day} today={today} onPick={d => { setDay(d); setOpen(null) }} />)}
      {needsRef && (
        <input ref={refRef} value={reference} onChange={e => setReference(e.target.value)} placeholder="Ref no. · e.g. 4012 3381 22" aria-label="Reference number"
          className="block w-full mt-2 h-7 bg-transparent border-0 border-b-[1.5px] border-ink-900 rounded-none px-0.5 text-[16px] md:text-[12px] font-semibold text-ink-900 placeholder:text-paper-400 placeholder:font-medium focus:outline-none focus:border-gold-400 transition-colors [animation:bp-slide_.25s_cubic-bezier(.16,1,.3,1)]" />
      )}
      {problem && <p role="alert" className="mt-1 text-[11px] font-semibold text-danger-600 [animation:bp-slide_.25s]">{problem}</p>}
    </form>
  )
}

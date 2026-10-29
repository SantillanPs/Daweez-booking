import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Floating } from '../calendar/BillRoomLines'
import { PAYMENT_METHODS, methodNeedsReference, paymentMethodChoice, paymentMethodLabel } from '../../utils/paymentMethod'
import type { StatementPayment } from '../../utils/statement'
import type { PaymentPatch } from '../walk-in/bookingPayment'
import { dateToString } from '../../utils/helpers'

type Part = 'purpose' | 'method' | 'amount' | 'day'

const digits = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0
const money = (n: number) => '₱' + n.toLocaleString()
const shortDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)

// A part of the line that opens its fix: the bill's own dashed-gold tap (the room lines' VAL), always
// showing — on a tablet nothing hovers (Sebastian, 2026-10-25: "they aren't very obvious they are editable").
const PART = 'px-0.5 -mx-0.5 rounded-sm border-b-[1.5px] border-dashed border-gold-400 hover:bg-gold-100 aria-expanded:border-solid aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,border-color,transform] cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400'
// The paper's boxes: a blank to write on is a gold dashed line, ✓ a gold outline (the Paper mock, 2026-10-29).
const SLOT = 'min-w-0 flex-1 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 py-px text-[12.5px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-solid'
const OK = 'shrink-0 w-[30px] h-7 grid place-items-center rounded-[3px] text-gold-800 shadow-[inset_0_0_0_1.5px_#D0AB60] hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer'
const LI = 'w-full flex items-center gap-2 px-2 py-[7px] border-b border-dotted border-ink-200 last:border-b-0 text-left text-[11.5px] font-semibold text-ink-900 cursor-pointer hover:text-gold-800 focus-visible:text-gold-800 focus-visible:outline-none active:scale-[0.98] transition-[color,transform] bw-rise group'
// One payment is one line of the ledger: a slot for its receipt, what for, the day, how, and the amount
// in green (Sebastian, 2026-10-29, the Paper mock: "I don't like how each item is a dropdown inside a
// dropdown"; gold is what can be changed, green a payment's amount).
const ROW = 'grid grid-cols-[14px_minmax(0,1fr)_auto_auto_62px] gap-x-2 items-baseline py-1 pl-3.5 text-[10.5px]'
const AMOUNT = 'justify-self-center font-mono text-[11px] font-bold text-emerald-700'

/** A payment's line where it cannot be changed: a new booking's first payment, a bill opened away from the desk. */
export function PayRow({ purpose, method, amount, under }: { purpose: React.ReactNode; method: React.ReactNode; amount: React.ReactNode; under?: React.ReactNode }) {
  return (
    <div className={ROW}>
      <span />
      <span className="min-w-0 truncate font-bold text-ink-900">{purpose}</span>
      <span className="font-medium text-muted tabular-nums">{under}</span>
      <span className="font-medium text-muted">{method}</span>
      <span className={AMOUNT}>{amount}</span>
    </div>
  )
}

// The receipt: a small slip, as it comes off the roll.
const Slip = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z" /><path d="M9 8h6M9 12h6" />
  </svg>
)

/**
 * **A payment on the bill, fixed where it is wrong** (Sebastian, 2026-10-24, the "Fixing a payment"
 * mock): each part of its line is its own tap, and a small box floats over the bill under it and
 * never pushes it. Taking a payment back stays on the booking panel ("i don't like the take back the
 * whole payment"). The paper keeps the plain line. The receipt is the slip at the start of the line
 * (2026-10-29, "what about the payment receipt and ref no.?"): its number, the ref. no., Print and Email.
 */
export function FixPayment({ p, sheet, onFix, onReceipt }: {
  p: StatementPayment
  /** What the boxes float in (the bill's money column). */
  sheet: HTMLElement | null
  onFix: (patch: PaymentPatch) => void
  onReceipt?: (receipt: string, start?: 'print' | 'email') => void
}) {
  const [open, setOpen] = useState<Part | 'receipt' | null>(null)
  const chips = useRef<Partial<Record<Part | 'receipt', HTMLButtonElement | null>>>({})
  const at = useCallback(() => chips.current[open || 'amount'] as HTMLElement, [open])
  const close = useCallback(() => setOpen(null), [])
  const method = paymentMethodChoice(p.method)
  const save = (patch: PaymentPatch) => {
    setOpen(null)
    const changed = (Object.keys(patch) as (keyof PaymentPatch)[]).some(k => (patch[k] ?? '') !== ((k === 'amount' ? p.amount : k === 'paid_at' ? p.paidAt : p[k]) ?? ''))
    if (changed) onFix(patch)
  }
  const part = (which: Part, name: string, value: string, look: string) => (
    <button ref={el => { chips.current[which] = el }} type="button" aria-expanded={open === which} aria-label={'Change ' + name}
      onClick={() => setOpen(o => (o === which ? null : which))} className={PART + ' ' + look}>
      <span key={value} className={'bw-rise' + (value ? '' : ' text-gold-800 font-bold')}>{value || 'What for?'}</span>
    </button>
  )
  const ref = methodNeedsReference(method) ? p.reference : ''
  return (
    <div data-screen className="print:hidden">
      <div className={ROW}>
        {p.receipt && onReceipt ? (
          <button ref={el => { chips.current.receipt = el }} type="button" aria-expanded={open === 'receipt'} aria-label={'Receipt ' + p.receipt}
            onClick={() => setOpen(o => (o === 'receipt' ? null : 'receipt'))}
            className="self-center -m-0.5 w-[18px] h-[18px] grid place-items-center rounded-[5px] text-gold-800 hover:bg-gold-100 aria-expanded:bg-gold-100 active:scale-[0.88] transition-[background-color,transform] cursor-pointer"><Slip /></button>
        ) : <span />}
        {part('purpose', 'what it was for', p.purpose || '', 'justify-self-start max-w-full truncate font-bold text-ink-900')}
        {part('day', 'the day it was paid', shortDay(p.paidAt), 'justify-self-start whitespace-nowrap font-medium text-muted tabular-nums')}
        {part('method', 'how they paid', short(method || paymentMethodLabel(p.method)), 'justify-self-start whitespace-nowrap font-medium text-muted')}
        {part('amount', 'the amount', '−' + money(p.amount), AMOUNT)}
      </div>
      {open === 'receipt' && sheet && onReceipt && (
        <Floating at={at} sheet={sheet} label={'Receipt ' + p.receipt} onClose={close}>
          <div className="bill-tear-b w-[200px] flex flex-col gap-[5px] px-2.5 pt-2 pb-3 bg-card">
            <div className="flex justify-between items-baseline pb-1 border-b border-dashed border-ink-200 text-[10px] text-muted">
              <b className="font-mono text-[11px] font-bold text-ink-900">{p.receipt}</b>{shortDay(p.paidAt)}
            </div>
            <div className="flex justify-between items-baseline gap-2 text-[11.5px] font-bold text-ink-900">
              <span className="min-w-0 truncate">{p.purpose || 'Payment'}</span>
              <span className="font-display text-[16px] font-extrabold text-emerald-700">{money(p.amount)}</span>
            </div>
            <div className="text-[10px] text-muted">{paymentMethodLabel(p.method)}{ref && <> · Ref <span className="font-mono text-ink-900">{ref}</span></>}</div>
            <div className="flex gap-1.5 mt-0.5">
              {(['print', 'email'] as const).map(how => (
                <button key={how} type="button" onClick={() => { setOpen(null); onReceipt(p.receipt, how) }}
                  className="flex-1 h-7 rounded-[3px] shadow-[inset_0_0_0_1.5px_#E3C68C] text-[11px] font-bold text-gold-800 hover:bg-gold-100 active:scale-95 transition-[background-color,transform] cursor-pointer">
                  {how === 'print' ? 'Print' : 'Email'}
                </button>
              ))}
            </div>
          </div>
        </Floating>
      )}
      {open && open !== 'receipt' && sheet && (
        <Floating key={open} at={at} sheet={sheet} right={open === 'amount'} width={open === 'amount' ? 170 : 210}
          label={open === 'purpose' ? 'What it was for' : open === 'method' ? 'How they paid' : open === 'day' ? 'Day it was paid' : 'Amount received'} onClose={close}>
          {open === 'purpose' && <TextFix value={p.purpose || ''} placeholder="e.g. Deposit" label="What it was for" onSave={v => v && save({ purpose: v })} />}
          {open === 'amount' && <TextFix money value={p.amount.toLocaleString()} placeholder="950" label="Amount received" onSave={v => digits(v) > 0 && save({ amount: digits(v) })} />}
          {open === 'day' && <DayFix paidAt={p.paidAt} onSave={paid_at => save({ paid_at })} />}
          {open === 'method' && <MethodFix method={method} reference={p.reference || ''} onSave={(m, reference) => save({ method: m, reference: reference || undefined })} />}
        </Floating>
      )}
    </div>
  )
}

function TextFix({ value, placeholder, label, money: isMoney, onSave }: { value: string; placeholder: string; label: string; money?: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value)
  // Focused a frame late: the box opens hidden while it finds its place, and a hidden box takes no focus.
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => { const f = requestAnimationFrame(() => box.current?.select()); return () => cancelAnimationFrame(f) }, [])
  return (
    <form onSubmit={e => { e.preventDefault(); onSave(v.trim()) }} className="flex items-end gap-1.5 p-1">
      {isMoney ? (
        <label className="min-w-0 flex-1 flex items-baseline gap-0.5 border-b-[1.5px] border-dashed border-gold-400 focus-within:border-solid transition-colors">
          <span className="font-display text-[11px] font-extrabold text-muted">₱</span>
          <input ref={box} inputMode="numeric" value={v} placeholder={placeholder} aria-label={label}
            onChange={e => { const n = digits(e.target.value); setV(n ? n.toLocaleString() : '') }}
            className="min-w-0 w-full bg-transparent border-0 p-0 text-right font-display text-[16px] font-extrabold text-ink-900 placeholder:text-paper-400 focus:outline-none" />
        </label>
      ) : (
        <input ref={box} value={v} placeholder={placeholder} aria-label={label} onChange={e => setV(e.target.value)} className={SLOT} />
      )}
      <button type="submit" aria-label="Save" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
    </form>
  )
}

/**
 * **The day it was paid** (Sebastian, 2026-10-27: "the date of the payment should be changeable"; the
 * "Payment Date" mock): any day up to today, in the date box alone (the Today and Yesterday buttons came
 * off, 2026-10-27). The time of day stays as it was.
 */
function DayFix({ paidAt, onSave }: { paidAt: string; onSave: (paidAt: string) => void }) {
  const was = paidAt ? new Date(paidAt) : new Date()
  const [v, setV] = useState(dateToString(was))
  const today = new Date()
  const pick = (day: string) => {
    if (!day || day > dateToString(today)) return
    const [y, m, d] = day.split('-').map(Number)
    const at = new Date(was); at.setFullYear(y, m - 1, d)
    onSave(at.toISOString())
  }
  return (
    <div className="p-1">
      <form onSubmit={e => { e.preventDefault(); pick(v) }} className="flex items-end gap-1.5">
        <input type="date" value={v} max={dateToString(today)} onChange={e => setV(e.target.value)} aria-label="Day it was paid" className={SLOT + ' text-[16px]'} />
        <button type="submit" aria-label="Save" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
      </form>
    </div>
  )
}

/** The four ways to pay; Cash and Check save at once, GCash and Bank ask for the ref. no. first. */
function MethodFix({ method, reference, onSave }: { method: string; reference: string; onSave: (method: string, reference: string) => void }) {
  const [pick, setPick] = useState(method)
  const [ref, setRef] = useState(methodNeedsReference(method) ? reference : '')
  const asking = methodNeedsReference(pick)
  return (
    <div role="radiogroup" aria-label="How they paid">
      {PAYMENT_METHODS.map((m, i) => (
        <button key={m} type="button" role="radio" aria-checked={m === pick} style={{ '--i': i } as React.CSSProperties}
          onClick={() => { setPick(m); if (!methodNeedsReference(m)) onSave(m, '') }} className={LI}>
          {m}
          <span aria-hidden="true" className="ml-auto w-3.5 text-center opacity-0 scale-50 group-aria-checked:opacity-100 group-aria-checked:scale-100 transition-[opacity,transform] duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]">✓</span>
        </button>
      ))}
      {asking && (
        <form key={pick} onSubmit={e => { e.preventDefault(); if (ref.trim()) onSave(pick, ref.trim()) }} className="flex items-end gap-1.5 px-1 pt-1.5 pb-1 border-t border-dotted border-ink-200 mt-1 bw-unfold">
          <input autoFocus value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. 4012 883 2716" aria-label={short(pick) + ' ref. no.'} className={SLOT + ' font-mono text-[11.5px]'} />
          <button type="submit" aria-label="Save" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
        </form>
      )}
    </div>
  )
}

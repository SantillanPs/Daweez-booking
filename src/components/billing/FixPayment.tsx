import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check } from 'lucide-react'
import { Floating } from '../calendar/BillRoomLines'
import { PAYMENT_METHODS, methodNeedsReference, paymentMethodChoice, paymentMethodLabel } from '../../utils/paymentMethod'
import type { StatementPayment } from '../../utils/statement'
import type { PaymentPatch } from '../walk-in/bookingPayment'

type Part = 'purpose' | 'method' | 'amount'

const digits = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0
const money = (n: number) => '₱' + n.toLocaleString()
const shortDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)

const CHIP = 'min-w-0 flex flex-col items-start gap-px px-1.5 py-1 rounded-lg bg-paper-50 shadow-[inset_0_-1.5px_0_#D0AB60] text-left cursor-pointer hover:bg-gold-100 aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400'
const NAME = 'text-[9px] font-semibold text-muted'
const VAL = 'max-w-full truncate text-[11px] font-bold text-ink-900 bw-rise'
const SLOT = 'min-w-0 flex-1 bg-transparent border-0 border-b-[1.5px] border-ink-900 rounded-none px-0.5 py-px text-[12.5px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-gold-400'
const OK = 'shrink-0 w-[30px] h-7 grid place-items-center rounded-lg bg-ink-900 text-white active:scale-90 transition-transform cursor-pointer'
const LI = 'w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-left text-[11.5px] font-semibold text-ink-900 cursor-pointer hover:bg-gold-100 focus-visible:bg-gold-100 focus-visible:outline-none active:scale-[0.98] transition-[background-color,transform] bw-rise group'

/**
 * **A payment on the bill, fixed where it is wrong** (Sebastian, 2026-10-24, the "Fixing a payment"
 * mock: "use B", then "the label and payment method is a bit confusing"). Its three parts sit side by
 * side, each named — For, Paid by, Amount — and each is its own tap: a small box floats over the bill
 * under it and never pushes it. Taking a payment back stays on the booking panel ("i don't like the
 * take back the whole payment"). The paper keeps the plain line.
 */
export function FixPayment({ p, sheet, onFix, onReceipt }: {
  p: StatementPayment
  /** What the boxes float in (the bill's money column). */
  sheet: HTMLElement | null
  onFix: (patch: PaymentPatch) => void
  onReceipt?: (receipt: string) => void
}) {
  const [open, setOpen] = useState<Part | null>(null)
  const chips = useRef<Partial<Record<Part, HTMLButtonElement | null>>>({})
  const at = useCallback(() => chips.current[open || 'amount'] as HTMLElement, [open])
  const close = useCallback(() => setOpen(null), [])
  const method = paymentMethodChoice(p.method)
  const save = (patch: PaymentPatch) => {
    setOpen(null)
    const changed = (Object.keys(patch) as (keyof PaymentPatch)[]).some(k => (patch[k] ?? '') !== ((k === 'amount' ? p.amount : p[k]) ?? ''))
    if (changed) onFix(patch)
  }
  const chip = (part: Part, name: string, value: string, right?: boolean) => (
    <button ref={el => { chips.current[part] = el }} type="button" aria-expanded={open === part} aria-label={'Change ' + name}
      onClick={() => setOpen(o => (o === part ? null : part))} className={CHIP + (right ? ' items-end font-mono' : '')}>
      <span className={NAME}>{name}</span>
      <span key={value} className={VAL + (right ? ' font-mono' : '') + (value ? '' : ' !text-muted font-semibold')}>{value || 'Add'}</span>
    </button>
  )
  return (
    <div data-screen className="print:hidden flex flex-col gap-0.5 py-0.5">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1">
        {chip('purpose', 'For', p.purpose || '')}
        {chip('method', 'Paid by', short(method || paymentMethodLabel(p.method)) + (p.reference ? ' · ' + p.reference : ''))}
        {chip('amount', 'Amount', '−' + money(p.amount), true)}
      </div>
      <span className="text-[10px] text-muted">
        {shortDay(p.paidAt)}{p.receipt && <> · {p.receipt}</>}
        {onReceipt && p.receipt && (
          <button type="button" onClick={() => onReceipt(p.receipt)}
            className="ml-1.5 font-semibold text-gold-800 underline underline-offset-2 cursor-pointer">Receipt</button>
        )}
      </span>
      {open && sheet && (
        <Floating key={open} at={at} sheet={sheet} right={open === 'amount'} width={open === 'amount' ? 170 : 210}
          label={open === 'purpose' ? 'What it was for' : open === 'method' ? 'How they paid' : 'Amount received'} onClose={close}>
          {open === 'purpose' && <TextFix value={p.purpose || ''} placeholder="e.g. Deposit" label="What it was for" onSave={v => v && save({ purpose: v })} />}
          {open === 'amount' && <TextFix money value={p.amount.toLocaleString()} placeholder="950" label="Amount received" onSave={v => digits(v) > 0 && save({ amount: digits(v) })} />}
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
        <label className="min-w-0 flex-1 flex items-baseline gap-0.5 border-b-2 border-ink-900 focus-within:border-gold-400 transition-colors">
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
        <form key={pick} onSubmit={e => { e.preventDefault(); if (ref.trim()) onSave(pick, ref.trim()) }} className="flex items-end gap-1.5 px-1 pt-1.5 pb-1 border-t border-ink-200 mt-1 bw-unfold">
          <input autoFocus value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. 4012 883 2716" aria-label={short(pick) + ' ref. no.'} className={SLOT + ' font-mono text-[11.5px]'} />
          <button type="submit" aria-label="Save" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
        </form>
      )}
    </div>
  )
}

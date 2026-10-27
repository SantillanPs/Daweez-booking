import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
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
const QUIET = 'px-0.5 -mx-0.5 rounded-sm border-b-[1.5px] border-dotted border-paper-400 hover:border-gold-400 hover:bg-gold-100 aria-expanded:border-solid aria-expanded:border-gold-400 aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,border-color,transform] cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400'
const SLOT = 'min-w-0 flex-1 bg-transparent border-0 border-b-[1.5px] border-ink-900 rounded-none px-0.5 py-px text-[12.5px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-gold-400'
const OK = 'shrink-0 w-[30px] h-7 grid place-items-center rounded-lg bg-ink-900 text-white active:scale-90 transition-transform cursor-pointer'
const LI = 'w-full flex items-center gap-2 px-2 py-[7px] rounded-lg text-left text-[11.5px] font-semibold text-ink-900 cursor-pointer hover:bg-gold-100 focus-visible:bg-gold-100 focus-visible:outline-none active:scale-[0.98] transition-[background-color,transform] bw-rise group'

/**
 * **A payment's line on the bill**, the same for every bill that lists payments: what it was for and the
 * amount, and under it the day and how they paid (Sebastian, 2026-10-25, the "Payments on the bill"
 * mock: three named boxes a payment were "horrendous"; 2026-10-27, the "Payment Lines" mock C: the line
 * was "chaotic and busy", so the ref. no. and receipt wait until the payment is opened).
 */
function PayLine({ purpose, method, amount, under, end }: { purpose: React.ReactNode; method: React.ReactNode; amount: React.ReactNode; under?: React.ReactNode; end?: React.ReactNode }) {
  return (
    // Bigger, darker and roomier than the bill's small print ("it's not very easy to read", 2026-10-25).
    <span className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 gap-y-0.5 items-baseline">
      <span className="min-w-0 text-[12.5px] font-bold text-ink-900 leading-snug">{purpose}</span>
      <span className="justify-self-end font-mono text-[13px] font-bold text-ink-900">{amount}</span>
      <span className="col-span-2 flex items-center gap-1 flex-wrap text-[11px] text-ink-700 leading-snug">{under}{under && method ? <span aria-hidden="true">·</span> : null}{method}{end}</span>
    </span>
  )
}

const LINE = 'block w-full py-1.5 border-b border-ink-200'

export function PayRow(props: { purpose: React.ReactNode; method: React.ReactNode; amount: React.ReactNode; under?: React.ReactNode }) {
  return <div className={LINE}><PayLine {...props} /></div>
}

// The ⌄ that says a payment opens, and flips when it is open.
const Fold = ({ open }: { open: boolean }) => (
  <ChevronDown aria-hidden="true" className={'w-3.5 h-3.5 shrink-0 text-gold-800 transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]' + (open ? ' rotate-180' : '')} strokeWidth={2.6} />
)

/**
 * **A payment on the bill, fixed where it is wrong** (Sebastian, 2026-10-24, the "Fixing a payment"
 * mock): each part of its line is its own tap, and a small box floats over the bill under it and
 * never pushes it. Taking a payment back stays on the booking panel ("i don't like the take back the
 * whole payment"). The paper keeps the plain line.
 */
export function FixPayment({ p, sheet, onFix, onReceipt }: {
  p: StatementPayment
  /** What the boxes float in (the bill's money column). */
  sheet: HTMLElement | null
  onFix: (patch: PaymentPatch) => void
  onReceipt?: (receipt: string) => void
}) {
  const [open, setOpen] = useState<Part | null>(null)
  const [unfolded, setUnfolded] = useState(false)
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!unfolded || open) return
    const off = (e: PointerEvent) => { if (!row.current?.contains(e.target as Node)) setUnfolded(false) }
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [unfolded, open])
  const chips = useRef<Partial<Record<Part, HTMLButtonElement | null>>>({})
  const at = useCallback(() => chips.current[open || 'amount'] as HTMLElement, [open])
  const close = useCallback(() => setOpen(null), [])
  const method = paymentMethodChoice(p.method)
  const save = (patch: PaymentPatch) => {
    setOpen(null)
    const changed = (Object.keys(patch) as (keyof PaymentPatch)[]).some(k => (patch[k] ?? '') !== ((k === 'amount' ? p.amount : k === 'paid_at' ? p.paidAt : p[k]) ?? ''))
    if (changed) onFix(patch)
  }
  const part = (which: Part, name: string, value: string) => (
    // Every part is its own tap, opened or not (Sebastian, 2026-10-27: "everything should still be
    // editable even if it's not opened"): shut, its line is a faint dot; open, the bill's gold dash.
    <button ref={el => { chips.current[which] = el }} type="button" aria-expanded={open === which} aria-label={'Change ' + name}
      onClick={() => setOpen(o => (o === which ? null : which))} className={unfolded ? PART : QUIET}>
      <span key={value} className={'inline-block bw-rise' + (value ? '' : ' text-gold-800 font-bold')}>{value || 'What for?'}</span>
    </button>
  )
  const ref = methodNeedsReference(method) ? p.reference : ''
  // The ⌄ sits at the foot of the line, so it drops to the ref. no. row when the payment opens (2026-10-27).
  const fold = <button type="button" onClick={() => setUnfolded(u => !u)} aria-expanded={unfolded} aria-label={unfolded ? 'Hide the ref. no. and receipt' : 'Show the ref. no. and receipt'}
            className="ml-auto w-6 h-5 shrink-0 grid place-items-center rounded hover:bg-gold-100 active:scale-90 transition cursor-pointer"><Fold open={unfolded} /></button>
  return (
    <div data-screen className="print:hidden">
      {/* A tap anywhere on the line that is not a part opens or shuts it, and a tap off it shuts it:
          the ⌄ only says which way it is ("the arrow shouldn't need to be clicked", 2026-10-27). */}
      <div ref={row} onClick={e => { if (!(e.target as HTMLElement).closest('button')) setUnfolded(u => !u) }}
        className={LINE + ' rounded-md cursor-pointer transition-colors ' + (unfolded ? 'bg-paper-50' : 'hover:bg-paper-50')}>
        <PayLine
          purpose={part('purpose', 'what it was for', p.purpose || '')}
          amount={part('amount', 'the amount', '−' + money(p.amount))}
          under={part('day', 'the day it was paid', shortDay(p.paidAt))}
          method={part('method', 'how they paid', short(method || paymentMethodLabel(p.method)))}
          end={!unfolded && fold} />
        {unfolded && (
          <span className="mt-0.5 flex items-center gap-2.5 text-[10.5px] text-ink-700 bw-unfold">
            {ref && <span><span className="font-semibold text-muted mr-1">Ref</span>{ref}</span>}
            {p.receipt && (onReceipt
              ? <button type="button" onClick={() => onReceipt(p.receipt)} aria-label={'Open receipt ' + p.receipt}
                className={PART + ' font-semibold text-gold-800'}>{p.receipt}</button>
              : <span>{p.receipt}</span>)}
            {fold}
          </span>
        )}
      </div>
      {open && sheet && (
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
        <form key={pick} onSubmit={e => { e.preventDefault(); if (ref.trim()) onSave(pick, ref.trim()) }} className="flex items-end gap-1.5 px-1 pt-1.5 pb-1 border-t border-ink-200 mt-1 bw-unfold">
          <input autoFocus value={ref} onChange={e => setRef(e.target.value)} placeholder="e.g. 4012 883 2716" aria-label={short(pick) + ' ref. no.'} className={SLOT + ' font-mono text-[11.5px]'} />
          <button type="submit" aria-label="Save" className={OK}><Check className="w-3.5 h-3.5" strokeWidth={3.2} /></button>
        </form>
      )}
    </div>
  )
}

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Mail, Printer, Trash2, Undo2 } from 'lucide-react'
import { Floating } from '../calendar/BillRoomLines'
import { NewTag } from '../NewMark'
import { markSeen } from '../../utils/newMarks'
import { PAYMENT_METHODS, methodNeedsReference, paymentMethodChoice, paymentMethodLabel } from '../../utils/paymentMethod'
import type { StatementPayment } from '../../utils/statement'
import type { PaymentPatch } from '../walk-in/bookingPayment'
import { dateToString, peso } from '../../utils/helpers'

type Part = 'purpose' | 'method' | 'amount' | 'day'

const digits = (v: string) => Number(v.replace(/[^0-9]/g, '')) || 0
const shortDay = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '')
const short = (m: string) => (m === 'Bank transfer' ? 'Bank' : m)

// A part of the line that opens its fix: the bill's own dashed-gold tap (the room lines' VAL), always
// showing — on a tablet nothing hovers (Sebastian, 2026-10-25: "they aren't very obvious they are editable").
export const PART = 'px-0.5 -mx-0.5 rounded-sm border-b-[1.5px] border-dashed border-gold-400 hover:bg-gold-100 aria-expanded:border-solid aria-expanded:bg-gold-100 active:scale-95 transition-[background-color,border-color,transform] cursor-pointer text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold-400'
// The paper's boxes: a blank to write on is a gold dashed line, ✓ a gold outline (the Paper mock, 2026-10-29).
const SLOT = 'min-w-0 flex-1 bg-transparent border-0 border-b-[1.5px] border-dashed border-gold-400 rounded-none px-0.5 py-px text-[12.5px] font-semibold text-ink-900 placeholder:text-paper-400 focus:outline-none focus:border-solid'
const OK = 'shrink-0 w-[30px] h-7 grid place-items-center rounded-[3px] text-gold-800 shadow-[inset_0_0_0_1.5px_#D0AB60] hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer'
const LI = 'w-full flex items-center gap-2 px-2 py-[7px] border-b border-dotted border-ink-200 last:border-b-0 text-left text-[11.5px] font-semibold text-ink-900 cursor-pointer hover:text-gold-800 focus-visible:text-gold-800 focus-visible:outline-none active:scale-[0.98] transition-[color,transform] bw-rise group'
// **The bill's totals sit on one grid** (Sebastian, 2026-11-06, the "Bill One-Line Totals" mock: "make
// sure all of the text and icons and buttons are aligned to make it look structured"): an icon, the
// name with its details, the amount, and the line's own button — the same four columns on every line,
// so names, figures and buttons each run down one edge. Gold underlines are still what can be changed.
// The amount column is wide enough for a ranked line's −₱10,000.
export const LINE = 'relative grid grid-cols-[16px_minmax(0,1fr)_76px_22px] gap-x-1.5 items-center min-h-[24px] text-left'
/** The name column of a line opened out of a folded one hangs from a soft gold thread. */
export const KID = 'self-stretch flex items-center gap-1.5 min-w-0 ml-1 pl-2 border-l-2 border-gold-100'

// **Ranked lines** (Sebastian, 2026-11-06, the "Bill Sub-total Row" mock, "lines ranked"): what it was for
// leads, the facts sit under it smaller with a coloured word for what kind of line it is, and the figure
// is the loudest thing on the line. Every such line is one height with everything on its middle ("keep
// everything aligned, or centered to make it look more structured and consistent"); a fact a tap can
// change keeps a paler dashed line, so it does not compete with the headline.
// 34px a line, so many payments or discounts still fit ("make it a bit more compact").
export const RANK = 'h-[34px]'
export const STACK = 'flex flex-col justify-center items-start min-w-0'
/** A ranked line opened out of a folded one, on the gold thread. */
export const KID_STACK = STACK + ' self-stretch ml-1 pl-2 border-l-2 border-gold-100'
export const HEAD = 'max-w-full truncate text-[12px] leading-[15px] font-bold text-ink-900'
export const FACTS = 'flex items-center gap-[5px] max-w-full min-w-0 text-[10px] leading-[12px] font-medium text-muted'
export const EYEBROW = 'shrink-0 text-[8.5px] font-extrabold uppercase tracking-[0.12em]'
export const BIG = 'justify-self-end font-display text-[13.5px] leading-[16px] font-extrabold tabular-nums'
export const Dot = () => <span aria-hidden="true" className="text-paper-400">·</span>
export const PALE = ' !border-gold-200'
/** The count beside a folded line's name, bumping when it changes. */
export const Count = ({ n }: { n: number }) => <span key={n} className="inline-grid place-items-center min-w-4 h-4 px-1 rounded-full bg-gold-100 text-[9px] font-extrabold text-gold-800 bill-bump">{n}</span>
export const FOLD = 'justify-self-center w-3 h-3 text-gold-800 transition-transform duration-300 ease-[cubic-bezier(.34,1.56,.64,1)] group-aria-expanded:rotate-180'
/** What a folded totals line opens to: it grows from the line instead of jumping. */
export function Unfold({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <div className={'grid transition-[grid-template-rows] duration-[180ms] ease-[cubic-bezier(.2,.9,.3,1.15)] ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
      <div className="overflow-hidden" inert={!open || undefined}>{open && children}</div>
    </div>
  )
}
const NAME = 'flex items-center gap-1.5 min-w-0'

/**
 * **A line can be taken off** (Sebastian, 2026-11-06: "add a way to delete discount and payments in the
 * bill"). The bin turns into a red Remove over the line's figure, so a stray tap takes nothing away.
 */
// `tag`: only the bill's first bin wears the NEW tag, so a column of bins is not a column of tags.
export function RemoveBin({ what, onRemove, tag }: { what: string; onRemove: () => void; tag?: boolean }) {
  const [asking, setAsking] = useState(false)
  if (asking) return (
    <>
      <span />
      <button type="button" autoFocus onBlur={() => setAsking(false)} onClick={() => { setAsking(false); onRemove() }}
        className="print:hidden absolute right-0 top-1/2 -translate-y-1/2 w-[96px] h-[22px] rounded-[4px] bg-danger-600 text-white text-[10.5px] font-extrabold active:scale-95 transition-transform cursor-pointer bw-rise">
        Remove
      </button>
    </>
  )
  return (
    <button type="button" aria-label={'Remove ' + what} onClick={() => { markSeen('bill-remove'); setAsking(true) }}
      className="print:hidden relative justify-self-center w-[22px] h-[22px] grid place-items-center rounded-[5px] text-paper-400 hover:text-danger-600 hover:bg-danger-50 active:scale-90 transition-[color,background-color,transform] cursor-pointer">
      <Trash2 aria-hidden="true" className="w-3 h-3" />
      {tag && <NewTag id="bill-remove" />}
    </button>
  )
}

/**
 * **What was taken off stays on the bill, struck through, until the bill closes** (Sebastian,
 * 2026-11-06: "I want the undo to be part of the bill somewhere but disappears after closing the
 * bill"). Its arrow puts it back. Screen only: the paper never shows it.
 */
export function GoneLine({ icon, name, detail, amount, onUndo }: { icon?: React.ReactNode; name: string; detail?: string; amount: string; onUndo: () => void }) {
  return (
    <div data-screen className={LINE + ' print:hidden bw-rise'}>
      <span className="justify-self-center text-paper-400">{icon}</span>
      <span className={NAME + ' text-muted line-through decoration-danger-600'}>
        <b className="shrink-0 text-[11px] font-bold">{name}</b>
        {detail && <span className="min-w-0 truncate text-[10px] font-medium">{detail}</span>}
      </span>
      <span className="justify-self-end font-mono text-[11.5px] font-bold text-muted line-through decoration-danger-600 tabular-nums">{amount}</span>
      <button type="button" aria-label={'Put back ' + name} onClick={onUndo}
        className="justify-self-center w-[22px] h-[22px] grid place-items-center rounded-[5px] text-gold-800 hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer">
        <Undo2 aria-hidden="true" className="w-3.5 h-3.5" strokeWidth={2.4} />
      </button>
    </div>
  )
}

/** A payment's line where it cannot be changed: a new booking's first payment, a bill opened away from the desk. */
export function PayRow({ purpose, method, amount, under, head, kid, onRemove, tag }: {
  purpose: React.ReactNode; method: React.ReactNode; amount: React.ReactNode; under?: React.ReactNode
  /** The line's own name when it is the only payment ("Paid"). */
  head?: string
  kid?: boolean
  onRemove?: () => void
  tag?: boolean
}) {
  return (
    <div className={LINE + ' ' + RANK}>
      <span className="justify-self-center text-gold-800"><Slip /></span>
      <span className={kid ? KID_STACK : STACK}>
        <span className={HEAD}>{purpose}</span>
        <span className={FACTS}>
          {head && <><b className={EYEBROW + ' text-emerald-700'}>{head}</b><Dot /></>}
          {under && <><span className="shrink-0 tabular-nums">{under}</span><Dot /></>}
          <span className="shrink-0">{method}</span>
        </span>
      </span>
      <span className={BIG + ' text-emerald-700'}>{amount}</span>
      {onRemove ? <RemoveBin what={typeof purpose === 'string' ? purpose : 'the payment'} onRemove={onRemove} tag={tag} /> : <span />}
    </div>
  )
}

// The receipt: a small slip, as it comes off the roll.
export const Slip = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z" /><path d="M9 8h6M9 12h6" />
  </svg>
)

/**
 * **A payment on the bill, fixed where it is wrong** (Sebastian, 2026-10-24, the "Fixing a payment"
 * mock): each part of its line is its own tap, and a small box floats over the bill under it and
 * never pushes it. Its bin takes it off (2026-11-06; it had stayed on the booking panel since
 * 2026-10-24, and then nowhere). The paper keeps the plain line. The receipt is the slip at the start of the line
 * (2026-10-29, "what about the payment receipt and ref no.?"): its number, the ref. no., Print and Email.
 */
export function FixPayment({ p, sheet, onFix, onReceipt, head, kid, onRemove, tag }: {
  p: StatementPayment
  /** The line's own name when it is the only payment ("Paid"); its parts follow it, quieter. */
  head?: string
  /** Opened out of the folded payments line: hangs from the gold thread. */
  kid?: boolean
  onRemove?: () => void
  tag?: boolean
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
      <div className={LINE + ' ' + RANK}>
        {p.receipt && onReceipt ? (
          <button ref={el => { chips.current.receipt = el }} type="button" aria-expanded={open === 'receipt'} aria-label={'Receipt ' + p.receipt}
            onClick={() => { markSeen('receipt-slim'); setOpen(o => (o === 'receipt' ? null : 'receipt')) }}
            className="relative justify-self-center w-[18px] h-[18px] grid place-items-center rounded-[5px] text-gold-800 hover:bg-gold-100 aria-expanded:bg-gold-100 active:scale-[0.88] transition-[background-color,transform] cursor-pointer"><Slip /><NewTag id="receipt-slim" /></button>
        ) : <span className="justify-self-center text-gold-800"><Slip /></span>}
        <span className={kid ? KID_STACK : STACK}>
          {part('purpose', 'what it was for', p.purpose || '', HEAD)}
          <span className={FACTS}>
            {head && <><b className={EYEBROW + ' text-emerald-700'}>{head}</b><Dot /></>}
            {part('day', 'the day it was paid', shortDay(p.paidAt), 'shrink-0 whitespace-nowrap tabular-nums' + PALE)}
            <Dot />
            {part('method', 'how they paid', short(method || paymentMethodLabel(p.method)), 'shrink-0 whitespace-nowrap' + PALE)}
          </span>
        </span>
        {part('amount', 'the amount', '−' + peso(p.amount), BIG + ' text-emerald-700' + PALE)}
        {onRemove ? <RemoveBin what={p.purpose || 'the payment'} onRemove={onRemove} tag={tag} /> : <span />}
      </div>
      {/* Only what the line does not already say (Sebastian, 2026-11-06: "this looks redundant", the
          "Payment receipt" mock, option A): the receipt's number, the ref. no. when there is one, and
          Print and Email. What it was for, the day, how and the amount are on the line above it. */}
      {open === 'receipt' && sheet && onReceipt && (
        <Floating at={at} sheet={sheet} label={'Receipt ' + p.receipt} onClose={close}>
          <div className="bill-tear-b w-[176px] flex flex-col gap-[7px] px-[9px] pt-2 pb-3 bg-card">
            <b className="font-mono text-[11px] font-bold text-ink-900 bw-rise">{p.receipt}</b>
            {ref && <div className="text-[10px] text-muted bw-rise" style={{ '--i': 1 } as React.CSSProperties}>Ref <span className="font-mono font-bold text-ink-900">{ref}</span></div>}
            <div className="flex gap-1.5 bw-rise" style={{ '--i': ref ? 2 : 1 } as React.CSSProperties}>
              {(['print', 'email'] as const).map(how => (
                <button key={how} type="button" onClick={() => { setOpen(null); onReceipt(p.receipt, how) }}
                  className="flex-1 h-7 inline-flex items-center justify-center gap-[5px] rounded-[3px] shadow-[inset_0_0_0_1.5px_#E3C68C] text-[11px] font-bold text-gold-800 hover:bg-gold-100 active:scale-95 transition-[background-color,transform] cursor-pointer">
                  {how === 'print' ? <Printer aria-hidden="true" className="w-[13px] h-[13px]" /> : <Mail aria-hidden="true" className="w-[13px] h-[13px]" />}
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

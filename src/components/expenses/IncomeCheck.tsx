import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Banknote, Check, ChevronDown, FileText, Landmark, Search, Smartphone, Wallet, X, type LucideIcon } from 'lucide-react'
import type { DatedMoneyIn } from '../../utils/dailyReport'
import type { IncomeLine } from '../../utils/incomeStatement'
import { parseDay, peso } from '../../utils/helpers'
import { paymentKind, type PaymentKind } from '../../utils/paymentMethod'

// A month's income line, every payment under it, to check against the paper logs (Sebastian, 2026-11-15:
// "the full view as a pop up, so that I can check on my physical logs every single payment if it actually
// exists there"). The papers are in no order, so a payment is found by receipt, name or amount, and ticked
// once it is found on paper. A payment on a cancelled booking counts in no total; it waits in its own red
// group at the foot, since money left on a cancelled booking is the first thing that goes missing.

const WAYS: Record<PaymentKind, { ink: string; Icon: LucideIcon; name: string }> = {
  cash: { ink: 'text-emerald-600', Icon: Banknote, name: 'Cash' },
  gcash: { ink: 'text-blue-700', Icon: Smartphone, name: 'GCash' },
  bank: { ink: 'text-ink-900', Icon: Landmark, name: 'Bank' },
  check: { ink: 'text-gold-700', Icon: FileText, name: 'Check' },
  other: { ink: 'text-paper-500', Icon: Wallet, name: 'Other' },
}
const WAY_ORDER: PaymentKind[] = ['cash', 'gcash', 'bank', 'check', 'other']

// Ticks are kept on this device, so a check can be stopped and picked up again. ponytail: per device, not
// shared — a table of ticks when two people check the same month.
const TICKS = 'daweez_income_ticks'
const readTicks = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(TICKS) || '[]')) } catch { return new Set() }
}
const keyOf = (line: string, p: DatedMoneyIn) => `${line}|${p.recordId || p.receipt || ''}|${p.paidAt || p.day}|${p.bookingId || p.tabId || ''}`

const shortDay = (day: string) => parseDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const timeOf = (p: DatedMoneyIn) => {
  const d = p.paidAt ? new Date(p.paidAt) : null
  return d && !isNaN(d.getTime()) && p.paidAt.length > 10 ? d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : ''
}

export function IncomeCheck({ lines, start, month, onClose }: {
  lines: IncomeLine[]
  /** The line that was tapped. */
  start: string
  /** `October 2026`. */
  month: string
  onClose: () => void
}) {
  const [label, setLabel] = useState(start)
  const [q, setQ] = useState('')
  const [way, setWay] = useState<PaymentKind | ''>('')
  const [hide, setHide] = useState(false)
  const [ticks, setTicks] = useState(readTicks)
  const [cancelOpen, setCancelOpen] = useState(false)

  useEffect(() => {
    const keys = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onClose])

  const line = lines.find(l => l.label === label) || lines[0]
  const paid = useMemo(() => line.payments.filter(p => !p.cancelled), [line])
  const cancelled = useMemo(() => line.payments.filter(p => p.cancelled), [line])
  const sum = (list: DatedMoneyIn[]) => list.reduce((s, p) => s + p.amount, 0)

  const find = q.trim().toLowerCase().replace(/[₱,\s]/g, '')
  const matches = (p: DatedMoneyIn) => (!way || paymentKind(p.method) === way)
    && (!find || [p.receipt, p.who, p.place, p.purpose, String(p.amount)].some(s => (s || '').toLowerCase().replace(/[,\s]/g, '').includes(find)))
  const isTicked = (p: DatedMoneyIn) => ticks.has(keyOf(line.label, p))
  const rows = paid.filter(p => matches(p) && !(hide && isTicked(p)))
  const ticked = paid.filter(isTicked)
  const ways = WAY_ORDER.filter(k => paid.some(p => paymentKind(p.method) === k))
  const shownCancelled = cancelled.filter(matches)

  const toggle = (p: DatedMoneyIn) => setTicks(prev => {
    const next = new Set(prev)
    const k = keyOf(line.label, p)
    if (next.has(k)) next.delete(k)
    else next.add(k)
    try { localStorage.setItem(TICKS, JSON.stringify([...next])) } catch { /* a private window keeps them for the sitting */ }
    return next
  })
  const pick = (l: string) => { setLabel(l); setWay(''); setCancelOpen(false) }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-3" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${line.label}, ${month}`}
        className="bg-card w-full max-w-[940px] max-h-[90vh] rounded-xl border border-soft shadow-xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="shrink-0 flex items-center gap-2.5 pl-[18px] pr-3 py-2.5 border-b border-soft">
          <h3 className="font-display text-[16px] font-bold text-main">{line.label}</h3>
          <span className="text-[13px] font-semibold text-muted">{month}</span>
          <button type="button" onClick={onClose} aria-label="Close" className="ml-auto w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        {/* every line of the month, so the next one is a tap away */}
        <div className="shrink-0 flex gap-1.5 px-[18px] pt-2.5 pb-0.5 overflow-x-auto [scrollbar-width:none]">
          {lines.map(l => (
            <button key={l.label} type="button" aria-pressed={l.label === line.label} onClick={() => pick(l.label)}
              className="group shrink-0 min-h-[34px] px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap text-[13px] font-bold text-ink-600 hover:bg-page aria-pressed:bg-gold-100 aria-pressed:text-gold-800 active:scale-95 transition-[background-color,transform] cursor-pointer">
              {l.label}
              <span className="font-display text-[12px] tabular-nums text-muted group-aria-pressed:text-gold-800">{peso(l.amount)}</span>
            </button>
          ))}
        </div>

        <div className="shrink-0 flex flex-wrap items-center gap-x-3 gap-y-2 px-[18px] py-2.5 border-b border-soft">
          <label className="relative flex-[1_1_260px] min-w-0">
            <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
            <input type="search" value={q} onChange={e => setQ(e.target.value)} aria-label="Find a payment"
              placeholder="PR-202610-061, Dela Cruz, 2000"
              className="w-full min-h-10 pl-9 pr-3 rounded-lg border border-soft bg-page focus:bg-card focus:border-gold-400 outline-none text-[16px] font-medium text-main" />
          </label>
          {ways.length > 1 && (
            <div className="flex gap-1">
              {ways.map(k => {
                const w = WAYS[k]
                return (
                  <button key={k} type="button" aria-pressed={way === k} onClick={() => setWay(way === k ? '' : k)}
                    className={'min-h-[34px] px-2.5 rounded-lg flex items-center gap-1.5 text-[12.5px] font-bold aria-pressed:bg-ink-900 aria-pressed:!text-white active:scale-95 transition-[background-color,transform] cursor-pointer ' + w.ink}>
                    <w.Icon aria-hidden="true" className="w-[15px] h-[15px]" />{w.name}
                  </button>
                )
              })}
            </div>
          )}
          <button type="button" aria-pressed={hide} onClick={() => setHide(!hide)}
            className="group min-h-[34px] flex items-center gap-1.5 text-[12.5px] font-bold text-muted aria-pressed:text-main cursor-pointer">
            <span className="relative w-[30px] h-[18px] rounded-full bg-paper-200 group-aria-pressed:bg-emerald-600 transition-colors">
              <span className="absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)] group-aria-pressed:translate-x-3" />
            </span>
            Hide ticked
          </button>
        </div>

        <div className="shrink-0 flex items-center gap-3 px-[18px] pt-2.5 pb-2 text-[13px]">
          <b className="font-display tabular-nums">{ticked.length}</b>
          <span className="font-semibold text-muted -ml-2">of {paid.length} ticked</span>
          <span className="flex-1 h-1.5 rounded-full bg-softbg overflow-hidden">
            <span className="block h-full rounded-full bg-emerald-600 transition-[width] duration-[450ms] ease-[cubic-bezier(.2,.8,.2,1)]"
              style={{ width: (paid.length ? ticked.length / paid.length * 100 : 0) + '%' }} />
          </span>
          <b className="font-display tabular-nums">{peso(sum(ticked))}</b>
          <span className="font-semibold text-muted -ml-2">of {peso(line.amount)}</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-2">
          {!rows.length ? (
            <p className="py-9 text-center font-semibold text-muted">
              {!paid.length ? 'Nothing paid here this month.' : hide && !find && !way ? 'All ticked.' : 'Nothing matches.'}
            </p>
          ) : (
            <>
              <div className={'hidden md:grid sticky top-0 z-[1] bg-card ' + COLS + ' pt-2 pb-1.5 border-b border-soft text-[10px] font-bold uppercase tracking-wider text-muted'}>
                <span /><span>Day</span><span>Receipt</span><span>Guest · for</span><span>Paid by</span><span className="text-right">Amount</span>
              </div>
              {rows.map((p, i) => <Row key={keyOf(line.label, p)} p={p} i={i} ticked={isTicked(p)} onTick={() => toggle(p)} />)}
            </>
          )}

          {shownCancelled.length > 0 && (
            <div className="mt-3.5">
              <button type="button" aria-expanded={cancelOpen} onClick={() => setCancelOpen(!cancelOpen)}
                className="group w-full min-h-10 flex items-center gap-2 text-[13px] font-bold text-danger-600 cursor-pointer">
                Paid, then cancelled
                <span className="rounded-full bg-danger-50 px-2 text-[12px]">{shownCancelled.length}</span>
                <span className="ml-auto font-display line-through tabular-nums">{peso(sum(shownCancelled))}</span>
                <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
              </button>
              <div className={'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] ' + (cancelOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                <div className="min-h-0 overflow-hidden">
                  {cancelOpen && shownCancelled.map((p, i) => <Row key={keyOf(line.label, p)} p={p} i={i} />)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center justify-between gap-3 px-[18px] py-3 border-t border-soft font-extrabold">
          <span>Total · {paid.length} {paid.length === 1 ? 'payment' : 'payments'}</span>
          <span className="font-mono text-[18px] text-emerald-600">{peso(line.amount)}</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// the tailwind config's extra screens turn off `max-md:`, so a row is laid out for a phone first
const COLS = 'grid grid-cols-[34px_minmax(0,1fr)_auto] md:grid-cols-[34px_92px_118px_minmax(0,1fr)_92px_100px] gap-x-2.5 items-center'

/** One payment. With no `onTick` it is a cancelled one: in red, its amount struck, nothing to tick. */
function Row({ p, i, ticked, onTick }: { p: DatedMoneyIn; i: number; ticked?: boolean; onTick?: () => void }) {
  const w = WAYS[paymentKind(p.method)]
  const time = timeOf(p)
  const dim = ticked ? ' opacity-[.42] transition-opacity duration-300' : ''
  return (
    <div className={COLS + ' relative min-h-[46px] py-2 md:py-1 border-b border-ink-900/[.07] text-[13px] bw-rise'}
      style={{ '--i': Math.min(i, 20) } as CSSProperties}>
      <span className="row-span-2 md:row-span-1">
        {onTick && (
          <button type="button" aria-pressed={!!ticked} aria-label="Found on paper" onClick={onTick}
            className="group w-7 h-7 rounded-lg border-[1.5px] border-paper-200 bg-white grid place-items-center aria-pressed:bg-emerald-600 aria-pressed:border-emerald-600 active:scale-90 transition-[background-color,border-color,transform] cursor-pointer">
            <Check aria-hidden="true" strokeWidth={3} className="w-4 h-4 text-white scale-0 group-aria-pressed:scale-100 transition-transform duration-[250ms] ease-[cubic-bezier(.34,1.56,.64,1)]" />
          </button>
        )}
      </span>
      <span className={'col-start-2 row-start-2 flex gap-1.5 text-[11.5px] text-muted md:block md:col-start-auto md:row-start-auto md:text-[13px] md:text-main font-bold tabular-nums' + dim}>
        {shortDay(p.day)}{time && <small className="md:block font-medium text-muted text-[11.5px]">{time}</small>}
      </span>
      <span className={'hidden md:block font-mono text-[12px] font-semibold text-ink-600' + dim}>{p.receipt || '—'}</span>
      <span className={'col-start-2 row-start-1 md:col-start-auto md:row-start-auto min-w-0' + dim}>
        <b className="block truncate">{p.who || '—'}</b>
        <small className={'block truncate text-[11.5px] ' + (p.cancelled ? 'text-danger-600 font-bold' : 'text-muted')}>
          {[p.place, p.cancelled ? 'Cancelled ' + shortDay(p.cancelled) : p.purpose].filter(Boolean).join(' · ')}
          {p.receipt && <span className="md:hidden"> · {p.receipt}</span>}
        </small>
      </span>
      <span className={'col-start-3 row-start-2 justify-self-end md:col-start-auto md:row-start-auto md:justify-self-start flex items-center gap-1.5 text-[12.5px] font-bold ' + w.ink + dim}>
        <w.Icon aria-hidden="true" className="w-[15px] h-[15px]" />{w.name}
      </span>
      <span className={'col-start-3 row-start-1 md:col-start-auto md:row-start-auto text-right font-display font-extrabold tabular-nums text-[14px] ' + (p.cancelled ? 'text-danger-600 line-through' : 'text-emerald-600') + dim}>
        {peso(p.amount)}
      </span>
    </div>
  )
}

import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { DatedMoneyIn } from '../../utils/dailyReport'
import { dateToString } from '../../utils/helpers'
import { PaymentKind, paymentKind } from '../../utils/paymentMethod'
import { PERIODS, type Period, inThis, rangeOf, shortDay, step } from './periods'

interface IncomeHistoryProps {
  /** Every dated payment (`allMoneyIn`). */
  payments: DatedMoneyIn[]
  /** The day the Cash Flow screen is on; the window opens on the month around it. */
  date: string
  /** Jumps the day screen to the day of the row that was tapped. */
  onOpenDay: (date: string) => void
  onClose: () => void
}

const peso = (n: number) => '₱' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })

const KINDS: [PaymentKind, string][] = [['cash', 'Cash'], ['gcash', 'GCash'], ['bank', 'Bank'], ['check', 'Check'], ['other', 'Other']]
const DOT: Record<PaymentKind, string> = {
  cash: 'bg-emerald-600', gcash: 'bg-blue-700', bank: 'bg-ink-900', check: 'bg-paper-500', other: 'bg-paper-400',
}
const PILL: Record<PaymentKind, string> = {
  cash: 'bg-emerald-50 text-emerald-600', gcash: 'bg-blue-50 text-blue-700', bank: 'bg-ink-200 text-ink-900', check: 'bg-paper-100 text-main', other: 'bg-paper-100 text-main',
}
const PICKED: Record<PaymentKind | 'all', string> = {
  all: 'aria-pressed:bg-ink-900', cash: 'aria-pressed:bg-emerald-600', gcash: 'aria-pressed:bg-blue-700',
  bank: 'aria-pressed:bg-ink-900', check: 'aria-pressed:bg-ink-900', other: 'aria-pressed:bg-ink-900',
}

/** Where a payment came from, for the bars: a booking, a diner's numbered slip, or plain money in. */
const sourceOf = (line: DatedMoneyIn) => (line.bookingId ? 'Rooms & venues' : line.slip && line.place ? 'Restaurant' : 'Other')

// Every payment of a day, week, month or year (Sebastian, 2026-10-31: "can you add an all income also?
// make sure to be able to filter with payment types"): All expenses' window for money in. The row of
// payment types filters the total, the bars and the list, and stays in reach while the list scrolls.
// A payment on a cancelled booking counts in no total, so it is not income here either.
export function IncomeHistory({ payments, date, onOpenDay, onClose }: IncomeHistoryProps) {
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(date)
  const [kind, setKind] = useState<PaymentKind | ''>('')
  const today = dateToString(new Date())
  const { from, to, name } = rangeOf(period, anchor)

  useEffect(() => {
    const keys = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onClose])

  const inPeriod = useMemo(() => payments
    .filter(p => !p.cancelled && p.day >= from && p.day <= to)
    .sort((a, b) => b.day.localeCompare(a.day) || b.paidAt.localeCompare(a.paidAt)), [payments, from, to])
  const rows = kind ? inPeriod.filter(p => paymentKind(p.method) === kind) : inPeriod
  const sum = (list: DatedMoneyIn[]) => list.reduce((s, p) => s + Number(p.amount || 0), 0)
  const total = sum(rows)

  const bySource = new Map<string, number>()
  rows.forEach(p => bySource.set(sourceOf(p), (bySource.get(sourceOf(p)) || 0) + Number(p.amount || 0)))
  const sources = [...bySource.entries()].sort((a, b) => b[1] - a[1])
  const top = sources[0]?.[1] || 1

  // A payment type with nothing in this period has nothing to filter, so it steps aside unless it is the one picked.
  const types = KINDS.filter(([k]) => k === kind || inPeriod.some(p => paymentKind(p.method) === k))
  const chip = 'group flex-1 min-w-0 min-h-11 grid justify-items-center content-center gap-px p-1 rounded-[10px] bg-page text-main aria-pressed:text-white active:scale-95 transition-[background-color,color,transform] cursor-pointer'
  const arrow = 'w-9 h-9 grid place-items-center rounded-lg text-muted hover:bg-page hover:text-main cursor-pointer disabled:opacity-30 disabled:cursor-default'

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="All income" className="bg-card w-full max-w-2xl max-h-[85vh] rounded-xl border border-soft shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-soft bg-page shrink-0 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-main">Income</h3>
          <div className="flex items-center gap-2">
            <div role="group" aria-label="Period" className="flex gap-0.5 p-[3px] rounded-[10px] bg-card border border-soft">
              {PERIODS.map(([key, label]) => (
                <button
                  key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}
                  className={`min-h-8 px-2.5 md:px-3 rounded-lg text-[12.5px] cursor-pointer transition-colors ${period === key ? 'bg-brand-primary text-ink-900 font-bold' : 'text-muted font-semibold hover:text-main'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="overflow-y-auto min-h-0">
          <div className="px-4 pt-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setAnchor(a => step(period, a, -1))} aria-label="Earlier" className={arrow}><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-[13px] font-semibold text-main text-center">{name}</span>
              <button type="button" onClick={() => setAnchor(a => step(period, a, 1))} disabled={to >= today} aria-label="Later" className={arrow}><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-muted">{KINDS.find(([k]) => k === kind)?.[1] || 'Received'}</span>
              <span key={total} className="font-mono text-[26px] font-extrabold text-emerald-600 leading-none inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">{peso(total)}</span>
            </div>
          </div>

          {(inPeriod.length > 0 || kind) && (
            <div role="group" aria-label="Payment type" className="sticky top-0 z-[1] flex gap-1.5 px-4 py-2.5 bg-card">
              <button type="button" aria-pressed={!kind} onClick={() => setKind('')} className={chip + ' ' + PICKED.all}>
                <span className="text-[11.5px] font-bold whitespace-nowrap">All</span>
                <span className="font-mono text-[11px] md:text-[12px] font-bold whitespace-nowrap">{peso(sum(inPeriod))}</span>
              </button>
              {types.map(([k, label]) => (
                <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chip + ' ' + PICKED[k]}>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-bold whitespace-nowrap"><i className={'w-1.5 h-1.5 rounded-full group-aria-pressed:bg-white ' + DOT[k]} />{label}</span>
                  <span className="font-mono text-[11px] md:text-[12px] font-bold whitespace-nowrap">{peso(sum(inPeriod.filter(p => paymentKind(p.method) === k)))}</span>
                </button>
              ))}
            </div>
          )}

          {sources.length > 0 && (
            <div className="px-4 pt-0.5 pb-3.5 flex flex-col gap-2">
              {sources.map(([source, amount]) => (
                <div key={source} className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] md:grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-2 md:gap-3 text-[13px]">
                  <span className="text-main truncate">{source}</span>
                  <span className="block h-2.5 rounded-full bg-page overflow-hidden">
                    <span className="block h-full w-[var(--w)] rounded-full bg-emerald-600/80 transition-[width] duration-500 ease-out" style={{ '--w': (amount / top) * 100 + '%' } as CSSProperties} />
                  </span>
                  <span className="font-mono font-semibold text-main text-right">{peso(amount)}</span>
                </div>
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted border-t border-soft">
              {kind ? 'No ' + KINDS.find(([k]) => k === kind)?.[1] + ' ' + inThis(period) + '.' : 'Nothing received ' + inThis(period) + '.'}
            </p>
          ) : rows.map(line => {
            const what = line.purpose || (line.slip && line.place ? 'Order slip' : '')
            const pk = paymentKind(line.method)
            return (
              <button
                key={(line.bookingId || line.tabId || '') + (line.receipt || line.recordId || line.label) + line.day}
                type="button" onClick={() => onOpenDay(line.day)}
                className={'w-full grid items-start gap-x-2.5 gap-y-[3px] px-4 py-2.5 border-t border-soft text-left text-[13px] hover:bg-page transition-colors cursor-pointer ' + (period === 'day' ? 'grid-cols-[minmax(0,1fr)_auto]' : 'grid-cols-[2.75rem_minmax(0,1fr)_auto] md:grid-cols-[3.25rem_minmax(0,1fr)_auto]')}
              >
                {/* A Day list has its date at the top, so its rows drop it. */}
                {period !== 'day' && <span className="row-span-2 font-bold text-main">{shortDay(line.day)}</span>}
                <span className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-bold text-main">
                  <span>{line.who}</span>
                  {line.place && <span className={'px-1.5 rounded-md text-[10.5px] font-extrabold ' + (line.slip ? 'bg-gold-100 text-gold-800' : 'bg-paper-100 text-main')}>{line.place}</span>}
                  {line.bill && <span className="px-1 rounded-md border border-paper-200 font-mono text-[10.5px] font-semibold text-muted">{line.bill}</span>}
                </span>
                <span className="justify-self-end font-mono text-[14px] font-bold text-emerald-600">{peso(line.amount)}</span>
                <span className="col-span-2 md:col-span-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[12px]">
                  {what && <span className="basis-full min-w-0 text-main">{what}</span>}
                  <span className={'inline-flex items-center gap-1 px-2 py-px rounded-full text-[11.5px] font-bold ' + PILL[pk]}><i className={'w-1.5 h-1.5 rounded-full ' + DOT[pk]} />{line.method}</span>
                  {line.reference && <span className="font-mono text-[11.5px] text-muted">Ref {line.reference}</span>}
                </span>
                <span className="hidden md:block justify-self-end font-mono text-[11px] text-muted">{line.receipt}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

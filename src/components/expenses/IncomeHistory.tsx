import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { DatedMoneyIn } from '../../utils/dailyReport'
import { dateToString } from '../../utils/helpers'
import { PaymentKind, paymentKind } from '../../utils/paymentMethod'
import { rangeOf, step } from './periods'

interface IncomeHistoryProps {
  /** Every dated payment (`allMoneyIn`). */
  payments: DatedMoneyIn[]
  /** The day the Cash Flow screen is on; the window opens on the month around it. */
  date: string
  /** Jumps the day screen to the day of the row that was tapped. */
  onOpenDay: (date: string) => void
  onClose: () => void
}

type Range = { from: string; to: string }

const peso = (n: number) => '₱' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })
const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const fmt = (iso: string, o: Intl.DateTimeFormatOptions) => parse(iso).toLocaleDateString('en-US', o)
const monthOf = (day: string): Range => {
  const { from, to } = rangeOf('month', day)
  return { from, to }
}

/** `November 2026`, `Oct 12 – 20, 2026`, `Oct 15 – Nov 3, 2026`, `Tuesday, Nov 3`. */
function rangeName(r: Range) {
  const m = monthOf(r.from)
  if (r.from === m.from && r.to === m.to) return fmt(r.from, { month: 'long', year: 'numeric' })
  if (r.from === r.to) return fmt(r.from, { weekday: 'long', month: 'short', day: 'numeric' })
  const sameMonth = r.from.slice(0, 7) === r.to.slice(0, 7)
  return fmt(r.from, { month: 'short', day: 'numeric' }) + ' – ' + fmt(r.to, sameMonth ? { day: 'numeric' } : { month: 'short', day: 'numeric' }) + ', ' + r.to.slice(0, 4)
}

const KINDS: [PaymentKind, string][] = [['cash', 'Cash'], ['gcash', 'GCash'], ['bank', 'Bank'], ['check', 'Check'], ['other', 'Other']]
const DOT: Record<PaymentKind, string> = {
  cash: 'bg-emerald-600', gcash: 'bg-blue-700', bank: 'bg-ink-900', check: 'bg-paper-500', other: 'bg-paper-400',
}

const SOURCES = ['Rooms & venues', 'Restaurant', 'Other'] as const
/** Where a payment came from: a booking, a diner's numbered slip, or plain money in. */
const sourceOf = (line: DatedMoneyIn) => (line.bookingId ? 'Rooms & venues' : line.slip && line.place ? 'Restaurant' : 'Other')

// Every payment of a stretch of days (Sebastian, 2026-10-31: "can you add an all income also? make sure
// to be able to filter with payment types"). Redrawn on 2026-11-03 from layout 1 of the mock ("the all
// income should only have month by default and be custom filter of when to track the income", then
// "redesign the entire all income feature and improve the visual hierarchy"): the calendar stays open
// beside the figures, two taps pick the first and last day, and the window reads total → how it splits →
// the payments, by day. A payment on a cancelled booking counts in no total, so it is not income here either.
export function IncomeHistory({ payments, date, onOpenDay, onClose }: IncomeHistoryProps) {
  const today = dateToString(new Date())
  const [range, setRange] = useState<Range>(() => monthOf(date))
  // "This month" starts the calendar afresh on this month.
  const [calendarKey, setCalendarKey] = useState(0)
  const [kind, setKind] = useState<PaymentKind | ''>('')
  const { from, to } = range

  useEffect(() => {
    const keys = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onClose])

  const inRange = useMemo(() => payments
    .filter(p => !p.cancelled && p.day >= from && p.day <= to)
    .sort((a, b) => b.day.localeCompare(a.day) || b.paidAt.localeCompare(a.paidAt)), [payments, from, to])
  const rows = kind ? inRange.filter(p => paymentKind(p.method) === kind) : inRange
  const sum = (list: DatedMoneyIn[]) => list.reduce((s, p) => s + Number(p.amount || 0), 0)
  const all = sum(inRange)
  const total = sum(rows)
  const kindName = KINDS.find(([k]) => k === kind)?.[1]

  const byKind = new Map<PaymentKind, number>()
  inRange.forEach(p => byKind.set(paymentKind(p.method), (byKind.get(paymentKind(p.method)) || 0) + Number(p.amount || 0)))
  // Other shows only when something was paid that way, or it is the one picked.
  const types = KINDS.filter(([k]) => k !== 'other' || k === kind || byKind.has(k))

  const bySource = SOURCES.map(s => sum(rows.filter(p => sourceOf(p) === s)))
  const topSource = Math.max(1, ...bySource)

  const days: [string, DatedMoneyIn[]][] = []
  rows.forEach(p => {
    const last = days[days.length - 1]
    if (last && last[0] === p.day) last[1].push(p)
    else days.push([p.day, [p]])
  })

  const thisMonth = monthOf(today)
  const away = from !== thisMonth.from || to !== thisMonth.to

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label="All income" className="bg-card w-full max-w-[940px] max-h-[88vh] rounded-xl border border-soft shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="pl-[18px] pr-3 py-2.5 border-b border-soft shrink-0 flex items-center justify-between gap-2">
          <h3 className="font-display text-[15px] font-bold text-main">Income</h3>
          <button onClick={onClose} aria-label="Close" className="w-9 h-9 grid place-items-center rounded-lg text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="min-h-0 overflow-y-auto md:overflow-hidden md:grid md:grid-cols-[284px_minmax(0,1fr)]">
          <aside className="bg-page p-4 flex flex-col items-center gap-3.5 border-b md:border-b-0 md:border-r border-soft md:overflow-y-auto md:overflow-x-hidden">
            <RangeCalendar key={calendarKey} range={range} today={today} onPick={setRange} />

            <div className="w-full max-w-[420px] md:max-w-[252px] flex flex-col gap-2.5">
              <div className="flex h-3 gap-0.5 rounded-md overflow-hidden bg-paper-100">
                {types.map(([k]) => (
                  <span key={k} className={'h-full min-w-0 grow-[var(--g)] transition-[flex-grow,opacity] duration-500 ' + DOT[k] + (kind && kind !== k ? ' opacity-20' : '')} style={{ '--g': byKind.get(k) || 0 } as CSSProperties} />
                ))}
              </div>
              <div role="group" aria-label="Payment type" className="flex flex-col gap-1">
                {types.map(([k, label]) => {
                  const amount = byKind.get(k) || 0
                  const none = !amount && kind !== k
                  return (
                    <button
                      key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}
                      className={'min-h-11 px-3 grid grid-cols-[1fr_auto_2.6rem] items-center gap-2.5 rounded-xl bg-card text-left aria-pressed:shadow-[inset_0_0_0_2px_#1C1C1C] active:scale-[.97] transition-[box-shadow,transform,opacity] cursor-pointer ' + (none ? 'opacity-40 pointer-events-none' : '')}
                    >
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-main"><i className={'w-2 h-2 rounded-[3px] ' + DOT[k]} />{label}</span>
                      <span className="font-mono text-[13.5px] font-bold text-main">{peso(amount)}</span>
                      <span className="text-right text-[10.5px] font-bold text-muted">{all ? Math.round((amount / all) * 100) + '%' : '—'}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>

          <div className="min-w-0 md:overflow-y-auto">
            <div className="px-[18px] pt-[18px] pb-4 flex flex-col gap-[18px]">
              <div className="flex flex-col gap-1">
                <div className="min-h-[26px] flex flex-wrap items-center gap-2 text-[13px] font-bold text-main">
                  <span key={from + to} className="bw-rise">{rangeName(range)}</span>
                  {away && (
                    <button type="button" onClick={() => { setRange(thisMonth); setCalendarKey(k => k + 1) }} className="h-[26px] px-2.5 rounded-lg text-[12px] font-bold text-gold-800 hover:bg-gold-100 cursor-pointer bw-rise">This month</button>
                  )}
                </div>
                <span key={total} className="font-mono text-[32px] md:text-[38px] font-extrabold text-emerald-600 leading-none tracking-tight inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">{peso(total)}</span>
                <span className="min-h-[18px] text-[12.5px] font-semibold text-muted">
                  {rows.length > 0 && (kind
                    ? <>{kindName} · <b className="font-mono text-main">{rows.length}</b> {rows.length === 1 ? 'payment' : 'payments'} of <b className="font-mono text-main">{peso(all)}</b></>
                    : <><b className="font-mono text-main">{rows.length}</b> {rows.length === 1 ? 'payment' : 'payments'}</>)}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 md:gap-3.5">
                {SOURCES.map((source, i) => (
                  <div key={source} className="grid gap-[3px] text-[12px] font-semibold text-muted min-w-0">
                    <span className="truncate">{source}</span>
                    <span className="font-mono text-[14px] font-bold text-main">{peso(bySource[i])}</span>
                    <span className="block h-1 rounded-full bg-paper-100 overflow-hidden">
                      <span className="block h-full w-[var(--w)] rounded-full bg-emerald-600 transition-[width] duration-500 ease-out" style={{ '--w': (bySource[i] / topSource) * 100 + '%' } as CSSProperties} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-soft">
              {rows.length === 0 ? (
                <p className="px-[18px] py-9 text-center text-sm text-muted">
                  {kind ? 'No ' + kindName + ' in these days.' : 'Nothing received in these days.'}
                </p>
              ) : days.map(([day, list]) => (
                <div key={day}>
                  {/* A day's header stays in view while its payments scroll under it. */}
                  <div className="sticky top-0 z-[1] flex items-baseline justify-between px-[18px] py-2 bg-page border-b border-soft text-[12px] font-bold">
                    <span className="text-main">{fmt(day, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                    <span className="font-mono text-muted">{peso(sum(list))}</span>
                  </div>
                  {list.map(line => {
                    const what = line.purpose || (line.slip && line.place ? 'Order slip' : '')
                    return (
                      <button
                        key={(line.bookingId || line.tabId || '') + (line.receipt || line.recordId || line.label) + line.day}
                        type="button" onClick={() => onOpenDay(line.day)}
                        className="w-full grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-[18px] py-2.5 border-b border-soft text-left hover:bg-page transition-colors cursor-pointer"
                      >
                        <span className="min-w-0 flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-main">
                          <span>{line.who}</span>
                          {line.place && <span className={'px-1.5 rounded-md text-[10.5px] font-extrabold ' + (line.slip ? 'bg-gold-100 text-gold-800' : 'bg-paper-100 text-main')}>{line.place}</span>}
                          {line.bill && <span className="px-1 rounded-md border border-paper-200 font-mono text-[10.5px] font-semibold text-muted">{line.bill}</span>}
                        </span>
                        <span className="justify-self-end font-mono text-[14.5px] font-extrabold text-emerald-600">{peso(line.amount)}</span>
                        <span className="min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted">
                          <i className={'w-[7px] h-[7px] rounded-[2px] ' + DOT[paymentKind(line.method)]} />
                          <span>{line.method}</span>
                          {line.reference && <span>· Ref {line.reference}</span>}
                          {what && <span>· {what}</span>}
                        </span>
                        <span className="hidden sm:block justify-self-end self-center font-mono text-[10.5px] text-paper-400">{line.receipt}</span>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * The month with the stretch drawn on it: the first tap is the first day, the second the last
 * (either order), and the days between fill in gold as the pointer moves. Nothing after today.
 */
function RangeCalendar({ range, today, onPick }: { range: Range; today: string; onPick: (r: Range) => void }) {
  const [month, setMonth] = useState(range.to.slice(0, 7) + '-01')
  const [anchor, setAnchor] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const first = parse(month)
  const lead = first.getDay()
  const count = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  let a = range.from, z = range.to
  if (anchor) {
    a = anchor; z = hover || anchor
    if (z < a) [a, z] = [z, a]
  }

  const tap = (day: string) => {
    if (!anchor) { setAnchor(day); onPick({ from: day, to: day }); return }
    setAnchor(null)
    onPick(day < anchor ? { from: day, to: anchor } : { from: anchor, to: day })
  }
  const nav = 'w-[30px] h-[30px] grid place-items-center rounded-lg text-gold-800 hover:bg-gold-100 active:scale-90 transition-[background-color,transform] cursor-pointer'

  return (
    <div className="w-[252px]" onMouseLeave={() => setHover(null)}>
      <div className="flex items-center justify-between h-[30px] font-display text-[12.5px] font-bold text-main">
        <button type="button" onClick={() => setMonth(step('month', month, -1))} aria-label="Month before" className={nav}><ChevronLeft className="w-3.5 h-3.5" /></button>
        <span key={month} className="bw-rise">{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
        {month.slice(0, 7) < today.slice(0, 7)
          ? <button type="button" onClick={() => setMonth(step('month', month, 1))} aria-label="Month after" className={nav}><ChevronRight className="w-3.5 h-3.5" /></button>
          : <span className="w-[30px]" />}
      </div>
      <div className="grid grid-cols-7 pb-0.5 text-center text-[9.5px] font-bold text-muted">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center">
        {Array.from({ length: lead }, (_, i) => <span key={'b' + i} />)}
        {Array.from({ length: count }, (_, i) => {
          const day = month.slice(0, 8) + String(i + 1).padStart(2, '0')
          const isEnd = day === a || day === z
          const band = day >= a && day <= z && a !== z
          if (day > today) return <span key={day} className="h-[34px] grid place-items-center text-[12px] font-semibold text-paper-400">{i + 1}</span>
          return (
            <button
              key={day} type="button" aria-pressed={isEnd} onClick={() => tap(day)} onMouseEnter={() => anchor && setHover(day)}
              className="group relative h-[34px] grid place-items-center p-0 cursor-pointer"
            >
              {band && <i className={'absolute inset-y-[3px] bg-gold-100 ' + (day === a ? 'left-1/2 right-0' : day === z ? 'left-0 right-1/2' : 'inset-x-0')} />}
              <span className={'relative w-[30px] h-7 grid place-items-center rounded-[9px] text-[12px] transition-[background-color,color,transform] group-active:scale-[.88] '
                + (isEnd ? 'bg-ink-900 text-white font-extrabold' : 'font-semibold text-main group-hover:bg-gold-100')
                + (day === today && !isEnd ? ' shadow-[inset_0_0_0_1.5px_#D0AB60]' : '')}>
                {i + 1}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

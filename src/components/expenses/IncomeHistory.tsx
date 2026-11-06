import { CSSProperties, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Banknote, ChevronLeft, ChevronRight, FileText, Landmark, LucideIcon, Smartphone, Wallet, X } from 'lucide-react'
import type { DatedMoneyIn } from '../../utils/dailyReport'
import { dateToString, parseDay, peso } from '../../utils/helpers'
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

const parse = parseDay
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
// Sebastian, 2026-11-05: how they paid "needs to be more visible and loud. not subtle" (A of the mock).
// So each way to pay has its own solid colour, a tint of it and a sign: a payment wears a filled pill,
// and the type rows under the calendar are tinted, the picked one filled. Check is deep gold, not pale grey.
const SOLID: Record<PaymentKind, string> = {
  cash: 'bg-emerald-600', gcash: 'bg-blue-700', bank: 'bg-ink-900', check: 'bg-gold-700', other: 'bg-paper-500',
}
const TINT: Record<PaymentKind, string> = {
  cash: 'bg-emerald-100 text-emerald-700', gcash: 'bg-blue-100 text-blue-700', bank: 'bg-ink-200 text-ink-900', check: 'bg-gold-100 text-gold-800', other: 'bg-paper-100 text-main',
}
const PICKED: Record<PaymentKind, string> = {
  cash: 'aria-pressed:bg-emerald-600', gcash: 'aria-pressed:bg-blue-700', bank: 'aria-pressed:bg-ink-900', check: 'aria-pressed:bg-gold-700', other: 'aria-pressed:bg-paper-500',
}
const SIGN: Record<PaymentKind, LucideIcon> = { cash: Banknote, gcash: Smartphone, bank: Landmark, check: FileText, other: Wallet }

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
              {/* Sebastian, 2026-11-05: the bar's pieces "should also be clickable" — each one picks its way to pay,
                  the same as the rows under it. The tap area reaches above and below so a thin piece can still be hit. */}
              <div className="flex h-4 gap-0.5 rounded-lg bg-paper-100">
                {types.map(([k, label]) => (
                  <button
                    key={k} type="button" aria-label={label + ' only'} aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}
                    className={'relative h-full min-w-0 grow-[var(--g)] first:rounded-l-lg last:rounded-r-lg cursor-pointer after:absolute after:inset-x-0 after:-inset-y-3.5 after:content-[\'\'] hover:scale-y-125 active:scale-y-90 aria-pressed:scale-y-125 transition-[flex-grow,opacity,transform] duration-500 ' + SOLID[k] + (kind && kind !== k ? ' opacity-20' : '') + (byKind.get(k) ? '' : ' pointer-events-none')}
                    style={{ '--g': byKind.get(k) || 0 } as CSSProperties}
                  />
                ))}
              </div>
              <div role="group" aria-label="Payment type" className="flex flex-col gap-1">
                {types.map(([k, label]) => {
                  const amount = byKind.get(k) || 0
                  const none = !amount && kind !== k
                  const Sign = SIGN[k]
                  return (
                    <button
                      key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(kind === k ? '' : k)}
                      className={'group min-h-11 px-3 grid grid-cols-[1fr_auto_2.6rem] items-center gap-2.5 rounded-xl text-left aria-pressed:text-white active:scale-[.97] transition-[background-color,color,transform,opacity] cursor-pointer ' + TINT[k] + ' ' + PICKED[k] + (none ? ' opacity-40 pointer-events-none' : '') + (kind && kind !== k ? ' opacity-60' : '')}
                    >
                      <span className="inline-flex items-center gap-2 text-[12.5px] font-bold"><Sign aria-hidden="true" className="w-4 h-4" />{label}</span>
                      <span className="font-mono text-[13.5px] font-bold">{peso(amount)}</span>
                      <span className="text-right text-[10.5px] font-bold opacity-75">{all ? Math.round((amount / all) * 100) + '%' : '—'}</span>
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
                    const pk = paymentKind(line.method)
                    const Sign = SIGN[pk]
                    return (
                      <button
                        key={(line.bookingId || line.tabId || '') + (line.receipt || line.recordId || line.label) + line.day}
                        type="button" onClick={() => onOpenDay(line.day)}
                        className="w-full grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-0.5 px-[18px] py-2.5 border-b border-soft text-left hover:bg-page transition-colors cursor-pointer"
                      >
                        <span className="min-w-0 flex flex-wrap items-center gap-1.5 text-[13.5px] font-bold text-main">
                          <span>{line.who}</span>
                          {line.place && <span className={'px-1.5 rounded-md text-[10.5px] font-extrabold ' + (line.slip ? 'bg-gold-100 text-gold-800' : 'bg-paper-100 text-main')}>{line.place}</span>}
                          {line.bill && <span className="px-1 rounded-md border border-paper-200 font-mono text-[10.5px] font-semibold text-muted">{line.bill}</span>}
                        </span>
                        <span className={'row-span-2 col-start-2 row-start-1 inline-flex items-center gap-1.5 h-[26px] pl-2 pr-2.5 rounded-full text-[12px] font-extrabold text-white ' + SOLID[pk]}>
                          <Sign aria-hidden="true" className="w-3.5 h-3.5" />{pk === 'other' ? line.method : KINDS.find(([k]) => k === pk)?.[1]}
                        </span>
                        <span className="row-span-2 col-start-3 row-start-1 justify-self-end font-mono text-[14.5px] font-extrabold text-emerald-600">{peso(line.amount)}</span>
                        <span className="col-start-1 min-w-0 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted">
                          {what && <span>{what}</span>}
                          {line.reference && <span>{what ? '· ' : ''}Ref {line.reference}</span>}
                        </span>
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

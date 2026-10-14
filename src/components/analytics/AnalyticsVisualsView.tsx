import React, { useEffect, useMemo, useRef, useState } from 'react'
import { TrendingUp, X } from 'lucide-react'
import { Booking, Room, Venue } from '../../types/booking'
import { Expense } from '../../types/expense'
import { TabLine } from '../../types/tab'
import { dateToString } from '../../utils/helpers'
import { Ledger, Place, addDays, buildLedger, parseDay } from '../../utils/dailyLedger'

// The Earnings report's Charts view (the owner, 2026-10-14, from the mock reviewed comment by comment): one big
// figure, a chart that shows whether the hotel is rising, steady or falling, and every room, venue and the
// restaurant as a tile read like a watchlist. No words that judge the figures — the owner reads them himself.

type Period = 'month' | 'year' | 'all' | 'custom'
type Measure = 'money' | 'filled'
/** `full` is how many days a whole unit has, so one not yet over can count at its pace. */
interface Unit { days: string[]; prev: string[] | null; label: string; long: string; full: number }
interface View { units: Unit[]; when: string; phrase: string; before: string | null; monthly: boolean }

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const peso = (n: number) => (n < 0 ? '(₱' + Math.abs(Math.round(n)).toLocaleString() + ')' : '₱' + Math.round(n).toLocaleString())
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => parseDay(day).toLocaleDateString('en-US', o)
const range = (a: string, b: string) => { const out: string[] = []; for (let d = a; d <= b; d = addDays(d, 1)) out.push(d); return out }
const later = (a: string, b: string) => (a > b ? a : b)

function dayUnits(days: string[], back: number | null): Unit[] {
  return days.map((d, k) => ({
    days: [d],
    prev: back ? [addDays(d, -back)] : null,
    label: (k === 0 || d.endsWith('-01') ? fmt(d, { month: 'short' }) + ' ' : '') + Number(d.slice(8)),
    long: fmt(d, { weekday: 'long', month: 'long', day: 'numeric' }),
    full: 1,
  }))
}
function monthUnits(start: string, end: string, withYear: boolean): Unit[] {
  const out: Unit[] = []
  for (let m = start.slice(0, 7) + '-01'; m <= end; m = dateToString(new Date(parseDay(m).getFullYear(), parseDay(m).getMonth() + 1, 1))) {
    const last = dateToString(new Date(parseDay(m).getFullYear(), parseDay(m).getMonth() + 1, 0))
    out.push({
      days: range(later(m, start), last < end ? last : end),
      prev: null,
      label: fmt(m, { month: 'short' }) + (withYear ? ' ’' + m.slice(2, 4) : ''),
      long: fmt(m, { month: 'long', year: 'numeric' }),
      full: Number(last.slice(8)),
    })
  }
  return out
}

function weekUnits(start: string, end: string, withYear: boolean): Unit[] {
  const out: Unit[] = []
  const monday = addDays(start, -((parseDay(start).getDay() + 6) % 7))
  for (let w = monday; w <= end; w = addDays(w, 7)) {
    const last = addDays(w, 6)
    out.push({
      days: range(later(w, start), last < end ? last : end),
      prev: null,
      label: fmt(w, { month: 'short', day: 'numeric' }) + (withYear && w.slice(5) <= '01-07' ? ' ’' + w.slice(2, 4) : ''),
      long: 'Week of ' + fmt(w, { month: 'long', day: 'numeric', year: 'numeric' }),
      full: 7,
    })
  }
  return out
}
/** Days for up to three months, weeks for up to two years, months beyond — always enough points for a shape. */
function unitsFor(a: string, b: string, withYear: boolean): { units: Unit[]; monthly: boolean } {
  const length = range(a, b).length
  if (length <= 92) return { units: dayUnits(range(a, b), null), monthly: false }
  return { units: length <= 731 ? weekUnits(a, b, withYear) : monthUnits(a, b, withYear), monthly: true }
}

/** The periods all end at today, so today is always the last point on the right (the owner, 2026-10-14). */
function buildView(period: Period, today: string, first: string, from: string, to: string): View {
  if (period === 'month') {
    const days = range(addDays(today, -29), today), before = addDays(today, -59) >= first
    return { units: dayUnits(days, before ? 30 : null), monthly: false, phrase: 'the last 30 days', before: before ? 'the 30 days before' : null,
      when: fmt(days[0], { month: 'long', day: 'numeric' }) + ' to ' + fmt(today, { month: 'long', day: 'numeric', year: 'numeric' }) }
  }
  if (period === 'year' || period === 'all') {
    // This year always runs from January 1, the weeks before the first record drawn as nothing earned
    // (the owner, 2026-10-14: "if it doesn't have enough data, then it should still show what it has").
    const start = period === 'year' ? today.slice(0, 4) + '-01-01' : first
    return { ...unitsFor(start, today, period === 'all'), phrase: period === 'year' ? 'this year' : 'all time', before: null,
      when: fmt(start, { month: 'long', day: 'numeric', year: 'numeric' }) + ' to ' + fmt(today, { month: 'long', day: 'numeric', year: 'numeric' }) }
  }
  const a = later(from < to ? from : to, first), b = (from < to ? to : from) > today ? today : (from < to ? to : from)
  const length = range(a, b).length, before = addDays(a, -length) >= first
  const when = a === b ? fmt(a, { month: 'short', day: 'numeric', year: 'numeric' })
    : fmt(a, a.slice(0, 4) === b.slice(0, 4) ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' }) + ' – ' + fmt(b, { month: 'short', day: 'numeric', year: 'numeric' })
  if (length <= 62) return { units: dayUnits(range(a, b), before ? length : null), monthly: false, phrase: when, when,
    before: before ? (length === 1 ? 'the day before' : 'the ' + length + ' days before') : null }
  return { ...unitsFor(a, b, true), phrase: when, when, before: null }
}

/** Each point is the average of the few before it, so the line follows where the figures are heading. */
function average(values: number[], monthly: boolean) {
  const span = monthly ? 4 : 7
  return values.map((_, i) => { const part = values.slice(Math.max(0, i - span + 1), i + 1); return sum(part) / part.length })
}
/** A smooth line through the points that never overshoots them. */
function curve(pts: [number, number][]) {
  const n = pts.length
  if (n < 2) return ''
  const dx: number[] = [], m: number[] = [], t: number[] = []
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; m[i] = (pts[i + 1][1] - pts[i][1]) / dx[i] }
  t[0] = m[0]; t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (3 * (dx[i - 1] + dx[i])) / ((2 * dx[i] + dx[i - 1]) / m[i - 1] + (dx[i] + 2 * dx[i - 1]) / m[i])
  let d = 'M' + pts[0][0] + ' ' + pts[0][1]
  for (let i = 0; i < n - 1; i++) { const h = dx[i] / 3; d += ' C' + (pts[i][0] + h) + ' ' + (pts[i][1] + t[i] * h) + ' ' + (pts[i + 1][0] - h) + ' ' + (pts[i + 1][1] - t[i + 1] * h) + ' ' + pts[i + 1][0] + ' ' + pts[i + 1][1] }
  return d
}
/** A week or month not yet over counts at its pace so far, so a part of one does not read as a fall. */
function paced(values: number[], units: Unit[], money: boolean) {
  const out = values.slice()
  const u = units[units.length - 1]
  if (money && u && out.length && u.days.length < u.full) out[out.length - 1] = (out[out.length - 1] * u.full) / u.days.length
  return out
}

/** What a point is compared with: the day, week or month before it, whichever the chart is drawn in. */
const unitBefore = (u: Unit) => (u.full === 1 ? 'the day before' : u.full === 7 ? 'the week before' : 'the month before')
/**
 * The quick trend (the owner, 2026-10-14): the latest point against the one before it — today against
 * yesterday on 30 days, this week against last on This year. An unfinished week or month counts at its pace.
 */
function lastStep(values: number[], units: Unit[], money: boolean) {
  if (values.length < 2) return null
  const v = paced(values, units, money)
  return { now: v[v.length - 1], then: v[v.length - 2], before: unitBefore(units[units.length - 1]) }
}

const Arrow: React.FC<{ now: number; then: number | null; peso: boolean; before: string | null; small?: boolean }> = ({ now, then, peso: isPeso, before, small }) => {
  if (then === null || !before) return null
  const diff = now - then
  const tip = diff ? (isPeso ? '₱' + Math.abs(Math.round(diff)).toLocaleString() + (diff > 0 ? ' more' : ' less') : 'From ' + then + '%') + ' than ' + before : 'The same as ' + before
  return (
    <span title={tip} className={`font-mono ${small ? 'text-[12px]' : 'text-[15px]'} font-semibold whitespace-nowrap ${diff > 0 ? 'text-emerald-600' : diff < 0 ? 'text-danger-600' : 'text-muted'}`}>
      {diff > 0 ? '▲ ' : diff < 0 ? '▼ ' : ''}{diff ? (isPeso ? '₱' + Math.abs(Math.round(diff)).toLocaleString() : Math.abs(diff) + '%') : '–'}
    </span>
  )
}

/** The big chart: one green area, its moving average, and a card for the day that is tapped. */
const Chart: React.FC<{ values: number[]; units: Unit[]; monthly: boolean; isPeso: boolean; name: string }> = ({ values, units, monthly, isPeso, name }) => {
  const host = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const [at, setAt] = useState<number | null>(null)
  // Drawn at the size it is shown, so a label is a real 11 points on a phone as on a desk.
  useEffect(() => {
    const el = host.current
    if (!el) return
    const watch = new ResizeObserver(([e]) => setSize({ width: Math.round(e.contentRect.width), height: Math.round(e.contentRect.height) }))
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  const N = units.length
  const width = size.width, W = Math.max(260, width), H = Math.max(220, size.height)
  const left = 46, right = 10, top = 12, bottom = 26, plotW = W - left - right, plotH = H - top - bottom
  // The chart spans exactly the period's lowest and highest points (the owner, 2026-10-14).
  const lo = Math.min(...values), hi = Math.max(lo + 1, ...values)
  const x = (i: number) => left + (plotW * i) / Math.max(1, N - 1)
  const y = (v: number) => top + plotH - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * plotH
  const axis = (v: number) => {
    if (!isPeso) return Math.round(v) + '%'
    const a = Math.abs(v)
    return (v < 0 ? '(' : '') + '₱' + (a >= 1000 ? (a / 1000).toFixed(1).replace('.0', '') + 'k' : Math.round(a)) + (v < 0 ? ')' : '')
  }
  const line = curve(values.map((v, i) => [x(i), y(v)]))
  const avg = average(paced(values, units, isPeso), monthly)
  const every = Math.ceil(N / Math.max(2, Math.floor(plotW / 56)))
  const pick = (clientX: number, box: DOMRect) => {
    const i = Math.round(((clientX - box.left) / box.width) * (N - 1))
    setAt(i >= 0 && i < values.length ? i : null)
  }
  const share = at === null ? 0 : (x(at) / W) * 100
  const steps = paced(values, units, isPeso)

  return (
    <div ref={host} className="relative flex-1 min-h-[240px]">
      {width > 0 && (
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible" role="img" aria-label={name}>
          <defs>
            <linearGradient id="perf-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#047857" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#047857" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          {[lo, (lo + hi) / 2, hi].map(v => (
            <g key={v}>
              <line x1={left} x2={W - right} y1={y(v)} y2={y(v)} className="stroke-ink-900/10" />
              <text x={left - 8} y={y(v) + 4} textAnchor="end" className="fill-muted text-[11px]">{axis(v)}</text>
            </g>
          ))}
          {units.map((u, i) => ((N - 1 - i) % every ? null : (
            <text key={i} x={x(i)} y={H - 7} textAnchor={i === 0 ? 'start' : i === N - 1 ? 'end' : 'middle'} className="fill-muted text-[11px]">{u.label}</text>
          )))}
          {values.length > 1 && (
            <>
              <path d={`${line} L${x(values.length - 1)} ${top + plotH} L${left} ${top + plotH} Z`} fill="url(#perf-fill)" />
              <path d={line} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-emerald-700" />
            </>
          )}
          {avg.length > 2 && <path d={curve(avg.map((v, i) => [x(i), y(v)]))} fill="none" strokeWidth={2.5} strokeLinecap="round" className="stroke-ink-900" />}
          <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r={3.5} className="fill-emerald-700" />
          {at !== null && (
            <>
              <line x1={x(at)} x2={x(at)} y1={top} y2={top + plotH} className="stroke-ink-900/20" />
              <circle cx={x(at)} cy={y(values[at])} r={4.5} strokeWidth={2} className="fill-white stroke-emerald-700" />
            </>
          )}
          {/* a tap or a pointer picks a day; the arrow keys move it */}
          <rect
            x={left} y={top} width={plotW} height={plotH + bottom} fill="transparent" tabIndex={0}
            aria-label="Pick a day with the arrow keys" className="cursor-crosshair outline-none touch-pan-y"
            onPointerDown={e => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
            onPointerMove={e => { if (e.pointerType === 'mouse' || e.buttons) pick(e.clientX, e.currentTarget.getBoundingClientRect()) }}
            onPointerLeave={e => { if (e.pointerType === 'mouse') setAt(null) }}
            onBlur={() => setAt(null)}
            onKeyDown={e => {
              if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
              e.preventDefault()
              setAt(Math.min(values.length - 1, Math.max(0, (at ?? values.length - 1) + (e.key === 'ArrowLeft' ? -1 : 1))))
            }}
          />
        </svg>
      )}
      {at !== null && (
        <div
          className={`absolute top-2 left-[var(--at)] pointer-events-none flex items-baseline gap-2.5 whitespace-nowrap bg-card border border-soft rounded-lg px-2.5 py-1.5 text-[12px] ${share > 55 ? '-translate-x-[calc(100%+12px)]' : 'translate-x-3'}`}
          style={{ '--at': share + '%' } as React.CSSProperties}
        >
          <span className="font-semibold text-muted">{units[at].long}</span>
          <b className={`font-mono ${!isPeso || Math.round(values[at]) === 0 ? 'text-ink-900' : values[at] < 0 ? 'text-danger-600' : 'text-emerald-600'}`}>{isPeso ? peso(values[at]) : values[at] + '%'}</b>
          <Arrow small now={steps[at]} then={at ? steps[at - 1] : null} peso={isPeso} before={unitBefore(units[at])} />
        </div>
      )}
    </div>
  )
}

/** A small line of a source's average over the period, green when it rose and red when it fell. */
const Spark: React.FC<{ values: number[]; monthly: boolean; tone: 'up' | 'down' | 'same' }> = ({ values, monthly, tone }) => {
  const line = average(values, monthly), W = 120, H = 34
  const lo = Math.min(...line), hi = Math.max(lo + 1, ...line)
  const pts = line.map((v, i): [number, number] => [(W * i) / Math.max(1, line.length - 1), 2 + (H - 4) * (1 - (v - lo) / (hi - lo))])
  const color = tone === 'up' ? 'text-emerald-600' : tone === 'down' ? 'text-danger-600' : 'text-muted'
  const d = curve(pts)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={`block w-full h-7 overflow-visible ${color}`} aria-hidden="true">
      {pts.length > 1 && (
        <>
          <path d={`${d} L${W} ${H} L0 ${H} Z`} fill="currentColor" fillOpacity={0.12} />
          <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        </>
      )}
    </svg>
  )
}

interface Props {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  expenses: Expense[]
  tabLines: TabLine[]
  includePending: boolean
  /** The Table / Charts switch, shown beside the period. */
  tools?: React.ReactNode
}

export const AnalyticsVisualsView: React.FC<Props> = props => {
  const { bookings, rooms, venues, expenses, tabLines, includePending } = props
  // read once per change of data, not on every tap
  const ledger: Ledger = useMemo(() => buildLedger({ bookings, rooms, venues, expenses, tabLines, includePending }), [bookings, rooms, venues, expenses, tabLines, includePending])
  const today = dateToString(new Date())
  const [period, setPeriod] = useState<Period>('month')
  const [measure, setMeasure] = useState<Measure>('money')
  const [picked, setPicked] = useState<string | null>(null)
  const [from, setFrom] = useState(() => addDays(today, -42))
  const [to, setTo] = useState(today)
  const view = useMemo(() => buildView(period, today, ledger.first, from, to), [period, today, ledger.first, from, to])

  const now = view.units.flatMap(u => u.days)
  const over = (bag: Record<string, number> | undefined, days: string[]) => (bag ? sum(days.map(d => bag[d] || 0)) : 0)
  const moneyIn = (days: string[]) => sum(ledger.places.map(p => over(ledger.money[p.id], days)))
  const nights = (days: string[]) => sum(ledger.places.filter(p => p.room).map(p => over(ledger.used[p.id], days)))
  const profitOf = (days: string[]) => moneyIn(days) - over(ledger.spent, days)
  // The chart counts income only, never expenses (the owner, 2026-10-14: "why is it counting losses? it's only
  // supposed to count income"); the profit stays the big figure above it.
  const MEASURES: Record<Measure, { name: string; peso: boolean; of: (days: string[]) => number }> = {
    money: { name: 'Money in', peso: true, of: moneyIn },
    filled: { name: 'Rooms filled', peso: false, of: days => (days.length && ledger.roomCount ? Math.round((nights(days) / (ledger.roomCount * days.length)) * 100) : 0) },
  }
  const place = ledger.places.find(p => p.id === picked)
  const placeOf = (p: Place) => (days: string[]) => over(ledger.money[p.id], days)
  const chartOf = place ? placeOf(place) : MEASURES[measure].of
  const chartIsPeso = place ? true : MEASURES[measure].peso
  const values = view.units.map(u => chartOf(u.days))

  // the big figure: the profit, or the room or venue that was tapped
  const big = place ? placeOf(place)(now) : profitOf(now)
  const bigStep = lastStep(view.units.map(u => (place ? placeOf(place) : profitOf)(u.days)), view.units, true)

  /** How a source moved: its latest day, week or month against the one before. */
  const change = (p: Place) => {
    const vals = view.units.map(u => placeOf(p)(u.days))
    const st = lastStep(vals, view.units, true)
    const pct = !st ? 0 : st.then > 0 ? Math.round(((st.now - st.then) / st.then) * 100) : st.now > 0 ? null : 0
    return { vals, pct, tip: st ? peso(st.now) + ' against ' + peso(st.then) + ', ' + st.before : '' }
  }

  const PERIODS: [Period, string][] = [['month', '30 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom']]
  const dateBox = 'bg-card border border-soft text-main text-base px-2 py-1.5 rounded-lg outline-none font-mono focus:border-gold-500 cursor-pointer'

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-gold-600" />
            Earnings report
          </h2>
          <p className="text-[13px] text-muted mt-0.5">{view.when}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 max-w-full">
        {props.tools}
        <div role="group" aria-label="Period" className="flex gap-1 p-1 bg-card border border-soft rounded-xl max-w-full overflow-x-auto">
          {PERIODS.map(([key, label]) => (
            <button
              key={key} type="button" aria-pressed={period === key} onClick={() => setPeriod(key)}
              className={`min-h-9 px-3.5 rounded-lg text-[13px] whitespace-nowrap cursor-pointer transition-colors ${period === key ? 'bg-brand-primary text-ink-900 font-bold' : 'text-muted font-semibold hover:text-main'}`}
            >
              {label}
            </button>
          ))}
        </div>
        </div>
      </div>
      {period === 'custom' && (
        <div className="flex flex-wrap items-center justify-end gap-2 text-[13px] text-muted">
          <input type="date" aria-label="From" value={later(from, ledger.first)} min={ledger.first} max={today} onChange={e => e.target.value && setFrom(e.target.value)} className={dateBox} />
          to
          <input type="date" aria-label="To" value={to} min={ledger.first} max={today} onChange={e => e.target.value && setTo(e.target.value)} className={dateBox} />
        </div>
      )}

      {/* the figure and the chart on the left, the watchlist of every source beside them (the owner, 2026-10-14:
          "utilize the extra space on the side") — stacked under each other on a narrow screen */}
      <div className="bg-card border border-soft rounded-2xl overflow-hidden grid lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 flex flex-col">
        <div className="px-4 pt-5 pb-1.5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center justify-between gap-3 min-h-9">
            <span className="text-[13px] font-semibold text-muted">
              {place ? place.name + (place.hint ? ' · ' + place.hint : '') : big < 0 ? 'Loss' : 'Profit'}, {view.phrase}
            </span>
            {place && (
              <button type="button" aria-label="Back to the whole hotel" onClick={() => setPicked(null)} className="w-9 h-9 rounded-full bg-page grid place-items-center cursor-pointer shrink-0">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3.5 gap-y-1">
            <span className={`font-mono text-[40px] leading-none font-extrabold tracking-tight ${big < 0 ? 'text-danger-600' : 'text-emerald-600'}`}>{peso(big)}</span>
            {bigStep && <Arrow now={bigStep.now} then={bigStep.then} peso before={bigStep.before} />}
          </div>
          <span className="text-[13px] text-muted">
            {place
              ? place.room && <><b className="font-mono text-main">{over(ledger.used[place.id], now)}</b> of {now.length} nights</>
              : <>Money in <b className="font-mono text-main">{peso(moneyIn(now))}</b> · Spent <b className="font-mono text-main">{peso(over(ledger.spent, now))}</b></>}
          </span>
        </div>
            {!place && view.units.length > 1 && (
              <div role="group" aria-label="What the chart shows" className="flex gap-0.5 p-[3px] rounded-[10px] bg-page">
                {(Object.keys(MEASURES) as Measure[]).map(k => (
                  <button
                    key={k} type="button" aria-pressed={measure === k} onClick={() => setMeasure(k)}
                    className={`min-h-9 px-3 rounded-lg text-[12.5px] cursor-pointer ${measure === k ? 'bg-card text-main font-bold ring-1 ring-ink-900/10' : 'text-muted font-semibold'}`}
                  >
                    {MEASURES[k].name}
                  </button>
                ))}
              </div>
            )}
        </div>

        {view.units.length > 1 && (
          <div className="px-4 pt-3 pb-4 flex-1 flex flex-col">
            {moneyIn(now)
              ? <Chart key={period + measure + picked + view.when} values={values} units={view.units} monthly={view.monthly} isPeso={chartIsPeso} name={(place ? place.name : MEASURES[measure].name) + ', ' + view.when} />
              : <p className="py-10 text-center text-[13px] text-muted">Nothing earned yet.</p>}
          </div>
        )}

        </div>

        <ul className="border-t lg:border-t-0 lg:border-l border-soft p-2 grid sm:grid-cols-2 lg:grid-cols-1 content-start gap-0.5 lg:max-h-[42rem] lg:overflow-y-auto">
          {ledger.places.map(p => {
            const c = change(p)
            const tone = c.pct === null || c.pct === 0 ? 'same' : c.pct > 0 ? 'up' : 'down'
            const on = picked === p.id
            return (
              <li key={p.id}>
                <button
                  type="button" aria-pressed={on} title={p.name + (p.hint ? ' · ' + p.hint : '') + (c.tip ? '\n' + c.tip : '')}
                  onClick={() => setPicked(on ? null : p.id)}
                  className={`w-full grid grid-cols-[5.75rem_minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-1.5 min-h-11 text-left cursor-pointer transition-colors active:translate-y-px ${on ? 'bg-ink-900 text-white' : 'hover:bg-page'}`}
                >
                  <span className="font-display font-bold text-[14px] truncate">{p.label}</span>
                  <Spark values={c.vals} monthly={view.monthly} tone={tone} />
                  <span className="flex flex-col items-end leading-tight">
                    {/* money earned is green, nothing earned stays plain (the owner, 2026-10-14) */}
                    <span className={`font-mono text-[13px] font-bold ${placeOf(p)(now) > 0 ? (on ? 'text-emerald-300' : 'text-emerald-600') : ''}`}>{peso(placeOf(p)(now))}</span>
                    <span className={`font-mono text-[11.5px] font-bold whitespace-nowrap ${tone === 'up' ? (on ? 'text-emerald-300' : 'text-emerald-600') : tone === 'down' ? (on ? 'text-danger-300' : 'text-danger-600') : on ? 'text-white/60' : 'text-muted'}`}>
                      {c.pct === null ? 'new' : c.pct === 0 ? '0%' : (c.pct > 0 ? '▲ ' : '▼ ') + Math.abs(c.pct) + '%'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </>
  )
}

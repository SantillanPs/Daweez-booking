import { useEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { BedDouble, Building2, Check, ChefHat, ChevronDown, House, Printer, SquareArrowOutUpRight, Trees, UtensilsCrossed, X, type LucideIcon } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'
import { WaySign } from './DayMoney'
import { PaperTitle } from '../billing/LedgerPaper'
import type { Journal, JournalBill } from '../../utils/journal'
import { paymentKind } from '../../utils/paymentMethod'
import { printOn } from '../../utils/printA5'
import { parseDay, pesoWhole } from '../../utils/helpers'

// Cash Flow → Month → Booked: the staff's Journal (`buildJournal`), the mock's option B (Sebastian,
// 2026-11-22: "apply B"). It opens on the bills that still owe, since chasing them is what the sheet
// is for; a bill opens to its lines and payments, and its bill opens here, as Money in's do.

const placeIcon = (p: string): LucideIcon =>
  p === 'Rooms' ? BedDouble : p === 'Restaurant' ? UtensilsCrossed : p === 'Catering' ? ChefHat : /house|exclusive/i.test(p) ? House : Trees
const md = (day?: string) => (day ? day.slice(5, 7) + '/' + day.slice(8, 10) : '')
const two = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const payDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
const ROW = 'grid grid-cols-[40px_minmax(0,1fr)_auto_18px] md:grid-cols-[48px_minmax(0,1fr)_92px_112px_96px_22px] gap-x-2.5 items-center'

export function MonthJournal({ journal, month, onOpen }: {
  journal: Journal
  /** `November 2026`. */
  month: string
  /** Opens the bill, by its booking's id. */
  onOpen: (bookingId: string) => void
}) {
  const live = journal.bills.filter(b => !b.cancelled)
  const owing = live.filter(b => b.owed > 0)
  const [filter, setFilter] = useState<'owe' | 'all'>('owe')
  const [open, setOpen] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const list = filter === 'owe' ? owing : journal.bills
  const sum = (f: (b: JournalBill) => number) => live.reduce((t, b) => t + f(b), 0)
  const net = sum(b => b.net), owed = sum(b => b.owed)
  const name = month.split(' ')[0]

  return (
    <div className="bg-card border border-soft rounded-xl shadow-soft">
      <div className="px-4 md:px-5 pt-4 pb-2.5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Booked in {name}</p>
          <p className="mt-1 text-[14px] font-extrabold">{live.length} bill{live.length === 1 ? '' : 's'}<span className="ml-1.5 text-[13px] font-semibold text-muted">· {pesoWhole(net)}</span></p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Still owed</p>
          <p className={'mt-1 font-mono text-[26px] font-extrabold leading-none tabular-nums ' + (owed ? 'text-danger-600' : 'text-emerald-600')}>
            <AnimatedNumber prefix="₱" value={Math.round(owed)} duration={700} />
          </p>
        </div>
      </div>

      <div className="px-4 md:px-5 pb-2">
        <div role="group" aria-label="Show" className="inline-flex gap-0.5 p-0.5 bg-paper-100 rounded-lg">
          {([['owe', 'Still owe · ' + owing.length], ['all', 'All · ' + journal.bills.length]] as const).map(([k, label]) => (
            <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
              className={'min-h-8 px-3 rounded-md text-[12.5px] font-bold transition-colors cursor-pointer active:scale-95 ' + (filter === k ? 'bg-ink-900 text-white' : 'text-muted hover:text-main')}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={ROW + ' hidden md:grid px-5 py-1.5 border-t border-soft text-[10px] font-bold uppercase tracking-wider text-muted'}>
        <span>Booked</span><span>Guest</span><span className="text-right">Bill</span><span className="text-right">Paid</span><span className="text-right">Owes</span><span />
      </div>

      {list.length === 0 ? (
        <p className="px-5 py-7 text-center text-[13px] font-semibold text-muted border-t border-soft">
          {journal.bills.length ? 'Every bill booked in ' + name + ' is paid.' : 'No bill booked in ' + name + ' has a payment yet.'}
        </p>
      ) : list.map((b, i) => (
        <BillRow key={b.key} bill={b} i={i} open={open === b.key} onToggle={() => setOpen(open === b.key ? null : b.key)} onOpen={() => onOpen(b.lead.id)} />
      ))}

      <div className="px-4 md:px-5 pt-3.5 pb-3 border-t-2 border-ink-800 bg-page rounded-b-xl">
        <div className="grid grid-cols-[minmax(0,1fr)_84px_84px] md:grid-cols-[minmax(0,1fr)_96px_96px_96px] gap-x-2.5 items-center min-h-5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <span>Summary</span><span className="text-right">Bill</span><span className="hidden md:block text-right">Paid</span><span className="text-right">Owes</span>
        </div>
        {journal.places.map(p => {
          const Icon = placeIcon(p.place)
          return (
            <div key={p.place} className="grid grid-cols-[minmax(0,1fr)_84px_84px] md:grid-cols-[minmax(0,1fr)_96px_96px_96px] gap-x-2.5 items-center min-h-7 text-[13px]">
              <span className="min-w-0 flex items-center gap-1.5 font-extrabold"><Icon aria-hidden="true" className="w-[15px] h-[15px] shrink-0 text-muted" /><span className="truncate">{p.place}</span></span>
              <Fig n={p.net} />
              <span className="hidden md:block text-right"><Fig n={p.paid} tone="text-emerald-600" /></span>
              <Fig n={p.owed} tone="text-danger-600" />
            </div>
          )
        })}
        <div className="grid grid-cols-[minmax(0,1fr)_84px_84px] md:grid-cols-[minmax(0,1fr)_96px_96px_96px] gap-x-2.5 items-center min-h-7 border-t border-soft mt-1.5 pt-1.5 text-[13px] font-extrabold">
          <span>Total</span><Fig n={net} /><span className="hidden md:block text-right"><Fig n={sum(b => b.paid)} tone="text-emerald-600" /></span><Fig n={owed} tone="text-danger-600" />
        </div>
        <div className="flex justify-end border-t border-soft mt-2.5 pt-3">
          <button type="button" onClick={() => setPrinting(true)}
            className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 rounded-lg bg-ink-900 hover:bg-ink-700 text-white text-[11.5px] font-extrabold active:scale-95 transition-[background-color,transform] cursor-pointer">
            <Printer className="w-3.5 h-3.5" />Print {name} journal
          </button>
        </div>
      </div>

      {printing && createPortal(<JournalPaper journal={journal} month={month} onClose={() => setPrinting(false)} />, document.body)}
    </div>
  )
}

/** A summary figure: a quiet dash for nothing, so the columns stay in place. */
const Fig = ({ n, tone = '' }: { n: number; tone?: string }) =>
  Math.round(n) > 0
    ? <span className={'text-right font-mono font-bold tabular-nums ' + tone}>{pesoWhole(n)}</span>
    : <span className="text-right font-mono font-bold text-ink-300">–</span>

function BillRow({ bill: b, i, open, onToggle, onOpen }: { bill: JournalBill; i: number; open: boolean; onToggle: () => void; onOpen: () => void }) {
  const places = [...new Set(b.lines.map(l => l.place))]
  const rooms = b.lines.filter(l => l.place === 'Rooms').map(l => l.what.replace('Room ', 'Rm '))
  const ways = [...new Set(b.payments.map(p => paymentKind(p.method)))]
  const day = parseDay(b.booked)
  return (
    <div className={'relative border-t border-soft bk-row' + (b.cancelled ? ' dm-struck' : '')} style={{ '--i': i } as CSSProperties}>
      <button type="button" aria-expanded={open} onClick={onToggle}
        className={ROW + ' group w-full text-left px-4 md:px-5 py-2.5 min-h-14 hover:bg-page aria-expanded:bg-page active:scale-[.993] transition-[background-color,transform] cursor-pointer'}>
        <span className="font-display text-[11px] font-bold text-muted leading-tight">
          {day.toLocaleDateString('en-US', { month: 'short' })}<b className="block text-[17px] text-main">{day.getDate()}</b>
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-[14px] font-extrabold min-w-0">
            {b.agency && <Building2 aria-label="Agency" className="w-[15px] h-[15px] shrink-0 text-gold-800" />}
            <span className="truncate">{b.who}</span>
            <span className="shrink-0 text-[11.5px] font-semibold text-muted">{b.number}</span>
          </span>
          <span className="flex flex-wrap gap-1 mt-1">
            {places.map(p => {
              const Icon = placeIcon(p)
              return (
                <span key={p} className="inline-flex items-center gap-1 text-[11.5px] font-bold text-ink-600 bg-paper-100 rounded-md px-1.5 py-0.5">
                  <Icon aria-hidden="true" className="w-3 h-3 text-muted" />{p === 'Rooms' ? rooms.join(', ') : p}
                </span>
              )
            })}
          </span>
        </span>
        <span className="hidden md:block text-right font-display text-[14px] font-extrabold tabular-nums">{pesoWhole(b.net)}</span>
        <span className="hidden md:flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1 font-display text-[13px] font-bold text-emerald-600 tabular-nums">
            {ways.map(w => <WaySign key={w} kind={w} />)}{pesoWhole(b.paid)}
          </span>
          {!b.cancelled && (
            <span className="w-full h-1 rounded bg-paper-200 overflow-hidden">
              <span className="block h-full rounded bg-emerald-600 origin-left src-grow [transform:scaleX(var(--p))]" style={{ '--p': b.net ? Math.min(1, b.paid / b.net) : 1, '--i': i } as CSSProperties} />
            </span>
          )}
        </span>
        {b.cancelled ? <span className="text-right font-display text-[11px] font-extrabold uppercase tracking-wide text-danger-600">Cancelled</span>
          : b.owed <= 0 ? <span className="inline-flex items-center justify-end gap-1 font-display text-[12.5px] font-extrabold text-emerald-600"><Check className="w-[15px] h-[15px] stroke-[3]" />Paid</span>
          : <span className={'text-right font-display font-extrabold tabular-nums ' + (b.agency ? 'text-[13px] text-gold-800' : 'text-[15px] text-danger-600')}>
              {pesoWhole(b.owed)}{b.agency && <small className="block font-sans text-[10.5px] font-bold">Agency pays</small>}
            </span>}
        <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-gold-600 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
      </button>
      {b.cancelled && <span aria-hidden="true" className="dm-scratch" />}

      {/* grows open from the row, like a day's merged expenses */}
      <div className={'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] ' + (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
        <div className="min-h-0 overflow-hidden">
          <div className="ml-[58px] md:ml-[78px] mr-4 md:mr-5 mb-3.5 pl-3 border-l-2 border-paper-200 text-[13px]">
            {b.lines.map((l, k) => {
              const Icon = placeIcon(l.place)
              return (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_84px] md:grid-cols-[minmax(0,1fr)_auto_96px] gap-x-2.5 items-center min-h-7">
                  <span className="min-w-0 flex items-center gap-1.5 font-bold"><Icon aria-hidden="true" className="w-[15px] h-[15px] shrink-0 text-muted" /><span className="truncate">{l.what}</span></span>
                  <span className="hidden md:block text-[12.5px] font-medium text-muted whitespace-nowrap">
                    {l.checkIn && md(l.checkIn) + (l.checkOut && l.checkOut !== l.checkIn ? '–' + md(l.checkOut) : '') + ' · '}
                    {l.unit ? l.qty + ' ' + l.unit + ' × ' + pesoWhole(l.rate) : ''}
                  </span>
                  <span className="text-right font-display font-bold tabular-nums">{pesoWhole(l.total)}</span>
                </div>
              )
            })}
            {b.discount > 0 && (
              <div className="grid grid-cols-[minmax(0,1fr)_84px] md:grid-cols-[minmax(0,1fr)_96px] gap-x-2.5 items-center min-h-7">
                <span className="font-semibold">Less: discount</span>
                <span className="text-right font-display font-bold text-danger-600 tabular-nums">({pesoWhole(b.discount)})</span>
              </div>
            )}
            {b.payments.map((p, k) => (
              <div key={p.id} className={'grid grid-cols-[minmax(0,1fr)_84px] md:grid-cols-[minmax(0,1fr)_auto_96px] gap-x-2.5 items-center min-h-7' + (k === 0 ? ' border-t border-dashed border-paper-200 mt-1 pt-1' : '')}>
                <span className="flex items-center gap-1.5 font-semibold"><WaySign kind={paymentKind(p.method)} />{payDay(p.paid_at)}</span>
                <span className="hidden md:block text-[12.5px] font-medium text-muted">{p.receipt_number}</span>
                <span className="text-right font-display font-bold text-emerald-600 tabular-nums">{pesoWhole(p.amount)}</span>
              </div>
            ))}
            <button type="button" onClick={onOpen}
              className="mt-2 inline-flex items-center gap-1.5 min-h-8 px-3 rounded-lg bg-ink-900 hover:bg-ink-700 text-white text-[12px] font-extrabold active:scale-95 transition-[background-color,transform] cursor-pointer">
              <SquareArrowOutUpRight className="w-3.5 h-3.5" />Open bill
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const TH = 'border border-ink-900 px-1 py-1 text-[8.5px] font-extrabold uppercase leading-tight'
const TD = 'border border-ink-900 px-1.5 py-0.5 align-middle'
const NUM = TD + ' text-right font-mono text-[9.5px] whitespace-nowrap'

/** The staff's own sheet, column for column: one row a room, venue, food or catering, the bill's money once across its rows. */
function JournalPaper({ journal, month, onClose }: { journal: Journal; month: string; onClose: () => void }) {
  const live = journal.bills.filter(b => !b.cancelled)
  const tot = (f: (b: JournalBill) => number) => live.reduce((t, b) => t + f(b), 0)
  const places = journal.places
  const pt = (f: (p: typeof places[number]) => number) => places.reduce((t, p) => t + f(p), 0)
  useEffect(() => {
    const keys = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 bg-ink-900/60 overflow-auto print:static print:bg-transparent print:overflow-visible">
      {/* the sheet is wider than a phone, so the bar stays on the screen, not on the sheet */}
      <div className="sticky top-0 left-0 z-10 w-full flex items-center justify-between px-5 py-3 bg-ink-900 text-white print:hidden">
          <span className="bg-white text-ink-800 text-[11px] font-bold px-2 py-0.5 rounded uppercase">Journal</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => printOn('A4 landscape')} className="bg-white hover:bg-paper-100 text-ink-800 font-bold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5 active:scale-95 transition-[background-color,transform] cursor-pointer">
              <Printer className="w-3.5 h-3.5" />Print
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className="text-white/70 hover:text-white p-1 cursor-pointer"><X className="w-5 h-5" /></button>
          </div>
      </div>
      <div className="print-page bg-card w-[1040px] max-w-none mx-auto my-6 rounded-xl shadow-2xl overflow-hidden print:my-0 print:shadow-none print:rounded-none">
        <div className="px-9 py-7 print:px-10 print:py-6 text-ink-900 font-sans">
          <PaperTitle heading="Journal" date={'For the month of ' + month.replace(' ', ', ')} />
          <table className="w-full border-collapse text-[10px] mt-1">
            <thead><tr>
              {['Date booked', 'Bill #', 'Name of guest / particulars', 'Room / venue / restaurant / catering', 'Rate', 'Check in', 'Check out', '# of nights / days', 'Total', 'Discount', 'Total net', 'Payment', 'Balance', 'Mode of payment'].map(h => <th key={h} className={TH}>{h}</th>)}
            </tr></thead>
            <tbody>
              {journal.bills.map(b => b.lines.map((l, k) => {
                const span = b.lines.length
                const ways = [...new Set(b.payments.map(p => paymentKind(p.method)))].map(w => w === 'gcash' ? 'GCash' : w[0].toUpperCase() + w.slice(1))
                return (
                  <tr key={b.key + k} className={b.cancelled ? 'text-ink-500 line-through' : ''}>
                    {k === 0 && <>
                      <td rowSpan={span} className={TD + ' whitespace-nowrap'}>{md(b.booked)}/{b.booked.slice(0, 4)}</td>
                      <td rowSpan={span} className={TD + ' whitespace-nowrap'}>{b.number}</td>
                      <td rowSpan={span} className={TD}>{b.who}</td>
                    </>}
                    <td className={TD}>{l.what}</td>
                    <td className={NUM}>{two(l.rate)}</td>
                    <td className={TD + ' text-center'}>{md(l.checkIn)}</td>
                    <td className={TD + ' text-center'}>{md(l.checkOut)}</td>
                    <td className={TD + ' text-center'}>{l.unit ? l.qty + ' ' + l.unit : ''}</td>
                    <td className={NUM}>{two(l.total)}</td>
                    {k === 0 && <>
                      <td rowSpan={span} className={NUM}>{b.discount ? two(b.discount) : ''}</td>
                      <td rowSpan={span} className={NUM}>{two(b.net)}</td>
                      <td rowSpan={span} className={NUM}>{two(b.paid)}</td>
                      <td rowSpan={span} className={NUM}>{b.cancelled ? '' : two(b.owed)}</td>
                      <td rowSpan={span} className={TD + ' text-center'}>{b.cancelled ? 'CANCELLED' : ways.join(', ')}</td>
                    </>}
                  </tr>
                )
              }))}
              <tr className="font-extrabold">
                <td colSpan={8} className={TD + ' text-right border-t-2'}>TOTAL</td>
                <td className={NUM + ' border-t-2'}>{two(tot(b => b.total))}</td>
                <td className={NUM + ' border-t-2'}>{two(tot(b => b.discount))}</td>
                <td className={NUM + ' border-t-2'}>{two(tot(b => b.net))}</td>
                <td className={NUM + ' border-t-2'}>{two(tot(b => b.paid))}</td>
                <td className={NUM + ' border-t-2'}>{two(tot(b => b.owed))}</td>
                <td className={TD + ' border-t-2'} />
              </tr>
            </tbody>
          </table>
          <table className="w-[560px] border-collapse text-[10px] mt-5">
            <thead><tr>{['Summary', 'Total', 'Discount', 'Total net', 'Payment', 'Balance'].map(h => <th key={h} className={TH + (h === 'Summary' ? ' text-left' : '')}>{h}</th>)}</tr></thead>
            <tbody>
              {places.map(p => (
                <tr key={p.place}>
                  <td className={TD + ' font-bold'}>{p.place}</td>
                  <td className={NUM}>{two(p.total)}</td><td className={NUM}>{two(p.discount)}</td><td className={NUM}>{two(p.net)}</td>
                  <td className={NUM}>{two(p.paid)}</td><td className={NUM}>{two(p.owed)}</td>
                </tr>
              ))}
              <tr className="font-extrabold">
                <td className={TD + ' text-right border-t-2'}>TOTAL</td>
                <td className={NUM + ' border-t-2'}>{two(pt(p => p.total))}</td><td className={NUM + ' border-t-2'}>{two(pt(p => p.discount))}</td>
                <td className={NUM + ' border-t-2'}>{two(pt(p => p.net))}</td><td className={NUM + ' border-t-2'}>{two(pt(p => p.paid))}</td>
                <td className={NUM + ' border-t-2'}>{two(pt(p => p.owed))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

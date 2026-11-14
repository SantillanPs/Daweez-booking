import { useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  BedDouble, ChefHat, ChevronDown, Cookie, Fuel, House, Printer, Receipt, ShoppingBasket, Trees, Users,
  UtensilsCrossed, Wrench, Zap, type LucideIcon,
} from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'
import { peso } from '../../utils/helpers'
import { printA5 } from '../../utils/printA5'
import type { IncomeStatement } from '../../utils/incomeStatement'
import { StatementShell } from '../billing/StatementShell'
import { PaperEnd, PaperHead, PaperRow, PaperTitle, PaperTotal } from '../billing/LedgerPaper'

// Cash Flow's Month and Year (Sebastian, 2026-11-14: "how about adding this to the today's money? like a
// monthly, and yearly"): the staff's paper income statement, on screen and on paper. An expense line that
// adds up more than one category opens to them, so the staff can see what went under it.

// Each line is drawn like the day's (Sebastian, 2026-11-14: "make the money in and expenses design a bit
// more similar to the daily"): a money-in line leads with its place's sign and its amount in green, an
// expense line is one row like the day's Money out and opens to what it holds the way a day's merged expenses do.
const ROW = 'grid grid-cols-[minmax(0,max-content)_minmax(40px,1fr)_80px_24px] items-center gap-x-2 min-h-7 py-1 -mx-2 px-2 rounded-lg text-[13px]'
const AMOUNT = 'font-display font-extrabold tabular-nums inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]'

const placeIcon = (label: string): LucideIcon =>
  label === 'Rooms' ? BedDouble : label === 'Restaurant' ? UtensilsCrossed : label === 'Catering' ? ChefHat : /house|exclusive/i.test(label) ? House : Trees
const LINE_ICONS: Record<string, LucideIcon> = {
  'Salaries & wages': Users, 'Restaurant expenses': ShoppingBasket, 'Catering expense': ChefHat, 'Repair & maintenance': Wrench,
  'Gasoline': Fuel, 'Light & water': Zap, 'Operational expense (snacks)': Cookie,
}

/** A line with nothing in the period: a quiet dash, so the paper's lines all stay in place. */
const Nothing = () => <span className="justify-self-end font-display font-extrabold text-ink-300">–</span>

export function MoneyStatement({ statement: s, heading, date }: {
  statement: IncomeStatement
  /** `Monthly Income Statement` / `Yearly Income Statement`, for the paper. */
  heading: string
  /** `October 2026` / `2026`. */
  date: string
}) {
  const [open, setOpen] = useState<string | null>(null)
  const [printing, setPrinting] = useState(false)
  const loss = s.net < 0

  // On screen it is drawn like the day (Sebastian, 2026-11-14: "before it's printed, keep the design of the
  // day"): money in beside money out, each total at the foot of its column, and the Summary bar under them.
  // Only the paper is the staff's income statement.
  return (
    <div className="bg-card border border-soft rounded-xl shadow-soft">
      <div className="grid md:grid-cols-2 md:divide-x divide-soft">
        <div className="px-5 pt-4 pb-3 flex flex-col">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Income</p>
          {s.income.map(l => {
            const Icon = placeIcon(l.label)
            return (
              <div key={l.label} className={'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 min-h-7 py-1 -mx-2 px-2 rounded-lg' + (l.amount ? '' : ' opacity-60')}>
                <span className="min-w-0 flex items-center gap-1.5 text-[14px] font-extrabold text-main">
                  <Icon aria-hidden="true" className="w-[15px] h-[15px] shrink-0 text-muted" />
                  <span className="min-w-0 truncate">{l.label}</span>
                </span>
                {l.amount ? <span key={l.amount} className={AMOUNT + ' text-[15px] text-right text-emerald-600'}>{peso(l.amount)}</span> : <Nothing />}
              </div>
            )
          })}
          <div className="flex-1 min-h-3" />
          <div className="flex justify-between items-center gap-3 pt-3 border-t border-soft text-[14px] font-extrabold">
            <span>Total income</span>
            <span key={s.totalIn} className="font-mono text-[18px] text-emerald-600 inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">{peso(s.totalIn)}</span>
          </div>
        </div>

        <div className="px-5 pt-4 pb-3 flex flex-col border-t md:border-t-0 border-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Operating expenses</p>
          {s.expenses.map(l => {
            const Icon = LINE_ICONS[l.label] || Receipt
            // one line each, like the day's Money out: the line in bold, what went under it faint beside it
            const body = (
              <>
                <span className="min-w-0 flex items-center gap-1.5 text-[14px] font-extrabold text-main">
                  <Icon aria-hidden="true" className="w-[15px] h-[15px] shrink-0 text-danger-600" />
                  <span className="min-w-0 truncate">{l.label}{l.parts.length > 1 && <span className="ml-1.5 text-[12.5px] font-semibold text-muted">· {l.parts.length} items</span>}</span>
                </span>
                <span className="min-w-0 truncate text-[12.5px] font-medium text-ink-600">{l.parts.map(p => p.label).join(', ')}</span>
                {l.amount ? <span key={l.amount} className={AMOUNT + ' text-[15px] text-right text-danger-600'}>{peso(l.amount)}</span> : <Nothing />}
              </>
            )
            if (l.parts.length < 2) return <div key={l.label} className={ROW + (l.amount ? '' : ' opacity-60')}>{body}<span /></div>
            const on = open === l.label
            return (
              <div key={l.label}>
                <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : l.label)}
                  className={'group ' + ROW + ' w-[calc(100%+1rem)] text-left hover:bg-page aria-expanded:bg-page active:scale-[.985] transition-[background-color,transform] cursor-pointer'}>
                  {body}
                  <span className="flex justify-end">
                    <ChevronDown aria-hidden="true" className="w-3.5 h-3.5 text-gold-600 transition-transform duration-[350ms] ease-[cubic-bezier(.34,1.4,.64,1)] group-aria-expanded:rotate-180" />
                  </span>
                </button>
                {/* grows open from the line, like a day's merged expenses */}
                <div className={'grid transition-[grid-template-rows] duration-[350ms] ease-[cubic-bezier(.2,.8,.2,1)] ' + (on ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="ml-[7px] mb-1 pl-3 border-l-2 border-paper-200">
                      {l.parts.map((p, i) => (
                        <div key={p.label} className={'grid grid-cols-[minmax(0,1fr)_80px_24px] items-center gap-x-2 min-h-7 py-1 text-[13px]' + (on ? ' bw-rise' : '')} style={{ '--i': i } as CSSProperties}>
                          <span className="min-w-0 truncate font-semibold text-main">{p.label}</span>
                          <span className={AMOUNT + ' text-[14px] text-danger-600'}>{peso(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
          <div className="flex-1 min-h-3" />
          <div className="flex justify-between items-center gap-3 pt-3 border-t border-soft text-[14px] font-extrabold">
            <span>Total expenses</span>
            <span key={s.totalOut} className="font-mono text-[18px] text-danger-600 inline-block [animation:bp-ready_.45s_cubic-bezier(.34,1.56,.64,1)]">({peso(s.totalOut)})</span>
          </div>
        </div>
      </div>

      <div className="px-5 pt-4 pb-3 border-t-2 border-ink-800 bg-page rounded-b-xl text-[13px] text-main">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1">Summary</p>
        <div className="flex items-center justify-between gap-3 min-h-6">
          <span>Total income</span>
          <span className="font-mono font-bold text-emerald-600">{peso(s.totalIn)}</span>
        </div>
        <div className="flex items-center justify-between gap-3 min-h-6">
          <span><span className="text-muted">Less:</span> Total expenses</span>
          <span className="font-mono font-bold text-danger-600">({peso(s.totalOut)})</span>
        </div>
        {/* a deposit given back left the cash, so it is said here rather than lost in silence */}
        {s.notCounted.map(l => (
          <div key={l.label} className="flex items-center justify-between gap-3 min-h-6 text-muted">
            <span>Not counted: {l.label}</span><span className="font-mono">{peso(l.amount)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 min-h-11 border-t border-soft mt-2 pt-2">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em]">{loss ? 'Net loss' : 'Net income'}</span>
          <span className={'font-mono text-[26px] font-extrabold leading-none ' + (loss ? 'text-danger-600' : 'text-emerald-600')}>
            {loss && '('}<AnimatedNumber prefix="₱" value={Math.abs(Math.round(s.net))} />{loss && ')'}
          </span>
        </div>
        <div className="flex justify-end border-t border-soft mt-2 pt-3">
          <button type="button" onClick={() => setPrinting(true)}
            className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 rounded-lg bg-ink-900 hover:bg-ink-700 text-white text-[11.5px] font-extrabold active:scale-95 transition-[background-color,transform] cursor-pointer">
            <Printer className="w-3.5 h-3.5" />Print {date}
          </button>
        </div>
      </div>

      {printing && createPortal(
        // a portal into <body>, like every print window here, so the sheet prints from the top of the page
        <div className="fixed inset-0 z-50 bg-ink-900/60 overflow-y-auto print:static print:bg-transparent print:overflow-visible">
          <div className="max-w-xl mx-auto my-6 print:my-0">
            <StatementShell label={heading} invoiceNumber={date} onClose={() => setPrinting(false)} onPrint={printA5} embedded>
              <div>
                <PaperTitle heading={heading} date={date} />
                <PaperHead>Income:</PaperHead>
                {s.income.map(l => <PaperRow key={l.label} label={l.label} amount={l.amount} />)}
                <PaperTotal label="Total income" amount={s.totalIn} />
                <PaperHead>Less: Operating expenses</PaperHead>
                {s.expenses.map(l => <PaperRow key={l.label} label={l.label} amount={l.amount} />)}
                <PaperTotal label="Total expenses" amount={s.totalOut} />
                <PaperEnd label={loss ? 'Net loss' : 'Net income'} amount={s.net} />
              </div>
            </StatementShell>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

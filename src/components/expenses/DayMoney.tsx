import { Trash2 } from 'lucide-react'
import { Expense, ExpenseCategory, Handover } from '../../types/expense'
import { CountPeso } from '../CountPeso'
import { DailyReport, forwardedLabel } from '../../utils/dailyReport'

const peso = (n: number) => '₱' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

const signed = (n: number) => (n < 0 ? '− ' : '') + peso(Math.abs(n))

interface DayMoneyProps {
  /** The day's sheet — the same figures the printed daily report carries. */
  report: DailyReport
  /** That day's expenses, so each one can be taken back off. */
  dayExpenses: Expense[]
  categories: ExpenseCategory[]
  onRemove: (expense: Expense) => void
  /** Money handed to the owner on this day, so each can be taken back. */
  dayHandovers: Handover[]
  onTakeBack: (handover: Handover) => void
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })

// The day on screen, in the order the printed sheet reads: money in, money out, and
// the money in the hotel at the bottom. Money in is read-only here — it comes from the receipts
// recorded on bookings and at the restaurant — and money out is the list just typed.
export function DayMoney({ report, dayExpenses, categories, onRemove, dayHandovers, onTakeBack }: DayMoneyProps) {
  const nameOf = (id: string) => categories.find(c => c.id === id)?.name || 'Other'

  return (
    <div className="bg-card border border-soft rounded-xl shadow-soft overflow-hidden">
      <div className="grid md:grid-cols-2 md:divide-x divide-soft">
        <div className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Money in</p>
          {report.moneyIn.length === 0 && <p className="text-[13px] text-muted">Nothing received yet.</p>}
          {report.moneyIn.map((line, i) => (
            <div key={line.label + i} className="flex justify-between gap-3 py-1 text-[13px]">
              <span className="text-main truncate">{line.label}</span>
              <span className="font-mono text-[14px] font-bold text-emerald-600 shrink-0">{peso(line.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between items-baseline gap-3 border-t border-soft mt-2 pt-2 text-[14px] font-extrabold">
            <span className="text-main">Total in</span>
            <span className="font-mono text-[18px] text-emerald-600">{peso(report.totalIn)}</span>
          </div>
        </div>

        <div className="p-4 border-t md:border-t-0 border-soft">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">Money out</p>
          {dayExpenses.length === 0 && <p className="text-[13px] text-muted">Nothing spent yet.</p>}
          {dayExpenses.map(expense => (
            <div key={expense.id} className="group flex items-center justify-between gap-3 py-1 text-[13px]">
              <span className="text-main truncate">
                {nameOf(expense.category_id)}
                {expense.notes ? <span className="text-muted"> · {expense.notes}</span> : null}
              </span>
              <span className="flex items-center gap-2 shrink-0">
                <span className="font-mono text-[14px] font-bold text-danger-600">{peso(expense.amount)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(expense)}
                  aria-label={'Remove ' + nameOf(expense.category_id) + ' ' + peso(expense.amount)}
                  className="text-muted hover:text-danger-600 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </span>
            </div>
          ))}
          <div className="flex justify-between items-baseline gap-3 border-t border-soft mt-2 pt-2 text-[14px] font-extrabold">
            <span className="text-main">Total out</span>
            <span className="font-mono text-[18px] text-danger-600">{peso(report.totalOut)}</span>
          </div>
        </div>
      </div>

      {/* THE SUMMARY, line for line as the staff write it on paper (their sheet, 2026-10-13):
          Cash for today · Add: Cash balance forwarded · Cash on hand · Less: Expenses ·
          Less: Cash remitted · Total cash on hand. The hotel's money does not start again at
          zero each morning, so the day before is carried in. Each figure keeps the colour it has
          above — money in green, money out red — and a hand-over is gold, so it is not read as
          money spent. */}
      <div className="px-4 py-3 border-t-2 border-ink-800 bg-page text-[13px] text-main">
        <div className="flex justify-between gap-3 py-0.5">
          <span>Cash for today</span>
          <span className="font-mono font-bold text-emerald-600">{peso(report.totalIn)}</span>
        </div>
        <div className="flex justify-between gap-3 py-0.5">
          <span><span className="text-muted">Add:</span> {forwardedLabel(report.date)}</span>
          <span className="font-mono font-bold">{signed(report.broughtForward)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-soft mt-1 pt-1.5 font-bold">
          <span>Cash on hand</span>
          <span className="font-mono">{signed(report.broughtForward + report.totalIn)}</span>
        </div>
        <div className="flex justify-between gap-3 py-0.5 mt-0.5">
          <span><span className="text-muted">Less:</span> Expenses</span>
          <span className="font-mono font-bold text-danger-600">− {peso(report.totalOut)}</span>
        </div>
        {/* A hand-over is rare, so its line is here only on the day it happened. */}
        {dayHandovers.map(handover => (
          <div key={handover.id} className="flex items-center justify-between gap-3 text-gold-800 [animation:bp-slide_.3s_cubic-bezier(.16,1,.3,1)]">
            <span className="min-w-0 truncate">
              <span className="opacity-80">Less:</span> Cash remitted
              {handover.handed_by ? ' · by ' + handover.handed_by : ''} · {timeOf(handover.created_at)}
              {handover.notes ? ' · ' + handover.notes : ''}
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onTakeBack(handover)}
                className="min-h-[44px] px-2 text-[12px] font-bold underline underline-offset-2 hover:text-ink-900 transition-colors cursor-pointer"
              >
                Take back
              </button>
              <span className="font-mono font-bold">− {peso(handover.amount)}</span>
            </span>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-3 border-t border-soft mt-2 pt-2.5">
          <span className="text-[12px] font-extrabold uppercase tracking-[0.14em]">Total cash on hand</span>
          <span className={'font-mono text-[26px] font-extrabold leading-none ' + (report.balance < 0 ? 'text-danger-600' : 'text-emerald-600')}>
            {report.balance < 0 ? '− ' : ''}<CountPeso value={Math.abs(report.balance)} />
          </span>
        </div>
      </div>
    </div>
  )
}

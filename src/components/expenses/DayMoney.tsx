import { Trash2 } from 'lucide-react'
import { Expense, ExpenseCategory } from '../../types/expense'
import { DailyReport } from '../../utils/dailyReport'

const peso = (n: number) => '₱' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })

interface DayMoneyProps {
  /** The day's sheet — the same figures the printed daily report carries. */
  report: DailyReport
  /** That day's expenses, so each one can be taken back off. */
  dayExpenses: Expense[]
  categories: ExpenseCategory[]
  onRemove: (expense: Expense) => void
}

// The day on screen, in the order the printed sheet reads: money in, money out, and
// what is left at the bottom. Money in is read-only here — it comes from the receipts
// recorded on bookings and at the restaurant — and money out is the list just typed.
export function DayMoney({ report, dayExpenses, categories, onRemove }: DayMoneyProps) {
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

      <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-t-2 border-ink-800 bg-page">
        <span className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-main">Left today</span>
        <span className={'font-mono text-[26px] font-extrabold leading-none ' + (report.net < 0 ? 'text-danger-600' : 'text-emerald-600')}>
          {report.net < 0 ? '− ' : ''}{peso(Math.abs(report.net))}
        </span>
      </div>
    </div>
  )
}

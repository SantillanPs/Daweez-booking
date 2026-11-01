import { useState } from 'react'
import { ChevronLeft, ChevronRight, Trash2, X } from 'lucide-react'
import { Expense, ExpenseCategory } from '../../types/expense'
import { dateToString } from '../../utils/helpers'
import { PERIODS, type Period, fmtDay, inThis, rangeOf, step } from './periods'

interface ExpenseHistoryProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  /** The day the Cash Flow screen is on; the window opens on the month around it. */
  date: string
  onRemove: (expense: Expense) => void
  /** Jumps the day screen to the day of the row that was tapped. */
  onOpenDay: (date: string) => void
  onClose: () => void
}

const peso = (n: number) => '₱' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })

// The expenses for a day, week, month or year (Sebastian, 2026-10-14, choosing "totals for a week, month or
// year" over repeating expenses; the day added 2026-10-31): how much went out, a bar for each kind of expense
// biggest first, and the list under it, where an old mistake can still be taken back. The day screen stays as it is.
export function ExpenseHistory({ expenses, categories, date, onRemove, onOpenDay, onClose }: ExpenseHistoryProps) {
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(date)
  const today = dateToString(new Date())
  const { from, to, name } = rangeOf(period, anchor)
  const nameOf = (id: string) => categories.find(c => c.id === id)?.name || 'Other'

  const rows = expenses
    .filter(e => e.expense_date >= from && e.expense_date <= to)
    .sort((a, b) => b.expense_date.localeCompare(a.expense_date) || (b.created_at || '').localeCompare(a.created_at || ''))
  const total = rows.reduce((s, e) => s + e.amount, 0)
  const byKind = new Map<string, number>()
  rows.forEach(e => byKind.set(nameOf(e.category_id), (byKind.get(nameOf(e.category_id)) || 0) + e.amount))
  const kinds = [...byKind.entries()].sort((a, b) => b[1] - a[1])
  const top = kinds[0]?.[1] || 1

  const arrow = 'w-9 h-9 grid place-items-center rounded-lg text-muted hover:bg-card hover:text-main cursor-pointer disabled:opacity-30 disabled:cursor-default'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-2xl max-h-[85vh] rounded-xl border border-soft shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-4 py-3 border-b border-soft bg-page shrink-0 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-main">Expenses</h3>
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

        <div className="overflow-y-auto">
          <div className="px-4 pt-3 pb-4 border-b border-soft flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setAnchor(a => step(period, a, -1))} aria-label="Earlier" className={arrow}><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-[13px] font-semibold text-main text-center">{name}</span>
              <button type="button" onClick={() => setAnchor(a => step(period, a, 1))} disabled={to >= today} aria-label="Later" className={arrow}><ChevronRight className="w-4 h-4" /></button>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-muted">Spent</span>
              <span className="font-mono text-[26px] font-extrabold text-danger-600 leading-none">{total ? '(' + peso(total) + ')' : peso(0)}</span>
            </div>
            {kinds.length > 0 && (
              <div className="flex flex-col gap-2">
                {kinds.map(([kind, amount]) => (
                  <div key={kind} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-[13px]">
                    <span className="text-main truncate">{kind}</span>
                    <span className="block h-2.5 rounded-full bg-page overflow-hidden">
                      <span className="block h-full w-[var(--w)] rounded-full bg-danger-600/80 transition-[width] duration-500 ease-out" style={{ '--w': (amount / top) * 100 + '%' } as React.CSSProperties} />
                    </span>
                    <span className="font-mono font-semibold text-main text-right">{peso(amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">Nothing spent {inThis(period)}.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-soft">
                {rows.map(expense => (
                  <tr key={expense.id} className="hover:bg-page transition-colors">
                    {/* A Day list has its date at the top, so its rows drop it. */}
                    {period !== 'day' && (
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <button type="button" onClick={() => onOpenDay(expense.expense_date)} className="text-main font-semibold hover:text-gold-700 cursor-pointer">
                          {fmtDay(expense.expense_date)}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-main">
                      {nameOf(expense.category_id)}
                      {expense.notes ? <span className="text-muted"> · {expense.notes}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-danger-600 whitespace-nowrap">{peso(expense.amount)}</td>
                    <td className="px-3 py-2.5 text-right w-10">
                      <button type="button" onClick={() => onRemove(expense)} aria-label="Remove this expense" className="text-muted hover:text-danger-600 transition-colors cursor-pointer">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

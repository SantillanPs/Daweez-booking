import { Trash2, X } from 'lucide-react'
import { Expense, ExpenseCategory } from '../../types/expense'

interface ExpenseHistoryProps {
  expenses: Expense[]
  categories: ExpenseCategory[]
  onRemove: (expense: Expense) => void
  /** Jumps the day screen to the day of the row that was tapped. */
  onOpenDay: (date: string) => void
  onClose: () => void
}

const fmtDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Every expense ever logged, newest day first. The day screen is where the work is
// done; this is the place to look something up or take back an old mistake.
export function ExpenseHistory({ expenses, categories, onRemove, onOpenDay, onClose }: ExpenseHistoryProps) {
  const rows = [...expenses].sort((a, b) =>
    b.expense_date.localeCompare(a.expense_date) || (b.created_at || '').localeCompare(a.created_at || ''))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={onClose}>
      <div className="bg-card w-full max-w-2xl max-h-[85vh] rounded-xl border border-soft shadow-xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-3.5 border-b border-soft flex items-center justify-between bg-page shrink-0">
          <h3 className="text-sm font-bold text-main">All expenses <span className="text-muted font-semibold">· {expenses.length}</span></h3>
          <button onClick={onClose} aria-label="Close" className="text-muted hover:text-main transition-colors cursor-pointer"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">No expenses logged yet.</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <tbody className="divide-y divide-soft">
                {rows.map(expense => (
                  <tr key={expense.id} className="hover:bg-page transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      <button type="button" onClick={() => onOpenDay(expense.expense_date)} className="text-main font-semibold hover:text-gold-700 cursor-pointer">
                        {fmtDay(expense.expense_date)}
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-main">
                      {categories.find(c => c.id === expense.category_id)?.name || 'Other'}
                      {expense.notes ? <span className="text-muted"> · {expense.notes}</span> : null}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold text-danger-600 whitespace-nowrap">
                      ₱{expense.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
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

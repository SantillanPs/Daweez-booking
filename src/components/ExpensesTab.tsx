import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer, Wallet } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { generateUUID } from '../utils/syncEngine'
import { dateToString } from '../utils/helpers'
import { getTabs } from '../utils/tabs'
import { buildDailyReport } from '../utils/dailyReport'
import { Expense, ExpenseCategory } from '../types/expense'
import { showToast } from '../utils/toast'
import { askConfirm } from '../utils/confirm'
import { QuickExpense } from './expenses/QuickExpense'
import { DayMoney } from './expenses/DayMoney'
import { ExpenseHistory } from './expenses/ExpenseHistory'
import { CategoryManager } from './expenses/CategoryManager'
import { DailyReportModal } from './analytics/DailyReportModal'

const prettyDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return iso
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// THE DAY'S MONEY, on one screen (the owner's ask, 2026-10-04).
//
// The staff log the day's expenses and print the daily report for the owner every day.
// That used to be two tabs and a slow form: a category dropdown with a search box, a
// date to pick and a notes box, then over to Analytics to print. Now the day is the
// screen — type what was spent, see money in, money out and what is left, print.
//
// The figures are `buildDailyReport`, the same function the printed sheet uses, so the
// screen and the paper cannot disagree.
export function ExpensesTab() {
  const {
    allBookings, rooms, expenses, expenseCategories, isLoading,
    createExpense, deleteExpense, createExpenseCategory, deleteExpenseCategory,
  } = useDashboardData()

  // LOCAL today — `toISOString()` is UTC and showed yesterday until 8 AM in UTC+8, so
  // an expense logged first thing in the morning landed on the wrong day's sheet.
  const today = dateToString(new Date())
  const [date, setDate] = useState(today)
  const [printing, setPrinting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCategories, setShowCategories] = useState(false)

  // A tab settled at the counter is money in with no booking behind it.
  const { data: tabs = [] } = useQuery({ queryKey: ['tabs'], queryFn: getTabs })

  const report = useMemo(
    () => buildDailyReport({ date, bookings: allBookings, tabs, expenses, categories: expenseCategories, rooms }),
    [date, allBookings, tabs, expenses, expenseCategories, rooms],
  )
  const dayExpenses = useMemo(
    () => expenses.filter(e => e.expense_date === date).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    [expenses, date],
  )

  const addExpense = async (input: { amount: number; categoryId: string; notes?: string }) => {
    try {
      await createExpense({
        id: 'exp-' + generateUUID(),
        amount: input.amount,
        category_id: input.categoryId,
        expense_date: date,
        notes: input.notes,
      })
    } catch (err) {
      showToast('Could not save that expense. Please try again.', 'error')
      throw err
    }
  }

  const removeExpense = async (expense: Expense) => {
    const ok = await askConfirm({
      title: 'Remove this ₱' + expense.amount.toLocaleString() + ' expense?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    try { await deleteExpense(expense.id) } catch { showToast('Could not remove the expense.', 'error') }
  }

  const addCategory = async (name: string) => {
    try { await createExpenseCategory({ id: 'cat-' + generateUUID(), name }) }
    catch { showToast('Could not add the category.', 'error') }
  }

  const removeCategory = async (category: ExpenseCategory) => {
    if (expenses.some(e => e.category_id === category.id)) {
      showToast('"' + category.name + '" has expenses logged under it, so it stays.', 'error')
      return
    }
    const ok = await askConfirm({ title: 'Remove "' + category.name + '"?', confirmLabel: 'Remove', tone: 'danger' })
    if (!ok) return
    try { await deleteExpenseCategory(category.id) } catch { showToast('Could not remove the category.', 'error') }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
      </div>
    )
  }

  const quiet = 'text-[12px] font-semibold text-muted hover:text-gold-700 transition-colors cursor-pointer'

  return (
    <div className="max-w-4xl mx-auto space-y-3 font-sans">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
            <Wallet className="w-5 h-5 text-gold-600" />
            {date === today ? "Today's money" : 'Money on this day'}
          </h2>
          <p className="text-[13px] text-muted mt-0.5">{prettyDay(date)}</p>
        </div>
        <div className="flex items-center gap-2">
          {date !== today && (
            <button type="button" onClick={() => setDate(today)} className="text-[12px] font-bold text-gold-700 hover:bg-gold-100 px-2.5 py-2 rounded-lg transition-colors cursor-pointer">
              Back to today
            </button>
          )}
          <input
            type="date"
            value={date}
            max={today}
            onChange={e => { if (e.target.value) setDate(e.target.value) }}
            aria-label="Day"
            className="bg-card border border-soft text-main text-xs px-2 py-2 rounded-lg outline-none font-mono focus:border-gold-500 cursor-pointer"
          />
          <button
            type="button"
            onClick={() => setPrinting(true)}
            className="inline-flex items-center gap-1.5 bg-ink-900 hover:bg-ink-700 text-white text-[13px] font-bold px-4 py-2 rounded-lg transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" /> Print daily report
          </button>
        </div>
      </div>

      <QuickExpense key={date} categories={expenseCategories} expenses={expenses} onAdd={addExpense} />

      <DayMoney report={report} dayExpenses={dayExpenses} categories={expenseCategories} onRemove={removeExpense} />

      <div className="flex items-center justify-between gap-3 px-1">
        {report.undatedCount > 0 ? (
          <span className="text-[11px] text-muted">
            {report.undatedCount} booking{report.undatedCount === 1 ? '' : 's'} holding ₱{report.undatedMoney.toLocaleString()} with no payment date
          </span>
        ) : <span />}
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setShowHistory(true)} className={quiet}>All expenses</button>
          <button type="button" onClick={() => setShowCategories(true)} className={quiet}>Categories</button>
        </div>
      </div>

      {printing && <DailyReportModal initialDate={date} onClose={() => setPrinting(false)} />}
      {showHistory && (
        <ExpenseHistory
          expenses={expenses}
          categories={expenseCategories}
          onRemove={removeExpense}
          onOpenDay={day => { setDate(day); setShowHistory(false) }}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showCategories && (
        <CategoryManager
          categories={expenseCategories}
          onAdd={addCategory}
          onRemove={removeCategory}
          onClose={() => setShowCategories(false)}
        />
      )}
    </div>
  )
}

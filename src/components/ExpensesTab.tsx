import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowDownLeft, ArrowUpRight, List, Printer, Tag, Wallet } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { generateUUID } from '../utils/syncEngine'
import { dateToString } from '../utils/helpers'
import { getTabs } from '../utils/tabs'
import { buildDailyReport } from '../utils/dailyReport'
import { Expense, ExpenseCategory, Handover } from '../types/expense'
import { getHandovers, insertHandover, deleteHandover } from '../utils/handovers'
import { updateExpense } from '../utils/expenses'
import { showToast } from '../utils/toast'
import { askConfirm } from '../utils/confirm'
import { DayPicker } from './expenses/DayPicker'
import { DayMoney } from './expenses/DayMoney'
import { ExpenseHistory } from './expenses/ExpenseHistory'
import { CategoryManager } from './expenses/CategoryManager'
import { HandOverModal } from './expenses/HandOverModal'
import { DailyReportModal } from './analytics/DailyReportModal'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { readTabLines } from '../utils/tabs'
import { WorkingBill } from './calendar/WorkingBill'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { openKey, type MoneyInLine } from '../utils/dailyReport'
import type { PaymentRecord } from '../types/booking'
import type { Tab, TabLine } from '../types/tab'

const shortDay = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// THE DAY'S MONEY, on one screen (the owner's ask, 2026-10-04).
//
// The staff log the day's expenses and print the daily report for the owner every day.
// That used to be two tabs and a slow form: a category dropdown with a search box, a
// date to pick and a notes box, then over to Analytics to print. Now the day is the
// screen — type what was spent, see money in, money out and what is left, print.
//
// The card is the day (the owner, 2026-10-27: "this design is fine, don't change it"), and
// everything else is folded into it: a new expense is a blank line at the end of Money out,
// and Print with the four rarely used things sit in a thin row under the total.
//
// The figures are `buildDailyReport`, the same function the printed sheet uses, so the
// screen and the paper cannot disagree.
export function ExpensesTab() {
  const {
    allBookings, rooms, venues, expenses, expenseCategories, isLoading,
    createExpense, deleteExpense, createExpenseCategory, deleteExpenseCategory,
  } = useDashboardData()

  // LOCAL today — `toISOString()` is UTC and showed yesterday until 8 AM in UTC+8, so
  // an expense logged first thing in the morning landed on the wrong day's sheet.
  const today = dateToString(new Date())
  const [date, setDate] = useState(today)
  const [printing, setPrinting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showCategories, setShowCategories] = useState(false)
  const [handingOver, setHandingOver] = useState<'out' | 'in' | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  const [billOf, setBillOf] = useState<{ id: string; receipt?: string } | null>(null)
  const navigate = useNavigate()
  // The bill's code is fetched while the day is read, so a tapped payment's bill comes up at once.
  useEffect(() => {
    const id = window.setTimeout(() => { void import('./calendar/NewBookingBill') }, 1500)
    return () => window.clearTimeout(id)
  }, [])
  const [slipReceipt, setSlipReceipt] = useState<{ tab: Tab; lines: TabLine[]; record: PaymentRecord } | null>(null)

  // A tab settled at the counter is money in with no booking behind it.
  const { data: tabs = [] } = useQuery({ queryKey: ['tabs'], queryFn: getTabs })

  const queryClient = useQueryClient()
  const { data: handovers = [] } = useQuery({ queryKey: ['handovers'], queryFn: getHandovers })

  const report = useMemo(
    () => buildDailyReport({ date, bookings: allBookings, tabs, expenses, handovers, categories: expenseCategories, rooms, venues }),
    [date, allBookings, tabs, expenses, handovers, expenseCategories, rooms, venues],
  )
  const billBooking = billOf ? allBookings.find(b => b.id === billOf.id) : undefined
  const dayHandovers = useMemo(() => handovers.filter(h => h.handover_date === date), [handovers, date])
  const dayExpenses = useMemo(
    () => expenses.filter(e => e.expense_date === date).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
    [expenses, date],
  )

  // A payment on a booking opens its bill here, being worked on — never a copy only to look at
  // (Sebastian, 2026-10-28: "it should never be in a view only state", "it should open the bill IN
  // the cash flow"). A diner's slip paid at the counter has no bill, so it opens its receipt, which
  // reads the slip's lines first: the row says it is coming.
  const openPayment = (line: MoneyInLine) => {
    if (line.bookingId) { setBillOf({ id: line.bookingId, receipt: line.receipt }); return }
    setOpening(openKey(line))
    const tab = tabs.find(t => t.id === line.tabId)
    const record = tab?.payment_records?.find(r => r.id === line.recordId)
    if (!tab || !record) { setOpening(null); return }
    readTabLines(tab.id)
      .then(lines => setSlipReceipt({ tab, lines, record }))
      .catch(() => showToast('Could not open the receipt. Please try again.', 'error'))
      .finally(() => setOpening(null))
  }

  // Most used first, the order the add form's chips are in, so the picker on a line
  // starts with the four or five things the hotel buys every day.
  const byUse = useMemo(() => {
    const used: Record<string, number> = {}
    expenses.forEach(e => { used[e.category_id] = (used[e.category_id] || 0) + 1 })
    return [...expenseCategories].sort((x, y) => (used[y.id] || 0) - (used[x.id] || 0) || x.name.localeCompare(y.name))
  }, [expenseCategories, expenses])

  // Written on the card at once and saved behind it; taken off again if the save fails.
  const addExpense = async (input: { amount: number; categoryId: string; notes?: string }) => {
    const row = {
      id: 'exp-' + generateUUID(),
      amount: input.amount,
      category_id: input.categoryId,
      expense_date: date,
      notes: input.notes,
    }
    queryClient.setQueryData<Expense[]>(['expenses'], (list = []) => [...list, { ...row, created_at: new Date().toISOString() } as Expense])
    try {
      await createExpense(row)
    } catch (err) {
      queryClient.setQueryData<Expense[]>(['expenses'], (list = []) => list.filter(e => e.id !== row.id))
      showToast('Could not save that expense. Please try again.', 'error')
      throw err
    }
  }

  // The month's dots: a day money came in, a day something was spent.
  const marksOf = useCallback((day: string) => {
    const r = buildDailyReport({ date: day, bookings: allBookings, tabs, expenses, handovers, categories: expenseCategories, rooms })
    return { moneyIn: r.totalIn > 0, spent: r.totalOut > 0 }
  }, [allBookings, tabs, expenses, handovers, expenseCategories, rooms])

  const removeExpense = async (expense: Expense) => {
    const ok = await askConfirm({
      title: 'Remove this ₱' + expense.amount.toLocaleString() + ' expense?',
      confirmLabel: 'Remove',
      tone: 'danger',
    })
    if (!ok) return
    try { await deleteExpense(expense.id) } catch { showToast('Could not remove the expense.', 'error') }
  }

  // A mistake on an expense is fixed where it is written (Sebastian, 2026-10-27), shown at
  // once and saved behind it; put back as it was if the save fails.
  const changeExpense = (expense: Expense, change: Partial<Pick<Expense, 'category_id' | 'amount' | 'notes'>>) => {
    const patch = (to: Partial<Expense>) => queryClient.setQueryData<Expense[]>(['expenses'], (list = []) =>
      list.map(e => e.id === expense.id ? { ...e, ...to } : e))
    patch(change)
    updateExpense(expense.id, change).catch(() => {
      patch({ category_id: expense.category_id, amount: expense.amount, notes: expense.notes })
      showToast('Could not save that change. Please try again.', 'error')
    })
  }

  // Shown at once and saved behind it; taken back off the screen if the save fails.
  const setHandovers = (change: (list: Handover[]) => Handover[]) =>
    queryClient.setQueryData<Handover[]>(['handovers'], (list = []) => change(list))

  const handOver = (input: { amount: number; handedBy?: string; notes?: string }) => {
    const kind = handingOver === 'in' ? 'in' : 'out'
    const row: Handover = {
      id: 'ho-' + generateUUID(),
      amount: input.amount,
      handover_date: date,
      handed_by: input.handedBy,
      notes: input.notes,
      kind,
      created_at: new Date().toISOString(),
    }
    setHandovers(list => [...list, row])
    setHandingOver(null)
    insertHandover(row).catch(() => {
      setHandovers(list => list.filter(h => h.id !== row.id))
      showToast(kind === 'in' ? 'Could not save the cash added. Please try again.' : 'Could not save the cash remitted. Please try again.', 'error')
    })
  }

  const takeBack = async (handover: Handover) => {
    const ok = await askConfirm({
      title: 'Take back this ₱' + handover.amount.toLocaleString() + (handover.kind === 'in' ? ' cash added?' : ' cash remitted?'),
      confirmLabel: 'Take back',
      tone: 'danger',
    })
    if (!ok) return
    setHandovers(list => list.filter(h => h.id !== handover.id))
    deleteHandover(handover.id).catch(() => {
      setHandovers(list => [...list, handover])
      showToast('Could not take it back. Please try again.', 'error')
    })
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

  const quiet = 'inline-flex items-center gap-1 min-h-8 px-1 text-[12px] font-semibold text-muted hover:text-gold-700 active:scale-95 transition-[color,transform] cursor-pointer'

  return (
    <div className="space-y-3 font-sans">
      <div>
        <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
          <Wallet className="w-5 h-5 text-gold-600" />
          Cash Flow
        </h2>
        <DayPicker day={date} today={today} onPick={setDate} marksOf={marksOf} />
      </div>

      <DayMoney
        report={report}
        dayExpenses={dayExpenses}
        categories={byUse}
        onRemove={removeExpense}
        onChange={changeExpense}
        dayHandovers={dayHandovers}
        onTakeBack={takeBack}
        onAdd={addExpense}
        pastDay={date === today ? undefined : shortDay(date)}
        onOpenPayment={openPayment}
        opening={opening}
        footer={<>
          <div className="flex flex-wrap items-center gap-x-2 -ml-1">
            <button type="button" onClick={() => setShowHistory(true)} className={quiet}><List className="w-3.5 h-3.5 opacity-75" />All expenses</button>
            <button type="button" onClick={() => setShowCategories(true)} className={quiet}><Tag className="w-3.5 h-3.5 opacity-75" />Categories</button>
            <button type="button" onClick={() => setHandingOver('in')} className={quiet}><ArrowDownLeft className="w-3.5 h-3.5 opacity-75" />Add cash on hand</button>
            <button type="button" onClick={() => setHandingOver('out')} className={quiet}><ArrowUpRight className="w-3.5 h-3.5 opacity-75" />Cash remitted</button>
          </div>
          <button type="button" onClick={() => setPrinting(true)}
            className="inline-flex items-center gap-1.5 min-h-[30px] px-2.5 rounded-lg bg-ink-900 hover:bg-ink-700 text-white text-[11.5px] font-extrabold active:scale-95 transition-[background-color,transform] cursor-pointer">
            <Printer className="w-3.5 h-3.5" />{date === today ? 'Print' : 'Print ' + shortDay(date)}
          </button>
        </>}
      />

      {report.undatedCount > 0 && (
        <p className="px-1 text-[11px] text-muted">
          {report.undatedCount} booking{report.undatedCount === 1 ? '' : 's'} holding ₱{report.undatedMoney.toLocaleString()} with no payment date
        </p>
      )}

      {billBooking && <WorkingBill booking={billBooking} mark={billOf?.receipt} onClose={() => setBillOf(null)}
        // The bill's Booking: the Front desk opens on the stay, its panel open (Sebastian, 2026-10-29).
        onBooking={b => { focusBookingAfterCreate(b.id); setBillOf(null); void navigate({ to: '/calendar' }) }} />}
      {slipReceipt && <TabReceiptModal tab={slipReceipt.tab} lines={slipReceipt.lines} record={slipReceipt.record} onClose={() => setSlipReceipt(null)} />}
      {printing && <DailyReportModal initialDate={date} onClose={() => setPrinting(false)} />}
      {showHistory && (
        <ExpenseHistory
          expenses={expenses}
          date={date}
          categories={expenseCategories}
          onRemove={removeExpense}
          onOpenDay={day => { setDate(day); setShowHistory(false) }}
          onClose={() => setShowHistory(false)}
        />
      )}
      {handingOver && <HandOverModal key={handingOver} kind={handingOver} inHotel={report.balance} onHandOver={handOver} onClose={() => setHandingOver(null)} />}
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

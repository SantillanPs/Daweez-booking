import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { ArrowDownLeft, ArrowUpRight, Coins, List, Printer, Tag, Wallet } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { dateToString, normalizeVenueId, randomUUID, shortDay } from '../utils/helpers'
import { getTabs, handSale, saveHandSale, saveTabFix, saveTabRemoval, withFixedTabPayment, withoutTabPayment } from '../utils/tabs'
import { withFixedPayment, withoutPayment, type PaymentPatch } from './walk-in/bookingPayment'
import { logRemovedPayment, takeBackPayment } from '../utils/removedPayments'
import { groupOf } from '../utils/bookingGroup'
import { formatRoomNumbers } from '../utils/roomNumbers'
import { freshReceiptNumber } from '../utils/receiptNumber'
import { payOnBill, paySlipsIfCleared } from '../utils/billPayment'
import { allMoneyIn, buildDailyReport } from '../utils/dailyReport'
import { Expense, ExpenseCategory, Handover } from '../types/expense'
import type { ExpenseChange } from './expenses/ExpenseEdit'
import { getHandovers, insertHandover, deleteHandover } from '../utils/handovers'
import { updateExpense } from '../utils/expenses'
import { showToast } from '../utils/toast'
import { askConfirm } from '../utils/confirm'
import { DayPicker } from './expenses/DayPicker'
import { NewTag } from './NewMark'
import { markSeen } from '../utils/newMarks'
import { DayMoney, type BillChoice, type MoneyInInput } from './expenses/DayMoney'
import { ExpenseHistory } from './expenses/ExpenseHistory'
import { IncomeHistory } from './expenses/IncomeHistory'
import { CategoryManager } from './expenses/CategoryManager'
import { HandOverModal } from './expenses/HandOverModal'
import { DailyReportModal } from './analytics/DailyReportModal'
import { TabReceiptModal } from './restaurant/TabReceiptModal'
import { readTabLines } from '../utils/tabs'
import { WorkingBill } from './calendar/WorkingBill'
import { focusBookingAfterCreate } from '../utils/bookingFocus'
import { hotelDay, openKey, type MoneyInLine } from '../utils/dailyReport'
import type { Booking, PaymentRecord } from '../types/booking'
import type { Tab, TabLine } from '../types/tab'


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
    createExpense, deleteExpense, createExpenseCategory, deleteExpenseCategory, updateBooking,
  } = useDashboardData()

  // LOCAL today — `toISOString()` is UTC and showed yesterday until 8 AM in UTC+8, so
  // an expense logged first thing in the morning landed on the wrong day's sheet.
  const today = dateToString(new Date())
  const [date, setDate] = useState(today)
  const [printing, setPrinting] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [showIncome, setShowIncome] = useState(false)
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
  const income = useMemo(
    () => (showIncome ? allMoneyIn({ bookings: allBookings, tabs, rooms, venues }) : []),
    [showIncome, allBookings, tabs, rooms, venues],
  )
  const closeIncome = useCallback(() => setShowIncome(false), [])
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
  const addExpense = async (input: { amount: number; categoryId: string; notes?: string; notFromCash?: boolean }) => {
    const row = {
      id: 'exp-' + randomUUID(),
      amount: input.amount,
      category_id: input.categoryId,
      expense_date: date,
      notes: input.notes,
      not_from_cash: !!input.notFromCash,
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

  // Every bill a payment can be written on, newest stay first: one entry per bill, under its first room.
  const bills = useMemo((): BillChoice[] => {
    const seen = new Set<string>()
    const fmt = (iso: string) => new Date(iso + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return allBookings
      .filter(b => b.status !== 'cancelled' && b.status !== 'blocked')
      .sort((a, b) => b.check_in.localeCompare(a.check_in))
      .flatMap(b => {
        const rows = groupOf(b, allBookings)
        const first = rows[0]
        if (seen.has(first.id)) return []
        seen.add(first.id)
        const numbers = rows.map(r => rooms.find(x => x.id === r.room_id)?.room_number).filter((n): n is number => n != null)
        const venue = rows.map(r => r.venue_id && venues.find(v => v.id === normalizeVenueId(r.venue_id))?.name).find(Boolean)
        const place = formatRoomNumbers(numbers) || venue || ''
        return [{ id: first.id, who: (first.guest_name || '').trim() || 'Guest', place, when: fmt(first.check_in) + '–' + fmt(first.check_out.slice(0, 10)), bill: first.invoice_number || '' }]
      })
  }, [allBookings, rooms, venues])

  // **Money in written by hand** (#19): shown on the day at once and saved behind it; taken off
  // again with a message if the save fails, and the blank line comes back filled in. A day gone
  // by gets it at noon, the way the bill dates a payment written for another day.
  const addMoneyIn = async (input: MoneyInInput) => {
    const paidAt = date === today ? new Date().toISOString() : new Date(date + 'T12:00:00').toISOString()
    if (input.kind !== 'booking') {
      const sale = handSale({ note: input.note, amount: input.amount, method: input.method, reference: input.reference, paidAt, plain: input.kind === 'plain' })
      queryClient.setQueryData<Tab[]>(['tabs'], (list = []) => [sale.tab, ...list])
      try {
        const saved = await saveHandSale(sale)
        queryClient.setQueryData<Tab[]>(['tabs'], (list = []) => list.map(t => (t.id === saved.id ? saved : t)))
        void queryClient.invalidateQueries({ queryKey: ['tab-lines'] })
      } catch (err) {
        queryClient.setQueryData<Tab[]>(['tabs'], (list = []) => list.filter(t => t.id !== sale.tab.id))
        showToast('Could not save that money in. Please try again.', 'error')
        throw err
      }
      return
    }
    const first = allBookings.find(b => b.id === input.billId)
    if (!first) throw new Error('No such booking')
    try {
      const number = await freshReceiptNumber(first, allBookings)
      const updated = payOnBill(groupOf(first, allBookings), {
        amount: input.amount, method: input.method, reference: input.reference, paidAt,
        purpose: input.note || undefined, number, byHand: true,
      })
      for (const b of updated) await updateBooking(b)
      paySlipsIfCleared(updated, number).catch(() => showToast('The payment is recorded, but the order slips were not marked as paid.', 'error'))
    } catch (err) {
      showToast('Could not save that payment. Please try again.', 'error')
      throw err
    }
  }

  // **A payment fixed from Money in** (Sebastian, 2026-11-01). Shown at once and saved behind it, on
  // every room that holds it, the same way the bill fixes one; put back with a message if the save
  // fails. A new day takes the line off this day, so the message says where it went and can undo it.
  const fixMoneyIn = (line: MoneyInLine, patch: PaymentPatch, label?: string) => {
    const moved = patch.paid_at ? hotelDay(patch.paid_at) : undefined
    const left = moved && moved !== date ? moved : undefined
    if (line.bookingId) {
      const holding = allBookings.flatMap(booking => {
        const rec = booking.payment_records?.find(r => (line.receipt ? r.receipt_number === line.receipt : r.id === line.recordId))
        return rec ? [{ booking, rec }] : []
      })
      if (holding.length === 0) return
      const before = holding.map(h => h.booking)
      const after = withFixedPayment(holding, patch, new Date().toISOString())
      const put = (rows: Booking[]) => queryClient.setQueryData<Booking[]>(['bookings'], (list = []) =>
        list.map(b => rows.find(r => r.id === b.id) || b))
      const write = async (rows: Booking[]) => { for (const b of rows) await updateBooking(b) }
      put(after)
      write(after).catch(() => {
        put(before)
        void write(before).catch(() => undefined)
        showToast('Could not fix the payment. Please try again.', 'error')
      })
      if (left) showToast('Moved to ' + shortDay(left), 'success', { label: 'Undo', run: () => {
        put(before)
        write(before).catch(() => {
          put(after)
          showToast('Could not undo that. Please try again.', 'error')
        })
      } })
      return
    }
    const tab = tabs.find(t => t.id === line.tabId)
    if (!tab || !line.recordId) return
    const recordId = line.recordId
    const after = withFixedTabPayment(tab, recordId, patch, new Date().toISOString(), label)
    const put = (row: Tab) => queryClient.setQueryData<Tab[]>(['tabs'], (list = []) => list.map(t => (t.id === row.id ? row : t)))
    const write = (row: Tab) => saveTabFix(row, recordId).then(() => { void queryClient.invalidateQueries({ queryKey: ['tab-lines'] }) })
    put(after)
    write(after).catch(() => {
      put(tab)
      showToast('Could not fix the payment. Please try again.', 'error')
    })
    if (left) showToast('Moved to ' + shortDay(left), 'success', { label: 'Undo', run: () => {
      put(tab)
      write(tab).catch(() => {
        put(after)
        showToast('Could not undo that. Please try again.', 'error')
      })
    } })
  }

  // **A payment removed from Money in** (Sebastian, 2026-11-03). The same steps as removing it in Bills &
  // receipts: off every room that holds it, its slips unpaid, logged. Gone from the screen at once and
  // put back with a message if the save fails.
  const removeMoneyIn = (line: MoneyInLine) => {
    if (line.bookingId) {
      const holding = allBookings.flatMap(booking => {
        const rec = booking.payment_records?.find(r => (line.receipt ? r.receipt_number === line.receipt : r.id === line.recordId))
        return rec ? [{ booking, rec }] : []
      })
      if (holding.length === 0) return
      const before = holding.map(h => h.booking)
      const shared = holding.length > 1
      const put = (rows: Booking[]) => queryClient.setQueryData<Booking[]>(['bookings'], (list = []) =>
        list.map(b => rows.find(r => r.id === b.id) || b))
      put(holding.map(h => withoutPayment(h.booking, h.rec, shared)))
      takeBackPayment(holding[0].rec, before, updateBooking, { guest: line.who, rooms: line.place })
        .then(() => {
          void queryClient.invalidateQueries({ queryKey: ['removed-payments'] })
          void queryClient.invalidateQueries({ queryKey: ['tabs'] })
        })
        .catch(() => {
          put(before)
          showToast('Could not remove the payment. Please try again.', 'error')
        })
      showToast('Payment removed', 'success')
      return
    }
    const tab = tabs.find(t => t.id === line.tabId)
    const record = tab?.payment_records?.find(r => r.id === line.recordId)
    if (!tab || !record) return
    const after = withoutTabPayment(tab, record.id)
    const put = (row: Tab | null) => queryClient.setQueryData<Tab[]>(['tabs'], (list = []) =>
      row ? list.map(t => (t.id === tab.id ? row : t)) : list.filter(t => t.id !== tab.id))
    put(after)
    saveTabRemoval(tab, after)
      .then(() => logRemovedPayment({
        receipt_number: record.receipt_number, amount: Number(record.amount || 0), method: record.method,
        paid_at: record.paid_at, prepared_by: record.prepared_by, guest_name: line.who, rooms: line.place, booking_ids: [],
      }).catch(() => undefined))
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['removed-payments'] })
        void queryClient.invalidateQueries({ queryKey: ['tab-lines'] })
      })
      .catch(() => {
        queryClient.setQueryData<Tab[]>(['tabs'], (list = []) => [...list.filter(t => t.id !== tab.id), tab])
        showToast('Could not remove the payment. Please try again.', 'error')
      })
    showToast('Payment removed', 'success')
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

  // A mistake on an expense is fixed from its pencil (Sebastian, 2026-10-27; drawn like Money in's
  // payments, B of the mock, 2026-11-03), shown at once and saved behind it; put back as it was if the
  // save fails. A new day takes it off this day, so the message says where it went and can undo it.
  const changeExpense = (expense: Expense, change: ExpenseChange) => {
    const was = { category_id: expense.category_id, amount: expense.amount, notes: expense.notes, expense_date: expense.expense_date }
    const patch = (to: Partial<Expense>) => queryClient.setQueryData<Expense[]>(['expenses'], (list = []) =>
      list.map(e => e.id === expense.id ? { ...e, ...to } : e))
    patch(change)
    updateExpense(expense.id, change).catch(() => {
      patch(was)
      showToast('Could not save that change. Please try again.', 'error')
    })
    if (change.expense_date && change.expense_date !== date) showToast('Moved to ' + shortDay(change.expense_date), 'success', { label: 'Undo', run: () => {
      patch(was)
      updateExpense(expense.id, was).catch(() => {
        patch(change)
        showToast('Could not undo that. Please try again.', 'error')
      })
    } })
  }

  // Removed from inside its slip, which has already asked (the bin turns into Remove), so no
  // second question here. Gone at once; back with a message if the save fails.
  const dropExpense = (expense: Expense) => {
    queryClient.setQueryData<Expense[]>(['expenses'], (list = []) => list.filter(e => e.id !== expense.id))
    deleteExpense(expense.id).catch(() => {
      queryClient.setQueryData<Expense[]>(['expenses'], (list = []) => [...list.filter(e => e.id !== expense.id), expense])
      showToast('Could not remove the expense. Please try again.', 'error')
    })
    showToast('Expense removed', 'success')
  }

  // Shown at once and saved behind it; taken back off the screen if the save fails.
  const setHandovers = (change: (list: Handover[]) => Handover[]) =>
    queryClient.setQueryData<Handover[]>(['handovers'], (list = []) => change(list))

  const handOver = (input: { amount: number; handedBy?: string; notes?: string }) => {
    const kind = handingOver === 'in' ? 'in' : 'out'
    const row: Handover = {
      id: 'ho-' + randomUUID(),
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
    try { await createExpenseCategory({ id: 'cat-' + randomUUID(), name }) }
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

  // The links under the day as chips in two groups: what you look up, then the cash that moves, each of those
  // in its own colour (Sebastian, 2026-11-13, the Cash Flow mock's Chips: "too bland and tiring to read through").
  const chip = 'group inline-flex items-center gap-1.5 h-[30px] px-[11px] rounded-full text-[12px] font-bold active:scale-[.94] transition-[transform,box-shadow,background-color,color] duration-200 cursor-pointer '
  const look = chip + 'bg-card ring-1 ring-inset ring-paper-200 text-ink-600 hover:ring-[1.5px] hover:ring-gold-400 hover:text-ink-900'
  const lookIcon = 'w-3.5 h-3.5 text-paper-500 group-hover:text-gold-700 group-hover:scale-[1.15] transition-[color,transform] duration-300'

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
        onRemove={dropExpense}
        onChange={changeExpense}
        dayHandovers={dayHandovers}
        onTakeBack={takeBack}
        onAdd={addExpense}
        pastDay={date === today ? undefined : shortDay(date)}
        onOpenPayment={openPayment}
        opening={opening}
        bills={bills}
        onAddIn={addMoneyIn}
        onFixPayment={fixMoneyIn}
        onRemovePayment={removeMoneyIn}
        today={today}
        footer={<>
          <div className="relative flex flex-wrap items-center gap-1.5" onClick={() => markSeen('cash-flow-chips')}>
            <NewTag id="cash-flow-chips" />
            <button type="button" onClick={() => setShowIncome(true)} className={look}><Coins aria-hidden="true" className={lookIcon} />All income</button>
            <button type="button" onClick={() => setShowHistory(true)} className={look}><List aria-hidden="true" className={lookIcon} />All expenses</button>
            <button type="button" onClick={() => setShowCategories(true)} className={look}><Tag aria-hidden="true" className={lookIcon} />Categories</button>
            <span aria-hidden="true" className="w-px h-5 mx-1 bg-paper-200" />
            <button type="button" onClick={() => setHandingOver('in')} className={chip + 'bg-emerald-600/[.08] text-emerald-700'}><ArrowDownLeft aria-hidden="true" className="w-3.5 h-3.5 text-emerald-600 group-hover:translate-y-0.5 transition-transform duration-300" />Add cash on hand</button>
            <button type="button" onClick={() => setHandingOver('out')} className={chip + 'bg-gold-100 text-gold-800'}><ArrowUpRight aria-hidden="true" className="w-3.5 h-3.5 text-gold-700 group-hover:-translate-y-0.5 transition-transform duration-300" />Cash remitted</button>
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
      {showIncome && (
        <IncomeHistory
          payments={income}
          date={date}
          onOpenDay={day => { setDate(day); setShowIncome(false) }}
          onClose={closeIncome}
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

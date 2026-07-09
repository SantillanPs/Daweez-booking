import React, { useState } from 'react'
import { useDashboardData } from './DashboardContext'
import { generateUUID } from '../utils/syncEngine'
import { TrendingDown, Plus, Trash2, Calendar, FileText, Tag, DollarSign, Wallet } from 'lucide-react'

export function ExpensesTab() {
  const { expenses, expenseCategories, createExpense, deleteExpense, isLoading } = useDashboardData()
  
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0])
  const [categoryId, setCategoryId] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!amount || !categoryId || !expenseDate) return

    setIsSubmitting(true)
    try {
      await createExpense({
        id: `exp-${generateUUID()}`,
        amount: parseFloat(amount),
        category_id: categoryId,
        expense_date: expenseDate,
        notes: notes.trim() || undefined
      })
      // Reset form
      setAmount('')
      setNotes('')
    } catch (err) {
      alert('Failed to log expense. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this expense? This will affect analytics.')) {
      try {
        await deleteExpense(id)
      } catch (err) {
        alert('Failed to delete expense.')
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary"></div>
      </div>
    )
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full">
      {/* Left Column: Title & Form */}
      <div className="w-full lg:w-[320px] shrink-0 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-main flex items-center gap-2">
            <Wallet className="w-5 h-5 text-brand-primary" />
            Hotel Expenses
          </h2>
          <p className="text-sm text-muted mt-1">Log and track all operational outgoings and purchases.</p>
        </div>

        <div className="bg-card rounded-xl border border-soft shadow-sm p-5">
          <h3 className="text-sm font-semibold text-main mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-rose-500" />
            Log New Expense
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-main mb-1">Amount (₱)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <DollarSign className="w-4 h-4 text-muted" />
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-soft rounded-lg text-sm focus:ring-2 focus:ring-[#B89251] focus:border-transparent"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-main mb-1">Category</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Tag className="w-4 h-4 text-muted" />
                </div>
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-soft rounded-lg text-sm focus:ring-2 focus:ring-[#B89251] focus:border-transparent"
                >
                  <option value="" disabled>Select a category</option>
                  {expenseCategories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
              {expenseCategories.length === 0 && (
                <p className="text-[10px] text-amber-600 mt-1">Please add categories in Settings first.</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-main mb-1">Date</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="w-4 h-4 text-muted" />
                </div>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="block w-full pl-9 pr-3 py-2 border border-soft rounded-lg text-sm focus:ring-2 focus:ring-[#B89251] focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-main mb-1">Notes (Optional)</label>
              <div className="relative">
                <div className="absolute top-2 left-0 pl-3 pointer-events-none">
                  <FileText className="w-4 h-4 text-muted" />
                </div>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was this for?"
                  className="block w-full pl-9 pr-3 py-2 border border-soft rounded-lg text-sm focus:ring-2 focus:ring-[#B89251] focus:border-transparent resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || expenseCategories.length === 0}
              className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-text text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Log Expense
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Right Column: List */}
      <div className="flex-1 bg-card rounded-xl border border-soft shadow-sm overflow-hidden flex flex-col min-h-[500px]">
        <div className="px-5 py-4 border-b border-soft bg-page flex justify-between items-center shrink-0">
          <h3 className="text-sm font-semibold text-main">Expense Ledger</h3>
          <span className="text-xs font-medium text-muted bg-card px-2 py-1 rounded border border-soft">
            {expenses.length} records
          </span>
        </div>
        
        <div className="flex-1 overflow-auto bg-card">
          {expenses.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted">
              <Wallet className="w-12 h-12 mb-3 text-muted opacity-30" />
              <p className="text-sm font-medium">No expenses logged yet</p>
              <p className="text-xs mt-1">Expenses you log will appear here.</p>
            </div>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="bg-page text-muted text-xs uppercase sticky top-0 border-b border-soft shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Notes</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium text-right w-16"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-soft">
                {expenses.map((expense) => {
                  const category = expenseCategories.find(c => c.id === expense.category_id)
                  return (
                    <tr key={expense.id} className="hover:bg-page transition-colors group">
                      <td className="px-4 py-3 whitespace-nowrap text-muted">
                        {new Date(expense.expense_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-softbg text-muted border border-soft">
                          {category?.name || 'Unknown Category'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted truncate max-w-[200px]">
                        {expense.notes || <span className="text-muted opacity-50 italic">No notes</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-rose-600 whitespace-nowrap">
                        -₱{expense.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(expense.id)}
                          className="text-muted hover:text-rose-500 transition-colors p-1 rounded hover:bg-rose-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

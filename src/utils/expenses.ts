import { Expense, ExpenseCategory } from '../types/expense'
import { supabase } from './supabaseClient'

// Expenses and their groups.
//
// The database is the only home. The browser stores that used to mirror them
// (`l_etoile_expenses_db`, `l_etoile_expense_categories_db`) are gone
// (2026-09-28), so a refused write throws and the screen says so, rather than
// showing an expense that never reached the books.
//
// The empty-database case no longer invents sample rows either: a fresh project
// shows an empty ledger and staff add the hotel's own groups.

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    const { data, error } = await supabase.from('expense_categories').select('*').order('name')
    if (error) throw error
    if (data) return data as ExpenseCategory[]
  } catch (err) {
    console.error('Supabase getExpenseCategories Error:', err)
  }

  return []
}

export async function insertExpenseCategory(category: Omit<ExpenseCategory, 'created_at'> & { created_at?: string }): Promise<ExpenseCategory> {
  const newCat = { ...category, created_at: category.created_at || new Date().toISOString() } as ExpenseCategory
  const { error } = await supabase.from('expense_categories').insert(newCat)
  if (error) throw error
  return newCat
}

export async function updateExpenseCategory(category: ExpenseCategory): Promise<void> {
  const { error } = await supabase.from('expense_categories').update({ name: category.name }).eq('id', category.id)
  if (error) throw error
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) throw error
}

export async function getExpenses(): Promise<Expense[]> {
  try {
    const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
    if (error) throw error
    if (data) return data as Expense[]
  } catch (err) {
    console.error('Supabase getExpenses Error:', err)
  }

  return []
}

export async function insertExpense(expense: Omit<Expense, 'created_at'> & { created_at?: string }): Promise<Expense> {
  const newExp = { ...expense, created_at: expense.created_at || new Date().toISOString() } as Expense
  const { error } = await supabase.from('expenses').insert(newExp)
  if (error) throw error
  return newExp
}

export async function updateExpense(id: string, change: Partial<Pick<Expense, 'category_id' | 'amount' | 'notes' | 'expense_date'>>): Promise<void> {
  const { error } = await supabase.from('expenses').update(change).eq('id', id)
  if (error) throw error
}

export async function deleteExpense(id: string): Promise<void> {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

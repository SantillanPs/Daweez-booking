import { Expense, ExpenseCategory } from '../types/expense'
import { supabase, isSupabaseConfigured } from './supabaseClient'

// Expenses and their groups.
//
// The database is the only home. The browser stores that used to mirror them
// (`l_etoile_expenses_db`, `l_etoile_expense_categories_db`) are gone
// (2026-09-28), so a refused write throws and the screen says so, rather than
// showing an expense that never reached the books.
//
// The empty-database case no longer invents sample rows either: a fresh project
// shows an empty ledger and staff add the hotel's own groups.

const NO_DB = 'No database is connected, so this was not saved.'

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  if (!isSupabaseConfigured) return []

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
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const newCat = { ...category, created_at: category.created_at || new Date().toISOString() } as ExpenseCategory
  const { error } = await supabase.from('expense_categories').insert(newCat)
  if (error) throw error
  return newCat
}

export async function updateExpenseCategory(category: ExpenseCategory): Promise<void> {
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const { error } = await supabase.from('expense_categories').update({ name: category.name }).eq('id', category.id)
  if (error) throw error
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this group was not deleted.')

  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) throw error
}

export async function getExpenses(): Promise<Expense[]> {
  if (!isSupabaseConfigured) return []

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
  if (!isSupabaseConfigured) throw new Error(NO_DB)

  const newExp = { ...expense, created_at: expense.created_at || new Date().toISOString() } as Expense
  const { error } = await supabase.from('expenses').insert(newExp)
  if (error) throw error
  return newExp
}

export async function deleteExpense(id: string): Promise<void> {
  if (!isSupabaseConfigured) throw new Error('No database is connected, so this expense was not deleted.')

  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

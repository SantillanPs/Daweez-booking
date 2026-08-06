import { Expense, ExpenseCategory } from '../types/expense'
import { supabase, isSupabaseConfigured } from './supabaseClient'

const EXPENSE_CATEGORIES_KEY = 'l_etoile_expense_categories_db'
const EXPENSES_KEY = 'l_etoile_expenses_db'

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('expense_categories').select('*').order('name')
      if (error) throw error
      if (data) return data
    } catch (err) {
      console.error('Supabase getExpenseCategories Error:', err)
    }
  }
  const data = localStorage.getItem(EXPENSE_CATEGORIES_KEY)
  if (data) return JSON.parse(data)

  const defaultCats: ExpenseCategory[] = [
    { id: 'cat-1', name: 'Maintenance & Repairs', created_at: new Date().toISOString() },
    { id: 'cat-2', name: 'Utilities (Water/Electricity)', created_at: new Date().toISOString() },
    { id: 'cat-3', name: 'Salaries & Wages', created_at: new Date().toISOString() },
    { id: 'cat-4', name: 'Supplies & Toiletries', created_at: new Date().toISOString() },
    { id: 'cat-5', name: 'Marketing & Promos', created_at: new Date().toISOString() }
  ]
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(defaultCats))
  return defaultCats
}

export async function insertExpenseCategory(category: Omit<ExpenseCategory, 'created_at'> & { created_at?: string }): Promise<ExpenseCategory> {
  const newCat = { ...category, created_at: category.created_at || new Date().toISOString() } as ExpenseCategory
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expense_categories').insert(newCat)
      if (error) throw error
      return newCat
    } catch (err) {
      console.error('Supabase insertExpenseCategory Error:', err)
    }
  }
  const existing = await getExpenseCategories()
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify([...existing, newCat]))
  return newCat
}

export async function updateExpenseCategory(category: ExpenseCategory): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expense_categories').update({ name: category.name }).eq('id', category.id)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase updateExpenseCategory Error:', err)
    }
  }
  const existing = await getExpenseCategories()
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(existing.map(c => c.id === category.id ? category : c)))
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expense_categories').delete().eq('id', id)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase deleteExpenseCategory Error:', err)
    }
  }
  const existing = await getExpenseCategories()
  localStorage.setItem(EXPENSE_CATEGORIES_KEY, JSON.stringify(existing.filter(c => c.id !== id)))
}

export async function getExpenses(): Promise<Expense[]> {
  if (isSupabaseConfigured) {
    try {
      const { data, error } = await supabase.from('expenses').select('*').order('expense_date', { ascending: false })
      if (error) throw error
      if (data) return data
    } catch (err) {
      console.error('Supabase getExpenses Error:', err)
    }
  }
  const data = localStorage.getItem(EXPENSES_KEY)
  if (data) return JSON.parse(data)

  const today = new Date()
  const yesterday = new Date(today.getTime() - 86400000)
  const lastWeek = new Date(today.getTime() - 86400000 * 7)

  const defaultExpenses: Expense[] = [
    { id: 'exp-1', amount: 12500, category_id: 'cat-3', expense_date: today.toISOString().split('T')[0], notes: 'Weekly Staff Payroll', created_at: today.toISOString() },
    { id: 'exp-2', amount: 4500, category_id: 'cat-2', expense_date: yesterday.toISOString().split('T')[0], notes: 'Electric Bill', created_at: yesterday.toISOString() },
    { id: 'exp-3', amount: 1200, category_id: 'cat-4', expense_date: yesterday.toISOString().split('T')[0], notes: 'Restock soap and shampoo', created_at: yesterday.toISOString() },
    { id: 'exp-4', amount: 3500, category_id: 'cat-1', expense_date: lastWeek.toISOString().split('T')[0], notes: 'Aircon cleaning service (Rooms 1-4)', created_at: lastWeek.toISOString() }
  ]
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(defaultExpenses))
  return defaultExpenses
}

export async function insertExpense(expense: Omit<Expense, 'created_at'> & { created_at?: string }): Promise<Expense> {
  const newExp = { ...expense, created_at: expense.created_at || new Date().toISOString() } as Expense
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expenses').insert(newExp)
      if (error) throw error
      return newExp
    } catch (err) {
      console.error('Supabase insertExpense Error:', err)
    }
  }
  const existing = await getExpenses()
  localStorage.setItem(EXPENSES_KEY, JSON.stringify([...existing, newExp]))
  return newExp
}

export async function deleteExpense(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    try {
      const { error } = await supabase.from('expenses').delete().eq('id', id)
      if (error) throw error
      return
    } catch (err) {
      console.error('Supabase deleteExpense Error:', err)
    }
  }
  const existing = await getExpenses()
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(existing.filter(e => e.id !== id)))
}

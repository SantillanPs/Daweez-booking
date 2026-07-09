export interface ExpenseCategory {
  id: string
  name: string
  created_at: string
}

export interface Expense {
  id: string
  category_id: string
  amount: number
  expense_date: string
  notes?: string
  created_at: string
}

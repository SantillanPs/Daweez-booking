export interface ExpenseCategory {
  id: string
  name: string
  created_at: string
}

/** Money the staff handed to the owner (`out`), or cash put into the hotel (`in`). Neither is an expense — see `utils/handovers.ts`. */
export interface Handover {
  id: string
  amount: number
  handover_date: string // YYYY-MM-DD, the hotel's own day
  handed_by?: string
  notes?: string
  /** Left out on older rows, which are all hand-overs. */
  kind?: 'out' | 'in'
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

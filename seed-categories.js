import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = 'https://ctbqxcxqfsrbgzfcmntw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0YnF4Y3hxZnNyYmd6ZmNtbnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTA3NzMsImV4cCI6MjA5NTc4Njc3M30.AAYUl2MTdMcSShx-UX4LKuNNV5GhtWwX_4kqk8PC34M'

const supabase = createClient(supabaseUrl, supabaseKey)

const categories = [
  'Salary', 'Cash Advance', 'Weekly Salary', 'Incentives',
  'Construction Expenses', 'Pension House Expense', 'Resto Expenses',
  'Catering Expense', 'Snacks', 'Miscellaneous', 'Mineral Water',
  'Gasoline', 'Repair and Maintenance'
]

async function seed() {
  let hasError = false
  for (const name of categories) {
    const { data, error } = await supabase.from('expense_categories').insert({ name, id: `cat-${crypto.randomUUID()}` })
    if (error) {
      console.error('Error inserting', name, error.message)
      hasError = true
    } else {
      console.log('Inserted', name)
    }
  }
  if (!hasError) {
    console.log('All categories inserted successfully!')
  }
}

seed()

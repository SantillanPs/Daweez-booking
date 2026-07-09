import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

const supabaseUrl = 'https://ctbqxcxqfsrbgzfcmntw.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN0YnF4Y3hxZnNyYmd6ZmNtbnR3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyMTA3NzMsImV4cCI6MjA5NTc4Njc3M30.AAYUl2MTdMcSShx-UX4LKuNNV5GhtWwX_4kqk8PC34M'

const supabase = createClient(supabaseUrl, supabaseKey)

async function seed() {
  const { data: categories, error: fetchErr } = await supabase.from('expense_categories').select('id, name')
  if (fetchErr) {
    console.error('Error fetching categories', fetchErr)
    return
  }

  if (!categories || categories.length === 0) {
    console.error('No categories found. Run seed-categories.js first.')
    return
  }

  const categoryMap = categories.reduce((map, cat) => {
    map[cat.name] = cat.id
    return map
  }, {})

  // Helper to pick a random category if specific one not found
  const getRandomCatId = () => categories[Math.floor(Math.random() * categories.length)].id
  const getCatId = (name) => categoryMap[name] || getRandomCatId()

  const mockExpenses = [
    { notes: 'Weekly Salary for Janitor', amount: 3500, date: new Date().toISOString().split('T')[0], category: 'Weekly Salary' },
    { notes: 'Hardware supplies for Room 2', amount: 1250, date: new Date(Date.now() - 86400000).toISOString().split('T')[0], category: 'Repair and Maintenance' },
    { notes: 'Snacks for guests', amount: 450, date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0], category: 'Snacks' },
    { notes: 'Gasoline for van', amount: 2000, date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0], category: 'Gasoline' },
    { notes: 'Plumbing Repair - Main Pipe', amount: 4500, date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0], category: 'Repair and Maintenance' },
    { notes: 'Front Desk Salary', amount: 8000, date: new Date(Date.now() - 10 * 86400000).toISOString().split('T')[0], category: 'Salary' },
    { notes: 'Mineral Water Refill', amount: 350, date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0], category: 'Mineral Water' },
    { notes: 'Garden maintenance', amount: 1500, date: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0], category: 'Miscellaneous' },
    { notes: 'Pension House Supplies', amount: 2300, date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0], category: 'Pension House Expense' },
    { notes: 'Catering deposit', amount: 5000, date: new Date().toISOString().split('T')[0], category: 'Catering Expense' }
  ]

  let hasError = false
  for (const exp of mockExpenses) {
    const catId = getCatId(exp.category)
    const id = crypto.randomUUID()
    
    const { error } = await supabase.from('expenses').insert({
      id,
      category_id: catId,
      amount: exp.amount,
      notes: exp.notes,
      expense_date: exp.date
    })
    
    if (error) {
      console.error('Error inserting', exp.notes, error.message)
      hasError = true
    } else {
      console.log('Inserted:', exp.notes, '- ₱' + exp.amount)
    }
  }
  
  if (!hasError) {
    console.log('Mock expenses inserted successfully!')
  }
}

seed()

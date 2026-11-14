// THE MONTHLY (AND YEARLY) INCOME STATEMENT — the staff's own paper, copied line for line (their sheet,
// 2026-11-14): Income by place, Less: Operating expenses on their eight lines, Net income. Sebastian put it
// in Cash Flow beside the day (Day · Month · Year), not on a page of its own.
//
// It counts money RECEIVED in the period, like the day's sheet: the payments `allMoneyIn` dates, never what
// a stay is priced at. A payment counts under the place its booking is for; a bill of rooms and a venue
// paid as one goes under the room or venue that holds the bill's payments (its first one still in the hotel).

import type { Booking, Venue } from '../types/booking'
import type { Expense, ExpenseCategory } from '../types/expense'
import type { DatedMoneyIn } from './dailyReport'
import { normalizeVenueId } from './helpers'

export interface StatementLine { label: string; amount: number }
export interface ExpenseLine extends StatementLine { parts: StatementLine[] }

export interface IncomeStatement {
  income: StatementLine[]
  totalIn: number
  expenses: ExpenseLine[]
  totalOut: number
  net: number
  /** Money that left the hotel but is not a cost of running it (a safety deposit given back). */
  notCounted: StatementLine[]
}

// The paper's own lines, in its order. A category goes under the first line whose words it matches;
// anything else is Miscellaneous, so a new category is never dropped. Light & water is asked before the
// snacks line, or a water bill would land there with the mineral water.
const EXPENSE_LINES: [string, RegExp][] = [
  ['Salaries & wages', /salar|wage|cash advance|incentive/i],
  ['Restaurant expenses', /resto|restaurant/i],
  ['Catering expense', /cater/i],
  ['Repair & maintenance', /repair|mainten|construct/i],
  ['Gasoline', /gasoline|fuel/i],
  ['Light & water', /light|electric|power|water bill/i],
  ['Operational expense (snacks)', /snack|mineral|pension house|operat/i],
]
const MISC = 'Miscellaneous'
// A deposit handed back to a guest was never the hotel's money (it is shown under the sheet, not as a cost).
const NOT_A_COST = /deposit/i

// The venues' own lines, in the paper's order; any other venue follows them by name.
const VENUE_ORDER = ['venue-vacation', 'venue-gazebo', 'venue-garden']

export function buildIncomeStatement({ from, to, payments, bookings, venues, expenses, categories }: {
  /** First and last day, `YYYY-MM-DD`, both counted. */
  from: string
  to: string
  payments: DatedMoneyIn[]
  bookings: Booking[]
  venues: Venue[]
  expenses: Expense[]
  categories: ExpenseCategory[]
}): IncomeStatement {
  const within = (day: string) => day >= from && day <= to
  const byId = new Map(bookings.map(b => [b.id, b]))

  const take = new Map<string, number>()
  const add = (key: string, n: number) => take.set(key, (take.get(key) || 0) + n)
  payments.forEach(p => {
    if (p.cancelled || !within(p.day)) return
    if (p.slip) return add('food', p.amount)
    const booking = p.bookingId ? byId.get(p.bookingId) : undefined
    const venue = booking && !booking.room_id ? booking.venue_id : undefined
    add(normalizeVenueId(venue) || 'rooms', p.amount)
  })

  const ordered = [...venues].sort((a, b) => {
    const ia = VENUE_ORDER.indexOf(a.id), ib = VENUE_ORDER.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name)
  })
  const income: StatementLine[] = [
    { label: 'Rooms', amount: take.get('rooms') || 0 },
    // a venue past the paper's three shows only in a period it earned something (the Exclusive)
    ...ordered.filter(v => VENUE_ORDER.includes(v.id) || take.get(v.id)).map(v => ({ label: v.name, amount: take.get(v.id) || 0 })),
    { label: 'Restaurant', amount: take.get('food') || 0 },
    // Not recorded by the system yet; the paper's line stays so the sheet reads like theirs.
    { label: 'Catering', amount: 0 },
  ]

  const nameOf = (id: string) => categories.find(c => c.id === id)?.name || 'Other'
  const lines = new Map<string, Map<string, number>>([...EXPENSE_LINES.map(([l]) => l), MISC].map(l => [l, new Map()]))
  const left = new Map<string, number>()
  expenses.forEach(e => {
    if (!within(e.expense_date)) return
    const name = nameOf(e.category_id)
    if (NOT_A_COST.test(name)) return left.set(name, (left.get(name) || 0) + e.amount)
    const line = EXPENSE_LINES.find(([, words]) => words.test(name))?.[0] || MISC
    const parts = lines.get(line)!
    parts.set(name, (parts.get(name) || 0) + e.amount)
  })
  const out: ExpenseLine[] = [...lines].map(([label, parts]) => {
    const list = [...parts].map(([l, amount]) => ({ label: l, amount })).sort((a, b) => b.amount - a.amount)
    return { label, amount: list.reduce((s, p) => s + p.amount, 0), parts: list }
  })

  const totalIn = income.reduce((s, l) => s + l.amount, 0)
  const totalOut = out.reduce((s, l) => s + l.amount, 0)
  return {
    income, totalIn, expenses: out, totalOut, net: totalIn - totalOut,
    notCounted: [...left].map(([label, amount]) => ({ label, amount })),
  }
}

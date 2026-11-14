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

  // CATERING is a charge the desk writes on a venue's bill ("CATER CHEF JOE 150 PAX", "Catering 380x70 Pax").
  // A payment is never split in two (Sebastian, 2026-11-14: "go 1 by 1 first … rooms/venues first, then
  // other charges like catering"): the bill's money fills its rooms and venues first, in the order it
  // was paid, and only what comes after counts as Catering. So every payment of a bill is walked, the
  // ones before the period too, to know how much of the bill was already covered.
  const billOf = (b: Booking) => b.group_id || b.id
  const catering = new Map<string, number>()
  const total = new Map<string, number>()
  bookings.forEach(b => {
    if (b.status === 'cancelled') return
    const key = billOf(b)
    const cater = (b.event_addons?.charges || []).filter(c => /cater/i.test(c.name)).reduce((s, c) => s + Number(c.amount || 0), 0)
    catering.set(key, (catering.get(key) || 0) + cater)
    // ponytail: the bill's saved figures, not priced again; an overpaid bill reads as its payments (balance
    // stops at 0), which only moves catering a little earlier — it is covered in full either way.
    total.set(key, (total.get(key) || 0) + Number(b.downpayment_paid || 0) + Number(b.balance_due || 0))
  })
  const covered = new Map<string, number>()

  const take = new Map<string, number>()
  const add = (key: string, n: number) => take.set(key, (take.get(key) || 0) + n)
  ;[...payments].sort((a, b) => (a.paidAt || a.day).localeCompare(b.paidAt || b.day)).forEach(p => {
    if (p.cancelled) return
    if (p.slip) return within(p.day) && add('food', p.amount)
    const booking = p.bookingId ? byId.get(p.bookingId) : undefined
    const venue = booking && !booking.room_id ? booking.venue_id : undefined
    const key = booking ? billOf(booking) : ''
    const cater = catering.get(key) || 0
    const before = covered.get(key) || 0
    covered.set(key, before + p.amount)
    const stays = (total.get(key) || 0) - cater
    // what of this payment lands past the rooms and venues, up to the catering written on the bill
    const toCater = cater > 0 ? Math.max(0, Math.min(before + p.amount, stays + cater) - Math.max(before, stays)) : 0
    if (!within(p.day)) return
    if (toCater) add('catering', toCater)
    add(normalizeVenueId(venue) || 'rooms', p.amount - toCater)
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
    { label: 'Catering', amount: take.get('catering') || 0 },
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

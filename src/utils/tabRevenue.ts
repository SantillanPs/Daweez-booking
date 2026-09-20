import { TabLine } from '../types/tab'
import { dateToString } from './helpers'

export interface FoodMoney {
  /** Everything ordered in the period. */
  total: number
  /** The same money day by day, so the trend chart can plot it where it was earned. */
  byDay: Record<string, number>
}

/**
 * Food and bar money for a period (board card k69, part E).
 *
 * Counted on the day the order was placed — the same way the Earnings Report
 * counts a night on the night it was slept — because the report answers "what
 * came in this period", not "what has been paid for". A line staff removed is
 * gone from the table, so it is gone from here too.
 *
 * The day comes from the line's own timestamp read as a LOCAL date: an order
 * taken at 7am in UTC+8 is 11pm the day before in UTC, and reading it as UTC
 * would file a whole early-morning breakfast shift under yesterday.
 */
export function foodMoneyIn(lines: TabLine[], start: string, end: string): FoodMoney {
  const byDay: Record<string, number> = {}
  let total = 0

  for (const line of lines) {
    const at = line.created_at ? new Date(line.created_at) : null
    if (!at || Number.isNaN(at.getTime())) continue
    const day = dateToString(at)
    if (day < start || day > end) continue
    const amount = Number(line.amount || 0)
    total += amount
    byDay[day] = (byDay[day] || 0) + amount
  }

  return { total: Math.round(total), byDay }
}

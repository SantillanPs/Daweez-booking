import { dateToString } from '../../utils/helpers'

// The stretches All expenses and All income can show (Sebastian, 2026-10-31: "add daily in the all
// expenses and all income", which brings back the Day the owner left out on 2026-10-14).
export type Period = 'day' | 'week' | 'month' | 'year'
export const PERIODS: [Period, string][] = [['day', 'Day'], ['week', 'Week'], ['month', 'Month'], ['year', 'Year']]

const parse = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const shortDay = (iso: string) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
export const fmtDay = (iso: string) => parse(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** `on this day`, `in this month`: how an empty list names its period. */
export const inThis = (period: Period) => (period === 'day' ? 'on this day' : 'in this ' + period)

/** The first and last day of the period around `day`, and its name. A week runs Monday to Sunday. */
export function rangeOf(period: Period, day: string): { from: string; to: string; name: string } {
  const d = parse(day)
  if (period === 'day') {
    return { from: day, to: day, name: d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) }
  }
  if (period === 'week') {
    const start = new Date(d)
    start.setDate(d.getDate() - ((d.getDay() + 6) % 7))
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return { from: dateToString(start), to: dateToString(end), name: 'Week of ' + start.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) }
  }
  if (period === 'month') {
    return { from: dateToString(new Date(d.getFullYear(), d.getMonth(), 1)), to: dateToString(new Date(d.getFullYear(), d.getMonth() + 1, 0)), name: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) }
  }
  return { from: d.getFullYear() + '-01-01', to: d.getFullYear() + '-12-31', name: String(d.getFullYear()) }
}

/** The same period, one step earlier or later. */
export function step(period: Period, day: string, by: number): string {
  const d = parse(day)
  if (period === 'day') d.setDate(d.getDate() + by)
  else if (period === 'week') d.setDate(d.getDate() + 7 * by)
  else if (period === 'month') d.setMonth(d.getMonth() + by, 1)
  else d.setFullYear(d.getFullYear() + by, 0, 1)
  return dateToString(d)
}

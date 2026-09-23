import { dateToString } from '../../utils/helpers'

export interface TimelineDayInfo {
  date: Date
  isoStr: string
  time: number
  dayNum: number
  weekday: string
  isToday: boolean
  isWeekend: boolean
  /** First of a month: its day header prints the month name, so a window that
   *  runs past the month end still says which month those days belong to. */
  monthLabel?: string
}

// How many day columns the grid draws. Fixed on purpose (card k154): the month
// is not cut short at its last day, because a window that shrinks through the
// month would stretch a handful of columns across the whole screen. The window
// runs into the days ahead instead, so the grid always looks the same.
export const TIMELINE_WINDOW_DAYS = 31

export function sameMonth(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

/**
 * The window's first day — and the anchor IS that day (card k154 follow-up).
 * The toolbar is what chooses it: **Today** sets today; **‹ ›** set the 1st of the
 * month they step to (or today, when that month is the current one, so arriving
 * back here never buries today off screen); the **date box** sets the day the desk
 * picked, even if that day is the 1st of the current month.
 *
 * Nothing is re-derived here on purpose. The earlier version guessed — "the 1st of
 * the current month means the current month, so open on today" — which cannot be
 * told apart from *the desk asked for the 1st*, and that guess is why picking
 * 1 September still showed 23 September.
 */
export function timelineStart(anchor: Date): Date {
  const start = new Date(anchor)
  start.setHours(0, 0, 0, 0)
  return start
}

export function buildTimelineDays(monthAnchor: Date, today: Date = new Date()): TimelineDayInfo[] {
  const start = timelineStart(monthAnchor)
  const todayStr = today.toDateString()
  const days: TimelineDayInfo[] = []
  for (let i = 0; i < TIMELINE_WINDOW_DAYS; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    days.push({
      date: d,
      isoStr: dateToString(d),
      time: d.getTime(),
      dayNum: d.getDate(),
      weekday: d.toLocaleDateString('en-US', { weekday: 'short' }).substring(0, 1),
      isToday: d.toDateString() === todayStr,
      isWeekend: d.getDay() === 0 || d.getDay() === 6,
      monthLabel: d.getDate() === 1 ? d.toLocaleDateString('en-US', { month: 'short' }) : undefined
    })
  }
  return days
}

/** `August 2026`, or `20 Sep – 20 Oct 2026` when the window runs into the next
 *  month — with the first year named too when the window crosses into January. */
export function timelineHeader(days: TimelineDayInfo[]): string {
  if (days.length === 0) return ''
  const first = days[0].date
  const last = days[days.length - 1].date
  if (sameMonth(first, last)) return first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const firstPart =
    first.toLocaleDateString('en-US', { month: 'short' }) + ' ' + first.getDate() +
    (first.getFullYear() !== last.getFullYear() ? ' ' + first.getFullYear() : '')
  return firstPart + ' – ' + last.toLocaleDateString('en-US', { month: 'short' }) + ' ' + last.getDate() + ', ' + last.getFullYear()
}

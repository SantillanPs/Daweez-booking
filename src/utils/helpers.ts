// Helper: Real RFC-4122 UUID (for Supabase UUID primary keys)
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for non-secure contexts
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// Helper: Is this string a valid UUID (the DB id column is UUID-typed)?
export function isValidUUID(id: string | undefined | null): boolean {
  if (!id) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
}

// Helper: Normalize Venue ID
export function normalizeVenueId(vid: string | undefined | null): string | undefined {
  if (!vid) return undefined
  if (vid.startsWith('venue-')) return vid
  const lower = vid.toLowerCase()
  if (lower.includes('vacation')) return 'venue-vacation'
  if (lower.includes('garden')) return 'venue-garden'
  if (lower.includes('gazebo')) return 'venue-gazebo'
  return vid
}

// Helper: YYYY-MM-DD for a LOCAL date (never UTC). Booking dates are plain
// calendar-day strings, so they must be built from local components —
// toISOString() shifts dates back one day in timezones ahead of UTC (UTC+8).
export function dateToString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return y + '-' + m + '-' + day
}

/** A YYYY-MM-DD day as a LOCAL date, the other way round from `dateToString`. One copy for the
 *  whole app: the same three lines were written out in some twenty files (2026-11-06). */
export const parseDay = (day: string) => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (day: string, n: number) => {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return dateToString(d)
}
/** "Nov 6" */
export const shortDay = (day: string) => parseDay(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

/** Money as the staff read it, "₱1,250.50": up to 2 decimals, none when it is whole. One copy for the
 *  whole app: some thirty screens had their own, and they disagreed on decimals (2026-11-06). */
export const peso = (n: number) => '₱' + Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
/** Rounded to the whole peso, "₱1,251": the bill's and the reports' figures. */
export const pesoWhole = (n: number) => '₱' + Math.round(Number(n || 0)).toLocaleString()

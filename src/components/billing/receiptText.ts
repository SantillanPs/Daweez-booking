// The words and figures a 58 mm slip needs. The blocks it is built from live in
// `receiptPrimitives.tsx`.
//
// Kept in its own module on purpose: a file that exports both React components
// and plain functions breaks React Fast Refresh (react-refresh/only-export-components),
// which is what a shared primitives file would otherwise trip on.

export const money = (n: number) => '₱' + Number(n || 0).toLocaleString()

export const fmtDateTime = (d?: string) =>
  d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

/**
 * A plain `YYYY-MM-DD` calendar day as `Sep 25` — parsed by hand, because
 * `new Date('2026-09-25')` is UTC midnight and would read as the day before in a
 * timezone behind UTC (the same trap `utils/helpers.ts` documents for dates).
 */
export const fmtDay = (d?: string) => {
  const [y, m, day] = (d || '').split('-').map(Number)
  if (!y || !m || !day) return ''
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

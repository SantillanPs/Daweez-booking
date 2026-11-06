// The statement's own date and time wording. The SHORT-STAY clock itself lives in
// `utils/shortStay.ts`, because the calendar block and the booking panel need the same
// answer as the paper.

export const fmtDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

/** `14:00` → `2:00nn` (the hotel's own way of writing noon). */
export const fmtTime = (t?: string) => {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hh = h % 12 === 0 ? 12 : h % 12
  const label = hh + ':' + String(m).padStart(2, '0') + period
  return h === 12 && m === 0 ? label.replace('pm', 'nn') : label
}

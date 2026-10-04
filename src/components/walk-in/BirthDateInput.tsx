import { useState } from 'react'
import { FIELD, FIELD_ERROR } from './formStyles'

const two = (n: number) => String(n).padStart(2, '0')

/** `1990-06-15` → `06/15/1990`, the way the hotel writes a date. */
const toTyped = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '')
  return m ? m[2] + '/' + m[3] + '/' + m[1] : ''
}

/**
 * What was typed → `1990-06-15`, or `''` while it is not a real date yet. Takes
 * `6/15/1990`, `06-15-1990`, `06 15 1990` and the bare eight digits `06151990`.
 */
const toIso = (typed: string) => {
  const t = typed.trim()
  const m = /^(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{4})$/.exec(t) || /^(\d{2})(\d{2})(\d{4})$/.exec(t)
  if (!m) return ''
  const month = Number(m[1]), day = Number(m[2]), year = Number(m[3])
  // Built from LOCAL parts, like every date here — the hotel is UTC+8.
  const d = new Date(year, month - 1, day)
  const real = d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day
  if (!real || year < 1900 || d > new Date()) return ''
  return year + '-' + two(month) + '-' + two(day)
}

/**
 * Birth Date as a box the desk TYPES in (the design review, 2026-10-04). It was the
 * browser's date picker, which opens on today — so a guest born in 1990 was some four
 * hundred presses of the back arrow away. Same reasoning as the number boxes: free
 * typing, never the browser's own widget.
 *
 * It still hands the form the `YYYY-MM-DD` the booking has always stored, and hands it
 * `''` until what is typed is a real date — a half-typed date is never saved.
 */
export function BirthDateInput({ value, onChange }: {
  value: string
  onChange: (iso: string) => void
}) {
  const [typed, setTyped] = useState(() => toTyped(value))
  // The last value this box itself sent up. When the form's value is something else,
  // it came from outside (correcting a booking fills it in after the form opens), so
  // the box shows that instead.
  const [sent, setSent] = useState(value)
  const [left, setLeft] = useState(false)
  if (value !== sent) { setSent(value); setTyped(toTyped(value)) }

  const wrong = left && typed.trim() !== '' && !toIso(typed)

  return (
    <>
      <input
        type="text"
        placeholder="MM/DD/YYYY"
        aria-label="Birth Date"
        aria-invalid={wrong || undefined}
        value={typed}
        onChange={e => {
          const iso = toIso(e.target.value)
          setTyped(e.target.value); setLeft(false); setSent(iso); onChange(iso)
        }}
        onBlur={() => { setLeft(true); if (toIso(typed)) setTyped(toTyped(toIso(typed))) }}
        className={wrong ? FIELD_ERROR : FIELD}
      />
      {wrong && <p className="text-xs text-error mt-1">Type the date like 06/15/1990.</p>}
    </>
  )
}

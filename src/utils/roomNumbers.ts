/**
 * How the app writes a set of room numbers: `Room 4`, `Rooms 2, 3`, or `Rooms 4–10` when they run
 * consecutively.
 *
 * It exists because **one payment can cover many rooms**. A receipt is stored on every room it paid for (the
 * owner's ruling, 2026-09-30), so both the printed daily report and the booking's own receipts list have to
 * say *which* rooms the money covered — otherwise a ₱9,200 receipt sitting on Room 7 reads as Room 7's own
 * money, and the run of rooms is the only thing that identifies the payment.
 *
 * The report and the receipts list must agree word for word, so the wording lives here once.
 */
export function formatRoomNumbers(numbers: number[]): string {
  if (numbers.length === 0) return ''
  const sorted = [...new Set(numbers)].sort((a, b) => a - b)
  if (sorted.length === 1) return `Room ${sorted[0]}`
  const consecutive = sorted.every((n, i) => i === 0 || n === sorted[i - 1] + 1)
  if (consecutive && sorted.length > 2) return `Rooms ${sorted[0]}–${sorted[sorted.length - 1]}`
  return `Rooms ${sorted.join(', ')}`
}

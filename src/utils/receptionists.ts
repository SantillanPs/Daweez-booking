import type { Booking } from '../types/booking'

// Who took a booking, shared by the New booking form and Log old booking so both offer the
// same names and open on the same person.
//
// The last receptionist picked is kept on this computer: the person at the desk is usually
// the same from one booking to the next.
const RECEPTIONIST_KEY = 'daweez_pms_receptionist'

export const lastReceptionist = () => {
  try { return localStorage.getItem(RECEPTIONIST_KEY) || '' } catch { return '' }
}
export const rememberReceptionist = (name: string) => {
  try { localStorage.setItem(RECEPTIONIST_KEY, name.trim()) } catch { /* storage is off: nothing to remember */ }
}

/** The names written on bookings before, most used first — six at most. */
export function staffNamesOf(bookings: Booking[] | undefined): string[] {
  const count = new Map<string, number>()
  for (const b of bookings || []) {
    const n = (b.prepared_by || '').trim().toUpperCase()
    if (n) count.set(n, (count.get(n) || 0) + 1)
  }
  return [...count].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n]) => n)
}

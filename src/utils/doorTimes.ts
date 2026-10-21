import { Booking } from '../types/booking'
import { getRateConfig } from './rateConfig'

/**
 * **Check in and out are back, as a note** (Sebastian, 2026-10-21, the door times mock, "F · Tick
 * box"): the desk may tick when a guest checked in or out and say the time, whenever they get to
 * it. Nothing asks for it, and it moves no stay and adds no charge — where the stay is still
 * comes from its dates (`stayStage`). Saved in `actual_check_in` / `actual_check_out`.
 *
 * A day gone by with nothing ticked reads as the usual time (his words: *"if a day passes after
 * check in/out they should automatically be defaulted to 2pm and 12pm"*). It is shown, never
 * saved, and a short stay has no usual time.
 */
export type Door = 'in' | 'out'

/** The day the door falls on: a short stay leaves on the day it came. */
export const doorDay = (b: Pick<Booking, 'check_in' | 'check_out' | 'stay_hours'>, k: Door) =>
  k === 'in' || b.stay_hours ? b.check_in : b.check_out

const hhmm = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + (m || 0) }
export const usualMinutes = (k: Door) => hhmm(k === 'in' ? getRateConfig().standardCheckInTime : getRateConfig().standardCheckOutTime)

/** The time to show for a door, in minutes after midnight: the one ticked, or the usual one once its day has gone by. */
export function doorTime(b: Booking, k: Door, todayIso: string): { minutes: number; usual: boolean } | null {
  const at = k === 'in' ? b.actual_check_in : b.actual_check_out
  if (at) { const d = new Date(at); return { minutes: d.getHours() * 60 + d.getMinutes(), usual: false } }
  if (b.stay_hours || todayIso <= doorDay(b, k)) return null
  return { minutes: usualMinutes(k), usual: true }
}

/** The stored time for a door ticked at `minutes` on its own day (local time, UTC+8). */
export function doorIso(b: Booking, k: Door, minutes: number): string {
  const [y, m, d] = doorDay(b, k).split('-').map(Number)
  return new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60).toISOString()
}

export const minutesLabel = (n: number) => {
  n = ((n % 1440) + 1440) % 1440
  const h = Math.floor(n / 60), m = n % 60
  return (h % 12 || 12) + (m ? ':' + String(m).padStart(2, '0') : '') + ' ' + (h < 12 ? 'AM' : 'PM')
}

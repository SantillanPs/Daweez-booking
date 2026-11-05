// New and changed features mark themselves where they live, in place of "What's new" (Sebastian,
// 2026-11-05: "add indicators from now on for features with updates or new features instead of using
// the what's new"; the "New feature marks" mock, option B in gold, "only on the feature"). The feature
// wears a NEW tag and one tap on it clears the tag on this device. The staff share devices and have no logins, so what a device has been shown is kept in its
// localStorage.
import { useSyncExternalStore } from 'react'

export interface NewFeature {
  id: string
  /** The day it went live, `YYYY-MM-DD`. Its marks go by themselves after `DAYS`, tapped or not. */
  since: string
}

/**
 * **Every update the staff can see adds one here, in the same push to `main`**, and its
 * feature wears `<NewTag id=… />` and calls `markSeen(id)` when tapped.
 */
export const NEW_FEATURES: NewFeature[] = [
  // Restaurant → History: each order slip's orders, serves and where its bill went (`RestaurantHistory`).
  { id: 'restaurant-history', since: '2026-11-05' },
  // The day-or-hours chip beside a Gazebo or Garden on the bill (`NewBookingBill`).
  { id: 'venue-length', since: '2026-11-05' },
  // An agency's room and breakfast prices are changed on its bill and kept on the agency (`NewBookingBill`).
  { id: 'agency-prices', since: '2026-11-05' },
  // The agency's own breakfast price in Settings → Agencies (`DirectoryTab`).
  { id: 'agency-breakfast', since: '2026-11-05' },
]

const KEY = 'daweez_new_seen'
const DAYS = 30

function read(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return new Set(Array.isArray(v) ? v : [])
  } catch {
    return new Set()
  }
}

let seen = read()
const watchers = new Set<() => void>()

function fresh(f: NewFeature): boolean {
  if (seen.has(f.id)) return false
  const end = new Date(f.since + 'T00:00:00')
  end.setDate(end.getDate() + DAYS)
  return new Date() < end
}

/** The feature was tapped: its tag goes at once. */
export function markSeen(id: string): void {
  if (seen.has(id) || !NEW_FEATURES.some(f => f.id === id)) return
  seen = new Set(seen).add(id)
  try { localStorage.setItem(KEY, JSON.stringify([...seen])) } catch { /* the marks just come back on reload */ }
  watchers.forEach(tell => tell())
}

function useSeen(): Set<string> {
  return useSyncExternalStore(
    tell => {
      watchers.add(tell)
      return () => { watchers.delete(tell) }
    },
    () => seen,
  )
}

/** Whether this feature is still new here. */
export function useIsNew(id: string): boolean {
  useSeen()
  return NEW_FEATURES.some(f => f.id === id && fresh(f))
}

// New and changed features mark themselves where they live, in place of "What's new" (Sebastian,
// 2026-11-05: "add indicators from now on for features with updates or new features instead of using
// the what's new"; the "New feature marks" mock, option B in gold). The feature wears a NEW tag, the
// tab and buttons on the way to it a gold dot, and one tap on the feature clears them all on this
// device. The staff share devices and have no logins, so what a device has been shown is kept in its
// localStorage.
import { useSyncExternalStore } from 'react'

export interface NewFeature {
  id: string
  /** The day it went live, `YYYY-MM-DD`. Its marks go by themselves after `DAYS`, tapped or not. */
  since: string
  /** The top-bar tab it lives under, as `TABS` in `DashboardLayout` names it. */
  tab: string
}

/**
 * **Every update the staff can see adds one here, in the same push to `main`**, and its
 * feature wears `<NewTag id=… />` and calls `markSeen(id)` when tapped.
 */
export const NEW_FEATURES: NewFeature[] = [
  // The day-or-hours chip beside a Gazebo or Garden on the bill (`NewBookingBill`).
  { id: 'venue-length', since: '2026-11-05', tab: 'Front desk' },
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

/** The feature was tapped: its tag and the dots leading to it go at once. */
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

/** Whether these features are still new here: one for a feature's tag, several for a dot on the way to them. */
export function useIsNew(...ids: string[]): boolean {
  useSeen()
  return NEW_FEATURES.some(f => ids.includes(f.id) && fresh(f))
}

/** Asks whether a top-bar tab has something new under it. */
export function useNewTabs(): (tab: string) => boolean {
  useSeen()
  return tab => NEW_FEATURES.some(f => f.tab === tab && fresh(f))
}

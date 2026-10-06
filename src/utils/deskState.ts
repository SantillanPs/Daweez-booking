import { useSyncExternalStore } from 'react'

// Two facts the calendar and the top bar tell each other, so that only one thing ever
// opens by itself at the front desk: the calendar's short-stay panel, or "What's new".
// A plain module singleton, the same shape as `bookingFocus.ts`: no provider.

let busy = false
let reading = false
const watchers = new Set<() => void>()

/** The calendar says whether the desk has a panel or a form open. */
export function setDeskBusy(now: boolean): void {
  busy = now
}

export function isDeskBusy(): boolean {
  return busy
}

/** The top bar says whether "What's new" is on screen. */
export function setReadingWhatsNew(now: boolean): void {
  if (reading === now) return
  reading = now
  watchers.forEach(tell => tell())
}

/** True while "What's new" is on screen. The calendar waits for it, as it waits for its own panels. */
export function useReadingWhatsNew(): boolean {
  return useSyncExternalStore(
    tell => {
      watchers.add(tell)
      return () => { watchers.delete(tell) }
    },
    () => reading,
  )
}

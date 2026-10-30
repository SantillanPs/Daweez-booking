import { useSyncExternalStore } from 'react'

// Two facts the calendar and the top bar tell each other: whether the desk has a panel open
// (an update waits for it to close, `appUpdate.ts`), and whether "What's new" is being read,
// so the short-stay panel does not open under it.
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

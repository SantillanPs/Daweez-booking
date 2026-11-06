import { useSyncExternalStore } from 'react'
import { supabase } from './supabaseClient'

// **Whether the hotel's records can be reached** (Sebastian, 2026-11-06: "if the database isn't
// reachable, then at least add something for the staff to know what the problem is"). Before, a
// dropped connection said nothing: a save failed with its own message, or a read quietly came back
// empty. One sign now says it for every screen (`ConnectionBand` under the top bar).
//
// It is lost when the browser says it is offline, or when a call to the database never got an
// answer (`noteReached`, called by the fetch in `supabaseClient`); an answer of any kind, even an
// error, means it is reachable. 'back' is shown for a moment once it returns, then 'closing' while
// the band folds away.
export type Connection = 'on' | 'off' | 'back' | 'closing'

let state: Connection = navigator.onLine ? 'on' : 'off'
let reached = true
const subs = new Set<() => void>()
let timer: number | undefined
let probing: number | undefined

function set(next: Connection) {
  if (next === state) return
  state = next
  window.clearTimeout(timer)
  if (next === 'back') timer = window.setTimeout(() => set('closing'), 2500)
  if (next === 'closing') timer = window.setTimeout(() => set('on'), 320)
  // While it is lost, ask again by itself every 10 seconds.
  window.clearInterval(probing)
  if (next === 'off') probing = window.setInterval(() => { void tryAgain() }, 10_000)
  subs.forEach(f => f())
}

function update() {
  if (!navigator.onLine || !reached) set('off')
  else if (state === 'off') set('back')
}

/** Called for every database call: did it get an answer? */
export function noteReached(ok: boolean) {
  if (ok === reached && (ok || state === 'off')) return
  reached = ok
  update()
}

/** Asks the database once (the band's "Try again", and every 10 seconds while lost). */
export async function tryAgain(): Promise<void> {
  // The answer, or the lack of one, reaches `noteReached` through the client's fetch.
  await supabase.from('rooms').select('id').limit(1)
}

window.addEventListener('offline', update)
window.addEventListener('online', () => { void tryAgain() })
// Opened with no connection: start asking at once.
if (state === 'off') probing = window.setInterval(() => { void tryAgain() }, 10_000)

export function useConnection(): Connection {
  return useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => state)
}

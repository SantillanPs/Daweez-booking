import type { QueryClient } from '@tanstack/react-query'
import { isDeskBusy } from './deskState'

// **A screen left open picks up an update by itself** (Sebastian, 2026-10-30: "I hate that in the live
// after an update they are always required to refresh the page to use the updated version").
//
// Each build carries its own version and writes it to `version.json` (`stampVersion` in vite.config.ts).
// An open screen asks for that file when it comes back into view and every few minutes; once the
// version differs, it reloads — but only at a moment nobody loses anything: no window or panel open,
// nothing still saving, nobody typing, and nobody has touched the screen for a while (or it is out of
// sight). There is no "please refresh" banner: the page just comes back new, with a dot on "What's
// new". The kitchen's tablet, open all day, waits for a quiet spell the same way.

const CHECK_EVERY = 5 * 60_000
const TRY_EVERY = 15_000
/** How long the screen must be left alone before a visible page reloads. */
const QUIET_FOR = 90_000

const mine = import.meta.env.VITE_APP_VERSION as string | undefined
let lastTouch = Date.now()
let behind = false

async function newVersionOut(): Promise<boolean> {
  try {
    const res = await fetch('/version.json?t=' + Date.now(), { cache: 'no-store' })
    if (!res.ok) return false
    const { version } = await res.json() as { version?: string }
    return !!version && version !== mine
  } catch {
    return false
  }
}

// A window, the booking panel, a bill or a receipt is put on top of the app with a portal, straight
// into <body>; anything there besides the app itself means something is open.
function somethingOpen(): boolean {
  const root = document.getElementById('root')
  return [...document.body.children].some(el => el !== root && !['SCRIPT', 'STYLE', 'LINK', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName))
}

// A box that is only focused (the passcode box focuses itself) loses nothing; one with words in it would.
function typing(): boolean {
  const el = document.activeElement as HTMLElement | null
  if (!el) return false
  if (el.isContentEditable) return !!el.textContent?.trim()
  return (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && !!el.value.trim()
}

function safeNow(queryClient: QueryClient): boolean {
  if (queryClient.isMutating() > 0 || somethingOpen() || isDeskBusy()) return false
  if (document.hidden) return true
  return !typing() && Date.now() - lastTouch >= QUIET_FOR
}

/** Starts watching for an update. Only the built app is stamped, so the dev server never reloads itself. */
export function watchForUpdates(queryClient: QueryClient): void {
  if (!import.meta.env.PROD || !mine) return

  for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const) {
    window.addEventListener(ev, () => { lastTouch = Date.now() }, { passive: true, capture: true })
  }

  const check = async () => {
    if (!behind) behind = await newVersionOut()
    if (behind && safeNow(queryClient)) window.location.reload()
  }
  document.addEventListener('visibilitychange', () => { void check() })
  window.addEventListener('focus', () => { void check() })
  window.setInterval(() => { void check() }, CHECK_EVERY)
  // Once behind, the safe moment is looked for often.
  window.setInterval(() => { if (behind && safeNow(queryClient)) window.location.reload() }, TRY_EVERY)

  // An old page asking for a part of the app the update has deleted (the bill, the reports, which load
  // when first opened) would fail to open it. It reloads instead, once — never in a loop.
  window.addEventListener('vite:preloadError', event => {
    let last = 0
    try { last = Number(sessionStorage.getItem('daweez_reloaded_at') || 0) } catch { /* private window */ }
    if (Date.now() - last < 30_000) return
    try { sessionStorage.setItem('daweez_reloaded_at', String(Date.now())) } catch { /* private window */ }
    event.preventDefault()
    window.location.reload()
  })
}

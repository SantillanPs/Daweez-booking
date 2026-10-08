import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Megaphone, X } from 'lucide-react'
import { UPDATES, markUpdatesSeen, unseenUpdates, updateDay, type Update } from '../utils/whatsNew'
import { isDeskBusy, setReadingWhatsNew } from '../utils/deskState'

// Only what this device has not seen is listed (Sebastian, 2026-10-07: what was already
// opened should be gone to make room for the new). The cap keeps a long absence readable.
const LISTED = 5

interface WhatsNewProps {
  /** The Front desk's calendar is the screen that is open: the only place it opens by itself. */
  atFrontDesk: boolean
}

// What changed, said to the staff at the front desk (Sebastian, 2026-10-05: *"can you add
// a what's new after every update we make on the live? make sure it's in the front desk"*).
//
// The first time a device opens the Front desk after an update, the window opens by
// itself — once. After that it stays behind this button in the top bar, beside Sync
// (*"move the button next to the sync button"*), which carries a dot until it has been
// opened. The staff share devices and swap places, so whoever missed it finds it there,
// from any screen.
//
// It waits its turn like the short-stay panel does (`utils/deskState.ts`): it never opens
// over a booking the desk already has open, and while it is open that panel does not open
// under it.
export function WhatsNew({ atFrontDesk }: WhatsNewProps) {
  // The updates this device had not shown when the window was opened — marked "New" in
  // it. Null while it is closed.
  const [fresh, setFresh] = useState<string[] | null>(null)
  // Earlier updates, kept behind a button and listed by day.
  const [older, setOlder] = useState(false)
  const [waiting, setWaiting] = useState(() => unseenUpdates().length > 0)

  const show = () => {
    setFresh(unseenUpdates().map(u => u.id))
    setOlder(false)
    markUpdatesSeen()
    setWaiting(false)
    setReadingWhatsNew(true)
  }
  const close = () => {
    setFresh(null)
    setReadingWhatsNew(false)
  }

  // A moment after the Front desk opens, so a booking handed over from another screen has
  // taken its place first — then this stays shut, and the dot says it is there.
  const showNow = useRef(show)
  useEffect(() => { showNow.current = show })
  useEffect(() => {
    if (!atFrontDesk || unseenUpdates().length === 0) return
    const timer = window.setTimeout(() => { if (!isDeskBusy()) showNow.current() }, 500)
    return () => window.clearTimeout(timer)
  }, [atFrontDesk])

  const open = fresh !== null
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setFresh(null); setReadingWhatsNew(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  if (UPDATES.length === 0) return null

  // Everything already seen, one block for each day.
  const olderDays: [string, Update[]][] = []
  for (const u of UPDATES) {
    if (fresh?.includes(u.id)) continue
    const day = u.id.slice(0, 10)
    const last = olderDays[olderDays.length - 1]
    if (last && last[0] === day) last[1].push(u)
    else olderDays.push([day, [u]])
  }

  return (
    <>
      {/* The same shape as Sync beside it; on a phone, where Sync is not shown, only the mark. */}
      <button type="button" onClick={show} aria-haspopup="dialog" aria-label="What’s new" title="What’s new"
        className="flex items-center justify-center gap-1.5 w-11 sm:w-auto h-11 mouse:h-8 text-xs font-semibold border rounded-xl sm:px-3 bg-card border-soft text-main hover:bg-softbg transition-colors cursor-pointer">
        <Megaphone className="w-3.5 h-3.5" aria-hidden="true" />
        <span className="hidden sm:inline whitespace-nowrap">What’s new</span>
        {waiting && <span className="w-1.5 h-1.5 rounded-full bg-danger-500 animate-pulse motion-reduce:animate-none" />}
      </button>

      {fresh && createPortal(
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-ink-900/50 font-sans animate-in fade-in duration-200 motion-reduce:animate-none" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label="What’s new" onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-lg max-h-[88dvh] flex flex-col bg-card border border-soft rounded-t-2xl sm:rounded-xl shadow-softLg overflow-hidden animate-in slide-in-from-bottom-4 duration-200 motion-reduce:animate-none">
            <div className="shrink-0 flex items-center justify-between gap-3 pl-5 pr-3 py-2 border-b border-soft">
              <h3 className="font-display text-[19px] font-bold tracking-tight text-main">What’s new</h3>
              <button type="button" onClick={close} aria-label="Close"
                className="w-11 h-11 inline-flex items-center justify-center rounded-lg text-muted hover:text-main hover:bg-softbg transition-colors cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* One update after another, parted by a rule — lines on one sheet, not boxes. */}
            <div className="min-h-0 overflow-y-auto overscroll-contain px-5 divide-y divide-soft">
              {fresh.length === 0 && (
                <p className="py-8 text-center text-[14px] text-muted">Nothing new since you last looked.</p>
              )}
              {UPDATES.filter(u => fresh.includes(u.id)).slice(0, LISTED).map(update => (
                <section key={update.id} className="py-4 space-y-4">
                  <p className="flex items-center gap-2 text-[13px] font-semibold text-muted">
                    {updateDay(update.id)}
                    <span className="px-1.5 py-0.5 rounded bg-gold-100 text-gold-800 text-[12px] font-bold leading-none">New</span>
                  </p>
                  <Changes update={update} />
                </section>
              ))}

              {UPDATES.some(u => !fresh.includes(u.id)) && (
                <div className="py-3">
                  <button type="button" onClick={() => setOlder(o => !o)} aria-expanded={older}
                    className="w-full h-11 rounded-lg text-[14px] font-semibold text-main hover:bg-softbg transition-colors cursor-pointer">
                    {older ? 'Hide previous changes' : 'Show previous changes'}
                  </button>
                </div>
              )}

              {older && olderDays.map(([day, updates]) => (
                <section key={day} className="py-4 space-y-4">
                  <p className="text-[13px] font-semibold text-muted">{updateDay(day)}</p>
                  {updates.map(update => <Changes key={update.id} update={update} />)}
                </section>
              ))}
            </div>

            <div className="shrink-0 px-5 py-3 border-t border-soft">
              <button type="button" onClick={close} autoFocus
                className="w-full h-11 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold transition-colors duration-200 active:scale-[0.98] cursor-pointer">
                Got it
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

function Changes({ update }: { update: Update }) {
  return (
    <>
      {update.changes.map(group => (
        <div key={group.where}>
          <h4 className="font-display text-[15px] font-bold text-main">{group.where}</h4>
          <ul className="mt-1.5 space-y-1.5">
            {group.what.map(line => (
              <li key={line} className="flex gap-2.5 text-[14px] leading-snug text-main">
                <span className="mt-[7px] w-1.5 h-1.5 shrink-0 rounded-full bg-gold-400" aria-hidden="true" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

/**
 * What an unknown URL gets.
 *
 * TanStack Router prints a bare `<p>Not Found</p>` and logs a console warning when nothing is configured, which
 * is what the owner saw after `/daily-report` stopped being a page (2026-09-30) — his browser was still sitting
 * on the old address. A dead link deserves a sentence in the hotel's own words and one way back, not a stray
 * word and a warning in the console.
 *
 * It lives here rather than in `router.tsx` because a file that exports the router cannot also define a
 * component without breaking Fast Refresh (`react-refresh/only-export-components`).
 */
export function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3 px-6 text-center">
      <p className="font-display font-extrabold text-lg text-ink-800">That page does not exist</p>
      <p className="text-sm text-muted max-w-sm">The link may be old, or a page that has moved.</p>
      <a href="/calendar"
        className="mt-1 bg-brand-primary hover:bg-gold-500 text-ink-900 text-xs font-bold px-5 py-2 rounded-lg transition-colors cursor-pointer shadow-sm">
        Go to the Calendar
      </a>
    </div>
  )
}

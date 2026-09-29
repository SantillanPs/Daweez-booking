/**
 * Shown when the shared settings could not be read before the app started.
 *
 * The shared rates and where-guests-pay are read once per page load, and
 * everything that prices a stay or prints an account number reads them
 * synchronously. If the database cannot be reached, stopping here with a plain
 * message is the honest outcome — the alternative is a screen quoting the
 * factory defaults, which is exactly the failure this replaced (2026-09-28).
 *
 * This is the only new screen part 2 introduces; it has no normal-state
 * counterpart to design against.
 */
export function SettingsUnavailable({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-page text-main flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-soft rounded-xl p-6 text-center">
        <h1 className="font-display text-base font-semibold">Cannot reach the hotel's database</h1>
        <p className="text-sm text-muted mt-2">
          The shared rates and the payment accounts could not be loaded. Nothing is shown rather than
          showing the wrong figures. Check the internet connection, then reload.
        </p>
        <p className="text-[11px] text-muted mt-3 break-words">{error.message}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 rounded-lg bg-brand-primary text-ink-900 text-sm font-semibold cursor-pointer"
        >
          Reload
        </button>
      </div>
    </div>
  )
}

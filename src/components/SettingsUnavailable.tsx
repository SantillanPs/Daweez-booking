/**
 * Shown when the app could not start a screen.
 *
 * The shared rates and where-guests-pay are read once per page load, and
 * everything that prices a stay or prints an account number reads them
 * synchronously. If the database cannot be reached, stopping here with a plain
 * message is the honest outcome — the alternative is a screen quoting the
 * factory defaults, which is exactly the failure this replaced (2026-09-28).
 *
 * **It says which of two things went wrong** (2026-10-04). Every failure the app does
 * not catch lands here, and the card used to blame the database for all of them. When
 * the Calendar's own code could not be fetched it still read *"Cannot reach the hotel's
 * database… check the internet connection"* — sending whoever saw it to look at the
 * wrong thing. A screen that could not be fetched now says so. Staff can meet it too:
 * after the app is updated, a tab left open asks for a file that is no longer there,
 * and Reload is the whole cure.
 */
export function SettingsUnavailable({ error }: { error: Error }) {
  // Chrome, Firefox and Safari each word a failed screen fetch differently.
  const screenNotLoaded = /dynamically imported module|importing a module script failed/i.test(error?.message || '')

  return (
    <div className="min-h-screen bg-page text-main flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-card border border-soft rounded-xl p-6 text-center">
        <h1 className="font-display text-base font-semibold">
          {screenNotLoaded ? 'This screen could not be opened' : "Cannot reach the hotel's database"}
        </h1>
        <p className="text-sm text-muted mt-2">
          {screenNotLoaded
            ? 'Reload the page. Nothing that was saved is lost.'
            : 'The shared rates and the payment accounts could not be loaded. Nothing is shown rather than showing the wrong figures. Check the internet connection, then reload.'}
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

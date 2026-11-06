import logo from '../assets/logo.png'

/** A copy built without the database settings says so instead of a blank page (2026-11-06). */
export function NotSetUp() {
  return (
    <main className="min-h-screen bg-page flex items-center justify-center px-4">
      <div className="flex max-w-xs flex-col items-center gap-2.5 text-center">
        <img src={logo} alt="" width={48} height={48} className="w-12 h-12" />
        <b className="font-display text-[15px] text-main">This copy isn’t set up</b>
        <span className="text-[13px] text-muted">It isn’t linked to the hotel’s records. Use the usual Daweez link, or tell Sebastian.</span>
      </div>
    </main>
  )
}

import type { ReactNode } from 'react'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

/**
 * The settled money, said once (card k132 — the owner's correction: *"move the fully
 * paid next to the SEB"*).
 *
 * A paid booking has nothing left to explain, so it gets no money block of its own:
 * `Fully paid ✓` with the figure it was paid at, and the next step — `Check in`, then
 * `Check out` — as the button on its right. That is the whole of the settled state: one
 * line, one action.
 *
 * It is the first thing under the guest, across the full width. The guest's name is in
 * the panel's title now (2026-10-04), so the strip sits directly below it instead of
 * sharing a row with it.
 *
 * While money is owed the panel keeps its own money box ([BookingMoneyPanel]), because
 * then the figures are the thing being worked on.
 */
export function SettledPaidTag({ paid, action }: { paid: number; action?: ReactNode }) {
  return (
    // The same emerald edge and tint that says "done" at a glance. It runs to the right
    // edge (owner: *"Why the fuck would there be empty space on the right?"*): the
    // words at its left end, the next step at its right end — no chip pinned to one
    // side with a gap beside it.
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50/40 pl-3 pr-1.5 py-1.5 min-h-14">
      <span className="min-w-0">
        <span className="block font-display text-[14px] font-bold text-emerald-700 leading-tight">Fully paid ✓</span>
        <span className="block text-[12px] text-emerald-700 mt-0.5 truncate">{fmtPeso(paid)} received</span>
      </span>
      {action}
    </div>
  )
}

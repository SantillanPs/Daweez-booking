import type { ReactNode } from 'react'

const fmtPeso = (n: number) => '₱' + n.toLocaleString()

/**
 * The settled money, said once, beside the guest's name (card k132 — the owner's
 * correction: *"move the fully paid next to the SEB"*).
 *
 * A paid booking has nothing left to explain, so it gets no money block of its own:
 * `Fully paid ✓` with the figure it was paid at sits in the guest's own row, and the
 * next step — `Check in`, then `Check out` — is the button on its right. That is the
 * whole of the settled state: one line, one action, and the rest of the panel stays
 * collapsed under it.
 *
 * While money is owed the panel keeps its own `Payment` block ([BookingMoneyPanel],
 * the four rows and the bar), because then the figures are the thing being worked on.
 */
export function SettledPaidTag({ paid, action }: { paid: number; action?: ReactNode }) {
  return (
    // The green box is kept exactly as it was — the same emerald edge and tint that
    // says "done" at a glance — it just sits in the guest's row now instead of in a
    // block of its own. And it GROWS to the right edge (owner: *"Why the fuck would
    // there be empty space on the right?"*): `Fully paid ✓ / ₱received` at its left
    // end, the next step at its right end, so the strip the row has is the strip it
    // uses — no chip pinned to one side with a gap beside it.
    <div className="flex-1 min-w-0 flex items-center justify-between gap-2 rounded-lg border border-emerald-300 bg-emerald-50/40 px-2.5 py-1.5">
      <span className="min-w-0">
        <span className="block font-display text-[13.5px] font-bold text-emerald-700 leading-tight">Fully paid ✓</span>
        <span className="block text-[10.5px] text-emerald-700/80 mt-0.5 truncate">{fmtPeso(paid)} received</span>
      </span>
      {action}
    </div>
  )
}

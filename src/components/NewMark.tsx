// The mark of a new or changed feature (`utils/newMarks.ts`). It sits on the top right corner of the
// feature, which must be `relative`, and is never printed. Only the feature wears it: no dot on the
// tab or the buttons that lead to it (Sebastian, 2026-11-05: "it's supposed to be B, and only on the feature").
import { useIsNew } from '../utils/newMarks'

/** The gold NEW tag on the feature itself, until it is tapped. */
export function NewTag({ id }: { id: string }) {
  if (!useIsNew(id)) return null
  return (
    <span aria-label="New" className="nm-pop print:hidden pointer-events-none absolute -top-2 -right-3 z-10 px-[5px] py-px rounded-full bg-gold-400 text-ink-900 font-display text-[8px] leading-[11px] font-extrabold uppercase tracking-[0.06em] shadow-[0_0_0_2px_#fff]">
      New
    </span>
  )
}

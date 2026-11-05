// The marks of a new or changed feature (`utils/newMarks.ts`). Both sit on the top right corner of
// their parent, which must be `relative`, and are never printed.
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

/** The dot on a button that opens where a feature is, while that feature is new. */
export function NewDotFor({ id, inset }: { id: string; inset?: boolean }) {
  return <NewDot on={useIsNew(id)} inset={inset} />
}

/**
 * A gold dot on the way to a new feature: a tab, or a button that opens where it is. `inset` keeps it
 * inside the corner, for a button that clips what sticks out (`.bw-shine` hides its overflow).
 */
export function NewDot({ on, inset }: { on: boolean; inset?: boolean }) {
  if (!on) return null
  const where = inset ? 'top-[7px] right-[7px]' : '-top-[3px] -right-[3px]'
  return <span aria-hidden="true" className={'nm-pop print:hidden pointer-events-none absolute w-[9px] h-[9px] rounded-full bg-gold-400 shadow-[0_0_0_2px_#fff] ' + where} />
}

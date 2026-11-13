// The mark of a new or changed feature (`utils/newMarks.ts`). It sits on the top right corner of the
// feature, which must be `relative`, and is never printed. Only the feature wears it: no dot on the
// tab or the buttons that lead to it (Sebastian, 2026-11-05: "it's supposed to be B, and only on the feature").
import { useEffect, useRef } from 'react'
import { markSeen, useIsNew } from '../utils/newMarks'

/** The gold NEW tag on the feature itself. It goes once the feature has been hovered — when the pointer
 *  leaves it, so it is seen while hovered (Sebastian, 2026-11-13: "the new work should disappear after
 *  hovered") — or tapped. `at` moves it off the corner where that would sit on the line above (the
 *  summary's lines, Cash Flow spacing, 2026-11-13). */
export function NewTag({ id, at = '-top-2 -right-3' }: { id: string; at?: string }) {
  const isNew = useIsNew(id)
  const tag = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const feature = tag.current?.parentElement
    if (!isNew || !feature) return
    const seen = () => markSeen(id)
    feature.addEventListener('pointerleave', seen)
    return () => feature.removeEventListener('pointerleave', seen)
  }, [id, isNew])
  if (!isNew) return null
  return (
    <span ref={tag} aria-label="New" className={'nm-pop print:hidden pointer-events-none absolute z-10 ' + at + ' px-[5px] py-px rounded-full bg-gold-400 text-ink-900 font-display text-[8px] leading-[11px] font-extrabold uppercase tracking-[0.06em] shadow-[0_0_0_2px_#fff]'}>
      New
    </span>
  )
}

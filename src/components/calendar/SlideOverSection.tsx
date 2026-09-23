import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface SlideOverSectionProps {
  title: string
  summary?: string
  defaultOpen?: boolean
  /**
   * Hide the one-line summary while the block is open. Used where the content
   * repeats it (the Payment block: its rows already carry the figures), so the
   * same numbers are never said twice on screen.
   */
  hideSummaryWhenOpen?: boolean
  /**
   * The content is always shown on a wide screen (the booking panel's money box
   * sits in its own right-hand column there, so it pushes nothing down), while
   * staying a normal collapsed block on a narrow one.
   */
  forceOpenOnDesktop?: boolean
  children: React.ReactNode
}

// A collapsed-by-default block for the booking slide-over. Progressive
// disclosure keeps the panel short: staff open only what they need. Separated by
// hairlines rather than nested cards so the money card stays the one focal box.
export function SlideOverSection({ title, summary, defaultOpen = false, hideSummaryWhenOpen = false, forceOpenOnDesktop = false, children }: SlideOverSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const bodyClass = 'pb-4' + (open ? '' : ' hidden md:block')
  return (
    <section className={'border-t border-soft' + (forceOpenOnDesktop ? ' md:border-t-0' : '')}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={'w-full flex items-center justify-between gap-3 py-3 text-left cursor-pointer' + (forceOpenOnDesktop ? ' md:hidden' : '')}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{title}</span>
          {summary && !(open && hideSummaryWhenOpen) && (
            <span className="block text-[11px] text-muted truncate mt-0.5">{summary}</span>
          )}
        </span>
        <ChevronDown className={'w-4 h-4 text-muted shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {(open || forceOpenOnDesktop) && <div className={bodyClass}>{children}</div>}
    </section>
  )
}

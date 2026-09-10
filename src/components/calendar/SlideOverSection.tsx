import React, { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface SlideOverSectionProps {
  title: string
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

// A collapsed-by-default block for the booking slide-over. Progressive
// disclosure keeps the panel short: staff open only what they need. Separated by
// hairlines rather than nested cards so the money card stays the one focal box.
export function SlideOverSection({ title, summary, defaultOpen = false, children }: SlideOverSectionProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="border-t border-soft">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 py-3 text-left cursor-pointer"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">{title}</span>
          {summary && <span className="block text-[11px] text-muted truncate mt-0.5">{summary}</span>}
        </span>
        <ChevronDown className={'w-4 h-4 text-muted shrink-0 transition-transform ' + (open ? 'rotate-180' : '')} />
      </button>
      {open && <div className="pb-4">{children}</div>}
    </section>
  )
}

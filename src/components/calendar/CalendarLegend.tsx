import React from 'react'

// The key to the calendar: what a pill's colour means — the stage of the stay (the
// staff's feedback, 2026-10-04). A pill already says who, IN or OUT, and what is still
// to pay in words, so this is all that is left to explain. It used to be a rail down the
// left of the grid listing nine "booked from" colours and four payment dots; four words
// fit on the Today line instead, and the grid gets the rail's width back.
export function CalendarLegend() {
  return (
    <div className="hidden md:flex items-center gap-3.5 text-[13px] text-muted">
      <LegendSwatch className="bg-card border-paper-400" label="Not arrived" />
      <LegendSwatch className="bg-gold-100 border-gold-500" label="In the hotel" />
      <LegendSwatch className="bg-ink-100 border-ink-200" label="Checked out" />
      <LegendSwatch className="bg-paper-200 border-paper-300" label="Blocked" />
    </div>
  )
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={'w-3.5 h-3.5 rounded border shrink-0 ' + className} />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  )
}

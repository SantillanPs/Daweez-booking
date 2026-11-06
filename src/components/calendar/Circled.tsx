import React from 'react'

/** What the calendar picked for one room or venue: its dates, and which kind of place it is. */
export interface Sel { checkIn: string; checkOut: string; type: 'room' | 'venue' }

/** Circled by hand on the paper — the hours taken, the receptionist on duty (`lo-circ`). */
export function Circled({ on, onClick, className, children }: { on: boolean; onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={'lo-circ relative min-h-11 px-3.5 py-2 text-center leading-tight cursor-pointer active:scale-[0.96] transition-transform ' + (className || '')}>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true" className="absolute -inset-[3px] w-[calc(100%+6px)] h-[calc(100%+6px)] overflow-visible text-gold-400" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M52 3C82 2 98 15 97 31C96 49 70 58 46 57C19 56 2 46 3 29C4 12 28 4 62 6" />
      </svg>
      {children}
    </button>
  )
}

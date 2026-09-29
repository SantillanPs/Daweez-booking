import React from 'react'

export interface SegmentOption<T extends string> {
  key: T
  label: string
  /** Shown on hover — for the words that would not fit on the row. */
  hint?: string
}

/**
 * The joined one-line chooser the booking form uses three times — the staff discount,
 * the guest's payment plan and how the guest paid.
 *
 * The owner's 2026-09 design: **a choose-one control costs ONE ROW**, not a row per
 * option. The owner's **2026-09-29 layout fix** added the other half: it **fills the
 * width its label column leaves**. It used to size to its own text, so the discount,
 * the plan and the method each ended somewhere different and the block read as ragged
 * — *"it looks messy. everything is all over the place."*
 *
 * The cells **grow** from their own text (`grow`, basis `auto`) rather than being forced
 * to equal quarters, so the row shares both edges **and** a long label like
 * `Bank transfer` still fits instead of being clipped or wrapped.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label }: {
  options: SegmentOption<T>[]
  value: T
  onChange: (key: T) => void
  /** What this group chooses, for screen readers — the visible label sits beside it. */
  label: string
}) {
  return (
    <div role="group" aria-label={label}
      className="flex flex-1 min-w-0 border border-base-300 rounded-lg overflow-hidden bg-base-100">
      {options.map(o => (
        <button key={o.key} type="button" title={o.hint} aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={'grow px-2 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors border-l border-base-300 first:border-l-0 ' +
            (value === o.key ? 'bg-gold-400 text-ink-900' : 'text-base-content/70 hover:bg-base-200')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

import React from 'react'

export interface SegmentOption<T extends string> {
  key: T
  label: string
  /** Shown on hover — for the words that would not fit on the row. */
  hint?: string
}

/**
 * The joined one-line chooser the booking form uses twice — the staff discount and
 * the guest's payment plan.
 *
 * The owner's 2026-09 design: **a choose-one control costs ONE ROW**, not a row per
 * option, so the two cards sit side by side at the same slim height instead of one
 * carrying a band of empty white under its buttons. The two rows are deliberately the
 * same control, so they read as the same kind of choice.
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
      className="inline-flex border border-base-300 rounded-lg overflow-hidden shrink-0 bg-base-100">
      {options.map(o => (
        <button key={o.key} type="button" title={o.hint} aria-pressed={value === o.key}
          onClick={() => onChange(o.key)}
          className={'px-2.5 py-1 text-[11px] font-bold whitespace-nowrap cursor-pointer transition-colors border-l border-base-300 first:border-l-0 ' +
            (value === o.key ? 'bg-gold-400 text-ink-900' : 'text-base-content/70 hover:bg-base-200')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

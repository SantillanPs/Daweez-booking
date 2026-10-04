import React, { useRef } from 'react'

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
 *
 * **The design review, 2026-10-04:**
 * - The cells are **44px tall with 14px words**, the same height as the boxes. They were
 *   25px and 11px — the smallest things on the form, and they are the choices that decide
 *   the money.
 * - **One Tab stop, then the arrow keys**, the way a row of radio buttons works. Every
 *   cell used to be its own stop: thirteen presses of Tab to cross the money block.
 * - A row too narrow for its choices **wraps** instead of cutting the last one off (a
 *   fifth plan once read `Re`). The lines between cells are the gaps showing the group's
 *   own colour, so they are drawn the same on a second line.
 * - `invalid` turns the edge red: the mark for a choice the form is still waiting on.
 *
 * **The chosen cell is charcoal, not gold** (the staff's feedback on the form, 2026-10-04:
 * hard to read). Gold on the chosen cell made `None` on the discount row as loud as the
 * button that finishes the booking. Gold now means one thing on the form — press this —
 * and charcoal means this is chosen.
 */
export function SegmentedControl<T extends string>({ options, value, onChange, label, invalid = false }: {
  options: SegmentOption<T>[]
  value: T
  onChange: (key: T) => void
  /** What this group chooses, for screen readers — the visible label sits beside it. */
  label: string
  invalid?: boolean
}) {
  const cells = useRef<(HTMLButtonElement | null)[]>([])
  // Nothing picked yet (the `Paid by` row starts that way): Tab lands on the first cell.
  const picked = options.findIndex(o => o.key === value)
  const tabStop = picked === -1 ? 0 : picked

  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const step = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!step) return
    e.preventDefault()
    const next = (i + step + options.length) % options.length
    onChange(options[next].key)
    cells.current[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} aria-invalid={invalid || undefined}
      className={'flex flex-wrap w-full min-w-0 gap-px border rounded-md overflow-hidden ' +
        (invalid ? 'border-danger-500 bg-danger-200' : 'border-base-300 bg-base-300')}>
      {options.map((o, i) => (
        <button key={o.key} type="button" role="radio" title={o.hint} aria-checked={value === o.key}
          ref={el => { cells.current[i] = el }}
          tabIndex={i === tabStop ? 0 : -1}
          onClick={() => onChange(o.key)}
          onKeyDown={e => onKeyDown(e, i)}
          /* The focus ring is drawn INSIDE the cell: the group clips whatever leaves it. */
          className={'grow h-11 px-2 text-[14px] font-semibold whitespace-nowrap cursor-pointer transition-colors duration-150 focus-visible:-outline-offset-2 focus-visible:rounded-none ' +
            (value === o.key ? 'bg-ink-900 text-white' : 'bg-base-100 text-base-content hover:bg-base-200 active:bg-base-300')}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

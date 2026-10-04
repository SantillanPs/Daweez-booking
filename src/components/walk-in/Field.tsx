import React from 'react'
import { LABEL } from './formStyles'

/**
 * A box, or a row of choices, with its label **above** it and what is wrong with it
 * **below** it.
 *
 * The label used to sit to the left, in a column of its own. On a wide form that left a
 * band of empty surface between every label and its box, and the eye had to cross it on
 * every row; above the box, the two read as one thing.
 *
 * `group` is for a row of buttons. A `<label>` wrapped round several buttons hands a
 * press on its words to the first of them — tapping `Paid by` would have chosen Cash —
 * so a group is a plain block with its words beside it.
 */
export function Field({ label, required = false, error = '', group = false, className = '', children }: {
  label: string
  /** The red star: a box the form cannot finish without. */
  required?: boolean
  error?: string
  group?: boolean
  className?: string
  children: React.ReactNode
}) {
  const words = (
    <span className={LABEL + ' mb-1.5'}>
      {label}{required && <span className="text-danger-600"> *</span>}
    </span>
  )
  const problem = error
    ? <span role="alert" className="block mt-1.5 text-[13px] font-medium text-danger-600">{error}</span>
    : null

  return group ? (
    <div className={className}>{words}{children}{problem}</div>
  ) : (
    <label className={'block ' + className}>{words}{children}{problem}</label>
  )
}

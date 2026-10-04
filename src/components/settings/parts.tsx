import React from 'react'
import { NumInput } from '../NumInput'
import { Field } from '../walk-in/Field'
import { FIELD, GROUP_TITLE } from '../walk-in/formStyles'

/**
 * The Settings screens' parts and rows, written once.
 *
 * Settings was drawn as cards inside a tinted page, with figures in 9–12px type and
 * 28px boxes on a tinted fill that read as switched off. The owner's taste, said of the
 * booking form (2026-10-04): *"I don't like the boxes design. I prefer a more 2d, clean,
 * minimalistic, simple, yet professional look."* So Settings is one white sheet: a part
 * is a name over its boxes, the only outlines are the boxes a person types in, and those
 * boxes are the booking form's own (`formStyles.ts`) — one height, nothing under 13px.
 */

/** A part of a Settings screen: its name, then what it holds. */
export function Section({ title, fact, children }: {
  title: string
  /** One plain line under the name — only where it stops a money mistake. */
  fact?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h3 className={GROUP_TITLE}>{title}</h3>
      {fact && <p className="mt-1 text-[13px] text-muted">{fact}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** A smaller name inside a part — Overnight, Short stay, GCash. */
export function SubHead({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[14px] font-semibold text-main">{children}</p>
}

/**
 * Boxes side by side, each with its label above it (`Field`) — the booking form's rule,
 * for its reason: a label out to the left leaves a band of empty sheet the eye has to
 * cross on every row. The boxes line up along the foot of a row even when one label
 * runs to two lines.
 */
export function FieldGrid({ cols = 2, children }: { cols?: 2 | 3; children: React.ReactNode }) {
  return (
    <div className={cols === 3 ? 'grid grid-cols-3 gap-x-3 gap-y-3 items-end' : 'grid grid-cols-2 gap-x-4 gap-y-3 items-end'}>
      {children}
    </div>
  )
}

/**
 * The box a figure is typed in: the unit at one end and the number at the other. A box
 * holding nothing says what nothing means ("Not sold", "None") in place of the unit, so
 * the rule is read where it applies and needs no footnote.
 */
export function FigureBox({ unit = '₱', value, onChange, placeholder, label }: {
  unit?: string
  value: number
  onChange: (v: number) => void
  /** What an empty (zero) box says. */
  placeholder?: string
  /** For a box with no words above it. */
  label?: string
}) {
  return (
    <span className="relative block">
      <NumInput value={value} onChange={onChange} placeholder={placeholder} aria-label={label}
        className={'peer ' + FIELD + ' text-right tabular-nums'} />
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-medium text-muted peer-placeholder-shown:opacity-0">
        {unit}
      </span>
    </span>
  )
}

/** One figure: its label above its box. */
export function Figure({ label, ...box }: {
  label: string
  unit?: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
}) {
  return <Field label={label}><FigureBox {...box} /></Field>
}

/** A time of day, in the same box. */
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <input type="time" value={value} onChange={e => onChange(e.target.value)} className={FIELD + ' tabular-nums'} />
    </Field>
  )
}

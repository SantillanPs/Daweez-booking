import React, { useId } from 'react'
import { NATIONALITIES } from '../utils/nationalities'

/**
 * The Nationality box: every nationality to pick from, found by typing (Sebastian,
 * 2026-10-05). It is the browser's own pick-as-you-type list, the same kind the
 * Receptionist box uses for the names typed before — so it opens the list on a tap, narrows
 * it with each letter, and works the same on the PC, a tablet and a phone.
 *
 * It still takes anything typed: a nationality the list does not have must never stop a
 * booking. What is stored is in capitals, like every other word on the form.
 */
export function NationalityInput({ value, onChange, className, placeholder, 'aria-label': label }: {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  'aria-label'?: string
}) {
  const list = useId()
  return (
    <>
      <input type="text" list={list} autoComplete="off" value={value} placeholder={placeholder} aria-label={label}
        onChange={e => onChange(e.target.value.toUpperCase())} className={className} />
      <datalist id={list}>
        {NATIONALITIES.map(n => <option key={n} value={n} />)}
      </datalist>
    </>
  )
}

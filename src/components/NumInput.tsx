import React, { useState } from 'react'

interface NumInputProps {
  value: number
  onChange: (n: number) => void
  className?: string
  placeholder?: string
  min?: number
  disabled?: boolean
  allowDecimal?: boolean
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  'aria-label'?: string
  title?: string
}

// A number/money box that types freely (like a text box) instead of the OS
// number spinner, so Backspace actually clears it and it never snaps back to 0.
// It still reports a clean number to the caller via onChange.
export function NumInput({ value, onChange, className, placeholder = '0', min = 0, disabled, allowDecimal = true, onFocus, onKeyDown, ...rest }: NumInputProps) {
  const [text, setText] = useState(value ? String(value) : '')
  // Re-sync the displayed text when the value changes from outside (a reset, an
  // edit loading, a minus/plus button). Adjusted DURING RENDER, not in an effect:
  // the effect version re-rendered twice for every outside change.
  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setText(value ? String(value) : '')
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let s = e.target.value
    if (allowDecimal) {
      s = s.replace(/[^0-9.]/g, '')
      const i = s.indexOf('.')
      if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
    } else {
      s = s.replace(/[^0-9]/g, '')
    }
    setText(s)
    const num = s === '' ? 0 : parseFloat(s)
    onChange(Math.max(min, Number.isNaN(num) ? 0 : num))
  }

  return (
    <input
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder={placeholder}
      onChange={handleChange}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      disabled={disabled}
      className={className}
      {...rest}
    />
  )
}

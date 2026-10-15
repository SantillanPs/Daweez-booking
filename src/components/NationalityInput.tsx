import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { NATIONALITIES } from '../utils/nationalities'
import { Seal } from './walk-in/Seal'

const ROW = 40 // px — every row is the same height, so the gold row can slide to any of them
const LIST = NATIONALITIES.map(n => n.toUpperCase())

/**
 * The Nationality box: every nationality to pick from, found by typing (Sebastian,
 * 2026-10-05). **It is the app's own list, not the browser's** (Sebastian, 2026-10-16,
 * from the pickers mock: the browser's list had a black ring, a ▼ and blue rows that
 * belonged to no screen of ours — *"I really don't like how they feel"*). It opens on a
 * tap, narrows with each letter (the letters typed show in brown), the arrow keys slide a
 * gold row through it, and a nationality picked from it draws a green tick.
 *
 * Filipino leads, marked as most guests'. It still takes anything typed: a nationality the
 * list does not have must never stop a booking. What is stored is in capitals, like every
 * other word on the form.
 *
 * The list hangs from the box in a layer of its own (a portal), so a form column that
 * scrolls can never clip it; it opens upwards when the box is near the bottom of the screen.
 */
export function NationalityInput({ value, onChange, className, placeholder, 'aria-label': label }: {
  value: string
  onChange: (value: string) => void
  className?: string
  placeholder?: string
  'aria-label'?: string
}) {
  const id = useId()
  const box = useRef<HTMLInputElement>(null)
  const rows = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState(0)
  const [place, setPlace] = useState<{ l: number; w: number; t?: number; b?: number } | null>(null)

  const q = value.trim().toUpperCase()
  const known = LIST.includes(q)
  // Typed letters first match where a word starts with them, then anywhere in it.
  const shown = !q || known ? LIST : LIST.filter(n => n.includes(q)).sort((a, b) => a.indexOf(q) - b.indexOf(q))
  const lead = !q || known // Filipino stands apart, over a line, only when the whole list shows
  const active = Math.min(at, shown.length - 1)

  const measure = () => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const below = window.innerHeight - r.bottom
    setPlace(below < 260 && r.top > below
      ? { l: r.left, w: r.width, b: window.innerHeight - r.top + 6 }
      : { l: r.left, w: r.width, t: r.bottom + 6 })
  }
  useLayoutEffect(() => { if (open) measure() }, [open])
  useEffect(() => {
    if (!open) return
    // The form scrolls and the window resizes under an open list; it follows its box.
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('scroll', measure, true); window.removeEventListener('resize', measure) }
  }, [open])
  useEffect(() => {
    rows.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, open])

  const pick = (n: string) => { onChange(n); setOpen(false) }
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setAt(Math.min(active + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setAt(Math.max(active - 1, 0)) }
    else if (e.key === 'Enter' && open && shown[active]) { e.preventDefault(); pick(shown[active]) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
  }
  // Where the gold row sits: one row per name, plus the line under Filipino.
  const y = active * ROW + (lead && active > 0 ? 9 : 0)

  return (
    <span className="relative block min-w-0">
      <input type="text" ref={box} role="combobox" aria-expanded={open} aria-controls={id} aria-autocomplete="list"
        autoComplete="off" value={value} placeholder={placeholder} aria-label={label}
        onFocus={() => { setAt(0); setOpen(true) }}
        onBlur={() => setOpen(false)}
        onKeyDown={keys}
        onChange={e => { onChange(e.target.value.toUpperCase()); setAt(0); setOpen(true) }}
        // Always the full width of its wrapper: in a companion's row it was given no width of
        // its own and ran under the Sex box beside it.
        className={className + ' w-full' + (known ? ' pr-16' : ' pr-10')} />
      {known && <span className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none"><Seal key={q} /></span>}
      <ChevronDown aria-hidden="true" className={'absolute right-3 top-1/2 -mt-2 w-4 h-4 pointer-events-none transition-[transform,color] duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] ' + (open ? 'rotate-180 text-brand-text' : 'text-muted')} />

      {open && place && createPortal(
        <div id={id} role="listbox" ref={rows}
          style={{ '--l': place.l + 'px', '--w': place.w + 'px', '--t': (place.t ?? 0) + 'px', '--b': (place.b ?? 0) + 'px' } as React.CSSProperties}
          onMouseDown={e => e.preventDefault()}
          className={'bk-list fixed z-[70] left-[var(--l)] w-[var(--w)] min-w-[200px] max-h-[248px] overflow-y-auto bg-card border border-soft rounded-lg shadow-softLg p-1.5 font-sans ' +
            (place.b !== undefined ? 'bottom-[var(--b)] origin-bottom' : 'top-[var(--t)] origin-top')}>
          {shown.length === 0 ? (
            <p className="px-2.5 py-2 text-[14px] text-muted">Keep <b className="font-semibold text-main">{q}</b> as typed</p>
          ) : (
            <div className="relative">
              <span aria-hidden="true" style={{ '--y': y + 'px' } as React.CSSProperties}
                className="bk-hi absolute inset-x-0 top-0 h-10 rounded-md bg-gold-100 pointer-events-none [transform:translateY(var(--y))]" />
              {shown.map((n, i) => {
                const k = q && !known ? n.indexOf(q) : -1
                return (
                  <React.Fragment key={n}>
                    {lead && i === 1 && <div className="h-px bg-soft mx-1.5 my-1" />}
                    <div role="option" aria-selected={i === active} data-i={i}
                      style={{ '--i': Math.min(i, 6) } as React.CSSProperties}
                      onMouseMove={() => { if (i !== active) setAt(i) }}
                      onClick={() => pick(n)}
                      className="bk-row relative flex items-center gap-2 h-10 px-2.5 rounded-md text-[15px] font-medium text-main cursor-pointer">
                      <span className="truncate">
                        {k < 0 ? n : <>{n.slice(0, k)}<b className="font-bold text-brand-text">{n.slice(k, k + q.length)}</b>{n.slice(k + q.length)}</>}
                      </span>
                      {lead && i === 0 && <small className="ml-auto text-[12px] font-normal text-muted shrink-0">most guests</small>}
                      {n === q && <Check aria-hidden="true" className="ml-auto w-4 h-4 text-brand-text shrink-0" />}
                    </div>
                  </React.Fragment>
                )
              })}
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  )
}

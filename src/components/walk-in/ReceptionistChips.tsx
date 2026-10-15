import React, { useState } from 'react'
import { Plus } from 'lucide-react'

/**
 * Who took the booking, as **the names used before, one chip each** (Sebastian,
 * 2026-10-16, from the pickers mock — the box with the browser's own list *"I really don't
 * like how they feel"*). The desk only ever picks from a few names, so one tap does it, and
 * the same person is never written two different ways (card k136). The name on the last
 * booking made on this computer is already gold.
 *
 * "Someone else" opens a box in the row for a name not seen before; it becomes a chip when
 * it is kept. With no names yet the box is simply open.
 */
export function ReceptionistChips({ names, value, onChange }: {
  /** The names used before, most used first. */
  names: string[]
  value: string
  onChange: (name: string) => void
}) {
  const [typing, setTyping] = useState(false)
  const [draft, setDraft] = useState('')
  const chosen = value.trim()
  // The name already on the booking is always a chip, even when it is new to the list.
  const chips = chosen && !names.includes(chosen) ? [...names, chosen] : names
  const keep = () => {
    const v = draft.trim().toUpperCase()
    if (v) onChange(v)
    setDraft('')
    setTyping(false)
  }
  const box = typing || chips.length === 0

  return (
    <div role="radiogroup" aria-label="Who took this booking — it prints on the bill and the receipt" className="flex flex-wrap gap-2">
      {chips.map(n => {
        const on = n === chosen
        return (
          <button key={n} type="button" role="radio" aria-checked={on} onClick={() => onChange(n)}
            className={'h-10 pl-1.5 pr-3.5 rounded-full border inline-flex items-center gap-2 text-[14px] font-semibold text-main cursor-pointer transition-[background-color,border-color,transform] duration-200 active:scale-95 ' +
              (on ? 'bk-chip bg-gold-400 border-gold-400' : 'bg-card border-soft hover:bg-gold-100')}>
            <span aria-hidden="true" className={'w-7 h-7 rounded-full grid place-items-center text-[12px] font-bold ' + (on ? 'bg-ink-900 text-white' : 'bg-softbg text-muted')}>{n[0]}</span>
            {n}
          </button>
        )
      })}
      {box ? (
        <span className="bp-up !inline-flex items-center h-10 px-3.5 rounded-full border border-gold-500 ring-2 ring-gold-400/30 bg-card">
          <input autoFocus={typing} value={draft} placeholder="Name" aria-label="Who took this booking"
            onChange={e => setDraft(e.target.value.toUpperCase())}
            onBlur={keep}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); keep() }
              if (e.key === 'Escape') { e.stopPropagation(); setDraft(''); setTyping(false) }
            }}
            className="w-32 bg-transparent border-0 outline-none text-[14px] font-semibold text-main placeholder:font-normal placeholder:text-muted" />
        </span>
      ) : (
        <button type="button" onClick={() => setTyping(true)}
          className="h-10 px-3.5 rounded-full border border-dashed border-gold-500 inline-flex items-center gap-1.5 text-[14px] font-semibold text-brand-text cursor-pointer hover:bg-gold-100 transition-colors active:scale-95">
          <Plus aria-hidden="true" className="w-4 h-4" /> Someone else
        </button>
      )}
    </div>
  )
}

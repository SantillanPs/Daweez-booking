import React, { useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Landmark, Plus, Search, X } from 'lucide-react'
import { getInstitutions, insertInstitution, Institution } from '../../utils/institutions'
import { showToast } from '../../utils/toast'

/**
 * The guest's institution, inside the guest card — the owner's note of 2026-10-20 ("add
 * institution to the booking form, optional and hidden like the agency"), built as option B
 * of the mock: a saved list, drawn and behaving like the agency line (AgencyFields). An
 * institution changes no price and bills nobody; its name is printed on the guest's bill.
 *
 * `＋ New institution` lives only on the "No saved institution" line, the agency's rule. It
 * needs no profile window: the name is all that is kept, so it is picked at once and saved
 * behind (the owner's instant-buttons rule), and taken back if the save fails.
 */
export function InstitutionFields({ value, picking, setPicking, onChange, onRemove }: {
  value: string
  picking: boolean
  setPicking: (v: boolean) => void
  onChange: (name: string) => void
  onRemove: () => void
}) {
  const queryClient = useQueryClient()
  const { data: saved = [] } = useQuery({ queryKey: ['institutions'], queryFn: getInstitutions })
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typed = query.trim()

  React.useEffect(() => {
    if (picking) inputRef.current?.focus()
  }, [picking])

  // Closed with nothing chosen, the line goes as if it was never added.
  const close = () => { setQuery(''); if (value) setPicking(false); else onRemove() }
  const closeRef = useRef(close)
  React.useLayoutEffect(() => { closeRef.current = close })

  React.useEffect(() => {
    if (!picking) return
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) closeRef.current()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [picking])

  const matches = useMemo(() => {
    const q = typed.toLowerCase()
    return q ? saved.filter(i => i.name.toLowerCase().includes(q)) : saved
  }, [saved, typed])

  const pick = (name: string) => {
    onChange(name)
    setPicking(false)
    setQuery('')
  }

  const create = () => {
    const name = typed.toUpperCase()
    const temp: Institution = { id: 'new-' + name, name }
    queryClient.setQueryData<Institution[]>(['institutions'], list =>
      [...(list || []), temp].sort((a, b) => a.name.localeCompare(b.name)))
    pick(name)
    insertInstitution(name)
      .then(() => queryClient.invalidateQueries({ queryKey: ['institutions'] }))
      .catch(() => {
        queryClient.setQueryData<Institution[]>(['institutions'], list => (list || []).filter(i => i.id !== temp.id))
        showToast(name + ' was not saved to the list. It is still on this booking.', 'error')
      })
  }

  // ── Chosen: one line above the guest's name ──
  if (!picking && value) {
    return (
      <div className="bk-pop flex items-center gap-2 h-11 border border-soft rounded-md px-3">
        <Landmark className="w-3.5 h-3.5 text-brand-text shrink-0" />
        <span className="text-sm font-bold text-main truncate">{value}</span>
        <button type="button" onClick={() => { setPicking(true); setQuery('') }}
          className="ml-auto text-xs font-bold text-brand-text hover:underline cursor-pointer shrink-0">Change</button>
        <button type="button" onClick={onRemove} title="Remove the institution" aria-label="Remove the institution"
          className="w-8 h-8 -mr-2 inline-flex items-center justify-center text-muted hover:text-main cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>
    )
  }

  // ── Choosing ──
  return (
    <div className="relative animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none" ref={boxRef}>
      <div className="flex items-center gap-2 h-11 border border-soft rounded-md px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-gold-500 focus-within:ring-2 focus-within:ring-gold-400/30">
        <Landmark className="w-3.5 h-3.5 text-brand-text shrink-0" />
        <Search className={typed ? 'w-3.5 h-3.5 text-brand-text shrink-0' : 'w-3.5 h-3.5 text-muted shrink-0'} />
        <input autoFocus ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') close()
            if (e.key === 'Enter') { e.preventDefault(); if (matches.length === 1) pick(matches[0].name) }
          }}
          placeholder="Institution…"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-[16px] sm:text-sm font-medium text-main placeholder:font-normal placeholder:text-muted" />
        <button type="button" onClick={close} title="Cancel" aria-label="Cancel"
          className="text-muted hover:text-main cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>

      {focused && matches.length > 0 && (
        <div className="bk-pop origin-top absolute left-0 right-0 top-full z-30 mt-1 bg-card border border-soft rounded-md shadow-softLg overflow-hidden"
          onMouseDown={e => e.preventDefault()}>
          <div className="max-h-[170px] overflow-y-auto">
            {matches.map(i => (
              <button key={i.id} type="button" onClick={() => pick(i.name)}
                className="w-full text-left px-3 py-2 text-[13px] font-semibold text-main truncate cursor-pointer hover:bg-gold-100 border-b border-soft last:border-b-0">
                {i.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {focused && matches.length === 0 && (
        <div className="bk-pop origin-top absolute left-0 right-0 top-full z-30 mt-1 bg-card border border-soft rounded-md shadow-softLg px-3 py-2 flex items-center gap-2"
          onMouseDown={e => e.preventDefault()}>
          <span className="text-xs text-muted">No saved institution</span>
          {typed && (
            <button type="button" onClick={create}
              className="ml-auto inline-flex items-center gap-1 rounded-sm bg-gold-400 text-ink-900 px-3 h-8 text-xs font-bold cursor-pointer transition-transform duration-150 active:scale-95">
              <Plus className="w-3 h-3" /> New institution
            </button>
          )}
        </div>
      )}
    </div>
  )
}

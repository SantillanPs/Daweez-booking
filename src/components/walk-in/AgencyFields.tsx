import React, { useMemo, useRef, useState } from 'react'
import { Building2, Plus, Search, X } from 'lucide-react'
import { PartnerDeal } from '../../types/booking'
import { AgencyValues } from './agencyValues'
import { useDashboardData } from '../DashboardContext'

/**
 * The agency, **inside the guest card** (the owner's design, 2026-09).
 *
 * The owner's rule for the whole feature: an agency booking IS a normal booking — the
 * agency's employee walks in and books rooms for a named guest — so nothing here is a form
 * of its own. The desk opens it from the **⋯ on the Guest Information card**, and what it
 * adds is one line: **`BILL TO <agency>`**, above the guest's name, plus a small print line
 * with the agency's address, contact and TIN. On the bill that becomes the `COMPANY` line
 * over `NAME OF GUEST: c/o …`.
 *
 * The line's behaviour is the owner's own, settled over three drawings: **empty means
 * nothing to read and nothing listed** — three marks only (a building for whose bill it is,
 * a glass for search, an ✕ to cancel); **typing lists every profile whose name CONTAINS what
 * was typed**, with no ranking rules to remember; and **`＋ New agency` appears only on the
 * “No saved agency” line**, which is where he said he wanted it — never as a permanent
 * button. That button opens the agency's own profile ([AgencyProfileForm](./AgencyProfileForm.tsx))
 * so its details and its per-room prices are set in one place.
 *
 * The line is drawn as one of the form's own boxes — the same height, edge and corner as
 * Name under it (2026-10-04, when the form went flat). It was a gold-tinted box with a
 * dashed edge, and the search box inside it drew a second edge of its own when the
 * cursor was in it: a box in a box.
 */
export function AgencyFields({ value, picking, setPicking, onChange, onOpenProfile, onRemove }: {
  value: AgencyValues
  /** True while the desk is choosing — the form owns this so the ⋯ can open it too. */
  picking: boolean
  setPicking: (v: boolean) => void
  /** A saved agency was chosen (or the picker was cleared). */
  onChange: (v: AgencyValues) => void
  /** Create/edit the agency's profile — the form owns that panel. */
  onOpenProfile: (deal: PartnerDeal | null, draftName: string) => void
  onRemove: () => void
}) {
  const { partnerDeals } = useDashboardData()
  const [query, setQuery] = useState('')
  /**
   * Is the cursor in the search box? The list is drawn **only while it is** (the owner's
   * ruling, 2026-09: *“if it's not being clicked, like the cursor isn't in the input field,
   * then the agencies should be hidden”*). It starts true because the box autofocuses when
   * the picker opens.
   */
  const [focused, setFocused] = useState(true)
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const typed = query.trim()

  // Whenever the picker is open the cursor belongs in the search box — that is what makes
  // the list appear (see `focused` above), including when the picker reopens after the
  // agency profile panel was closed.
  React.useEffect(() => {
    if (picking) inputRef.current?.focus()
  }, [picking])

  React.useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      // A click outside closes the picker — the matches float OVER the form, so they must
      // not stay open behind whatever the desk does next.
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setPicking(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [setPicking])

  /**
   * Clicking the box lists the saved agencies; typing narrows them to the names that
   * CONTAIN the word (the owner's ruling, 2026-09). Nothing is listed while the box is
   * closed — the list only exists while the desk is choosing.
   */
  const matches = useMemo(() => {
    const q = typed.toLowerCase()
    const sorted = [...partnerDeals].sort((a, b) => a.name.localeCompare(b.name))
    return q ? sorted.filter(d => d.name.toLowerCase().includes(q)) : sorted
  }, [partnerDeals, typed])

  const pick = (deal: PartnerDeal) => {
    onChange({
      dealId: deal.id,
      name: deal.name,
      address: deal.address || '',
      contact: deal.contact_no || '',
      tin: deal.tin || '',
      plate: deal.vehicle_plate || '',
    })
    setPicking(false)
    setQuery('')
  }

  // ── Chosen: ONE line, above the guest's name ─────────────────────────────────
  if (!picking && value.name) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2 h-11 border border-base-300 rounded-md px-3">
          <Building2 className="w-3.5 h-3.5 text-brand-text shrink-0" />
          <span className="text-sm font-bold text-main truncate">{value.name}</span>
          <button type="button" onClick={() => { setPicking(true); setQuery('') }}
            className="ml-auto text-xs font-bold text-brand-text hover:underline cursor-pointer shrink-0">Change</button>
        </div>
        {(value.address || value.contact || value.tin) && (
          <p className="text-xs text-base-content/70">
            {[value.address, value.contact, value.tin && 'TIN ' + value.tin].filter(Boolean).join(' · ')}
            {' '}
            <button type="button" onClick={onRemove} className="font-bold text-brand-text hover:underline cursor-pointer">Remove the agency</button>
          </p>
        )}
      </div>
    )
  }

  // ── Choosing: three marks on one line, everything else floats OVER the fields ──
  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-2 h-11 border border-base-300 rounded-md px-3 transition-[border-color,box-shadow] duration-200 focus-within:border-ink-900 focus-within:ring-2 focus-within:ring-gold-400/40">
        <Building2 className="w-3.5 h-3.5 text-brand-text shrink-0" />
        <Search className={typed ? 'w-3.5 h-3.5 text-brand-text shrink-0' : 'w-3.5 h-3.5 text-muted shrink-0'} />
        <input autoFocus ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => { if (e.key === 'Escape') { setPicking(false); setQuery('') } }}
          placeholder="Agency…"
          className="flex-1 min-w-0 bg-transparent border-0 outline-none focus-visible:outline-none text-sm font-medium text-main placeholder:font-normal placeholder:text-muted" />
        <button type="button" onClick={() => { setPicking(false); setQuery('') }} title="Cancel"
          aria-label="Cancel"
          className="text-muted hover:text-main cursor-pointer shrink-0"><X className="w-3.5 h-3.5" /></button>
      </div>

      {/* The list hovers OVER the form — it takes no room in the card. It is about FIVE
          ROWS TALL and scrolls for the rest, so it never grows down over the guest's own
          fields however many agencies are saved (the owner, 2026-09). It is shown ONLY
          while the cursor is in the search box; `onMouseDown` is swallowed so tapping a row
          does not blur the box and yank the list away before the tap lands. */}
      {focused && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 bg-base-100 border border-base-300 rounded-sm shadow-lg overflow-hidden"
          onMouseDown={e => e.preventDefault()}>
          <div className="max-h-[170px] overflow-y-auto">
            {matches.map(d => (
              <button key={d.id} type="button" onClick={() => pick(d)}
                className="w-full text-left px-3 py-2 text-[13px] flex items-center gap-2 cursor-pointer hover:bg-base-200 border-b border-base-200 last:border-b-0">
                <span className="truncate font-semibold text-main">{d.name}</span>
                <span className="ml-auto text-xs text-muted shrink-0">{d.address || d.type}</span>
              </button>
            ))}
          </div>
          {matches.length > 5 && (
            <p className="px-3 py-1 text-xs text-muted border-t border-base-200">
              {matches.length} saved · scroll for the rest
            </p>
          )}
        </div>
      )}

      {/* Nothing matched — and this is the ONLY place the New agency button lives. */}
      {focused && matches.length === 0 && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 bg-base-100 border border-base-300 rounded-sm shadow-lg px-3 py-2 flex items-center gap-2"
          onMouseDown={e => e.preventDefault()}>
          <span className="text-xs text-base-content/70">No saved agency</span>
          <button type="button" onClick={() => onOpenProfile(null, typed)}
            className="ml-auto inline-flex items-center gap-1 rounded-sm bg-primary text-primary-content px-3 h-8 text-xs font-bold cursor-pointer">
            <Plus className="w-3 h-3" /> New agency
          </button>
        </div>
      )}
    </div>
  )
}

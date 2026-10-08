import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ConciergeBell, Flame, Plus } from 'lucide-react'
import { Field } from '../walk-in/Field'
import { FIELD } from '../walk-in/formStyles'
import { Served } from './served'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

// ponytail: twelve numbered tables, fixed. Any other table ("Bar") goes through "Other".
// Move the count to app_settings if the restaurant asks for more squares.
const TABLES = 12

/** Where a person's food has got to: not given to the kitchen, cooking, cooked and waiting. */
export type KitchenCounts = Record<string, { fresh: number; cooking: number; ready: number }>

/** Which numbered square a table sits in, or 0 for a room's slip or a table with a name. */
const squareOf = (p: Served): number => {
  if (p.booking) return 0
  const n = Number(/^Table (\d+)$/.exec(p.name)?.[1] || 0)
  return n >= 1 && n <= TABLES ? n : 0
}

/**
 * The slip's title, and the way to the tables (Sebastian, 2026-10-08: the menu and the
 * list stay on screen — *"the tables should be hidden"*). It says who is being served; a
 * tap opens `TablesPopup` just below it.
 *
 * **The green bell is the one thing a put-away table may still say:** how many dishes are
 * cooked and not yet carried out, on any table. Without it, food would sit waiting behind
 * a closed popup.
 */
export function TableButton({ label, ready, open, onOpen }: {
  label: string
  ready: number
  open: boolean
  /** Handed where the button is, so the popup can hang from it. */
  onOpen: (at: DOMRect) => void
}) {
  return (
    <button type="button" data-table-button aria-haspopup="dialog" aria-expanded={open}
      onClick={e => onOpen(e.currentTarget.getBoundingClientRect())}
      className={'min-w-0 inline-flex items-center gap-1.5 min-h-11 px-2.5 -ml-2.5 rounded-lg transition-colors duration-150 active:scale-[0.98] cursor-pointer ' + (open ? 'bg-gold-100' : 'hover:bg-gold-100')}>
      <span className="truncate font-display text-[19px] font-bold tracking-tight text-main leading-tight">{label}</span>
      <ChevronDown className={'w-4 h-4 shrink-0 text-muted transition-transform duration-300 ' + (open ? 'rotate-180' : '')} />
      {ready > 0 && (
        <span title={ready + ' ready to serve'}
          className="shrink-0 inline-flex items-center gap-1 h-[26px] pl-1.5 pr-2 rounded-full bg-emerald-700 text-white text-[13px] font-bold tabular-nums animate-in zoom-in-50 duration-300 motion-reduce:animate-none">
          <ConciergeBell className="w-3.5 h-3.5 tp-ring" />{ready}
        </span>
      )}
    </button>
  )
}

interface TablesPopupProps {
  /** The table button it hangs from. */
  anchor: DOMRect
  served: Served[]
  selectedKey: string | null
  /** What each person's open slip comes to, by `Served.key`. */
  totals: Record<string, number>
  kitchen: KitchenCounts
  /** A dish tapped with nobody picked: the popup asks which table it is for. */
  askFor?: string
  onPick: (person: Served) => void
  /** Starts a table. The popup closes at once; the slip is made behind it. */
  onStart: (table: string, name: string) => void
  onClose: () => void
}

const CELL = 'tp-cell relative h-[72px] min-w-0 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-[background-color,border-color,color,transform] duration-150 active:scale-95 cursor-pointer disabled:opacity-50 '
const FREE = 'group border border-dashed border-soft text-ink-500 hover:bg-gold-100 hover:border-gold-400 hover:text-gold-800 hover:-translate-y-0.5'
const NOTE = 'h-3.5 inline-flex items-center gap-1 text-[11.5px] font-semibold tabular-nums '

// The room itself: one square per table, free or not (Sebastian, 2026-10-08, after a
// dropdown and a window with a list — *"can you redesign the table popup?"*). A table
// keeps its own place, so a hand learns where table 7 is. One tap either switches to a
// table or starts it. It wears the calendar's colours: white while the order is taken,
// gold while the kitchen has it, and a green left edge when a dish is ready to serve.
//
// A room's slip (started from its booking's "Take orders") and a table with a name stand
// after the numbers; "Other" starts a table that has no number.
export function TablesPopup({ anchor, served, selectedKey, totals, kitchen, askFor, onPick, onStart, onClose }: TablesPopupProps) {
  const [other, setOther] = useState(false)
  const [table, setTable] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const start = (t: string, n: string) => {
    if (!t.trim()) { setError('Which table?'); return }
    onStart(t, n)
  }

  const open = (person: Served, big: React.ReactNode, i: number) => {
    const k = kitchen[person.key] || { fresh: 0, cooking: 0, ready: 0 }
    return (
      <button key={person.key} type="button" onClick={() => onPick(person)}
        title={[person.name, person.place].filter(Boolean).join(' · ')}
        style={{ '--i': i } as React.CSSProperties}
        className={CELL + 'border text-main hover:brightness-95 ' +
          (k.cooking + k.ready > 0 ? 'bg-gold-100 border-gold-500 ' : 'bg-card border-paper-400 ') +
          (k.ready > 0 ? 'border-l-[5px] border-l-emerald-700 ' : '') +
          (person.key === selectedKey ? 'ring-2 ring-ink-900' : '')}>
        {big}
        {k.ready > 0 ? <span className={NOTE + 'text-emerald-700'}><ConciergeBell className="w-3 h-3" />ready</span>
          : k.fresh > 0 ? <span className={NOTE + 'text-gold-800'}>not sent</span>
            : <span className={NOTE + (k.cooking > 0 ? 'text-gold-800' : 'text-muted')}>{k.cooking > 0 && <Flame className="w-3 h-3" />}{fmtPeso(totals[person.key] || 0)}</span>}
      </button>
    )
  }
  const NUMBER = 'font-display text-[20px] font-bold tracking-tight leading-none'

  // Below the button when it is in the top half of the screen (the slip beside the menu),
  // above it when it is at the foot (the order bar on a phone).
  const below = anchor.top < window.innerHeight * 0.55
  const rest = served.filter(p => squareOf(p) === 0)

  return createPortal(
    <div className="fixed inset-0 z-[70] font-sans" onClick={onClose}>
      <div role="dialog" aria-label="Tables" onClick={e => e.stopPropagation()}
        style={{ '--l': Math.max(16, Math.min(anchor.left, window.innerWidth - 364)) + 'px', '--y': (below ? anchor.bottom + 8 : window.innerHeight - anchor.top + 8) + 'px' } as React.CSSProperties}
        className={'absolute left-[var(--l)] w-[348px] max-w-[calc(100vw-32px)] max-h-[calc(100dvh-32px)] overflow-y-auto overscroll-contain flex flex-col gap-2.5 p-3.5 rounded-xl bg-card border border-gold-400 shadow-softLg animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none ' + (below ? 'top-[var(--y)] origin-top-left' : 'bottom-[var(--y)] origin-bottom-left')}>
        {askFor && <p className="px-0.5 font-display text-[15px] font-bold tracking-tight text-main">Which table is the {askFor} for?</p>}

        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: TABLES }, (_, i) => i + 1).map((n, i) => {
            const person = served.find(p => squareOf(p) === n)
            if (person) return open(person, <b className={NUMBER}>{n}</b>, i)
            return (
              <button key={n} type="button" onClick={() => start(String(n), '')}
                aria-label={'Start table ' + n} style={{ '--i': i } as React.CSSProperties} className={CELL + FREE}>
                <b className={NUMBER}>{n}</b>
                <span className={NOTE + 'opacity-0 translate-y-0.5 group-hover:opacity-100 group-hover:translate-y-0 transition-[opacity,transform] duration-150'}><Plus className="w-3 h-3" />start</span>
              </button>
            )
          })}
          {rest.map((person, i) => open(person,
            <b className={person.room !== undefined ? NUMBER : 'max-w-full px-1.5 truncate text-[13px] font-bold leading-none'}>
              {person.room !== undefined ? 'R' + person.room : person.name}
            </b>, TABLES + i))}
          <button type="button" onClick={() => { setOther(v => !v); setError('') }} aria-expanded={other}
            style={{ '--i': TABLES + rest.length } as React.CSSProperties} className={CELL + FREE}>
            <Plus className="w-5 h-5" />
            <span className={NOTE}>Other</span>
          </button>
        </div>

        {other && (
          <form onSubmit={e => { e.preventDefault(); start(table, name) }}
            className="flex flex-col gap-2.5 pt-1 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
            <Field label="Table">
              <input value={table} onChange={e => setTable(e.target.value)} autoFocus autoComplete="off" className={FIELD} />
            </Field>
            <Field label="Name (if they give one)">
              <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" className={FIELD} />
            </Field>
            <button type="submit"
              className="h-11 px-4 inline-flex items-center justify-center rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50">
              Start order
            </button>
          </form>
        )}
        {error && <p role="alert" className="text-[13px] font-medium text-danger-600">{error}</p>}
      </div>
    </div>,
    document.body,
  )
}

import React, { useState } from 'react'
import { Music, Plus, Utensils } from 'lucide-react'
import { Tab } from '../../types/tab'
import { Booking } from '../../types/booking'
import { Field } from '../walk-in/Field'
import { FIELD } from '../walk-in/formStyles'

const fmtPeso = (n: number) => '₱' + Number(n || 0).toLocaleString()

/** One person the desk is serving: a guest in a room, or a diner with no room. */
export interface Served {
  /** Stable: the slip, or the booking while it has no open slip. */
  key: string
  name: string
  place: string
  /** The open order slip, if there is one. */
  tab: Tab | null
  booking: Booking | null
  /** A room guest's room number — what the staff call them by. */
  room?: number
}

interface ServedStripProps {
  served: Served[]
  selectedKey: string | null
  /** What each person's open slip comes to, by `Served.key`. */
  totals: Record<string, number>
  busy: boolean
  loading: boolean
  onPick: (person: Served) => void
  /** Opens an order slip for a diner with no room. Returns the reason when it could not. */
  onOpenDiner: (name: string, table: string) => Promise<string>
}

const CHIP = 'inline-flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-lg border text-[14px] transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 animate-in fade-in slide-in-from-bottom-1 fill-mode-both motion-reduce:animate-none'
const BADGE = 'w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md font-display text-[13px] font-bold'

// Everyone the desk may charge, each with what their open order slip comes to: the
// diners at the tables first, then every guest in the hotel (the order the owner picked).
//
// **They sit on the page itself, and wrap** — they were a row inside a box that scrolled
// sideways, so with a full hotel some guests were off the edge. A room guest leads with
// the room number in the same gold tile the calendar gives a room, because that is what
// the staff call them by; a diner leads with a fork and knife. Sized for a finger: the
// staff tap this on a tablet in front of the guest.
export function ServedStrip({ served, selectedKey, totals, busy, loading, onPick, onOpenDiner }: ServedStripProps) {
  // The form stays hidden until a diner actually walks in.
  const [newDiner, setNewDiner] = useState(false)
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() && !table.trim()) { setError('Enter a name or a table.'); return }
    const failed = await onOpenDiner(name, table)
    if (failed) { setError(failed); return }
    setName(''); setTable(''); setError(''); setNewDiner(false)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Still reading: the shapes of what is coming, not a sentence about it. */}
        {loading && served.length === 0 && [0, 1, 2].map(i => (
          <span key={i} className="h-11 w-40 rounded-lg bg-softbg animate-pulse" />
        ))}

        {served.map((person, i) => {
          const on = person.key === selectedKey
          const total = totals[person.key] || 0
          return (
            <button
              key={person.key}
              type="button"
              disabled={busy}
              aria-pressed={on}
              onClick={() => { setNewDiner(false); onPick(person) }}
              title={person.place ? person.name + ' · ' + person.place : person.name}
              style={{ animationDelay: Math.min(i, 8) * 30 + 'ms' }}
              className={CHIP + ' ' + (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}
            >
              <span className={BADGE + ' ' + (on ? 'bg-ink-900/10 text-ink-900' : 'bg-gold-100 text-gold-800')}>
                {person.room ?? (person.booking ? <Music className="w-4 h-4" /> : <Utensils className="w-4 h-4" />)}
              </span>
              <span className="font-semibold">{person.name}</span>
              {/* A room is already named by its number; a table or a venue is named here. */}
              {person.place && person.room === undefined && (
                <span className={on ? 'text-ink-900/70' : 'text-muted'}>{person.place}</span>
              )}
              {total > 0 && (
                <span className={'font-bold tabular-nums ' + (on ? '' : 'text-brand-text')}>{fmtPeso(total)}</span>
              )}
            </button>
          )
        })}

        {!loading && served.length === 0 && <span className="text-[14px] text-muted mr-1">Nobody is in the hotel.</span>}

        <button
          type="button"
          onClick={() => { setNewDiner(v => !v); setError('') }}
          aria-expanded={newDiner}
          className="inline-flex items-center gap-1.5 h-11 px-3 rounded-lg border border-dashed border-soft text-[14px] font-semibold text-brand-text hover:border-gold-400 hover:bg-gold-100 transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Walk-in diner
        </button>
      </div>

      {newDiner && (
        <form onSubmit={open} className="flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
          <Field label="Name" className="w-full sm:w-56">
            <input value={name} onChange={e => setName(e.target.value)} autoFocus autoComplete="off" className={FIELD} />
          </Field>
          <Field label="Table" className="w-full sm:w-40">
            <input value={table} onChange={e => setTable(e.target.value)} autoComplete="off" className={FIELD} />
          </Field>
          <button type="submit" disabled={busy}
            className="h-11 px-4 inline-flex items-center gap-1.5 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold shadow-sm transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50">
            Open order slip
          </button>
          <button type="button" onClick={() => { setNewDiner(false); setError('') }}
            className="h-11 px-3 rounded-lg text-[14px] font-semibold text-main hover:bg-softbg transition-colors cursor-pointer">
            Cancel
          </button>
          {error && <p role="alert" className="basis-full text-[13px] font-medium text-danger-600">{error}</p>}
        </form>
      )}
    </div>
  )
}

import React, { useEffect, useRef, useState } from 'react'
import { ChefHat, Music, Plus, Utensils } from 'lucide-react'
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
  /**
   * Where each person's food has got to, by `Served.key`: how many dishes the kitchen has
   * not been given, how many it is still cooking, and how many are cooked and waiting to
   * be carried out.
   */
  kitchen?: Record<string, { fresh: number; cooking: number; ready: number }>
  busy: boolean
  loading: boolean
  onPick: (person: Served) => void
  /** Opens an order slip for a diner with no room. Returns the reason when it could not. */
  onOpenDiner: (name: string, table: string) => Promise<string>
}

const CHIP = 'shrink-0 inline-flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-lg border text-[14px] transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50 animate-in fade-in slide-in-from-bottom-1 fill-mode-both motion-reduce:animate-none'
const BADGE = 'w-8 h-8 shrink-0 inline-flex items-center justify-center rounded-md font-display text-[13px] font-bold'

// The tables with an order open, each with what its slip comes to (Sebastian,
// 2026-10-05). It used to hold every guest in the hotel as well, ordered or not, which
// read as a list of things to do. Now the line is empty until the staff start a table,
// and a table leaves it when its bill is sent. Who stands in it is decided by `served`
// in `RestaurantTab`; a chip says what is to be done with it — "not sent", "ready" —
// and says nothing when that is nothing but the bill.
//
// A table leads with a fork and knife and its name; a slip that belongs to a stay leads
// with the room number in the same gold tile the calendar gives a room. Sized for a
// finger: the staff tap this on a tablet in front of the guest.
export function ServedStrip({ served, selectedKey, totals, kitchen = {}, busy, loading, onPick, onOpenDiner }: ServedStripProps) {
  // The form stays hidden until a guest actually sits down.
  const [newDiner, setNewDiner] = useState(false)
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')

  const open = async (e: React.FormEvent) => {
    e.preventDefault()
    // The table is what the staff call the order by, and where the food is carried to.
    if (!table.trim()) { setError('Which table?'); return }
    const failed = await onOpenDiner(name, table)
    if (failed) { setError(failed); return }
    setName(''); setTable(''); setError(''); setNewDiner(false)
  }

  // On a tablet or a phone the strip is one line that slides sideways, so the person
  // just picked (or handed over from their booking) is brought into view.
  const row = useRef<HTMLDivElement>(null)
  useEffect(() => {
    row.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [selectedKey])

  return (
    <div className="shrink-0 space-y-3">
      {/* One line that slides sideways on a tablet or a phone, so it never pushes the menu
          down the screen (it used to wrap into four rows on a phone). It runs to the
          screen's edges, which is what says there is more to the side. A mouse cannot
          slide it, so on a PC it wraps. */}
      <div ref={row} className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 mouse:mx-0 mouse:px-0 mouse:flex-wrap mouse:overflow-visible">
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
              {/* Seen without opening the slip: cooked food waiting to be carried out, an
                  order the kitchen was never given, or the kitchen still cooking for them. */}
              {(kitchen[person.key]?.ready || 0) > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-bold">
                  {/* Cooked food going cold is the one thing here that should catch the eye. */}
                  <span className={'w-1.5 h-1.5 rounded-full animate-pulse motion-reduce:animate-none ' + (on ? 'bg-ink-900' : 'bg-gold-600')} />
                  ready
                </span>
              ) : (kitchen[person.key]?.fresh || 0) > 0 ? (
                <span className={'font-semibold ' + (on ? 'text-ink-900/70' : 'text-gold-800')}>not sent</span>
              ) : (kitchen[person.key]?.cooking || 0) > 0 ? (
                <ChefHat aria-label="cooking" className={'w-4 h-4 ' + (on ? 'text-ink-900/70' : 'text-muted')} />
              ) : null}
            </button>
          )
        })}

        {!loading && served.length === 0 && <span className="shrink-0 text-[14px] text-muted mr-1">No orders open.</span>}

        <button
          type="button"
          onClick={() => { setNewDiner(v => !v); setError('') }}
          aria-expanded={newDiner}
          // First in the line on a tablet or a phone: every order starts here, and at the
          // end of a sliding line this would be off the edge of the screen.
          className="shrink-0 whitespace-nowrap order-first mouse:order-none inline-flex items-center gap-1.5 h-11 px-3 rounded-lg border border-dashed border-soft text-[14px] font-semibold text-brand-text hover:border-gold-400 hover:bg-gold-100 transition-[background-color,border-color,transform] duration-200 active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4" /> New table
        </button>
      </div>

      {newDiner && (
        <form onSubmit={open} className="flex flex-wrap items-end gap-3 animate-in fade-in slide-in-from-top-1 duration-200 motion-reduce:animate-none">
          <Field label="Table" className="w-full sm:w-40">
            <input value={table} onChange={e => setTable(e.target.value)} autoFocus autoComplete="off" className={FIELD} />
          </Field>
          <Field label="Name (if they give one)" className="w-full sm:w-56">
            <input value={name} onChange={e => setName(e.target.value)} autoComplete="off" className={FIELD} />
          </Field>
          <button type="submit" disabled={busy}
            className="h-11 px-4 inline-flex items-center gap-1.5 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold shadow-sm transition-[background-color,transform] duration-200 active:scale-[0.98] cursor-pointer disabled:opacity-50">
            Start order
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

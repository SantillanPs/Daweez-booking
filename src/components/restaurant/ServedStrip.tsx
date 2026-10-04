import React, { useState } from 'react'
import { BedDouble, Plus } from 'lucide-react'
import { Tab } from '../../types/tab'
import { Booking } from '../../types/booking'

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

// Everyone the desk may charge, each with what their open order slip comes to: the
// diners at the tables first, then every guest in the hotel. Sized for a finger — the
// staff tap this on a tablet in front of the guest.
export function ServedStrip({ served, selectedKey, totals, busy, loading, onPick, onOpenDiner }: ServedStripProps) {
  // The form stays hidden until a diner actually walks in.
  const [newDiner, setNewDiner] = useState(false)
  const [name, setName] = useState('')
  const [table, setTable] = useState('')
  const [error, setError] = useState('')

  const open = async () => {
    if (!name.trim() && !table.trim()) { setError('Enter a name or a table.'); return }
    const failed = await onOpenDiner(name, table)
    if (failed) { setError(failed); return }
    setName(''); setTable(''); setError(''); setNewDiner(false)
  }

  const box = 'w-full h-11 bg-card border border-soft text-main px-3 rounded-lg text-[13px] focus:outline-none focus:border-gold-500'
  const label = 'block text-[12px] font-semibold text-muted mb-1'

  return (
    <div className="bg-card border border-soft rounded-lg p-3">
      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
        {served.map(person => {
          const on = person.key === selectedKey
          const total = totals[person.key] || 0
          return (
            <button
              key={person.key}
              type="button"
              disabled={busy}
              onClick={() => { setNewDiner(false); onPick(person) }}
              title={person.place ? person.name + ' · ' + person.place : person.name}
              className={'shrink-0 inline-flex items-center gap-1.5 min-h-[44px] text-[13px] font-bold px-3 py-2 rounded-lg border transition-colors cursor-pointer disabled:opacity-50 ' +
                (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400 hover:bg-gold-100')}
            >
              {person.booking && <BedDouble className={'w-4 h-4 ' + (on ? 'text-ink-900' : 'text-gold-700')} />}
              <span>{person.name}</span>
              {person.place && <span className={on ? 'text-ink-900/70' : 'text-muted'}>· {person.place}</span>}
              {total > 0 && <span className={on ? 'text-ink-900' : 'text-brand-text'}>{fmtPeso(total)}</span>}
              {person.tab?.billed_at && <span className={on ? 'text-ink-900/70' : 'text-muted'}>· bill out</span>}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setNewDiner(v => !v)}
          aria-expanded={newDiner}
          className="shrink-0 inline-flex items-center gap-1.5 min-h-[44px] text-[13px] font-bold text-ink-600 border border-dashed border-soft hover:border-gold-400 hover:text-gold-800 px-3 py-2 rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Walk-in diner
        </button>

        {loading && <span className="shrink-0 text-[12px] text-muted">Reading the order slips…</span>}
      </div>

      {newDiner && (
        <div className="mt-2 pt-3 border-t border-soft flex flex-wrap items-end gap-2">
          <label className="w-[180px]">
            <span className={label}>Name</span>
            <input value={name} onChange={e => setName(e.target.value)} className={box} />
          </label>
          <label className="w-[140px]">
            <span className={label}>Table</span>
            <input value={table} onChange={e => setTable(e.target.value)} className={box} />
          </label>
          <button type="button" onClick={() => void open()} disabled={busy}
            className="inline-flex items-center gap-1.5 min-h-[44px] text-[13px] font-bold text-ink-900 bg-gold-400 hover:bg-gold-600 px-4 rounded-lg transition-colors cursor-pointer disabled:opacity-50">
            <Plus className="w-4 h-4" /> Open order slip
          </button>
          <button type="button" onClick={() => { setNewDiner(false); setError('') }}
            className="inline-flex items-center min-h-[44px] text-[13px] font-semibold text-muted hover:text-main px-3 transition-colors cursor-pointer">
            Cancel
          </button>
          {error && <span className="text-[12px] font-semibold text-danger-600 w-full">{error}</span>}
        </div>
      )}
    </div>
  )
}

import React, { useState } from 'react'
import { NumInput } from '../NumInput'

const peso = (n: number) => (n < 0 ? '− ' : '') + '₱' + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 2 })

interface HandOverModalProps {
  /** Money in the hotel right now, before this hand-over. */
  inHotel: number
  /** `in` adds cash to the hotel instead of handing it over (the owner, 2026-10-14). */
  kind?: 'out' | 'in'
  onHandOver: (input: { amount: number; handedBy?: string; notes?: string }) => void
  onClose: () => void
}

// Handing money to the owner happens rarely (the owner, 2026-10-13), so it is a small
// window behind a quiet link, never a button on the day's screen. Three things to type
// — his own cut of the first drawing: how much, who handed it over, and a note.
export function HandOverModal({ inHotel, kind = 'out', onHandOver, onClose }: HandOverModalProps) {
  const adding = kind === 'in'
  const [amount, setAmount] = useState(0)
  const [handedBy, setHandedBy] = useState('')
  const [notes, setNotes] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (amount <= 0) return
    onHandOver({ amount, handedBy: handedBy.trim() || undefined, notes: notes.trim() || undefined })
  }

  const label = 'text-[10px] font-bold uppercase tracking-wider text-gold-800'
  const left = adding ? inHotel + amount : inHotel - amount

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 [animation:bp-dim_.2s_ease-out]" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={e => e.stopPropagation()}
        className="bg-card w-full max-w-md rounded-xl p-5 flex flex-col gap-4 [animation:bp-rise_.28s_cubic-bezier(.16,1,.3,1)]"
      >
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-display text-[15px] font-bold text-main">{adding ? 'Add cash on hand' : 'Cash remitted'}</h3>
          <span className="text-[12px] text-muted">In the hotel now <span className="font-mono font-bold text-main">{peso(inHotel)}</span></span>
        </div>

        <div className="flex flex-col gap-2">
          <span className={label}>How much</span>
          <NumInput
            value={amount}
            onChange={setAmount}
            aria-label="How much"
            placeholder="₱0"
            className="w-full min-h-[56px] px-3.5 border-2 border-gold-500 rounded-lg font-mono text-[26px] font-extrabold text-right text-main bg-card outline-none focus:border-gold-600"
          />
        </div>

        <label className="flex flex-col gap-2">
          <span className={label}>{adding ? 'Added by' : 'Remitted by'}</span>
          <input
            value={handedBy}
            onChange={e => setHandedBy(e.target.value)}
            className="min-h-[44px] px-3 border border-ink-300 rounded-lg text-[16px] text-main bg-card outline-none focus:border-gold-500"
          />
        </label>

        <label className="flex flex-col gap-2">
          <span className={label}>Notes</span>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            className="px-3 py-2.5 border border-ink-300 rounded-lg text-[16px] leading-[22px] text-main bg-card outline-none resize-none focus:border-gold-500"
          />
        </label>

        <div className="flex justify-between gap-3 border-t border-soft pt-3 text-[13px] text-main">
          <span>{adding ? 'In the hotel after' : 'Left in the hotel'}</span>
          <span className={'font-mono font-extrabold ' + (left < 0 ? 'text-danger-600' : 'text-emerald-700')}>{peso(left)}</span>
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="min-h-[48px] px-4 border border-soft rounded-lg bg-card text-main text-[14px] font-semibold hover:bg-page transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={amount <= 0}
            className="min-h-[48px] flex-1 rounded-lg bg-gold-400 hover:bg-gold-600 text-ink-900 text-[14px] font-bold transition-colors active:scale-[0.98] cursor-pointer disabled:bg-gold-200 disabled:cursor-not-allowed"
          >
            {(adding ? 'Add' : 'Remit') + (amount > 0 ? ' ' + peso(amount) : '')}
          </button>
        </div>
      </form>
    </div>
  )
}

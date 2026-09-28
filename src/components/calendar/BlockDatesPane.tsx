import React, { useState } from 'react'
import { CalendarOff } from 'lucide-react'

/** The reasons the desk blocks dates for (the owner's list, 2026-09). */
const REASONS = ['Cleaning', 'Maintenance', 'Owner use', 'Other'] as const

const chip = (on: boolean) =>
  'px-3 py-1.5 rounded-lg text-[11.5px] font-bold border transition-colors cursor-pointer ' +
  (on ? 'bg-gold-400 border-gold-400 text-ink-900' : 'bg-card border-soft text-main hover:border-gold-400')

/**
 * Blocking dates, as a small pane of its own (the owner's design, 2026-09).
 *
 * It used to be a mode of the booking form — a `Booking / Block dates` toggle in the
 * header that turned the whole form into a block-only form. The owner's ruling: blocking
 * starts where every other calendar action starts, **from the dates that were picked**,
 * so this pane is opened by the block icon in the grid's action bar and asks only what
 * the pick cannot answer: **why**. The room and the dates are shown read-only, because
 * they came from the calendar and retyping them was the whole cost of the old mode.
 */
export function BlockDatesPane({ unitLabel, checkIn, checkOut, fmt, onSubmit, onClose }: {
  unitLabel: string
  checkIn: string
  checkOut: string
  /** How a stored date reads on screen — handed in so this pane holds no date logic. */
  fmt: (iso: string) => string
  /** Writes the block. Resolves when it is saved; the caller closes the pane. */
  onSubmit: (notes: string) => Promise<void>
  onClose: () => void
}) {
  const [reason, setReason] = useState<string>('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)
  const [busy, setBusy] = useState(false)
  const missing = !reason && tried

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason) { setTried(true); return }
    setBusy(true)
    try {
      await onSubmit(note.trim() ? `${reason} — ${note.trim()}` : reason)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/50 font-sans" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-base-100 rounded-xl border border-base-300 shadow-xl p-4 space-y-3 text-left">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <CalendarOff className="w-3 h-3" />
          </span>
          <h3 className="text-sm font-bold text-base-content">Block these dates</h3>
          <button type="button" onClick={onClose}
            className="ml-auto text-[11px] font-bold text-muted hover:text-main cursor-pointer">Cancel</button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg border border-soft bg-page text-[11.5px] font-bold text-main">{unitLabel}</span>
          <span className="px-2.5 py-1 rounded-lg border border-soft bg-page text-[11.5px] font-bold text-main">{fmt(checkIn)}</span>
          {checkOut !== checkIn && (
            <>
              <span className="text-[11px] text-muted">→</span>
              <span className="px-2.5 py-1 rounded-lg border border-soft bg-page text-[11.5px] font-bold text-main">{fmt(checkOut)}</span>
            </>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Why</p>
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map(r => (
              <button key={r} type="button" onClick={() => setReason(r)} className={chip(reason === r)}>{r}</button>
            ))}
          </div>
          {missing && <p className="text-[11px] text-danger-600 font-semibold mt-1.5">Pick a reason for the block.</p>}
        </div>

        <label className="block">
          <span className="text-[10px] font-bold text-base-content/60 uppercase tracking-wider">Note (optional)</span>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What is being done"
            className="input input-bordered w-full text-sm mt-1" />
        </label>

        <div className="flex justify-end items-center gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? 'Blocking…' : 'Create block'}
          </button>
        </div>
      </form>
    </div>
  )
}

import { CheckCircle2 } from 'lucide-react'
import { FIELD } from './formStyles'

/**
 * What the guest card shows instead of itself when the form is in **Block** mode.
 *
 * Extracted from `RoomDetailsForm` (which was 308 lines, over the 300-line limit)
 * when the guest card was restructured on the owner's instruction, 2026-09-28.
 * Blocking dates is done from the calendar's action bar (`BlockDatesPane`); this is
 * only what the form draws while correcting a block that already exists.
 */
export function BlockReasonFields({ notes, setNotes }: {
  notes: string
  setNotes: (val: string) => void
}) {
  return (
    <div className="bg-page border border-soft rounded-lg px-2.5 py-2 space-y-1.5">
      <p className="text-[10px] font-bold text-main flex items-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5 text-brand-text" /> Block — just blocks the calendar (no charge).
      </p>
      <label className="text-[10px] text-muted font-bold block">Block reason (maintenance / cleaning)</label>
      <input value={notes} onChange={e => setNotes(e.target.value.toUpperCase())} placeholder="e.g. Room maintenance"
        className={FIELD} />
    </div>
  )
}

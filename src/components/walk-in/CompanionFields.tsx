import { Companion } from '../../types/booking'
import { Users, Trash2, Plus } from 'lucide-react'

/**
 * The companion list inside the guest card.
 *
 * Extracted from `RoomDetailsForm` (which was 332 lines, over the 300-line limit)
 * when the guest card was restructured on the owner's instruction, 2026-09-28: name
 * and contact share the first row, everything else waits behind "More details", and
 * **the empty grey "No other guests added" placeholder is gone** — the owner's words,
 * *"keep the add a guest the same as before, but just remove the 'no other guests
 * added' section"*. The header and the `＋ Add Guest` button are unchanged, so the
 * desk sees exactly what it saw before; only the furniture under it went.
 *
 * The section stays in place rather than collapsing: with no companions it is the
 * header and the button, one line tall, and adding the first guest fills the row
 * where the placeholder used to sit.
 */
export function CompanionFields({ companions, setCompanions }: {
  companions: Companion[]
  setCompanions: (val: Companion[]) => void
}) {
  return (
    <div className="pt-2 border-t border-base-300">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0"><Users className="w-3 h-3" /></span>
          <span className="text-xs font-bold text-base-content">Companion Information</span>
          {companions.length > 0 && (
            <span className="badge badge-primary badge-sm ml-1">{companions.length} Guest{companions.length !== 1 ? 's' : ''}</span>
          )}
        </span>
        <button
          type="button"
          onClick={() => setCompanions([...companions, { name: '' }])}
          className="btn btn-ghost btn-xs text-primary hover:text-primary/80 font-bold gap-1 normal-case"
        >
          <Plus className="w-3.5 h-3.5" /> Add Guest
        </button>
      </div>

      {companions.length > 0 && (
        <div className="space-y-2 pt-2">
          {companions.map((comp, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-base-200/50 p-2 rounded border border-base-300/60">
              <input
                type="text"
                required
                placeholder="Full name"
                value={comp.name}
                onChange={e => {
                  const u = [...companions]
                  u[idx] = { ...u[idx], name: e.target.value.toUpperCase() }
                  setCompanions(u)
                }}
                className="input input-bordered input-sm flex-1"
              />
              <input
                type="text"
                placeholder="Nationality"
                value={comp.nationality}
                onChange={e => {
                  const u = [...companions]
                  u[idx] = { ...u[idx], nationality: e.target.value.toUpperCase() }
                  setCompanions(u)
                }}
                className="input input-bordered input-sm w-24"
              />
              <button
                type="button"
                onClick={() => setCompanions(companions.filter((_, i) => i !== idx))}
                className="btn btn-ghost btn-xs text-base-content/60 hover:text-error p-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

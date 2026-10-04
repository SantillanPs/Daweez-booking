import { Companion } from '../../types/booking'
import { Trash2, Plus } from 'lucide-react'
import { FIELD_IN_ROW, ICON_BUTTON, OPTION_ROW, OPTION_NAME, OPTION_VALUE, REVEAL } from './formStyles'

/**
 * The companions — one line in the guest's list of extras, and a row for each
 * companion under it.
 *
 * Extracted from `RoomDetailsForm` when the guest card was restructured on the owner's
 * instruction, 2026-09-28: name and contact come first, everything else waits behind
 * "More details", and **the empty grey "No other guests added" placeholder is gone** —
 * the owner's words, *"keep the add a guest the same as before, but just remove the 'no
 * other guests added' section"*.
 *
 * With no companions it is one line, and the whole line adds the first one. The words
 * are **Add companion** (the design review, 2026-10-04): "Add Guest" used a second word
 * for the same person.
 */
export function CompanionFields({ companions, setCompanions }: {
  companions: Companion[]
  setCompanions: (val: Companion[]) => void
}) {
  const change = (idx: number, patch: Partial<Companion>) => {
    const next = [...companions]
    next[idx] = { ...next[idx], ...patch }
    setCompanions(next)
  }

  return (
    <li>
      <button type="button" onClick={() => setCompanions([...companions, { name: '' }])}
        className={OPTION_ROW + ' cursor-pointer'}>
        <span className={OPTION_NAME}>
          Companions
          {companions.length > 0 && <span className="ml-2 text-muted font-normal">{companions.length}</span>}
        </span>
        <span className={OPTION_VALUE}><Plus className="w-4 h-4" /> Add companion</span>
      </button>

      {companions.length > 0 && (
        <div className="space-y-2 pb-3">
          {companions.map((comp, idx) => (
            <div key={idx} className={'flex items-center gap-2 ' + REVEAL}>
              <input
                type="text"
                required
                placeholder="Full name"
                aria-label={'Companion ' + (idx + 1) + ' name'}
                value={comp.name}
                onChange={e => change(idx, { name: e.target.value.toUpperCase() })}
                className={FIELD_IN_ROW}
              />
              <input
                type="text"
                placeholder="Nationality"
                aria-label={'Companion ' + (idx + 1) + ' nationality'}
                value={comp.nationality || ''}
                onChange={e => change(idx, { nationality: e.target.value.toUpperCase() })}
                className={FIELD_IN_ROW + ' max-w-[10rem]'}
              />
              <button
                type="button"
                onClick={() => setCompanions(companions.filter((_, i) => i !== idx))}
                title="Remove this companion"
                aria-label="Remove this companion"
                className={ICON_BUTTON + ' hover:text-danger-600'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </li>
  )
}

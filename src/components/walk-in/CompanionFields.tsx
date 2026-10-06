import { Companion } from '../../types/booking'
import { Trash2, Plus } from 'lucide-react'
import { NationalityInput } from '../NationalityInput'
import { FIELD_IN_ROW, ICON_BUTTON, OPTION_ROW, OPTION_NAME, OPTION_VALUE, REVEAL, SELECT } from './formStyles'

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
 *
 * **A companion has a sex as well as a name and a nationality** (Sebastian, 2026-10-05:
 * *"can you also add sex for companions"*) — the same two words the guest's own Sex holds.
 * On a phone the name takes the first line and the other two share the second.
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
            <div key={idx} className={'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] sm:grid-cols-[minmax(0,1fr)_9rem_7.5rem_2.75rem] items-center gap-2 ' + REVEAL}>
              <input
                type="text"
                required
                placeholder="Full name"
                aria-label={'Companion ' + (idx + 1) + ' name'}
                value={comp.name}
                onChange={e => change(idx, { name: e.target.value.toUpperCase() })}
                className={FIELD_IN_ROW + ' col-span-3 sm:col-span-1'}
              />
              <NationalityInput
                placeholder="Nationality"
                aria-label={'Companion ' + (idx + 1) + ' nationality'}
                value={comp.nationality || ''}
                onChange={v => change(idx, { nationality: v })}
                className={FIELD_IN_ROW}
              />
              {/* Empty, it reads "Sex" in the grey the other two boxes use for theirs. */}
              <select
                aria-label={'Companion ' + (idx + 1) + ' sex'}
                value={comp.sex || ''}
                onChange={e => change(idx, { sex: e.target.value || undefined })}
                className={SELECT + (comp.sex ? '' : ' font-normal text-muted')}
              >
                <option value="">Sex</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
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

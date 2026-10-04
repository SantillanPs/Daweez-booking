import React, { useState } from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { ICON_BUTTON, LABEL, OPTION_ROW, OPTION_NAME, OPTION_VALUE, REVEAL } from './formStyles'

interface AmenitiesFormProps {
  hasRooms: boolean
  hasVenues: boolean
  hasAddons: boolean
  estRentals: number
  estAddons: number
  formChairs: number
  setFormChairs: (val: number) => void
  formExtraFoam: number
  setFormExtraFoam: (val: number) => void
  formExtraPillow: number
  setFormExtraPillow: (val: number) => void
  formExtraBlanket: number
  setFormExtraBlanket: (val: number) => void
  formExtraTowel: number
  setFormExtraTowel: (val: number) => void
  formEventTable: number
  setFormEventTable: (val: number) => void
  formEventTent: number
  setFormEventTent: (val: number) => void
  formVenueExcessHours: number
  setFormVenueExcessHours: (val: number) => void
}

interface Extra {
  label: string
  value: number
  set: (val: number) => void
  price: number
  per: string
}

/** One fewer, the count, one more. */
function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center select-none">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}
        aria-label={'One fewer ' + label} className={ICON_BUTTON + ' disabled:opacity-30 disabled:hover:bg-transparent'}>
        <Minus className="w-4 h-4" />
      </button>
      <span className="w-7 text-center text-[15px] font-semibold tabular-nums text-main">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label={'One more ' + label} className={ICON_BUTTON}>
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}

function ExtraList({ title, items }: { title: string; items: Extra[] }) {
  return (
    <div>
      <p className={LABEL}>{title}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
        {items.map(item => (
          <div key={item.label} className="flex items-center justify-between min-h-11">
            <span className="text-[15px] font-medium text-main">
              {item.label}
              <span className="ml-2 text-[13px] font-normal text-muted tabular-nums">₱{item.price}{item.per}</span>
            </span>
            <Counter label={item.label} value={item.value} onChange={item.set} />
          </div>
        ))}
      </div>
    </div>
  )
}

// Add-ons (card k138) — one line in the stay's list of extras.
//
// The owner's rule: "everything should be accessible but not immediately on
// display" — and never the wrong kind of thing. A guest in a room is not offered
// a tent and a wedding is not offered an extra blanket, so the list follows the
// unit being booked, and the counters stay closed until somebody actually wants
// them. When something HAS been added the line says what and how much, so a closed
// line can never hide a charge.
//
// The sentences that listed what could be added, and the one explaining why a room is
// not offered a tent, are gone (the staff's feedback, 2026-10-04: hard to read).
export const AmenitiesForm = React.memo(
  ({
    hasRooms,
    hasVenues,
    estRentals,
    estAddons,
    formChairs,
    setFormChairs,
    formExtraFoam,
    setFormExtraFoam,
    formExtraPillow,
    setFormExtraPillow,
    formExtraBlanket,
    setFormExtraBlanket,
    formExtraTowel,
    setFormExtraTowel,
    formEventTable,
    setFormEventTable,
    formEventTent,
    setFormEventTent,
    formVenueExcessHours,
    setFormVenueExcessHours,
  }: AmenitiesFormProps) => {
    const [open, setOpen] = useState(false)

    const roomExtras: Extra[] = [
      { label: 'Foam', value: formExtraFoam, set: setFormExtraFoam, price: 200, per: '/night' },
      { label: 'Pillow', value: formExtraPillow, set: setFormExtraPillow, price: 50, per: '/night' },
      { label: 'Blanket', value: formExtraBlanket, set: setFormExtraBlanket, price: 50, per: '/night' },
      { label: 'Towel', value: formExtraTowel, set: setFormExtraTowel, price: 50, per: '/night' },
    ]
    const venueExtras: Extra[] = [
      { label: 'Table', value: formEventTable, set: setFormEventTable, price: 150, per: '' },
      { label: 'Tent', value: formEventTent, set: setFormEventTent, price: 500, per: '' },
      { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15, per: '' },
      { label: 'Excess Hours', value: formVenueExcessHours, set: setFormVenueExcessHours, price: 500, per: '' },
    ]
    const added = [...(hasRooms ? roomExtras : []), ...(hasVenues ? venueExtras : [])]
      .filter(item => item.value > 0)
      .map(item => `${item.value} × ${item.label}`)
      .join(' · ')

    return (
      <li>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className={OPTION_ROW + ' cursor-pointer'}>
          <span className={OPTION_NAME}>Add-ons</span>
          <span className={OPTION_VALUE}>
            {added ? (
              <span className="truncate text-main">
                {added}
                <span className="ml-2 tabular-nums">+₱{(estRentals + estAddons).toLocaleString()}</span>
              </span>
            ) : !open && <span>Add</span>}
            <ChevronDown className={'w-4 h-4 shrink-0 transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
          </span>
        </button>

        {open && (
          <div className={'space-y-3 pb-3 ' + REVEAL}>
            {hasRooms && <ExtraList title="Room extras, per night" items={roomExtras} />}
            {hasVenues && <ExtraList title="Venue rentals, one-time" items={venueExtras} />}
          </div>
        )}
      </li>
    )
  },
  (prevProps, nextProps) => {
    return (
      prevProps.hasRooms === nextProps.hasRooms &&
      prevProps.hasVenues === nextProps.hasVenues &&
      prevProps.hasAddons === nextProps.hasAddons &&
      prevProps.estRentals === nextProps.estRentals &&
      prevProps.estAddons === nextProps.estAddons &&
      prevProps.formChairs === nextProps.formChairs &&
      prevProps.formExtraFoam === nextProps.formExtraFoam &&
      prevProps.formExtraPillow === nextProps.formExtraPillow &&
      prevProps.formExtraBlanket === nextProps.formExtraBlanket &&
      prevProps.formExtraTowel === nextProps.formExtraTowel &&
      prevProps.formEventTable === nextProps.formEventTable &&
      prevProps.formEventTent === nextProps.formEventTent &&
      prevProps.formVenueExcessHours === nextProps.formVenueExcessHours
    )
  }
)

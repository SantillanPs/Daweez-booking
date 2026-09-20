import React, { useState } from 'react'
import { PackagePlus, ChevronDown } from 'lucide-react'

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

// Add-ons (card k138).
//
// The owner's rule: "everything should be accessible but not immediately on
// display" — and never the wrong kind of thing. A guest in a room is not offered
// a tent and a wedding is not offered an extra blanket, so the list follows the
// unit being booked, and the counters sit behind one **More add-ons** line until
// somebody actually wants them. When something HAS been added the header says so
// and keeps the running amount visible, so a collapsed section can never hide a
// charge.
export const AmenitiesForm = React.memo(
  ({
    hasRooms,
    hasVenues,
    hasAddons,
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

    const Counter = ({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) => (
      <div className="flex items-center gap-0.5 select-none">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="btn btn-ghost btn-xs w-6 h-6 rounded"
        >
          −
        </button>
        <span className="font-mono w-6 text-center text-sm font-semibold text-base-content">{value}</span>
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="btn btn-ghost btn-xs w-6 h-6 rounded"
        >
          +
        </button>
      </div>
    )

    const roomExtras = [
      { label: 'Foam', value: formExtraFoam, set: setFormExtraFoam, price: 200, per: '/night' },
      { label: 'Pillow', value: formExtraPillow, set: setFormExtraPillow, price: 50, per: '/night' },
      { label: 'Blanket', value: formExtraBlanket, set: setFormExtraBlanket, price: 50, per: '/night' },
      { label: 'Towel', value: formExtraTowel, set: setFormExtraTowel, price: 50, per: '/night' },
    ]
    const venueExtras = [
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
      <div className="bg-base-100 p-3 rounded-xl border border-base-300 shadow-sm space-y-2.5 font-sans">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><PackagePlus className="w-3 h-3" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-bold text-base-content tracking-widest uppercase">Add-ons</p>
              <p className="text-[11px] text-base-content/60 truncate">
                {added || (hasVenues && !hasRooms
                  ? 'Tables, chairs, tent, extra hours — nothing added'
                  : hasRooms && !hasVenues
                    ? 'Extra foam, pillow, blanket, towel — nothing added'
                    : 'Room extras and venue rentals — nothing added')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(estRentals + estAddons) > 0 && (
              <span className="text-xs font-mono font-bold text-success">+₱{(estRentals + estAddons).toLocaleString()}</span>
            )}
            <button
              type="button"
              onClick={() => setOpen(o => !o)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-base-content/70 hover:text-base-content border border-base-300 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer"
            >
              {open ? 'Hide' : 'More add-ons'}
              <ChevronDown className={'w-3.5 h-3.5 transition-transform ' + (open ? 'rotate-180' : '')} />
            </button>
          </div>
        </div>

        {open && (
          <div className="space-y-3 pt-1 border-t border-base-300 animate-in fade-in duration-200">
            {hasRooms && (
              <div className="space-y-2">
                <span className="text-xs text-base-content/60 font-bold uppercase tracking-wider block">
                  Room extras (per night)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {roomExtras.map(item => (
                    <div key={item.label} className="flex items-center justify-between bg-base-200/60 px-3 py-1.5 rounded-lg border border-base-300">
                      <div>
                        <span className="text-sm font-semibold text-base-content">{item.label}</span>
                        <span className="text-sm text-success font-bold font-mono ml-1.5">₱{item.price}{item.per}</span>
                      </div>
                      <Counter value={item.value} onChange={item.set} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {hasVenues && (
              <div className="space-y-2">
                <span className="text-xs text-base-content/60 font-bold uppercase tracking-wider block">
                  Venue rentals (one-time fee)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {venueExtras.map(item => (
                    <div key={item.label} className="flex items-center justify-between bg-base-200/60 px-3 py-1.5 rounded-lg border border-base-300">
                      <div>
                        <span className="text-sm font-semibold text-base-content">{item.label}</span>
                        <span className="text-sm text-success font-bold font-mono ml-1.5">₱{item.price}</span>
                      </div>
                      <Counter value={item.value} onChange={item.set} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[11px] text-base-content/60">
              Only what suits this booking is listed — a room is never offered a tent.
            </p>
          </div>
        )}
      </div>
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

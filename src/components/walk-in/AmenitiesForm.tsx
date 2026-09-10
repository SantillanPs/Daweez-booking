import React from 'react'
import { PackagePlus } from 'lucide-react'

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
    // Counter Component
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

    return (
      <div className="bg-base-100 p-3 rounded-xl border border-base-300 shadow-sm space-y-2.5 animate-in fade-in duration-200 font-sans">
        <h4 className="flex items-center justify-between border-b border-base-300 pb-1.5">
          <span className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-sky-100 text-sky-600 flex items-center justify-center shrink-0"><PackagePlus className="w-3 h-3" /></span>
            <span className="text-[10px] font-bold text-base-content tracking-widest uppercase">Add-ons</span>
          </span>
          <span className="text-xs font-mono font-bold text-success">+₱{(estRentals + estAddons).toLocaleString()}</span>
        </h4>

        {hasRooms && (
          <div className="space-y-3">
            <span className="text-xs text-base-content/60 font-bold uppercase tracking-wider block">
              Room Extras (per night)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Foam', value: formExtraFoam, set: setFormExtraFoam, price: 200 },
                { label: 'Pillow', value: formExtraPillow, set: setFormExtraPillow, price: 50 },
                { label: 'Blanket', value: formExtraBlanket, set: setFormExtraBlanket, price: 50 },
                { label: 'Towel', value: formExtraTowel, set: setFormExtraTowel, price: 50 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-base-200/60 px-3 py-1.5 rounded-lg border border-base-300">
                  <div>
                    <span className="text-sm font-semibold text-base-content">{item.label}</span>
                    <span className="text-sm text-success font-bold font-mono ml-1.5">₱{item.price}/night</span>
                  </div>
                  <Counter value={item.value} onChange={item.set} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider if both exist */}
        {hasRooms && hasVenues && <div className="border-t border-base-300 my-4" />}

        {hasVenues && (
          <div className="space-y-3">
            <span className="text-xs text-base-content/60 font-bold uppercase tracking-wider block">
              Venue Rentals (one-time fee)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Table', value: formEventTable, set: setFormEventTable, price: 150 },
                { label: 'Tent', value: formEventTent, set: setFormEventTent, price: 500 },
                { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15 },
                { label: 'Excess Hours', value: formVenueExcessHours, set: setFormVenueExcessHours, price: 500 },
              ].map(item => (
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
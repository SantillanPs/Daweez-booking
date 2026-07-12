import React, { useState } from 'react'
import { Armchair, ChevronDown, Coffee } from 'lucide-react'

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
  formBreakfastEnabled: boolean
  setFormBreakfastEnabled: (val: boolean) => void
  formBreakfastGuests: number
  setFormBreakfastGuests: (val: number) => void
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
    formBreakfastEnabled,
    setFormBreakfastEnabled,
    formBreakfastGuests,
    setFormBreakfastGuests
  }: AmenitiesFormProps) => {
    const [showVenueAddons, setShowVenueAddons] = useState(true)

    // Counter Component
    const Counter = ({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) => (
      <div className="flex items-center gap-0.5 select-none">
        <button 
          type="button" 
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-6 h-6 rounded bg-softbg hover:bg-slate-200 text-muted flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
        >
          −
        </button>
        <span className="font-mono w-6 text-center text-xs font-semibold text-main">{value}</span>
        <button 
          type="button" 
          onClick={() => onChange(value + 1)}
          className="w-6 h-6 rounded bg-softbg hover:bg-slate-200 text-muted flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
        >
          +
        </button>
      </div>
    )

    return (
      <div className="bg-card p-4 rounded-md border border-soft/60 shadow-sm space-y-4 animate-in fade-in duration-200 font-sans">
        <h4 className="text-[9px] font-bold text-brand-text tracking-widest uppercase border-b border-soft pb-1.5 flex justify-between items-center">
          <span>3. Extras</span>
          {hasAddons && (
            <span className="bg-brand-bg border border-brand-border text-brand-text text-[9px] font-bold px-2 py-0.5 rounded animate-fade-in normal-case tracking-normal">
              +₱{(estRentals + estAddons).toLocaleString()}
            </span>
          )}
        </h4>

        {/* Breakfast Toggle — only for room bookings */}
        {hasRooms && (
          <div className="space-y-3">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">
              Breakfast
            </span>
            <div className="flex items-center justify-between bg-brand-bg px-3 py-2 rounded border border-brand-border/65">
              <div className="flex items-center gap-2">
                <Coffee className="w-4 h-4 text-brand-primary" />
                <div>
                  <span className="text-xs font-semibold text-main">Include Breakfast</span>
                  <span className="text-[10px] text-muted ml-1.5 font-mono">₱150/guest/night</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formBreakfastEnabled}
                  onChange={e => setFormBreakfastEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-ring rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-brand-primary"></div>
              </label>
            </div>

            {formBreakfastEnabled && (
              <div className="flex items-center justify-between bg-page px-3 py-2 rounded border border-soft ml-2">
                <span className="text-[11px] text-muted font-semibold">Guests for Breakfast</span>
                <Counter value={formBreakfastGuests} onChange={setFormBreakfastGuests} min={1} />
              </div>
            )}

            <div className="border-t border-dashed border-soft/50 mt-3" />
          </div>
        )}

        {hasRooms && (
          <div className="space-y-3">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">
              Room Extras (per night)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Extra Foam', value: formExtraFoam, set: setFormExtraFoam, price: 200 },
                { label: 'Extra Pillow', value: formExtraPillow, set: setFormExtraPillow, price: 50 },
                { label: 'Extra Blanket', value: formExtraBlanket, set: setFormExtraBlanket, price: 50 },
                { label: 'Extra Towel', value: formExtraTowel, set: setFormExtraTowel, price: 50 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-brand-bg px-3 py-1.5 rounded border border-brand-border/65">
                  <div>
                    <span className="text-xs font-semibold text-main">{item.label}</span>
                    <span className="text-[10px] text-muted ml-1.5 font-mono">₱{item.price}/night</span>
                  </div>
                  <Counter value={item.value} onChange={item.set} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider if both exist */}
        {hasRooms && hasVenues && <div className="border-t border-soft my-4" />}

        {hasVenues && (
          <div className="space-y-3">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block">
              Venue Rentals (one-time fee)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Table', value: formEventTable, set: setFormEventTable, price: 150 },
                { label: 'Tent', value: formEventTent, set: setFormEventTent, price: 500 },
                { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15 },
                { label: 'Excess Hours', value: formVenueExcessHours, set: setFormVenueExcessHours, price: 500 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-page/60 px-3 py-1.5 rounded border border-soft">
                  <div>
                    <span className="text-xs font-semibold text-main">{item.label}</span>
                    <span className="text-[10px] text-muted ml-1.5 font-mono">₱{item.price}</span>
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
      prevProps.formVenueExcessHours === nextProps.formVenueExcessHours &&
      prevProps.formBreakfastEnabled === nextProps.formBreakfastEnabled &&
      prevProps.formBreakfastGuests === nextProps.formBreakfastGuests
    )
  }
)

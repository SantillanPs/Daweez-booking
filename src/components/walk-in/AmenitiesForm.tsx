import React, { useState } from 'react'
import { Armchair, ChevronDown } from 'lucide-react'

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
    setFormEventTent
  }: AmenitiesFormProps) => {
    const [showVenueAddons, setShowVenueAddons] = useState(true)

    // Counter Component
    const Counter = ({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) => (
      <div className="flex items-center gap-0.5 select-none">
        <button 
          type="button" 
          onClick={() => onChange(Math.max(min, value - 1))}
          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
        >
          −
        </button>
        <span className="font-mono w-6 text-center text-xs font-semibold text-slate-700">{value}</span>
        <button 
          type="button" 
          onClick={() => onChange(value + 1)}
          className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold transition-colors cursor-pointer"
        >
          +
        </button>
      </div>
    )

    return (
      <div className="bg-white p-4 rounded-md border border-slate-200/60 shadow-sm space-y-4 animate-in fade-in duration-200 font-sans">
        <h4 className="text-[9px] font-bold text-[#9A783E] tracking-widest uppercase border-b border-slate-100 pb-1.5 flex justify-between items-center">
          <span>3. Amenities &amp; Services</span>
          {hasAddons && (
            <span className="bg-[#FDFBF7] border border-[#E5D5C0] text-[#9A783E] text-[9px] font-bold px-2 py-0.5 rounded animate-fade-in normal-case tracking-normal">
              +₱{(estRentals + estAddons).toLocaleString()}
            </span>
          )}
        </h4>

        {/* Room Extras & Amenities Section */}
        {hasRooms && (
          <div className="space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Room Extras &amp; Bedding (Nightly rates)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Extra Foam', value: formExtraFoam, set: setFormExtraFoam, price: 200 },
                { label: 'Extra Pillow', value: formExtraPillow, set: setFormExtraPillow, price: 50 },
                { label: 'Extra Blanket', value: formExtraBlanket, set: setFormExtraBlanket, price: 50 },
                { label: 'Extra Towel', value: formExtraTowel, set: setFormExtraTowel, price: 50 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-[#FDFBF7] px-3 py-1.5 rounded border border-[#E5D5C0]/65">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">₱{item.price}/night</span>
                  </div>
                  <Counter value={item.value} onChange={item.set} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider if both exist */}
        {hasRooms && hasVenues && <div className="border-t border-slate-100 my-4" />}

        {/* Venue Equipment Section */}
        {hasVenues && (
          <div className="space-y-3">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
              Venue Equipment &amp; Rentals (Flat rates)
            </span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Table', value: formEventTable, set: setFormEventTable, price: 150 },
                { label: 'Tent', value: formEventTent, set: setFormEventTent, price: 500 },
                { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15 },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between bg-slate-50/60 px-3 py-1.5 rounded border border-slate-100">
                  <div>
                    <span className="text-xs font-semibold text-slate-700">{item.label}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5 font-mono">₱{item.price}</span>
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
      prevProps.formEventTent === nextProps.formEventTent
    )
  }
)

import React, { useState } from 'react'
import { Coffee, Armchair, ChevronDown } from 'lucide-react'

interface AmenitiesFormProps {
  hasRooms: boolean
  hasVenues: boolean
  hasAddons: boolean
  estBreakfast: number
  estRentals: number
  estAddons: number
  formBreakfastQty: Record<string, number>
  setFormBreakfastQty: React.Dispatch<React.SetStateAction<Record<string, number>>>
  formBigTable: number
  setFormBigTable: (val: number) => void
  formSmallTable: number
  setFormSmallTable: (val: number) => void
  formChairs: number
  setFormChairs: (val: number) => void
  formWater: number
  setFormWater: (val: number) => void
  formBand: boolean
  setFormBand: (val: boolean) => void
  formStage: boolean
  setFormStage: (val: boolean) => void
  formLedWall: boolean
  setFormLedWall: (val: boolean) => void
}

export const AmenitiesForm = React.memo(
  ({
    hasRooms,
    hasVenues,
    hasAddons,
    estBreakfast,
    estRentals,
    estAddons,
    formBreakfastQty,
    setFormBreakfastQty,
    formBigTable,
    setFormBigTable,
    formSmallTable,
    setFormSmallTable,
    formChairs,
    setFormChairs,
    formWater,
    setFormWater,
    formBand,
    setFormBand,
    formStage,
    setFormStage,
    formLedWall,
    setFormLedWall
  }: AmenitiesFormProps) => {
    const [showBreakfast, setShowBreakfast] = useState(true)
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
              +₱{(estBreakfast + estRentals + estAddons).toLocaleString()}
            </span>
          )}
        </h4>
        
        {/* Breakfast Section */}
        {hasRooms && (
          <div className="space-y-3">
            <button 
              type="button" 
              onClick={() => setShowBreakfast(!showBreakfast)}
              className="flex items-center justify-between w-full text-[10px] text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-700 transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Coffee className="w-3.5 h-3.5 text-[#B89251]" /> Breakfast Orders
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showBreakfast ? 'rotate-180' : ''}`} />
            </button>

            {showBreakfast && (
              <div className="space-y-2 pt-1 animate-in slide-in-from-top-1 duration-150">
                {Object.keys(formBreakfastQty).map(meal => (
                  <div key={meal} className="flex items-center justify-between bg-slate-50/60 px-3 py-1.5 rounded border border-slate-100">
                    <div>
                      <span className="text-xs font-semibold text-slate-700">{meal}</span>
                      <span className="text-[10px] text-slate-400 ml-2">₱200/set</span>
                    </div>
                    <Counter 
                      value={formBreakfastQty[meal]} 
                      onChange={v => setFormBreakfastQty(p => ({ ...p, [meal]: v }))} 
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Venue Equipment & Add-ons Section */}
        {hasVenues && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <button 
              type="button" 
              onClick={() => setShowVenueAddons(!showVenueAddons)}
              className="flex items-center justify-between w-full text-[10px] text-slate-500 font-semibold uppercase tracking-wider hover:text-slate-700 transition-colors py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5 font-bold">
                <Armchair className="w-3.5 h-3.5 text-[#B89251]" /> Equipment &amp; Event Add-ons
              </span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${showVenueAddons ? 'rotate-180' : ''}`} />
            </button>

            {showVenueAddons && (
              <div className="space-y-3.5 pt-1 animate-in slide-in-from-top-1 duration-150">
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Big Table', value: formBigTable, set: setFormBigTable, price: 150 },
                    { label: 'Small Table', value: formSmallTable, set: setFormSmallTable, price: 100 },
                    { label: 'Chairs', value: formChairs, set: setFormChairs, price: 15 },
                    { label: 'Water Pot', value: formWater, set: setFormWater, price: 35 },
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
                <div className="flex flex-wrap gap-x-4 gap-y-2 pt-2 border-t border-slate-100 text-xs">
                  {[
                    { label: 'Band & Lights', price: '₱2k', checked: formBand, set: setFormBand },
                    { label: 'Stage setup', price: '₱2k', checked: formStage, set: setFormStage },
                    { label: 'LED Wall 9x12', price: '₱5k', checked: formLedWall, set: setFormLedWall },
                  ].map(item => (
                    <label key={item.label} className="flex items-center gap-1.5 cursor-pointer text-slate-700 font-semibold select-none">
                      <input 
                        type="checkbox" 
                        checked={item.checked} 
                        onChange={e => item.set(e.target.checked)} 
                        className="accent-[#B89251] rounded cursor-pointer" 
                      />
                      <span>{item.label}</span> 
                      <span className="text-[10px] text-slate-400 font-mono">({item.price})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  },
  (prevProps, nextProps) => {
    const breakfastQtyEqual = Object.keys(prevProps.formBreakfastQty).every(
      k => prevProps.formBreakfastQty[k] === nextProps.formBreakfastQty[k]
    )
    return (
      prevProps.hasRooms === nextProps.hasRooms &&
      prevProps.hasVenues === nextProps.hasVenues &&
      prevProps.hasAddons === nextProps.hasAddons &&
      prevProps.estBreakfast === nextProps.estBreakfast &&
      prevProps.estRentals === nextProps.estRentals &&
      prevProps.estAddons === nextProps.estAddons &&
      prevProps.formBigTable === nextProps.formBigTable &&
      prevProps.formSmallTable === nextProps.formSmallTable &&
      prevProps.formChairs === nextProps.formChairs &&
      prevProps.formWater === nextProps.formWater &&
      prevProps.formBand === nextProps.formBand &&
      prevProps.formStage === nextProps.formStage &&
      prevProps.formLedWall === nextProps.formLedWall &&
      breakfastQtyEqual
    )
  }
)

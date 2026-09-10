import React from 'react'
import { NumInput } from '../NumInput'

export type DiscountType = 'none' | 'percent' | 'flat'

function StepLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div>
      <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">{label}</p>
      {hint && <p className="text-xs text-base-content/60 mt-0.5">{hint}</p>}
    </div>
  )
}

function Stepper({ label, value, onChange, min = 0, max = 24, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <div className="flex items-center justify-between gap-1.5 bg-base-200/60 border border-base-300 rounded-lg px-2.5 py-2">
      <span className="text-xs text-base-content/60 font-medium">{label}</span>
      <div className="flex items-center gap-0.5">
        <button type="button" onClick={() => onChange(Math.max(min, value - step))} className="btn btn-ghost btn-xs">-</button>
        <span className="font-mono w-8 text-center text-sm font-semibold text-base-content">{value}</span>
        <button type="button" onClick={() => onChange(Math.min(max, value + step))} className="btn btn-ghost btn-xs">+</button>
      </div>
    </div>
  )
}

// The money-only inputs in the quick booking form: staff discount (20% / 10% /
// custom flat price) and Gazebo/Garden day blocks. Early/late check-in-out is
// NOT set here — it is auto-computed at the actual check-in / check-out.
export function DiscountPricingControls({
  isDayBlock, discountType, setDiscountType, discountValue, setDiscountValue,
  venueDayBlocks, setVenueDayBlocks
}: {
  isDayBlock: boolean
  discountType: DiscountType
  setDiscountType: (t: DiscountType) => void
  discountValue: number
  setDiscountValue: (v: number) => void
  venueDayBlocks: number
  setVenueDayBlocks: (v: number) => void
}) {
  return (
    <div className="bg-base-100 border border-base-300 rounded-xl p-3 shadow-sm space-y-2.5">
      <StepLabel label="Discount" hint="% off the room charge, or a custom peso discount." />
      <div className="flex flex-wrap gap-1.5">
        {[
          { key: 'none', label: 'None', active: discountType === 'none', onClick: () => { setDiscountType('none'); setDiscountValue(0) } },
          { key: 'p20', label: '20%', active: discountType === 'percent' && discountValue === 20, onClick: () => { setDiscountType('percent'); setDiscountValue(20) } },
          { key: 'p10', label: '10%', active: discountType === 'percent' && discountValue === 10, onClick: () => { setDiscountType('percent'); setDiscountValue(10) } },
          { key: 'flat', label: 'Custom price', active: discountType === 'flat', onClick: () => { setDiscountType('flat'); setDiscountValue(0) } },
        ].map(btn => (
          <button
            key={btn.key}
            type="button"
            onClick={btn.onClick}
            className={'btn btn-sm ' + (btn.active ? 'btn-primary' : 'btn-ghost')}
          >{btn.label}</button>
        ))}
      </div>
      {discountType === 'flat' && (
        <div>
          <label className="text-xs text-base-content/60 font-bold block mb-1">Discount amount (PHP)</label>
          <NumInput value={discountValue} onChange={setDiscountValue}
            placeholder="e.g. 500" className="input input-bordered w-full text-sm" />
        </div>
      )}
      {isDayBlock ? (
        <Stepper label="Day blocks (6 hrs)" value={venueDayBlocks} onChange={setVenueDayBlocks} min={1} max={8} step={1} />
      ) : null}
    </div>
  )
}
import React from 'react'
import { Percent } from 'lucide-react'
import { NumInput } from '../NumInput'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'

export type DiscountType = 'none' | 'percent' | 'flat'

type DiscountKey = 'none' | 'p20' | 'p10' | 'flat'

// One row, as drawn and approved (the owner, 2026-09): the label, the four choices and
// the typed box when it is needed. The old card stacked a heading, a hint and a row of
// buttons — three lines of height for one decision. The hint the heading used to carry
// (`% off the room charge…`) now lives on the label's hover, because the buttons already
// say what they do and the row has to stay one line tall.
// Early/late check-in-out is NOT set here — it is auto-computed at the actual check-in.
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
  const value: DiscountKey = discountType === 'none' ? 'none' : discountType === 'flat' ? 'flat' : discountValue === 10 ? 'p10' : 'p20'
  const options: SegmentOption<DiscountKey>[] = [
    { key: 'none', label: 'None' },
    { key: 'p20', label: '20%' },
    { key: 'p10', label: '10%' },
    { key: 'flat', label: 'Custom price', hint: 'A flat peso amount off instead of a percentage.' },
  ]

  const pick = (key: DiscountKey) => {
    if (key === 'none') { setDiscountType('none'); setDiscountValue(0) }
    else if (key === 'p20') { setDiscountType('percent'); setDiscountValue(20) }
    else if (key === 'p10') { setDiscountType('percent'); setDiscountValue(10) }
    else { setDiscountType('flat'); setDiscountValue(0) }
  }

  return (
    <div className="bg-base-100 border border-base-300 rounded-xl px-3 py-2 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 shrink-0"
          title="% off the room charge, or a custom peso discount.">
          <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Percent className="w-2.5 h-2.5" />
          </span>
          <span className="text-[10px] font-bold text-base-content/70 whitespace-nowrap">Discount</span>
        </span>
        <SegmentedControl options={options} value={value} onChange={pick} label="Staff discount" />
        {discountType === 'flat' && (
          <span className="ml-auto">
            <NumInput value={discountValue} onChange={setDiscountValue} placeholder="Amount"
              className="w-[92px] bg-card border border-base-300 text-main px-2 py-1 rounded-lg text-sm font-mono focus:outline-none focus:border-brand-primary text-right" />
          </span>
        )}
      </div>

      {isDayBlock && (
        <div className="flex items-center justify-between gap-2 bg-base-200/60 border border-base-300 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-bold text-base-content/70 whitespace-nowrap">Day blocks (6 hrs)</span>
          <div className="flex items-center gap-0.5">
            <button type="button" onClick={() => setVenueDayBlocks(Math.max(1, venueDayBlocks - 1))} className="btn btn-ghost btn-xs">-</button>
            <span className="font-mono w-8 text-center text-sm font-semibold text-base-content">{venueDayBlocks}</span>
            <button type="button" onClick={() => setVenueDayBlocks(Math.min(8, venueDayBlocks + 1))} className="btn btn-ghost btn-xs">+</button>
          </div>
        </div>
      )}
    </div>
  )
}

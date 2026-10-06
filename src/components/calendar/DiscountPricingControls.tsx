import React from 'react'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { NumInput } from '../NumInput'
import { SegmentedControl, SegmentOption } from '../SegmentedControl'
import { Field } from '../walk-in/Field'
import { FIELD, ICON_BUTTON, OPTION_ROW, OPTION_NAME, OPTION_VALUE, REVEAL } from '../walk-in/formStyles'

export type DiscountType = 'none' | 'percent' | 'flat'

type DiscountKey = 'none' | 'p20' | 'p10' | 'flat'

// The staff discount — one line in the stay's list of extras, opening to the four choices
// and the typed box when it is needed (the owner approved the choices, 2026-09).
//
// A discount is rare, so with none given the line is closed, like Add-ons above it (the
// staff's feedback, 2026-10-04: the form was hard to read). The four choices used to be on
// screen for every booking, with `None` filled in as loudly as the payment plan beside it.
// A booking that has a discount opens with the choices, and the line says what it is.
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
    // It read "Custom price", and the box under it asks for an amount OFF: a desk meaning
    // to charge ₱850 for a ₱950 room would have typed 850 and taken ₱850 off. It was "₱ off"
    // for that reason, and is "Custom" again (Sebastian, 2026-10-06, to match the payment
    // choices) — so the box under it must keep saying "Amount off (₱)", which is what stops
    // it being read as a price.
    { key: 'flat', label: 'Custom', hint: 'A peso amount off instead of a percentage.' },
  ]

  const pick = (key: DiscountKey) => {
    if (key === 'none') { setDiscountType('none'); setDiscountValue(0) }
    else if (key === 'p20') { setDiscountType('percent'); setDiscountValue(20) }
    else if (key === 'p10') { setDiscountType('percent'); setDiscountValue(10) }
    else { setDiscountType('flat'); setDiscountValue(0) }
  }

  const [open, setOpen] = React.useState(discountType !== 'none')
  const given = discountType === 'percent' ? discountValue + '% off'
    : discountType === 'flat' && discountValue > 0 ? '₱' + discountValue.toLocaleString() + ' off'
      : ''

  return (
    <>
      <li>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className={OPTION_ROW + ' cursor-pointer'}>
          <span className={OPTION_NAME}>Discount</span>
          <span className={OPTION_VALUE}>
            {given ? <span className="text-main tabular-nums">{given}</span> : !open && <span>Add</span>}
            <ChevronDown className={'w-4 h-4 shrink-0 transition-transform duration-200 ' + (open ? 'rotate-180' : '')} />
          </span>
        </button>

        {open && (
          <div className={'space-y-3 pb-3 ' + REVEAL}>
            <SegmentedControl options={options} value={value} onChange={pick} label="Staff discount" />
            {/* A custom price is a figure the desk types, so it takes the row below. */}
            {discountType === 'flat' && (
              <Field label="Amount off (₱)">
                <NumInput value={discountValue} onChange={setDiscountValue} aria-label="Amount off"
                  className={FIELD + ' text-right tabular-nums'} />
              </Field>
            )}
          </div>
        )}
      </li>

      {isDayBlock && (
        <li className="min-h-12 flex items-center justify-between gap-4" title="A venue is booked in blocks of six hours.">
          <span className={OPTION_NAME}>
            Day blocks
            <span className="ml-2 text-[13px] font-normal text-muted">6 hours each</span>
          </span>
          <div className="flex items-center select-none">
            <button type="button" onClick={() => setVenueDayBlocks(Math.max(1, venueDayBlocks - 1))} disabled={venueDayBlocks <= 1}
              aria-label="One block fewer" className={ICON_BUTTON + ' disabled:opacity-30 disabled:hover:bg-transparent'}>
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-7 text-center text-[15px] font-semibold tabular-nums text-main">{venueDayBlocks}</span>
            <button type="button" onClick={() => setVenueDayBlocks(Math.min(8, venueDayBlocks + 1))} disabled={venueDayBlocks >= 8}
              aria-label="One block more" className={ICON_BUTTON + ' disabled:opacity-30 disabled:hover:bg-transparent'}>
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </li>
      )}
    </>
  )
}

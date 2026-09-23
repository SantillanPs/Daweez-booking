// The building blocks of a 58 mm thermal receipt.
//
// The hotel prints on a 58 mm roll, so a receipt is ONE column, black on white
// (the printer is 1-bit — grey text just dithers into fuzz), and nothing wider
// than the paper. Both the payment receipt and the walk-in tab receipt are drawn
// from these, so they cannot drift apart.
import React from 'react'

/** Dashed rule, the way a receipt separates its blocks. */
export function Rule() {
  return <div className="border-t border-dashed border-black my-1.5" />
}

/**
 * Label above the value. At 58 mm a long label and a long value cannot share one
 * line, so anything that can run long gets its own row. A blank value prints
 * nothing at all — never a label with an empty space under it.
 */
export function Block({ label, value }: { label: string; value?: string }) {
  const shown = (value ?? '').trim()
  if (!shown) return null
  return (
    <div className="mt-1.5 first:mt-0">
      <p className="text-[8px] font-bold uppercase tracking-wider">{label}</p>
      <p className="text-[10px] font-semibold break-words">{shown}</p>
    </div>
  )
}

/** Label left, amount right. Only for labels short enough to always fit. */
export function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 mt-0.5 first:mt-0">
      <span className="text-[9px] font-semibold break-words">{label}</span>
      <span className={'font-mono shrink-0 text-right break-all ' + (strong ? 'text-[11px] font-bold' : 'text-[10px]')}>{value}</span>
    </div>
  )
}

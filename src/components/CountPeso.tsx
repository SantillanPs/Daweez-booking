import NumberFlow from '@number-flow/react'

const PESO = { style: 'currency', currency: 'PHP', maximumFractionDigits: 0 } as const

/** A peso amount whose digits roll to the new figure when it changes, so a payment is seen
 *  coming off what is owed (NumberFlow, Sebastian, 2026-11-12: "use this for the main numbers").
 *  It never rolls on first render: a screen that opens shows what is true, at once, and it
 *  stands still under reduced motion. */
export function CountPeso({ value }: { value: number }) {
  return <NumberFlow value={value} format={PESO} locales="en-PH" className="tabular-nums" />
}

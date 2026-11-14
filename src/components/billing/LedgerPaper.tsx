import React from 'react'

// The staff's own way of writing a money sheet (their monthly income statement, 2026-11-14), which Sebastian
// chose for every money sheet the office prints — the month, the year and the day (2026-11-14: "I really
// like this printed design ... including for the daily"): the hotel's name, the sheet's name and its date
// centred, then each block's heading, its lines indented with every amount on the right edge, a rule over
// its total, and the conclusion closed by a double rule. No signatures (his call on the mock).

/** `156645` → `156,645.00`; money going out is bracketed. */
const paperAmount = (n: number, out = false) => {
  const text = Math.abs(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return out || n < 0 ? `(${text})` : text
}

export function PaperTitle({ heading, date }: { heading: string; date: string }) {
  return (
    <div className="text-center pb-2">
      <h1 className="font-display font-extrabold text-[14px] tracking-[0.04em] uppercase">Daweez Pension House</h1>
      <h2 className="font-display font-extrabold text-[12px] tracking-[0.04em] uppercase">{heading}</h2>
      <p className="text-[11px] mt-0.5">{date}</p>
    </div>
  )
}

export function PaperHead({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-extrabold uppercase tracking-[0.04em] pt-2">{children}</p>
}

/** One line of a block, indented under its heading, its amount on the right edge. */
export function PaperRow({ label, amount, out = false, struck, note }: {
  label: string; amount: number; out?: boolean
  /** A payment on a cancelled booking: printed struck through and counted nowhere. */
  struck?: boolean
  note?: string
}) {
  const show = (t: string) => (struck ? <s>{t}</s> : t)
  return (
    <div className={'grid grid-cols-[minmax(0,1fr)_auto] gap-3 pl-4 text-[11.5px] leading-snug' + (struck ? ' text-ink-500' : '')}>
      <span className="truncate">{show(label)}{note && <span className="ml-1 text-[10px] font-extrabold">{note}</span>}</span>
      <span className="font-mono text-right">{amount ? show(paperAmount(amount, out)) : '–'}</span>
    </div>
  )
}

/** A block's total: bold, a rule over its amount. */
export function PaperTotal({ label, amount, out = false }: { label: string; amount: number; out?: boolean }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 pl-10 text-[12px] font-extrabold">
      <span>{label}</span>
      <span className="font-mono text-right border-t border-ink-900 pt-0.5 min-w-[7rem]">{paperAmount(amount, out)}</span>
    </div>
  )
}

/** The sheet's answer, at the bottom, closed by a double rule the way a ledger closes a column. */
export function PaperEnd({ label, amount }: { label: string; amount: number }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pt-4 text-[13px] font-extrabold uppercase">
      <span>{label}</span>
      <span className="font-mono text-right border-b-4 border-double border-ink-900 min-w-[7rem]">{paperAmount(amount)}</span>
    </div>
  )
}

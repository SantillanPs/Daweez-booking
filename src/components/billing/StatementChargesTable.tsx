import React from 'react'
import { StatementBand, StatementLineItem } from '../../utils/statement'

const money = (n: number) => (n < 0 ? '−₱' + Math.abs(n).toLocaleString() : '₱' + n.toLocaleString())

/** `2026-09-25` → `09/25/26`, the way the paper's own Date columns read. */
const shortDate = (iso?: string) => {
  const v = (iso || '').trim()
  if (!v.includes('-')) return v
  const [y, m, d] = v.split('-')
  return m + '/' + d + '/' + (y || '').slice(2)
}

/**
 * The charges table of the printed Guest Billing Statement — **the paper's own table**
 * (the owner's ruling, 2026-09, taken from the hotel's real PGO bill, and applied to BOTH
 * bills): `Room / Particulars · Rate · Date (Check In | Check Out) · No. of Night · Total`,
 * with the charges grouped under bands, the way the paper groups them under
 * `Room Accommodation:`.
 *
 * The bands exist so every kind of money has a home and **nothing is invented**: a band is
 * drawn only when it has rows, which is why a booking that has not checked in yet shows no
 * `Restaurant & bar:` band at all (food follows check-in, card k69). A real staff discount
 * is a row of its own under `Discount:`, so the column of Totals adds up in front of the
 * guest; the gap between a room's night price and its hours price is never printed as one.
 */

const BAND_LABEL: Record<StatementBand, string> = {
  room: 'Room Accommodation:',
  breakfast: 'Breakfast:',
  extras: 'Extras:',
  discount: 'Discount:',
  food: 'Restaurant & bar:',
}

// The order the desk reads money in: what was stayed in, then what was eaten, then extras,
// then anything taken off the price, then the food they ordered.
const BAND_ORDER: StatementBand[] = ['room', 'breakfast', 'extras', 'food', 'discount']

export function StatementChargesTable({ items }: { items: StatementLineItem[] }) {
  const bands = BAND_ORDER
    .map(band => ({ band, rows: items.filter(i => i.band === band) }))
    .filter(b => b.rows.length > 0)

  return (
    // No rule above the table: the owner took the long separating lines out of the
    // statement (2026-09) so the page reads as one form; the table's own border says
    // where the charges start.
    // **And no vertical padding of its own** (card k144): this used to carry `py-3`,
    // which stacked with the field block's `py-3` above it and the payment block's `py-3`
    // below — 24px of air at a boundary that needs 8, which is why the table read as
    // floating. The blocks either side are `py-2` now and own the space, so the spacing
    // lives in ONE place instead of three meeting in the middle.
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-paper-100 text-center text-[9.5px] uppercase tracking-wider text-ink-800">
            <th rowSpan={2} className="border border-ink-400 py-1 px-2 font-bold text-left">Room / Particulars</th>
            <th rowSpan={2} className="border border-ink-400 py-1 px-2 font-bold w-16">Rate</th>
            <th colSpan={2} className="border border-ink-400 py-1 px-2 font-bold">Date</th>
            <th rowSpan={2} className="border border-ink-400 py-1 px-2 font-bold w-16">No. of Night</th>
            <th rowSpan={2} className="border border-ink-400 py-1 px-2 font-bold w-20">Total</th>
          </tr>
          <tr className="bg-paper-100 text-center text-[9px] uppercase tracking-wider text-ink-700">
            <th className="border border-ink-400 py-0.5 px-2 font-bold w-20">Check In</th>
            <th className="border border-ink-400 py-0.5 px-2 font-bold w-20">Check Out</th>
          </tr>
        </thead>
        <tbody>
          {bands.map(({ band, rows }) => (
            <React.Fragment key={band}>
              <tr className="bg-paper-200">
                <td colSpan={6} className="border border-ink-400 py-1 px-2 text-[11px] font-bold text-ink-800">
                  {BAND_LABEL[band]}
                </td>
              </tr>
              {rows.map(it => (
                <tr key={it.key} className="text-[12px]">
                  <td className="border border-ink-300 py-1 px-2">{it.description}</td>
                  <td className="border border-ink-300 py-1 px-2 text-right font-mono">{it.price ? money(it.price) : '—'}</td>
                  <td className="border border-ink-300 py-1 px-2 text-center font-mono text-[11px]">{shortDate(it.checkIn)}</td>
                  <td className="border border-ink-300 py-1 px-2 text-center font-mono text-[11px]">{shortDate(it.checkOut)}</td>
                  {/* The unit lives here when it is not a night: `3 hrs` for a short stay,
                      and the count for anything sold by the piece. */}
                  <td className="border border-ink-300 py-1 px-2 text-center font-mono text-[11px]">
                    {it.band === 'room' && it.unit === 'HOURS' ? it.qty + ' hrs' : it.qty}
                    {it.band !== 'room' && it.unit && it.unit !== 'PC' ? ' ' + it.unit.toLowerCase() : ''}
                  </td>
                  <td className="border border-ink-300 py-1 px-2 text-right font-mono">{money(it.amount)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

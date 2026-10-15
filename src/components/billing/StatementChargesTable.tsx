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

/**
 * `dates={false}` drops the Check In / Check Out columns and calls the count `Qty`: the agency
 * bill says its dates once, in its Stay block (the owner, 2026-10-15: *"make sure to check for
 * redundancies"*). A group whose rooms have different dates then shows only the first room's.
 */
export function StatementChargesTable({ items, dates = true }: { items: StatementLineItem[]; dates?: boolean }) {
  const bands = BAND_ORDER
    .map(band => ({ band, rows: items.filter(i => i.band === band) }))
    .filter(b => b.rows.length > 0)

  // No boxes and no grey header (the owner's pick, 2026-10-13): one thin line under each row.
  // The column names and the band names are labels, so they are grey; everything the guest
  // is charged is black.
  const head = 'pb-1 pl-2 text-[8.5px] font-medium uppercase tracking-[0.08em] text-muted align-bottom whitespace-nowrap'
  const cell = 'py-[3px] pl-2 border-b border-ink-200 text-[11px] font-semibold text-ink-900 whitespace-nowrap'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th rowSpan={dates ? 2 : 1} className={head + ' pl-0 text-left border-b-[1.5px] border-ink-900'}>Room / Particulars</th>
            <th rowSpan={dates ? 2 : 1} className={head + ' text-right w-16 border-b-[1.5px] border-ink-900'}>Rate</th>
            {dates && <th colSpan={2} className={head + ' pb-0.5 text-center border-b border-ink-200'}>Date</th>}
            <th rowSpan={dates ? 2 : 1} className={head + ' text-right w-16 border-b-[1.5px] border-ink-900'}>{dates ? 'No. of Night' : 'Qty'}</th>
            <th rowSpan={dates ? 2 : 1} className={head + ' text-right w-20 border-b-[1.5px] border-ink-900'}>Total</th>
          </tr>
          {dates ? (
            <tr>
              <th className={head + ' pt-0.5 text-right w-[72px] border-b-[1.5px] border-ink-900'}>Check In</th>
              <th className={head + ' pt-0.5 text-right w-[72px] border-b-[1.5px] border-ink-900'}>Check Out</th>
            </tr>
          ) : null}
        </thead>
        <tbody>
          {bands.map(({ band, rows }) => (
            <React.Fragment key={band}>
              <tr>
                <td colSpan={dates ? 6 : 4} className="pt-1 text-[10px] font-medium text-muted">{BAND_LABEL[band]}</td>
              </tr>
              {rows.map(it => (
                <tr key={it.key}>
                  {/* An order slip says whether it is paid, beside its number — on one line. */}
                  <td className={cell + ' pl-0 text-left' + (it.status ? '' : ' whitespace-normal')}>
                    {it.description}
                    {it.status && <span className="ml-1.5 border border-ink-900 px-1 text-[8.5px] font-bold uppercase tracking-wide">{it.status}</span>}
                  </td>
                  <td className={cell + ' text-right font-mono'}>{it.price ? money(it.price) : '—'}</td>
                  {dates && <td className={cell + ' text-right font-mono'}>{shortDate(it.checkIn)}</td>}
                  {dates && <td className={cell + ' text-right font-mono'}>{shortDate(it.checkOut)}</td>}
                  {/* The unit lives here when it is not a night: `3 hrs` for a short stay,
                      and the count for anything sold by the piece. */}
                  <td className={cell + ' text-right font-mono'}>
                    {it.band === 'room' && it.unit === 'HOURS' ? it.qty + ' hrs' : it.qty}
                    {it.band !== 'room' && it.unit && it.unit !== 'PC' ? ' ' + it.unit.toLowerCase() : ''}
                  </td>
                  <td className={cell + ' text-right font-mono font-bold'}>{money(it.amount)}</td>
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

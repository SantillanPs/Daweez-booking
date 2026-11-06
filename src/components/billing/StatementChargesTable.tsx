import React from 'react'
import { X } from 'lucide-react'
import { StatementBand, StatementLineItem, shortDate } from '../../utils/statement'
import { SectionName } from './StatementShell'

const money = (n: number) => (n < 0 ? '−₱' + Math.abs(n).toLocaleString() : '₱' + n.toLocaleString())
/** `2026-10-19` → `10/19`: the paper's one Dates column; the year is in the Stay above it. */
const dayMonth = (iso?: string) => shortDate(iso).split('/').slice(0, 2).join('/')

/**
 * **The extras beside the totals, on paper** (Sebastian, 2026-11-06, the long-bill mock, "D · Beside
 * totals"): each charge the desk added, with its price, and what they come to. They sit in the room
 * left under Payment, so a group's bill spends no table rows on them. Nothing when there are none.
 */
export function PaperExtras({ items }: { items: StatementLineItem[] }) {
  const rows = items.filter(i => i.band === 'extras')
  if (rows.length === 0) return null
  const fig = 'justify-self-end font-mono text-[11px] font-bold text-ink-900 tabular-nums'
  return (
    <div>
      <SectionName>Extras</SectionName>
      <div className="grid grid-cols-[1fr_auto] items-baseline gap-x-2.5 text-[10.5px] font-semibold text-ink-900 leading-snug">
        {rows.map(r => (
          <React.Fragment key={r.key}>
            <span className="min-w-0">
              {r.description}
              {Number(r.qty) > 1 && <span className="text-muted font-medium"> × {r.qty}{r.unit && r.unit !== 'PC' ? ' ' + r.unit.toLowerCase() : ''}</span>}
            </span>
            <span className={fig}>{money(r.amount)}</span>
          </React.Fragment>
        ))}
        {rows.length > 1 && (
          <>
            <span className="mt-0.5 pt-0.5 border-t border-ink-900 text-[10px] text-muted font-medium">Extras total</span>
            <span className={fig + ' mt-0.5 pt-0.5 border-t border-ink-900 w-full text-right'}>{money(rows.reduce((s, r) => s + r.amount, 0))}</span>
          </>
        )}
      </div>
    </div>
  )
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
export function StatementChargesTable({ items, dates = true, paper = false, away = ['extras', 'discount'], onRemove, isNew, renderLine, children }: {
  items: StatementLineItem[]
  /**
   * The printed and emailed copy (Sebastian, 2026-11-06, the long-bill mock, "Tight table" with the
   * extras beside the totals): rows only as tall as their text, Check In and Check Out as one Dates
   * column so a room's name never wraps, and no Extras or Discount band — the paper prints those by
   * the totals (`PaperExtras`, the discount lines in `InvoiceDocument`).
   */
  paper?: boolean
  /** The bands the paper prints elsewhere; the agency's keeps its discount in the table. */
  away?: StatementBand[]
  /** A bill that draws some lines itself (the rooms on the new-booking bill): its row(s), `null` for none, `undefined` for the usual row. */
  renderLine?: (it: StatementLineItem, cell: string) => React.ReactNode | undefined
  dates?: boolean
  /** On a bill the desk is working on: an × that takes a charge it added off (never printed). */
  onRemove?: (it: StatementLineItem) => void
  /** Rows written since the bill opened, which settle in like ink. */
  isNew?: (key: string) => boolean
  /** Rows under the charges — the desk's "Add a charge". */
  children?: React.ReactNode
}) {
  const bands = BAND_ORDER
    .filter(band => !(paper && away.includes(band)))
    .map(band => ({ band, rows: items.filter(i => i.band === band) }))
    .filter(b => b.rows.length > 0)
  const oneDates = paper && dates
  const cols = dates ? (oneDates ? 5 : 6) : 4

  // No boxes and no grey header (the owner's pick, 2026-10-13): one thin line under each row.
  // One row of column names, no "Date" over Check In and Check Out, on screen and on paper
  // (Sebastian, 2026-10-29, on the mock: "remove this").
  // The column names and the band names are labels, so they are grey; everything the guest
  // is charged is black.
  const head = 'pb-1 pl-2 text-[8.5px] font-medium uppercase tracking-[0.08em] text-muted align-bottom whitespace-nowrap'
  const cell = (paper ? 'py-px leading-tight' : 'py-[3px]') + ' pl-2 border-b border-ink-200 text-[11px] font-semibold text-ink-900 whitespace-nowrap'
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={head + ' pl-0 text-left border-b-[1.5px] border-ink-900'}>Room / Particulars</th>
            <th className={head + ' text-right w-16 border-b-[1.5px] border-ink-900'}>Rate</th>
            {oneDates && <th className={head + ' text-right w-[84px] border-b-[1.5px] border-ink-900'}>Dates</th>}
            {dates && !oneDates && <th className={head + ' text-right w-[72px] border-b-[1.5px] border-ink-900'}>Check In</th>}
            {dates && !oneDates && <th className={head + ' text-right w-[72px] border-b-[1.5px] border-ink-900'}>Check Out</th>}
            <th className={head + ' text-right w-16 border-b-[1.5px] border-ink-900'}>{dates ? 'No. of Night' : 'Qty'}</th>
            <th className={head + ' text-right w-20 border-b-[1.5px] border-ink-900'}>Total</th>
          </tr>
        </thead>
        <tbody>
          {bands.map(({ band, rows }) => (
            <React.Fragment key={band}>
              <tr>
                <td colSpan={cols} className={(paper ? 'pt-0.5 leading-tight' : 'pt-1') + ' text-[10px] font-medium text-muted'}>{BAND_LABEL[band]}</td>
              </tr>
              {rows.map(it => renderLine?.(it, cell) !== undefined ? <React.Fragment key={it.key}>{renderLine(it, cell)}</React.Fragment> : (
                <tr key={it.key} className={isNew?.(it.key) ? 'bill-ink' : undefined}>
                  {/* An order slip says whether it is paid, beside its number — on one line. */}
                  <td className={cell + ' pl-0 text-left' + (it.status ? '' : ' whitespace-normal')}>
                    {it.description}
                    {(it.times ?? 1) > 1 && <span className="ml-1.5 border border-ink-900 px-1 font-mono text-[8.5px] font-bold">×{it.times}</span>}
                    {it.status && <span className="ml-1.5 border border-ink-900 px-1 text-[8.5px] font-bold uppercase tracking-wide">{it.status}</span>}
                    {onRemove && it.remove && (
                      <button type="button" data-screen onClick={() => onRemove(it)} aria-label={'Take ' + it.description + ' off the bill'}
                        className="print:hidden -my-1 ml-0.5 p-1 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                  <td className={cell + ' text-right font-mono'}>{it.price ? money(it.price) : '—'}</td>
                  {oneDates && <td className={cell + ' text-right font-mono'}>{it.checkIn ? dayMonth(it.checkIn) + '–' + dayMonth(it.checkOut) : ''}</td>}
                  {dates && !oneDates && <td className={cell + ' text-right font-mono'}>{shortDate(it.checkIn)}</td>}
                  {dates && !oneDates && <td className={cell + ' text-right font-mono'}>{shortDate(it.checkOut)}</td>}
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
          {children}
        </tbody>
      </table>
    </div>
  )
}

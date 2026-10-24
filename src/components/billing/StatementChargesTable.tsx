import React, { useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { StatementBand, StatementLineItem, shortDate } from '../../utils/statement'
import { BillMove } from './BillDesk'
import { NumInput } from '../NumInput'

const money = (n: number) => (n < 0 ? '−₱' + Math.abs(n).toLocaleString() : '₱' + n.toLocaleString())

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
export function StatementChargesTable({ items, dates = true, onRemove, canRemove, onPrice, isNew, move, renderLine, children }: {
  items: StatementLineItem[]
  /** A bill that draws some lines itself (the rooms on the new-booking bill): its row(s), `null` for none, `undefined` for the usual row. */
  renderLine?: (it: StatementLineItem, cell: string) => React.ReactNode | undefined
  /** Rescheduling on the bill: the stay's own line opens the other free rooms under it. */
  move?: BillMove
  dates?: boolean
  /** On a bill the desk is working on: an × that takes a charge it added off (never printed). */
  onRemove?: (it: StatementLineItem) => void
  canRemove?: (key: string) => boolean
  /** On a bill the desk is working on: the room's own price, typed over (the stay's line, `-stay`). */
  onPrice?: (it: StatementLineItem, price: number) => void
  /** Rows written since the bill opened, which settle in like ink. */
  isNew?: (key: string) => boolean
  /** Rows under the charges — the desk's "Add a charge". */
  children?: React.ReactNode
}) {
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
              {rows.map(it => renderLine?.(it, cell) !== undefined ? <React.Fragment key={it.key}>{renderLine(it, cell)}</React.Fragment> : move && it.key === move.lineKey ? (
                <MovableLine key={it.key} it={it} move={move} dates={dates} cell={cell} onPrice={onPrice} />
              ) : (
                <tr key={it.key} className={isNew?.(it.key) ? 'bill-ink' : undefined}>
                  {/* An order slip says whether it is paid, beside its number — on one line. */}
                  <td className={cell + ' pl-0 text-left' + (it.status ? '' : ' whitespace-normal')}>
                    {it.description}
                    {it.status && <span className="ml-1.5 border border-ink-900 px-1 text-[8.5px] font-bold uppercase tracking-wide">{it.status}</span>}
                    {onRemove && it.remove && (!canRemove || canRemove(it.key)) && (
                      <button type="button" data-screen onClick={() => onRemove(it)} aria-label={'Take ' + it.description + ' off the bill'}
                        className="print:hidden -my-1 ml-0.5 p-1 align-middle rounded text-muted opacity-50 hover:opacity-100 hover:text-danger-600 active:scale-90 transition cursor-pointer">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </td>
                  <td className={cell + ' text-right font-mono'}>
                    {onPrice && it.key.endsWith('-stay') && (!canRemove || canRemove(it.key)) ? <RateBox it={it} onPrice={onPrice} /> : it.price ? money(it.price) : '—'}
                  </td>
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
          {children}
        </tbody>
      </table>
    </div>
  )
}

const peso = (n: number) => '₱' + n.toLocaleString()

/**
 * **The stay's line is where its room is changed** (the reschedule mock's "C · On the charge
 * line", Sebastian, 2026-10-22). Its name is written on a dashed gold line; tapped, the other
 * rooms free on those nights open under it as lines of the bill — their own rate and total,
 * and what the whole bill changes by — closest price first. Tapping one moves the stay there;
 * the rooms that are taken are named once, quietly, at the bottom.
 */
function MovableLine({ it, move, dates, cell, onPrice }: { it: StatementLineItem; move: BillMove; dates: boolean; cell: string; onPrice?: (it: StatementLineItem, price: number) => void }) {
  const [open, setOpen] = useState(false)
  const cols = dates ? 6 : 4
  const options = move.units
    .filter(u => u.id !== move.unitId)
    .map(u => ({ ...u, taken: !move.free(u.id, move.checkIn, move.checkOut), ...move.quote(u.id) }))
  const free = options.filter(o => !o.taken).sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))
  const taken = options.filter(o => o.taken)
  const opt = 'py-[5px] pl-2 border-b border-card bg-paper-50 text-[11px] font-semibold text-ink-700 whitespace-nowrap transition-colors group-hover:bg-gold-100 group-focus-visible:bg-gold-100'
  return (
    <>
      {/* A move lands like ink, the same as a charge just written. */}
      <tr key={move.unitId + move.checkIn + move.checkOut} className={move.moved ? 'bill-ink' : undefined}>
        <td className={cell + ' pl-0 text-left whitespace-normal'}>
          <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
            className={'inline-flex items-center gap-1 -ml-0.5 px-0.5 rounded-sm border-b-[1.5px] border-dashed border-gold-400 print:border-0 hover:bg-gold-100 transition-colors cursor-pointer ' + (open ? 'bg-gold-100' : '')}>
            {it.description}
            <ChevronDown aria-hidden="true" className={'print:hidden w-3 h-3 text-gold-600 transition-transform duration-300 ' + (open ? 'rotate-180' : '')} />
          </button>
        </td>
        <td className={cell + ' text-right font-mono'}>{onPrice ? <RateBox it={it} onPrice={onPrice} /> : it.price ? money(it.price) : '—'}</td>
        {dates && <td className={cell + ' text-right font-mono'}>{shortDate(it.checkIn)}</td>}
        {dates && <td className={cell + ' text-right font-mono'}>{shortDate(it.checkOut)}</td>}
        <td className={cell + ' text-right font-mono'}>{it.qty}</td>
        <td className={cell + ' text-right font-mono font-bold'}>{money(it.amount)}</td>
      </tr>
      {open && free.map((o, i) => (
        <tr key={o.id} data-screen tabIndex={0} role="button" aria-label={'Move to ' + o.label}
          onClick={() => { setOpen(false); move.onMove(o.id, move.checkIn, move.checkOut) }}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(false); move.onMove(o.id, move.checkIn, move.checkOut) } }}
          style={{ '--i': i } as React.CSSProperties}
          className="group print:hidden cursor-pointer outline-none bw-rise">
          <td className={opt + ' pl-2.5 text-left'}>
            {o.label}
            <span className={'ml-1.5 px-1.5 py-px rounded text-[9.5px] font-bold ' + (o.diff > 0 ? 'bg-gold-100 text-gold-800 group-hover:bg-card' : o.diff < 0 ? 'bg-emerald-50 text-emerald-800' : 'bg-ink-100 text-muted')}>
              {o.diff === 0 ? 'Same price' : (o.diff > 0 ? '+' : '−') + peso(Math.abs(o.diff))}
            </span>
          </td>
          <td className={opt + ' text-right font-mono'}>{money(o.rate)}</td>
          {dates && <td className={opt + ' text-right font-mono'}>{shortDate(it.checkIn)}</td>}
          {dates && <td className={opt + ' text-right font-mono'}>{shortDate(it.checkOut)}</td>}
          <td className={opt + ' text-right font-mono'}>{it.qty}</td>
          <td className={opt + ' pr-2 text-right font-mono'}>{money(o.amount)}</td>
        </tr>
      ))}
      {open && (
        <tr data-screen className="print:hidden">
          <td colSpan={cols} style={{ '--i': free.length } as React.CSSProperties} className="py-1.5 px-2.5 bg-paper-50 text-[10px] text-muted bw-rise">
            {free.length === 0 ? 'No other room is free those nights.' : taken.length > 0 ? 'Taken those nights: ' + taken.map(t => t.label.split(' · ')[0]).join(', ') : 'Every room is free those nights.'}
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * **The room's price is typed on the bill** (Sebastian, 2026-10-24, on the "What the Bill
 * Edits" mock: "the price of the rooms should be editable"). The rate is a gold box; what is
 * typed is saved when the box is left or Enter is pressed, as the booking's own price, and the
 * line's total and the bill follow. Escape puts the old price back. On paper it is the figure.
 */
function RateBox({ it, onPrice }: { it: StatementLineItem; onPrice: (it: StatementLineItem, price: number) => void }) {
  const [price, setPrice] = useState(it.price)
  const [was, setWas] = useState(it.price)
  // The bill priced again from outside (a payment, a move): the box shows the new figure.
  if (it.price !== was) { setWas(it.price); setPrice(it.price) }
  const save = () => { if (price > 0 && price !== it.price) onPrice(it, price); else setPrice(it.price) }
  return (
    <>
      <span className="hidden print:inline">{money(it.price)}</span>
      <label data-screen className="print:hidden inline-flex items-baseline justify-end gap-px -my-0.5 px-1 rounded-t-sm border-b-2 border-ink-900 bg-gold-100 hover:bg-gold-200/70 focus-within:bg-card focus-within:border-gold-600 transition-colors cursor-text">
        <span className="text-[9px] font-bold text-muted">₱</span>
        <NumInput value={price} onChange={setPrice} allowDecimal={false} aria-label={'Price of ' + it.description}
          onBlur={save}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur() }
            if (e.key === 'Escape') { e.stopPropagation(); setPrice(it.price); setTimeout(() => (e.target as HTMLInputElement).blur()) }
          }}
          className="w-12 bg-transparent border-0 p-0 text-right font-mono text-[11px] font-bold text-ink-900 outline-none" />
      </label>
    </>
  )
}

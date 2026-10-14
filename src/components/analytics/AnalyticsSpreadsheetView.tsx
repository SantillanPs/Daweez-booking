import React, { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'

interface RoomRevenue {
  id: string
  room_number: number
  name: string
  base: number
  breakfast: number
  rentals: number
  total: number
}

interface AnalyticsCalculations {
  periodLabel: string
  totalRevenue: number
  pensionExtras: number
  vacationExtras: number
  gardenExtras: number
  gazeboExtras: number
  totalExtras: number
  vacationTotal: number
  gardenTotal: number
  gazeboTotal: number
  totalExpenses: number
  netProfit: number
  totalPension: number
  totalPensionBase: number
  totalPensionBreakfast: number
  totalPensionRentals: number
  totalVacationHouse: number
  totalGardenArea: number
  totalGazebo: number
  /** Food and bar money ordered this period, from the stay tabs and the walk-in tabs (k69). */
  restaurantTotal: number
  roomRevenues: RoomRevenue[]
}

interface AnalyticsSpreadsheetViewProps {
  calculations: AnalyticsCalculations
}

// The Earnings Report (board card k69, part E).
//
// Every place the money comes from is a row, and the restaurant and bar is its own row rather than being
// folded into a room — the owner runs it as its own business.
//
// It was a grid of kinds of money, but each place filled only one column, so most of it was dashes and the
// venues sat under "Room rate". The owner found it "messy and too plain" and chose this list (2026-10-14):
// the profit first, as on the Charts view, then each place, and the kinds of money only under the place that
// has them. The places keep one order, so each is always where the eye expects it; the owner had the Vacation
// House moved below the restaurant (2026-10-14).
//
// Drawn as a ledger (the owner, 2026-10-14: the full-width list was "a bit hard to read"; chosen from a
// mock): a line between places, every amount in one right-hand column, and a short share bar out of 100%
// beside it, so the eye no longer crosses a bar the width of the screen to reach a figure.
const peso = (n: number) => '₱' + Math.round(n).toLocaleString()

type Part = [string, number]

/** A place's share of the money in, out of 100%. Left out for a place that earned nothing. */
const Share: React.FC<{ pct: number }> = ({ pct }) => (
  <span className="col-span-2 sm:col-span-1 grid grid-cols-[minmax(0,1fr)_2.75rem] items-center gap-2.5">
    <span className="block h-2 rounded-full bg-page overflow-hidden">
      <span className="block h-full w-[var(--w)] rounded-full bg-emerald-600 transition-[width] duration-500 ease-out" style={{ '--w': pct + '%' } as React.CSSProperties} />
    </span>
    <span className="font-mono text-[12.5px] text-muted text-right">{pct}%</span>
  </span>
)

const grid = 'grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_9rem_11rem] items-center gap-x-6 gap-y-2 px-4 sm:px-6'

export const AnalyticsSpreadsheetView: React.FC<AnalyticsSpreadsheetViewProps> = ({ calculations: c }) => {
  const [roomsOpen, setRoomsOpen] = useState(false)
  const loss = c.netProfit < 0

  const places: { id: string; name: string; hint?: string; total: number; parts: Part[] }[] = [
    { id: 'pension', name: 'Pension', hint: 'Rooms 1–10', total: c.totalPension, parts: [['Room rate', c.totalPensionBase], ['Breakfast', c.totalPensionBreakfast], ['Extras', c.totalPensionRentals]] },
    { id: 'food', name: 'Restaurant & bar', total: c.restaurantTotal, parts: [] },
    { id: 'vacation', name: 'Vacation House', total: c.vacationTotal, parts: [['Booking', c.totalVacationHouse], ['Extras', c.vacationExtras]] },
    { id: 'garden', name: 'Garden Area', total: c.gardenTotal, parts: [['Booking', c.totalGardenArea], ['Extras', c.gardenExtras]] },
    { id: 'gazebo', name: 'Gazebo', total: c.gazeboTotal, parts: [['Booking', c.totalGazebo], ['Extras', c.gazeboExtras]] },
  ]
  const pctOf = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)
  // the kinds of money show only where there is more than one, so a place is not split into a lone part
  const split = (parts: Part[]) => {
    const shown = parts.filter(([, n]) => n > 0)
    return shown.length > 1 || (shown.length === 1 && shown[0][0] === 'Extras') ? shown : []
  }

  return (
    <div className="bg-card border border-soft rounded-2xl overflow-hidden">
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)] border-b border-soft">
        <div className="col-span-2 sm:col-span-1 px-5 py-4 flex flex-col gap-1">
          <span className="text-[13px] font-semibold text-muted">{loss ? 'Loss' : 'Profit'}</span>
          <span className={`font-mono text-[36px] leading-none font-extrabold tracking-tight ${loss ? 'text-danger-600' : 'text-emerald-600'}`}>
            {loss && '('}<AnimatedNumber prefix="₱" value={Math.abs(c.netProfit)} />{loss && ')'}
          </span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1 border-t sm:border-t-0 sm:border-l border-soft">
          <span className="text-[13px] font-semibold text-muted">Money in</span>
          <span className="font-mono text-[20px] font-extrabold text-main">{peso(c.totalRevenue)}</span>
        </div>
        <div className="px-5 py-4 flex flex-col gap-1 border-t border-l border-soft sm:border-t-0">
          <span className="text-[13px] font-semibold text-muted">Spent</span>
          {/* always red, as money going out (the owner, 2026-10-14); brackets only round an amount, never ₱0 */}
          <span className="font-mono text-[20px] font-extrabold text-danger-600">
            {c.totalExpenses ? '(' + peso(c.totalExpenses) + ')' : peso(0)}
          </span>
        </div>
      </div>

      <div className={`${grid} hidden sm:grid pt-3.5 pb-2.5 border-b border-soft text-[11px] font-bold uppercase tracking-wider text-muted`}>
        <span>Where it came from</span><span className="text-right">Earned</span><span>Share of money in</span>
      </div>
      <ul className="divide-y divide-soft">
        {places.map(p => {
          const parts = split(p.parts)
          const pension = p.id === 'pension'
          const body = (
            <>
              <span className="flex flex-col gap-1.5 min-w-0">
                <span className={`flex items-center gap-2 text-[15px] font-bold ${p.total ? 'text-main' : 'text-ink-300'}`}>
                  {pension && <ChevronRight className={`w-4 h-4 shrink-0 text-muted transition-transform ${roomsOpen ? 'rotate-90' : ''}`} strokeWidth={2.5} />}
                  <span className="truncate">{p.name}</span>
                  {p.hint && <span className="text-[13px] font-medium text-muted shrink-0">{p.hint}</span>}
                </span>
                {parts.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {parts.map(([label, n]) => (
                      <span key={label} className="text-[12.5px] text-main bg-page rounded-md px-2 py-0.5"><span className="text-muted mr-1">{label}</span>{peso(n)}</span>
                    ))}
                  </span>
                )}
              </span>
              <span className={`font-mono text-[16px] font-extrabold text-right ${p.total ? 'text-emerald-600' : 'text-ink-300'}`}>{p.total ? peso(p.total) : '–'}</span>
              {p.total > 0 ? <Share pct={pctOf(p.total, c.totalRevenue)} /> : <span className="hidden sm:block" />}
            </>
          )
          return (
            <li key={p.id}>
              {/* the whole Pension row opens the ten rooms, so it is a 44px target, not a small chevron */}
              {pension ? (
                <button type="button" onClick={() => setRoomsOpen(open => !open)} aria-expanded={roomsOpen}
                  className={`${grid} w-full min-h-14 py-3.5 text-left cursor-pointer hover:bg-page transition-colors`}>
                  {body}
                </button>
              ) : (
                <div className={`${grid} min-h-14 py-3.5 hover:bg-page transition-colors`}>{body}</div>
              )}
              {pension && roomsOpen && (
                <ul className="pb-2">
                  {c.roomRevenues.map(r => (
                    <li key={r.id} className={`${grid} py-1.5 sm:pl-12`}>
                      <span className={`text-[13px] truncate ${r.total ? 'text-main font-medium' : 'text-ink-300'}`}>Room {r.room_number} · {r.name}</span>
                      <span className={`font-mono text-[13px] font-bold text-right ${r.total ? 'text-emerald-600' : 'text-ink-300'}`}>{r.total ? peso(r.total) : '–'}</span>
                      {/* a room's share is of the Pension, so the ten add up to its 100% */}
                      {r.total > 0 ? <Share pct={pctOf(r.total, c.totalPension)} /> : <span className="hidden sm:block" />}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

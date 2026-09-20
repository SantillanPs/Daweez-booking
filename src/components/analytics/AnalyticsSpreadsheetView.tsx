import React, { useState } from 'react'
import { ChevronDown, ChevronRight, BedDouble, House, Flower2, PartyPopper, Coins, Coffee, PackagePlus, PieChart, CircleDollarSign, Building2, Utensils } from 'lucide-react'
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
// Every row is a place the money comes from and every column a kind of money, so
// the restaurant and bar is its own row rather than being folded into a room —
// the owner runs it as its own business, and food money that quietly landed in
// the room column would read as rooms earning more than they did.
export const AnalyticsSpreadsheetView: React.FC<AnalyticsSpreadsheetViewProps> = ({ calculations }) => {
  const [isPensionExpanded, setIsPensionExpanded] = useState(false)
  const dash = <span className="text-slate-300 font-normal">-</span>

  return (
    <div className="bg-card border border-soft rounded-xl overflow-hidden">
      <div className="p-4 border-b border-soft flex items-center justify-between gap-3">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Report</h4>
          <p className="text-[10px] text-muted">Where your money comes from{calculations.totalRevenue === 0 && calculations.totalExpenses === 0 ? ' — nothing recorded yet this period' : ''}</p>
        </div>
        <span className="text-[10px] font-semibold text-brand-text bg-brand-bg border border-brand-border rounded-full px-3 py-1 whitespace-nowrap">
          {calculations.periodLabel}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-100/50 border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
              <th className="py-4 px-5" title="Which room or venue the money came from"><span className="inline-flex items-center gap-1"><Building2 className="w-3.5 h-3.5 text-slate-400" />Area / Room</span></th>
              <th className="py-4 px-5 text-right" title="Money from the room's nightly rate"><span className="inline-flex items-center gap-1 justify-end"><Coins className="w-3.5 h-3.5 text-[#2E7D78]" />Room Rate</span></th>
              <th className="py-4 px-5 text-right" title="Money from breakfast served during stays"><span className="inline-flex items-center gap-1 justify-end"><Coffee className="w-3.5 h-3.5 text-[#C9922F]" />Breakfast</span></th>
              <th className="py-4 px-5 text-right" title="Money from the restaurant and bar — the food and drinks ordered on a tab"><span className="inline-flex items-center gap-1 justify-end"><Utensils className="w-3.5 h-3.5 text-brand-text" />Restaurant &amp; bar</span></th>
              <th className="py-4 px-5 text-right" title="Money from extra items (rentals, linens, etc.)"><span className="inline-flex items-center gap-1 justify-end"><PackagePlus className="w-3.5 h-3.5 text-[#0EA5E9]" />Extras</span></th>
              <th className="py-4 px-5 text-right" title="Share of everything that came in"><span className="inline-flex items-center gap-1 justify-end"><PieChart className="w-3.5 h-3.5 text-slate-500" />% of Total</span></th>
              <th className="py-4 px-5 text-right text-slate-800" title="Every column added up for this row"><span className="inline-flex items-center gap-1 justify-end"><CircleDollarSign className="w-3.5 h-3.5 text-emerald-600" />Total Earned</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-main text-sm">
            {/* Row 1: Pension */}
            <tr 
              className="cursor-pointer hover:bg-slate-50 transition-colors group"
              onClick={() => setIsPensionExpanded(!isPensionExpanded)}
            >
              <td className="py-4 px-5 font-semibold flex items-center gap-3">
                <div className="p-1 rounded bg-slate-100 group-hover:bg-slate-200 transition-colors">
                  {isPensionExpanded ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#2E7D78]/10 text-[#2E7D78] flex items-center justify-center shrink-0"><BedDouble className="w-3.5 h-3.5" /></span>
                  <span className="text-slate-800">Pension <span className="text-slate-500 font-normal">(Rooms 1-10)</span></span>
                </div>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#2E7D78]">₱{calculations.totalPensionBase.toLocaleString()}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#C9922F]">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#0EA5E9]">₱{calculations.totalPensionRentals.toLocaleString()}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-600">
                {calculations.totalRevenue > 0 ? Math.round((calculations.totalPension / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700"><AnimatedNumber prefix="₱" value={calculations.totalPension} /></td>
            </tr>

            {/* Pension Individual Rooms */}
            {isPensionExpanded && calculations.roomRevenues.map((room, idx) => (
              <tr key={room.id} className={`hover:bg-slate-50 transition-colors ${idx % 2 === 0 ? 'bg-slate-50/50' : 'bg-white'}`}>
                <td className="py-3 px-5 pl-[52px] text-[13px] font-semibold text-slate-800 flex items-center gap-2 relative">
                  <div className="absolute left-[30px] top-0 bottom-0 w-px bg-slate-200"></div>
                  <div className="absolute left-[30px] top-1/2 w-3 h-px bg-slate-200"></div>
                  <span className="text-slate-400 font-normal">Room {room.room_number}</span><span>{room.name}</span>
                </td>
                <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                  {room.base > 0 ? <span className="text-[#2E7D78]">{`₱${Math.round(room.base).toLocaleString()}`}</span> : dash}
                </td>
                <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                  {room.breakfast > 0 ? <span className="text-[#C9922F]">{`₱${Math.round(room.breakfast).toLocaleString()}`}</span> : dash}
                </td>
                <td className="py-3 px-5 text-right">{dash}</td>
                <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                  {room.rentals > 0 ? <span className="text-[#0EA5E9]">{`₱${Math.round(room.rentals).toLocaleString()}`}</span> : dash}
                </td>
                <td className="py-3 px-5 text-right font-mono font-medium text-[13px] text-slate-600">
                  {calculations.totalRevenue > 0 && room.total > 0 ? `${Math.round((room.total / calculations.totalRevenue) * 100)}%` : <span className="text-slate-300">-</span>}
                </td>
                <td className="py-3 px-5 text-right font-mono font-bold text-[13px] text-emerald-700">
                  {room.total > 0 ? <AnimatedNumber prefix="₱" value={room.total} /> : dash}
                </td>
              </tr>
            ))}

            {/* Row 2: Vacation House */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-6 h-6 rounded-full bg-[#4A90E2]/10 text-[#4A90E2] flex items-center justify-center shrink-0"><House className="w-3.5 h-3.5" /></span>
                <span className="text-slate-800">Vacation House</span>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#2E7D78]">
                ₱{Math.round(calculations.totalVacationHouse).toLocaleString()}
              </td>
              <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right font-mono font-semibold text-[#0EA5E9]">{calculations.vacationExtras > 0 ? `₱${calculations.vacationExtras.toLocaleString()}` : dash}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-600">
                {calculations.totalRevenue > 0 ? Math.round((calculations.vacationTotal / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.vacationTotal} />
              </td>
            </tr>

            {/* Row 3: Garden Area */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-6 h-6 rounded-full bg-[#2ECC71]/10 text-[#2ECC71] flex items-center justify-center shrink-0"><Flower2 className="w-3.5 h-3.5" /></span>
                <span className="text-slate-800">Garden Area</span>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#2E7D78]">
                ₱{Math.round(calculations.totalGardenArea).toLocaleString()}
              </td>
              <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right font-mono font-semibold text-[#0EA5E9]">{calculations.gardenExtras > 0 ? `₱${calculations.gardenExtras.toLocaleString()}` : dash}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-600">
                {calculations.totalRevenue > 0 ? Math.round((calculations.gardenTotal / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.gardenTotal} />
              </td>
            </tr>

            {/* Row 4: Gazebo */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-6 h-6 rounded-full bg-[#F39C12]/10 text-[#F39C12] flex items-center justify-center shrink-0"><PartyPopper className="w-3.5 h-3.5" /></span>
                <span className="text-slate-800">Gazebo</span>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#2E7D78]">
                ₱{Math.round(calculations.totalGazebo).toLocaleString()}
              </td>
              <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right font-mono font-semibold text-[#0EA5E9]">{calculations.gazeboExtras > 0 ? `₱${calculations.gazeboExtras.toLocaleString()}` : dash}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-600">
                {calculations.totalRevenue > 0 ? Math.round((calculations.gazeboTotal / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.gazeboTotal} />
              </td>
            </tr>

            {/* Row 5: Restaurant & bar (k69) — the food and drinks, on their own line */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-6 h-6 rounded-full bg-brand-bg text-brand-text flex items-center justify-center shrink-0"><Utensils className="w-3.5 h-3.5" /></span>
                <span className="text-slate-800">Restaurant &amp; bar</span>
              </td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-brand-text">
                {calculations.restaurantTotal > 0 ? `₱${calculations.restaurantTotal.toLocaleString()}` : dash}
              </td>
              <td className="py-4 px-5 text-right">{dash}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-600">
                {calculations.totalRevenue > 0 ? Math.round((calculations.restaurantTotal / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.restaurantTotal} />
              </td>
            </tr>

          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-slate-800">
              <td className="py-5 px-5 font-bold text-[13px] uppercase tracking-wider">Total Money In</td>
              <td className="py-5 px-5 text-right font-mono font-bold text-[#2E7D78]">
                ₱{(calculations.totalPensionBase + calculations.totalVacationHouse + calculations.totalGardenArea + calculations.totalGazebo).toLocaleString()}
              </td>
              <td className="py-5 px-5 text-right font-mono font-bold text-[#C9922F]">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
              <td className="py-5 px-5 text-right font-mono font-bold text-brand-text">₱{calculations.restaurantTotal.toLocaleString()}</td>
              <td className="py-5 px-5 text-right font-mono font-bold text-[#0EA5E9]">₱{calculations.totalExtras.toLocaleString()}</td>
              <td className="py-5 px-5 text-right font-mono font-black text-slate-600 text-[17px]">100%</td>
              <td className="py-5 px-5 text-right font-mono font-black text-emerald-700 text-[17px]"><AnimatedNumber prefix="₱" value={calculations.totalRevenue} /></td>
            </tr>
            <tr className="border-t border-slate-200 bg-rose-50/50 text-rose-800">
              <td className="py-4 px-5 font-bold text-[13px] uppercase tracking-wider text-rose-600" colSpan={5}>Total Money Out (Expenses)</td>
              <td className="py-4 px-5 text-right"></td>
              <td className="py-4 px-5 text-right font-mono font-black text-rose-600 text-[17px]">
                -<AnimatedNumber prefix="₱" value={calculations.totalExpenses} />
              </td>
            </tr>
            <tr className="bg-slate-900 text-white shadow-xl relative overflow-hidden">
              <td className="py-6 px-6 font-black tracking-widest text-[15px] uppercase relative z-10" colSpan={5}>
                Your Profit <span className="font-medium text-slate-400 text-xs ml-2 tracking-normal">(Money In - Money Out)</span>
              </td>
              <td className="py-6 px-6 text-right relative z-10"></td>
              <td className="py-6 px-6 text-right font-mono font-black text-3xl text-emerald-400 relative z-10">
                <AnimatedNumber prefix="₱" value={calculations.netProfit} />
              </td>
              {/* Decorative background element for the profit row */}
              <div className="absolute top-0 right-0 bottom-0 w-1/2 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none"></div>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { AnimatedNumber } from '../AnimatedNumber'

interface RoomRevenue {
  id: string
  name: string
  base: number
  breakfast: number
  rentals: number
  total: number
}

interface AnalyticsCalculations {
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  totalPension: number
  totalPensionBase: number
  totalPensionBreakfast: number
  totalPensionRentals: number
  totalVacationHouse: number
  totalGardenArea: number
  totalGazebo: number
  roomRevenues: RoomRevenue[]
}

interface AnalyticsSpreadsheetViewProps {
  calculations: AnalyticsCalculations
}

export const AnalyticsSpreadsheetView: React.FC<AnalyticsSpreadsheetViewProps> = ({ calculations }) => {
  const [isPensionExpanded, setIsPensionExpanded] = useState(false)

  return (
    <div className="bg-card border border-soft rounded-xl overflow-hidden">
      <div className="p-4 border-b border-soft flex items-center justify-between">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Report</h4>
          <p className="text-[10px] text-muted">Detailed breakdown of where your money comes from</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse whitespace-nowrap">
          <thead>
            <tr className="bg-slate-100/50 border-b-2 border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[11px]">
              <th className="py-4 px-5">Area / Room</th>
              <th className="py-4 px-5 text-right">Room Rate</th>
              <th className="py-4 px-5 text-right">Breakfast</th>
              <th className="py-4 px-5 text-right">Extras</th>
              <th className="py-4 px-5 text-right">% of Total</th>
              <th className="py-4 px-5 text-right text-slate-800">Total Earned</th>
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
                  <span className="w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
                  <span className="text-slate-800">Pension <span className="text-slate-500 font-normal">(Rooms 1-10)</span></span>
                </div>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">₱{calculations.totalPensionBase.toLocaleString()}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">₱{calculations.totalPensionRentals.toLocaleString()}</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-brand-primary">
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
                  {room.name}
                </td>
                <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                  {room.base > 0 ? `₱${Math.round(room.base).toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                </td>
                <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                  {room.breakfast > 0 ? `₱${Math.round(room.breakfast).toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                </td>
                <td className="py-3 px-5 text-right font-mono text-[13px] font-semibold text-slate-800">
                  {room.rentals > 0 ? `₱${Math.round(room.rentals).toLocaleString()}` : <span className="text-slate-300 font-normal">-</span>}
                </td>
                <td className="py-3 px-5 text-right font-mono font-medium text-[13px] text-slate-500">
                  {calculations.totalRevenue > 0 && room.total > 0 ? `${Math.round((room.total / calculations.totalRevenue) * 100)}%` : <span className="text-slate-300">-</span>}
                </td>
                <td className="py-3 px-5 text-right font-mono font-bold text-[13px] text-emerald-700">
                  {room.total > 0 ? <AnimatedNumber prefix="₱" value={room.total} /> : <span className="text-slate-300 font-normal">-</span>}
                </td>
              </tr>
            ))}

            {/* Row 2: Vacation House */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#4A90E2]"></span>
                <span className="text-slate-800">Vacation House</span>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                ₱{Math.round(calculations.totalVacationHouse).toLocaleString()}
              </td>
              <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
              <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500 text-xs italic">Included</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#4A90E2]">
                {calculations.totalRevenue > 0 ? Math.round((calculations.totalVacationHouse / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.totalVacationHouse} />
              </td>
            </tr>

            {/* Row 3: Garden Area */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]"></span>
                <span className="text-slate-800">Garden Area</span>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                ₱{Math.round(calculations.totalGardenArea).toLocaleString()}
              </td>
              <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
              <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500 text-xs italic">Included</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#2ECC71]">
                {calculations.totalRevenue > 0 ? Math.round((calculations.totalGardenArea / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.totalGardenArea} />
              </td>
            </tr>

            {/* Row 4: Gazebo */}
            <tr className="hover:bg-slate-50 transition-colors">
              <td className="py-4 px-5 font-semibold flex items-center gap-2 pl-[44px]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]"></span>
                <span className="text-slate-800">Gazebo</span>
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-slate-800">
                ₱{Math.round(calculations.totalGazebo).toLocaleString()}
              </td>
              <td className="py-4 px-5 text-right font-mono font-medium text-slate-300">-</td>
              <td className="py-4 px-5 text-right font-mono font-semibold text-slate-500 text-xs italic">Included</td>
              <td className="py-4 px-5 text-right font-mono font-bold text-[#F39C12]">
                {calculations.totalRevenue > 0 ? Math.round((calculations.totalGazebo / calculations.totalRevenue) * 100) : 0}%
              </td>
              <td className="py-4 px-5 text-right font-mono font-bold text-emerald-700">
                <AnimatedNumber prefix="₱" value={calculations.totalGazebo} />
              </td>
            </tr>

          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 text-slate-800">
              <td className="py-5 px-5 font-bold text-[13px] uppercase tracking-wider">Total Money In</td>
              <td className="py-5 px-5 text-right font-mono font-bold">
                ₱{(calculations.totalPensionBase + calculations.totalVacationHouse + calculations.totalGardenArea + calculations.totalGazebo).toLocaleString()}
              </td>
              <td className="py-5 px-5 text-right font-mono font-bold text-slate-500">₱{calculations.totalPensionBreakfast.toLocaleString()}</td>
              <td className="py-5 px-5 text-right font-mono font-bold text-slate-500">₱{calculations.totalPensionRentals.toLocaleString()}</td>
              <td className="py-5 px-5 text-right font-mono font-black text-brand-primary text-[17px]">100%</td>
              <td className="py-5 px-5 text-right font-mono font-black text-emerald-700 text-[17px]"><AnimatedNumber prefix="₱" value={calculations.totalRevenue} /></td>
            </tr>
            <tr className="border-t border-slate-200 bg-rose-50/50 text-rose-800">
              <td className="py-4 px-5 font-bold text-[13px] uppercase tracking-wider text-rose-600" colSpan={4}>Total Money Out (Expenses)</td>
              <td className="py-4 px-5 text-right"></td>
              <td className="py-4 px-5 text-right font-mono font-black text-rose-600 text-[17px]">
                -<AnimatedNumber prefix="₱" value={calculations.totalExpenses} />
              </td>
            </tr>
            <tr className="bg-slate-900 text-white shadow-xl relative overflow-hidden">
              <td className="py-6 px-6 font-black tracking-widest text-[15px] uppercase relative z-10" colSpan={4}>
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

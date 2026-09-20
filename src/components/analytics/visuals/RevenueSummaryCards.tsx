import React from 'react'
import { AnimatedNumber } from '../../AnimatedNumber'

interface RevenueSummaryCardsProps {
  totalPension: number
  totalPensionBase: number
  totalPensionBreakfast: number
  totalVacationHouse: number
  totalGardenArea: number
  totalGazebo: number
  /** Food and bar money this period (k69, part E). */
  restaurantTotal: number
}

export const RevenueSummaryCards: React.FC<RevenueSummaryCardsProps> = ({
  totalPension,
  totalPensionBase,
  totalPensionBreakfast,
  totalVacationHouse,
  totalGardenArea,
  totalGazebo,
  restaurantTotal
}) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      {/* Card 1: Pension Income */}
      <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Pension (Rms 1-10)</span>
          <span className="w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
        </div>
        <div className="mt-3">
          <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600">
            <AnimatedNumber prefix="₱" value={totalPension} />
          </h3>
          <p className="text-[10px] text-muted mt-1">
            Base: ₱{totalPensionBase.toLocaleString()} | Breakfast: ₱{totalPensionBreakfast.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Card 2: Vacation House Income */}
      <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Vacation House</span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#4A90E2]"></span>
        </div>
        <div className="mt-3">
          <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600">
            <AnimatedNumber prefix="₱" value={totalVacationHouse} />
          </h3>
          <p className="text-[10px] text-muted mt-1">Property Rental + Add-ons</p>
        </div>
      </div>

      {/* Card 3: Garden Area Income */}
      <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Garden Area</span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#2ECC71]"></span>
        </div>
        <div className="mt-3">
          <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600">
            <AnimatedNumber prefix="₱" value={totalGardenArea} />
          </h3>
          <p className="text-[10px] text-muted mt-1">Event Venue + Equipment</p>
        </div>
      </div>

      {/* Card 4: Gazebo Income */}
      <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Gazebo</span>
          <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]"></span>
        </div>
        <div className="mt-3">
          <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600">
            <AnimatedNumber prefix="₱" value={totalGazebo} />
          </h3>
          <p className="text-[10px] text-muted mt-1">Event Venue + Equipment</p>
        </div>
      </div>

      {/* Card 5: Restaurant & bar Income (k69) */}
      <div className="bg-card border-2 border-brand-border rounded-xl p-4 flex flex-col justify-between shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-[10px] sm:text-xs font-bold text-muted uppercase tracking-wider">Restaurant &amp; bar</span>
          <span className="w-2.5 h-2.5 rounded-full bg-brand-primary"></span>
        </div>
        <div className="mt-3">
          <h3 className="text-xl sm:text-2xl font-extrabold text-emerald-600">
            <AnimatedNumber prefix="₱" value={restaurantTotal} />
          </h3>
          <p className="text-[10px] text-muted mt-1">Food &amp; drinks ordered on a tab</p>
        </div>
      </div>
    </div>
  )
}

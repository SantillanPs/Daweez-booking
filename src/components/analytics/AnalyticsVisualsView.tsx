import React from 'react'
import { RevenueSummaryCards } from './visuals/RevenueSummaryCards'
import { RevenueTrendChart, TrendSlot } from './visuals/RevenueTrendChart'
import { RevenueDonutChart, DonutSegment } from './visuals/RevenueDonutChart'

interface AnalyticsCalculations {
  totalPension: number
  totalPensionBase: number
  totalPensionBreakfast: number
  totalVacationHouse: number
  totalGardenArea: number
  totalGazebo: number
}

interface AnalyticsVisualsViewProps {
  calculations: AnalyticsCalculations
  trendSlots: TrendSlot[]
  donutSegments: DonutSegment[]
}

export const AnalyticsVisualsView: React.FC<AnalyticsVisualsViewProps> = ({
  calculations,
  trendSlots,
  donutSegments
}) => {
  return (
    <>
      <RevenueSummaryCards 
        totalPension={calculations.totalPension}
        totalPensionBase={calculations.totalPensionBase}
        totalPensionBreakfast={calculations.totalPensionBreakfast}
        totalVacationHouse={calculations.totalVacationHouse}
        totalGardenArea={calculations.totalGardenArea}
        totalGazebo={calculations.totalGazebo}
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RevenueTrendChart trendSlots={trendSlots} />
        <RevenueDonutChart donutSegments={donutSegments} />
      </div>
    </>
  )
}

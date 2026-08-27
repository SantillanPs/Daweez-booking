import { defineChart } from '@tanstack/charts'
import { pie, polar, radialArc } from '@tanstack/charts/polar'
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal'
import React, { useMemo } from 'react'
import { Chart } from '@tanstack/charts/react'
import { AnimatedNumber } from '../../AnimatedNumber'

export interface DonutSegment {
  name: string
  value: number
  color: string
  percentage: number
  renderPercent: number
  renderStartPercent: number
}

interface RevenueDonutChartProps { donutSegments: DonutSegment[] }
export const RevenueDonutChart: React.FC<RevenueDonutChartProps> = ({ donutSegments }) => {
  const definition = useMemo(() => {
    if (donutSegments.length === 0) return null
    // Suppress the supporting data addon (security_deposit 500) from inflating the share.
    const billable = donutSegments.filter(s => s.value > 0)
    if (billable.length === 0) return null
    const slices = pie(billable, { value: 'value' })
    return defineChart({
      marks: [
        polar({
          inset: 8,
          radiusRatio: 0.82,
          marks: [
            radialArc(slices, {
              // donut: hole via innerRadius (function keeps it responsive)
              innerRadius: ({ radius }: { radius: number }) => radius * 0.58,
              cornerRadius: 4,
              color: 'name',
              key: 'name',
              fill: (d: DonutSegment) => d.color,
            }),
          ],
        }),
      ],
      color: {
        scale: () => scaleOrdinal<string, string>().range(billable.map(s => s.color)).domain(billable.map(s => s.name)),
      },
      svgAnimation: true,
    })
  }, [donutSegments])

  if (donutSegments.length === 0) {
    return (
      <div className="bg-card border border-soft rounded-xl p-4 flex flex-col min-h-[240px]">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Share</h4>
          <p className="text-[10px] text-muted">Breakdown of where your money comes from</p>
        </div>
        <div className="flex-1 grid place-items-center text-xs text-muted">No earnings data</div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-soft rounded-xl p-4 flex flex-col">
      <div>
        <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Share</h4>
        <p className="text-[10px] text-muted">Breakdown of where your money comes from</p>
      </div>
      <div className="py-2">
        <Chart definition={definition!} height={220} ariaLabel="Earnings share by property" />
      </div>
      <div className="space-y-1.5 border-t border-soft pt-3">
        {donutSegments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between text-[10px] font-medium">
            <div className="flex items-center gap-1.5 text-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span>{seg.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">
                <AnimatedNumber prefix="₱" value={seg.value} />
              </span>
              <span className="font-semibold text-muted">{seg.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

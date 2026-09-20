import { defineChart } from '@tanstack/charts'
import { barY, group } from '@tanstack/charts'
import { scaleBand } from '@tanstack/charts/scales/band'
import { scaleLinear } from '@tanstack/charts/scales/linear'
import { scaleOrdinal } from '@tanstack/charts/scales/ordinal'
import { Chart } from '@tanstack/charts/react'
import React, { useMemo } from 'react'

export interface TrendSlot {
  label: string
  start: string
  end: string
  pension: number
  vacationHouse: number
  gardenArea: number
  gazebo: number
  /** Food and bar money ordered in this slot (k69, part E). */
  restaurant?: number
}

interface TrendRow { label: string; source: 'Pension' | 'House' | 'Garden' | 'Gazebo' | 'Restaurant'; revenue: number }

const COLORS: Record<TrendRow['source'], string> = {
  Pension: '#B89251',
  House: '#4A90E2',
  Garden: '#2ECC71',
  Gazebo: '#F39C12',
  Restaurant: '#D0AB60',
}

const pesoTicks = (value: number) => (value >= 1000 ? `₱${(value / 1000).toFixed(0)}k` : `₱${value}`)

interface RevenueTrendChartProps { trendSlots: TrendSlot[] }
export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({ trendSlots }) => {
  // Real ordinal scale — satisfies "callable and copyable"; infer the source domain from `color: 'source'`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const colorScale = useMemo(
    () => scaleOrdinal<string, string>().domain(['Pension', 'House', 'Garden', 'Gazebo', 'Restaurant']).range(Object.values(COLORS)) as any,
    [],
  )

  const definition = useMemo(() => {
    const rows: TrendRow[] = trendSlots.flatMap(s => [
      { label: s.label, source: 'Pension', revenue: s.pension },
      { label: s.label, source: 'House', revenue: s.vacationHouse },
      { label: s.label, source: 'Garden', revenue: s.gardenArea },
      { label: s.label, source: 'Gazebo', revenue: s.gazebo },
      { label: s.label, source: 'Restaurant', revenue: s.restaurant || 0 },
    ])
    const hasAny = rows.some(r => r.revenue > 0)
    if (!hasAny) return null
    return defineChart({
      marks: [barY(rows, { x: 'label', y: 'revenue', color: 'source', layout: group({ padding: 0.12 }), inset: 1, radius: 2 })],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      color: { scale: () => colorScale as any },
      x: { scale: () => scaleBand().paddingInner(0.15).paddingOuter(0.18), axis: { label: 'Period' } },
      y: { scale: scaleLinear, nice: true, grid: true, axis: { label: 'Revenue', ticks: { format: pesoTicks as (v: string | number) => string } } },
      svgAnimation: true,
    })
  }, [colorScale, trendSlots])

  return (
    <div className="bg-card border border-soft rounded-xl p-4 lg:col-span-2 flex flex-col min-h-[280px]">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-main">Income Over Time</h4>
          <p className="text-[10px] text-muted">Daily earnings breakdown</p>
        </div>
        <div className="flex gap-2.5 text-[9px] font-semibold text-muted">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-primary" />Pension</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#4A90E2]" />House</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#2ECC71]" />Garden</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#F39C12]" />Gazebo</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#D0AB60]" />Restaurant</span>
        </div>
      </div>
      {definition ? (
        <Chart definition={definition} height={290} ariaLabel="Income over time by source" />
      ) : (
        <div className="flex-1 grid place-items-center text-xs text-muted py-10">No earnings in this range.</div>
      )}
    </div>
  )
}

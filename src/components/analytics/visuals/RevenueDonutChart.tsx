import React, { useState, useEffect } from 'react'
import { AnimatedNumber } from '../../AnimatedNumber'

export interface DonutSegment {
  name: string
  value: number
  color: string
  percentage: number
  renderPercent: number
  renderStartPercent: number
}

interface RevenueDonutChartProps {
  donutSegments: DonutSegment[]
}

export const RevenueDonutChart: React.FC<RevenueDonutChartProps> = ({ donutSegments }) => {
  const [hoveredDonutSegment, setHoveredDonutSegment] = useState<string | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Trigger donut animation on mount
  useEffect(() => {
    setIsMounted(true)
  }, [])

  return (
    <div className="bg-card border border-soft rounded-xl p-4 flex flex-col justify-between">
      <div>
        <h4 className="text-xs sm:text-sm font-bold text-main">Earnings Share</h4>
        <p className="text-[10px] text-muted">Breakdown of where your money comes from</p>
      </div>

      <div className="flex items-center justify-center py-4 relative">
        {donutSegments.length === 0 ? (
          <p className="text-muted text-xs font-semibold">No earnings data</p>
        ) : (
          <div className="relative w-48 h-48 sm:w-56 sm:h-56">
            <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
              {donutSegments.map((seg, idx) => {
                const radius = 80
                const circumference = 2 * Math.PI * radius
                const dashArray = isMounted ? `${seg.renderPercent * (circumference / 100)} ${circumference}` : `0 ${circumference}`
                const dashOffset = `-${seg.renderStartPercent * (circumference / 100)}`

                return (
                  <circle
                    key={idx}
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke={seg.color}
                    strokeWidth="28"
                    strokeDasharray={dashArray}
                    strokeDashoffset={dashOffset}
                    className="cursor-pointer transition-all duration-1000 ease-out hover:stroke-[34]"
                    onMouseEnter={() => setHoveredDonutSegment(seg.name)}
                    onMouseLeave={() => setHoveredDonutSegment(null)}
                  />
                );
              })}
            </svg>
            {/* Text overlay in the middle of donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] uppercase tracking-wider text-muted font-bold">
                {hoveredDonutSegment ? hoveredDonutSegment.split(' ')[0] : 'Total'}
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-600 mt-0.5">
                {hoveredDonutSegment 
                  ? `${donutSegments.find(s => s.name === hoveredDonutSegment)?.percentage}%`
                  : '100%'
                }
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Donut Legend */}
      <div className="space-y-1.5 border-t border-soft pt-3">
        {donutSegments.map((seg, idx) => (
          <div key={idx} className="flex items-center justify-between text-[10px] font-medium">
            <div className="flex items-center gap-1.5 text-muted">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }}></span>
              <span>{seg.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold"><AnimatedNumber prefix="₱" value={seg.value} /></span>
              <span className="font-semibold text-muted">{seg.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

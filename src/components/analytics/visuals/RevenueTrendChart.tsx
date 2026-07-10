import React, { useState } from 'react'
import { AnimatedRect } from '../../AnimatedRect'

export interface TrendSlot {
  label: string
  start: string
  end: string
  pension: number
  vacationHouse: number
  gardenArea: number
  gazebo: number
}

interface RevenueTrendChartProps {
  trendSlots: TrendSlot[]
}

export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({ trendSlots }) => {
  const [hoveredBar, setHoveredBar] = useState<{
    label: string;
    pension: number;
    vacationHouse: number;
    gardenArea: number;
    gazebo: number;
    x: number;
    y: number;
  } | null>(null)

  // Find max value in trendSlots for SVG height scaling
  const maxTrendVal = Math.max(
    1000, 
    ...trendSlots.map(s => Math.max(s.pension, s.vacationHouse, s.gardenArea, s.gazebo))
  )

  return (
    <div className="bg-card border border-soft rounded-xl p-4 lg:col-span-2 flex flex-col justify-between relative">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="text-xs sm:text-sm font-bold text-main">Income Over Time</h4>
          <p className="text-[10px] text-muted">Daily earnings breakdown</p>
        </div>
        <div className="flex gap-2.5 text-[9px] font-semibold text-muted">
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-brand-primary"></span>Pension</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#4A90E2]"></span>House</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#2ECC71]"></span>Garden</span>
          <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-[#F39C12]"></span>Gazebo</span>
        </div>
      </div>

      {/* SVG Bar Chart */}
      <div className="relative flex-1 w-full min-h-[250px] mt-4">
        <svg width="100%" height="100%" className="overflow-visible">
          {/* Y Grid Lines & Labels */}
          {[0, 0.25, 0.5, 0.75, 1.0].map((ratio, idx) => {
            const yPct = 90 - ratio * 88 // From 90% (bottom) to 2% (top)
            const val = Math.round(maxTrendVal * ratio)
            return (
              <g key={idx} className="opacity-40">
                <line x1="45" y1={`${yPct}%`} x2="100%" y2={`${yPct}%`} stroke="var(--border-soft)" strokeDasharray="3,3" />
                <text x="35" y={`${yPct}%`} dy="3" textAnchor="end" className="text-[9px] fill-current text-muted font-semibold font-mono">
                  ₱{val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                </text>
              </g>
            )
          })}

          {/* X Grid Labels & Grouped Columns */}
          <svg x="50" y="2%" width="calc(100% - 50px)" height="88%" className="overflow-visible">
            {trendSlots.map((slot, slotIdx) => {
              const totalSlots = trendSlots.length
              const slotWidth = 100 / totalSlots // width in %
              const xCenter = slotIdx * slotWidth + slotWidth / 2

              // Calculate heights in percentages (0 to 100%)
              const pHeightPct = (slot.pension / maxTrendVal) * 100 || 0
              const vHeightPct = (slot.vacationHouse / maxTrendVal) * 100 || 0
              const gHeightPct = (slot.gardenArea / maxTrendVal) * 100 || 0
              const zHeightPct = (slot.gazebo / maxTrendVal) * 100 || 0

              // Bar X coordinates in %
              const barSpacing = slotWidth > 15 ? 1 : 0.5
              const barW = Math.max(1, (slotWidth - 4) / 4)

              const px = xCenter - (barW * 2 + barSpacing * 1.5)
              const vx = xCenter - (barW + barSpacing * 0.5)
              const gx = xCenter + barSpacing * 0.5
              const zx = xCenter + barW + barSpacing * 1.5

              return (
                <g key={slotIdx}>
                  {/* Pension Bar */}
                  <AnimatedRect
                    x={`${px}%`}
                    targetY={100 - pHeightPct}
                    width={`${barW}%`}
                    targetHeight={pHeightPct}
                    fill="#B89251"
                    rx="2"
                    className="cursor-pointer transition-opacity hover:opacity-85"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredBar({
                        label: slot.label,
                        pension: slot.pension,
                        vacationHouse: slot.vacationHouse,
                        gardenArea: slot.gardenArea,
                        gazebo: slot.gazebo,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 80
                      })
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  />

                  {/* Vacation House Bar */}
                  <AnimatedRect
                    x={`${vx}%`}
                    targetY={100 - vHeightPct}
                    width={`${barW}%`}
                    targetHeight={vHeightPct}
                    fill="#4A90E2"
                    rx="2"
                    className="cursor-pointer transition-opacity hover:opacity-85"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredBar({
                        label: slot.label,
                        pension: slot.pension,
                        vacationHouse: slot.vacationHouse,
                        gardenArea: slot.gardenArea,
                        gazebo: slot.gazebo,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 80
                      })
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  />

                  {/* Garden Area Bar */}
                  <AnimatedRect
                    x={`${gx}%`}
                    targetY={100 - gHeightPct}
                    width={`${barW}%`}
                    targetHeight={gHeightPct}
                    fill="#2ECC71"
                    rx="2"
                    className="cursor-pointer transition-opacity hover:opacity-85"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredBar({
                        label: slot.label,
                        pension: slot.pension,
                        vacationHouse: slot.vacationHouse,
                        gardenArea: slot.gardenArea,
                        gazebo: slot.gazebo,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 80
                      })
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  />

                  {/* Gazebo Bar */}
                  <AnimatedRect
                    x={`${zx}%`}
                    targetY={100 - zHeightPct}
                    width={`${barW}%`}
                    targetHeight={zHeightPct}
                    fill="#F39C12"
                    rx="2"
                    className="cursor-pointer transition-opacity hover:opacity-85"
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect()
                      setHoveredBar({
                        label: slot.label,
                        pension: slot.pension,
                        vacationHouse: slot.vacationHouse,
                        gardenArea: slot.gardenArea,
                        gazebo: slot.gazebo,
                        x: rect.left + rect.width / 2,
                        y: rect.top - 80
                      })
                    }}
                    onMouseLeave={() => setHoveredBar(null)}
                  />
                </g>
              )
            })}
          </svg>

          {/* X Labels (placed at 90% downwards) */}
          <svg x="50" y="90%" width="calc(100% - 50px)" height="10%" className="overflow-visible">
            {trendSlots.map((slot, slotIdx) => {
              const totalSlots = trendSlots.length
              const slotWidth = 100 / totalSlots
              const xCenter = slotIdx * slotWidth + slotWidth / 2
              
              return (
                <text key={slotIdx} x={`${xCenter}%`} y="20" textAnchor="middle" className="text-[9px] font-semibold fill-current text-muted">
                  {slot.label}
                </text>
              )
            })}
          </svg>

          {/* Baseline */}
          <line x1="45" y1="90%" x2="100%" y2="90%" stroke="var(--border-soft)" strokeWidth="1" />
        </svg>
      </div>

      {/* Interactive Tooltip Portal */}
      {hoveredBar && (
        <div 
          className="absolute z-50 bg-[#1E293B] text-white p-2.5 rounded-lg text-[10px] space-y-1 shadow-xl leading-normal w-40 pointer-events-none border border-white/10"
          style={{
            left: `${hoveredBar.x - window.innerWidth / 12}px`,
            top: `30px`
          }}
        >
          <div className="font-bold border-b border-white/10 pb-1 mb-1 text-[#E5D5C0]">{hoveredBar.label}</div>
          <div className="flex justify-between">
            <span>Pension:</span>
            <span className="font-mono font-bold">₱{Math.round(hoveredBar.pension).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Vacation House:</span>
            <span className="font-mono font-bold text-[#60A5FA]">₱{Math.round(hoveredBar.vacationHouse).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Garden Area:</span>
            <span className="font-mono font-bold text-[#4ADE80]">₱{Math.round(hoveredBar.gardenArea).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Gazebo:</span>
            <span className="font-mono font-bold text-[#FBBF24]">₱{Math.round(hoveredBar.gazebo).toLocaleString()}</span>
          </div>
          <div className="flex justify-between border-t border-slate-700 pt-1 mt-1 font-bold text-emerald-400">
            <span>Total:</span>
            <span>₱{Math.round(hoveredBar.pension + hoveredBar.vacationHouse + hoveredBar.gardenArea + hoveredBar.gazebo).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

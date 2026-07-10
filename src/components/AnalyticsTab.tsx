import React, { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { useAnalyticsCalculations } from '../hooks/useAnalyticsCalculations'
import { AnalyticsFilters } from './analytics/AnalyticsFilters'
import { AnalyticsSpreadsheetView } from './analytics/AnalyticsSpreadsheetView'
import { AnalyticsVisualsView } from './analytics/AnalyticsVisualsView'

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export function AnalyticsTab() {
  const { bookings, rooms, venues, expenses, isLoading } = useDashboardData()

  // 1. Timeframe Filter state
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'visuals'>('visuals')
  const [timeframe, setTimeframe] = useState<Timeframe>('monthly')
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date()
    d.setDate(1) // Start of month
    return d.toISOString().split('T')[0]
  })
  const [customEnd, setCustomEnd] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  // 2. Booking Status Filter state
  const [includePending, setIncludePending] = useState<boolean>(false)

  // Use extracted hook for all heavy lifting calculations
  const { calculations, donutSegments } = useAnalyticsCalculations({
    bookings,
    rooms,
    venues,
    expenses,
    isLoading,
    timeframe,
    customStart,
    customEnd,
    includePending
  })

  if (isLoading || !calculations) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 text-muted">
        <Sparkles className="w-8 h-8 text-brand-primary animate-spin" />
        <p className="text-xs font-medium">Analyzing PMS profits & records...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters Toolbar */}
      <AnalyticsFilters
        timeframe={timeframe}
        setTimeframe={setTimeframe}
        customStart={customStart}
        setCustomStart={setCustomStart}
        customEnd={customEnd}
        setCustomEnd={setCustomEnd}
        viewMode={viewMode}
        setViewMode={setViewMode}
        includePending={includePending}
        setIncludePending={setIncludePending}
      />

      {/* Render selected view mode */}
      {viewMode === 'visuals' && (
        <AnalyticsVisualsView 
          calculations={calculations}
          trendSlots={calculations.trendSlots}
          donutSegments={donutSegments}
        />
      )}

      {viewMode === 'spreadsheet' && (
        <AnalyticsSpreadsheetView calculations={calculations} />
      )}
    </div>
  )
}

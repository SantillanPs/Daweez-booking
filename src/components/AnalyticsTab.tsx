import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChartSpline, Printer, Rows3 } from 'lucide-react'
import { useDashboardData } from './DashboardContext'
import { useAnalyticsCalculations } from '../hooks/useAnalyticsCalculations'
import { getAllTabLines } from '../utils/tabs'
import { TabLine } from '../types/tab'
import { AnalyticsFilters } from './analytics/AnalyticsFilters'
import { AnalyticsSpreadsheetView } from './analytics/AnalyticsSpreadsheetView'
import { AnalyticsVisualsView } from './analytics/AnalyticsVisualsView'
import { DailyReportModal } from './analytics/DailyReportModal'

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

export function AnalyticsTab() {
  const { bookings, rooms, venues, expenses, isLoading } = useDashboardData()

  // Food and bar money comes from the tabs, not the bookings (k69, part E), so
  // the report reads every tab line once — a stay's tab and a walk-in diner's.
  const { data: tabLines = [] } = useQuery<TabLine[]>({
    queryKey: ['tab-lines'],
    queryFn: getAllTabLines,
    staleTime: 60 * 1000,
  })

  // 1. Timeframe Filter state. **Daily is the default** (the owner, 2026-09-30): the desk opens this screen to
  // see today, so a month of history was the wrong thing to land on every time.
  const [viewMode, setViewMode] = useState<'spreadsheet' | 'visuals'>('spreadsheet')
  const [timeframe, setTimeframe] = useState<Timeframe>('daily')
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

  // 3. The day's sheet, printed from here — an action, not a page (the owner's ruling, 2026-09-30).
  const [printingDay, setPrintingDay] = useState(false)

  // Use extracted hook for all heavy lifting calculations
  const { calculations } = useAnalyticsCalculations({
    bookings,
    rooms,
    venues,
    expenses,
    tabLines,
    isLoading,
    timeframe,
    customStart,
    customEnd,
    includePending
  })

  if (isLoading || !calculations) {
    return (
      <p className="text-center text-[13px] text-muted py-24">Adding up the earnings…</p>
    )
  }

  // Table and Charts are the two ways to read the report, so they sit beside the period as one switch, in
  // both views, instead of a quiet link under the card (the owner, 2026-10-14: "do something with" the links).
  const viewSwitch = (
    <div role="group" aria-label="View" className="flex gap-1 p-1 bg-card border border-soft rounded-xl">
      {([['spreadsheet', 'Table', Rows3], ['visuals', 'Charts', ChartSpline]] as const).map(([key, label, Icon]) => (
        <button
          key={key} type="button" aria-pressed={viewMode === key} onClick={() => setViewMode(key)}
          className={`min-h-9 px-3 rounded-lg text-[13px] inline-flex items-center gap-1.5 cursor-pointer transition-colors active:translate-y-px ${viewMode === key ? 'bg-ink-900 text-white font-bold' : 'text-muted font-semibold hover:text-main'}`}
        >
          <Icon className="w-4 h-4" strokeWidth={2} />{label}
        </button>
      ))}
    </div>
  )
  // The pending switch is contextual: it shows only while there is a booking not yet confirmed to count.
  const pending = bookings.filter(b => b.status === 'pending').length

  return (
    <div className="space-y-3 font-sans">
      {/* The two views keep their own periods: the table reads a calendar day, week or month; the charts read
          the days up to today, so today is always the right-hand end of the chart (the owner, 2026-10-14). */}
      {viewMode === 'visuals' ? (
        <AnalyticsVisualsView bookings={bookings} rooms={rooms} venues={venues} expenses={expenses} tabLines={tabLines} includePending={includePending} tools={viewSwitch} />
      ) : (
        <>
          <AnalyticsFilters
            periodLabel={calculations.periodLabel}
            timeframe={timeframe}
            setTimeframe={setTimeframe}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
            tools={viewSwitch}
          />
          <AnalyticsSpreadsheetView calculations={calculations} />
        </>
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 px-1">
        {(pending > 0 || includePending) && (
          <button type="button" role="switch" aria-checked={includePending} onClick={() => setIncludePending(on => !on)}
            className="inline-flex items-center gap-2.5 min-h-9 text-[13px] font-semibold text-muted hover:text-main cursor-pointer">
            <span className={`relative w-9 h-5 rounded-full transition-colors ${includePending ? 'bg-emerald-600' : 'bg-ink-900/15'}`}>
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${includePending ? 'translate-x-4' : ''}`} />
            </span>
            Count {pending} not yet confirmed
          </button>
        )}
        <button type="button" onClick={() => setPrintingDay(true)}
          className="inline-flex items-center gap-2 min-h-9 px-3.5 rounded-lg bg-card border border-soft text-[13px] font-semibold text-main hover:border-ink-900/30 cursor-pointer transition-colors active:translate-y-px">
          <Printer className="w-4 h-4" strokeWidth={2} />Print daily report
        </button>
      </div>

      {printingDay && <DailyReportModal onClose={() => setPrintingDay(false)} />}
    </div>
  )
}

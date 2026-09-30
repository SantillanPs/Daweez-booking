import React from 'react'
import { Calendar, BarChart2, Table, ToggleRight, ToggleLeft, Printer } from 'lucide-react'

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

interface AnalyticsFiltersProps {
  timeframe: Timeframe
  setTimeframe: (t: Timeframe) => void
  customStart: string
  setCustomStart: (d: string) => void
  customEnd: string
  setCustomEnd: (d: string) => void
  viewMode: 'visuals' | 'spreadsheet'
  setViewMode: React.Dispatch<React.SetStateAction<'visuals' | 'spreadsheet'>>
  includePending: boolean
  setIncludePending: React.Dispatch<React.SetStateAction<boolean>>
  /** Opens the day's sheet for printing — an action here, not a page of its own (the owner's ruling). */
  onPrintDailyReport: () => void
}

export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  timeframe,
  setTimeframe,
  customStart,
  setCustomStart,
  customEnd,
  setCustomEnd,
  viewMode,
  setViewMode,
  includePending,
  setIncludePending,
  onPrintDailyReport
}) => {
  return (
    <div className="bg-card border border-soft rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
      {/* Left Side: Timeframes and Dates */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Timeframe selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['daily', 'weekly', 'monthly', 'yearly', 'custom'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTimeframe(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider cursor-pointer transition-all shrink-0 ${
                timeframe === t 
                  ? 'bg-brand-primary text-ink-900' 
                  : 'bg-page hover:bg-softbg text-muted'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Dynamic Custom Date Inputs */}
        {timeframe === 'custom' && (
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-brand-text shrink-0" />
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="text-xs font-medium bg-page border border-soft rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-primary"
            />
            <span className="text-muted text-xs">to</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="text-xs font-medium bg-page border border-soft rounded px-2.5 py-1.5 focus:outline-none focus:border-brand-primary"
            />
          </div>
        )}
      </div>

      {/* Right Side: View Mode Toggle & Status Toggle */}
      <div className="flex flex-wrap items-center gap-4 xl:justify-end">
        {/* Print the day's sheet. It sits here, beside the view control, because it is the same kind of thing:
            a way of looking at the money — on paper. It is deliberately NOT a third view. */}
        <button
          onClick={onPrintDailyReport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all bg-card border-2 border-soft hover:border-brand-primary/30 hover:bg-page text-muted shadow-sm"
        >
          <Printer className="w-4 h-4 text-brand-text" />
          Print daily report
        </button>

        {/* View Mode Toggle */}
        <button
          onClick={() => setViewMode(prev => prev === 'spreadsheet' ? 'visuals' : 'spreadsheet')}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest cursor-pointer transition-all bg-white border-2 border-slate-100 hover:border-brand-primary/30 hover:bg-slate-50 text-slate-600 shadow-sm"
        >
          {viewMode === 'spreadsheet' ? (
            <>
              <BarChart2 className="w-4 h-4 text-brand-text" />
              Switch to Visuals
            </>
          ) : (
            <>
              <Table className="w-4 h-4 text-brand-text" />
              Switch to Spreadsheet
            </>
          )}
        </button>

        {/* Status Toggle */}
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-xs font-medium text-muted whitespace-nowrap">
            Include Pending Bookings
          </span>
          <button 
            onClick={() => setIncludePending(prev => !prev)}
            className="text-muted hover:text-brand-text transition-all cursor-pointer"
          >
            {includePending ? (
              <ToggleRight className="w-8 h-8 text-brand-text" />
            ) : (
              <ToggleLeft className="w-8 h-8 text-muted" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

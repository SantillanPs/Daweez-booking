import React from 'react'
import { TrendingUp } from 'lucide-react'

type Timeframe = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom'

interface AnalyticsFiltersProps {
  /** The dates the report covers, in words, under the title. */
  periodLabel: string
  timeframe: Timeframe
  setTimeframe: (t: Timeframe) => void
  customStart: string
  setCustomStart: (d: string) => void
  customEnd: string
  setCustomEnd: (d: string) => void
  /** The Table / Charts switch, shown beside the period. */
  tools?: React.ReactNode
}

const PERIODS: [Timeframe, string][] = [
  ['daily', 'Day'], ['weekly', 'Week'], ['monthly', 'Month'], ['yearly', 'Year'], ['custom', 'Other dates'],
]

const dateBox = 'bg-card border border-soft text-main text-base px-2 py-1.5 rounded-lg outline-none font-mono focus:border-gold-500 cursor-pointer'

// The top of the Earnings report, drawn like the top of Today's money (the owner, 2026-10-13: the page
// "looks so out of place with the rest of the system"): a title with the dates under it, and the period
// to its right. The two date boxes show only for "Other dates".
export const AnalyticsFilters: React.FC<AnalyticsFiltersProps> = ({
  periodLabel, timeframe, setTimeframe, customStart, setCustomStart, customEnd, setCustomEnd, tools,
}) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display font-bold text-xl text-main flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-gold-600" />
          Earnings report
        </h2>
        <p className="text-[13px] text-muted mt-0.5">{periodLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
      {tools}
      <div role="group" aria-label="Period" className="flex flex-wrap gap-1 p-1 bg-card border border-soft rounded-xl">
        {PERIODS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={timeframe === key}
            onClick={() => setTimeframe(key)}
            className={`min-h-9 px-3.5 rounded-lg text-[13px] cursor-pointer transition-colors ${
              timeframe === key ? 'bg-brand-primary text-ink-900 font-bold' : 'text-muted font-semibold hover:text-main'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      </div>
    </div>

    {timeframe === 'custom' && (
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-[13px] text-muted">
        <label className="flex items-center gap-2">From
          <input type="date" value={customStart} onChange={e => { if (e.target.value) setCustomStart(e.target.value) }} className={dateBox} />
        </label>
        <label className="flex items-center gap-2">to
          <input type="date" value={customEnd} onChange={e => { if (e.target.value) setCustomEnd(e.target.value) }} className={dateBox} />
        </label>
      </div>
    )}
  </>
)

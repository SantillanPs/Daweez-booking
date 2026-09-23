import React from 'react'
import { Calendar, ChevronLeft, ChevronRight, FilePlus } from 'lucide-react'

interface CalendarToolbarProps {
  monthHeader: string
  /** The grid opens on today (card k154) — the earlier days of the month are
   *  deliberately not shown, and the badge says so. */
  startsToday?: boolean
  /** The day the 31-day window starts on, as `YYYY-MM-DD` for the date box. */
  datePickerValue: string
  onPrevMonth: () => void
  onNextMonth: () => void
  /** Jump the window to the day the desk picked (option A, card k154). */
  onJumpToDate: (value: string) => void
  onToday: () => void
  onLogOldBooking: () => void
  logOldDisabled: boolean
}

// Calendar top bar: window title and day navigation. The booking actions live in the
// grid's own action bar (see TimelineGrid) — they appear once dates are picked.
export function CalendarToolbar({ monthHeader, startsToday, datePickerValue, onPrevMonth, onNextMonth, onJumpToDate, onToday, onLogOldBooking, logOldDisabled }: CalendarToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card px-3 py-2 rounded-xl border border-soft flex-shrink-0 shadow-soft">
      <h2 className="font-display font-bold text-lg text-main tracking-tight flex items-center gap-2">
        <Calendar className="w-5 h-5 text-gold-600" />
        {monthHeader}
        {startsToday && (
          <span className="text-[9px] font-bold uppercase tracking-wider text-gold-800 bg-gold-100 border border-gold-200 rounded-full px-2 py-0.5">from today</span>
        )}
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-page p-1 rounded-lg border border-soft/70">
          <button onClick={onPrevMonth} title="Previous month" className="p-1.5 text-muted hover:text-main hover:bg-card rounded-md transition-all cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {/* A DATE, not a month (option A, card k154): the grid is a rolling
              31-day window that begins on a day, so this picks the day it begins
              on — `15 Dec 2026` runs the grid 15 Dec → 14 Jan. The old
              `type="month"` control was a leftover of the monthly calendar, and it
              was clipped to 115px on top of that, so its own name did not fit. */}
          <input
            type="date"
            value={datePickerValue}
            onChange={e => { if (e.target.value) onJumpToDate(e.target.value) }}
            title="Jump to a day — the calendar runs 31 days from it"
            aria-label="Jump to a day"
            className="bg-card border border-soft text-main text-xs px-1.5 py-1 rounded-md outline-none font-mono focus:ring-1 focus:ring-gold-500 focus:border-gold-500 cursor-pointer w-[150px] text-center"
          />
          <button onClick={onNextMonth} title="Next month" className="p-1.5 text-muted hover:text-main hover:bg-card rounded-md transition-all cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-soft mx-1" />
          <button onClick={onToday} title="Back to today" className="text-xs font-semibold text-gold-700 px-2 py-1 hover:bg-card hover:shadow-sm rounded-md transition-all cursor-pointer">
            Today
          </button>
        </div>

        {/* The booking actions are NOT here any more (the owner's design): they appear
            in the action bar under this toolbar, lined up over the day that was picked
            (see TimelineGrid), so nothing has to be greyed out and the rule reads
            itself — pick the dates first. Log old booking stays: it is a back-office
            job rather than a stay, and it needs a range that the grid does not give it. */}
        <button onClick={onLogOldBooking} disabled={logOldDisabled} title={logOldDisabled ? 'Pick a date range on the calendar first' : 'Log old booking'} aria-label="Log old booking" className="flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-soft text-muted hover:text-main hover:bg-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          <FilePlus className="w-4 h-4 text-gold-600" />
        </button>
      </div>
    </div>
  )
}

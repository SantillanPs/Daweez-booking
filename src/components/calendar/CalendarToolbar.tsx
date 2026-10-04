import React from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarToolbarProps {
  monthHeader: string
  /** The grid opens on today (card k154) — the earlier days of the month are
   *  deliberately not shown, and the words beside the title say so. */
  startsToday?: boolean
  /** The day the 31-day window starts on, as `YYYY-MM-DD` for the date box. */
  datePickerValue: string
  onPrevMonth: () => void
  onNextMonth: () => void
  /** Jump the window to the day the desk picked (option A, card k154). */
  onJumpToDate: (value: string) => void
  onToday: () => void
}

const STEP = 'w-9 h-9 inline-flex items-center justify-center rounded-md text-muted hover:text-main hover:bg-softbg transition-colors duration-150 active:scale-95 cursor-pointer'

// Calendar top bar: window title and day navigation. **Every action lives in the grid's own
// action bar** (see TimelineGrid) — they appear once dates are picked, so the rule teaches
// itself: pick the dates first. This bar used to keep one button of its own, `Log old
// booking`, on the argument that it is back-office rather than a stay. The owner had it
// removed (2026-09-29: *"can you remove the log old booking on the top right of the
// calendar? since there's already a button for that when I click on dates"*) — the action
// bar already carries it, so the toolbar is now nothing but the window and its days.
//
// It is the top line of the calendar's one sheet, not a card of its own (the design pass,
// 2026-10-04): the title at one end, the days at the other, a rule under them.
export function CalendarToolbar({ monthHeader, startsToday, datePickerValue, onPrevMonth, onNextMonth, onJumpToDate, onToday }: CalendarToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 min-h-12 border-b border-soft flex-shrink-0">
      <h2 className="flex items-baseline gap-2.5 font-display font-bold text-[19px] text-main tracking-tight">
        {monthHeader}
        {startsToday && <span className="font-sans text-[13px] font-medium tracking-normal text-muted">from today</span>}
      </h2>

      <div className="flex items-center gap-1">
        <button type="button" onClick={onPrevMonth} title="Previous month" aria-label="Previous month" className={STEP}>
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
          className="h-9 w-[150px] rounded-md border border-soft bg-card px-2 text-[13px] font-medium tabular-nums text-main text-center outline-none transition-colors duration-200 focus:border-gold-500 focus:ring-2 focus:ring-gold-400/30 cursor-pointer"
        />
        <button type="button" onClick={onNextMonth} title="Next month" aria-label="Next month" className={STEP}>
          <ChevronRight className="w-4 h-4" />
        </button>
        <span className="h-5 w-px bg-soft mx-1.5" aria-hidden="true" />
        <button type="button" onClick={onToday} title="Back to today"
          className="h-9 px-2.5 rounded-md text-[13px] font-semibold text-brand-text hover:bg-softbg transition-colors duration-150 active:scale-95 cursor-pointer">
          Today
        </button>
      </div>
    </div>
  )
}

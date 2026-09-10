import React from 'react'
import { Calendar, ChevronLeft, ChevronRight, Plus, Users, FilePlus } from 'lucide-react'

interface CalendarToolbarProps {
  monthHeader: string
  datePickerValue: string
  onPrevMonth: () => void
  onNextMonth: () => void
  onMonthChange: (value: string) => void
  onThisMonth: () => void
  onNewBooking: () => void
  onNewCorporate: () => void
  onLogOldBooking: () => void
  newBookingDisabled: boolean
  logOldDisabled: boolean
}

// Calendar top bar: month title, month navigation, and the primary action.
export function CalendarToolbar({ monthHeader, datePickerValue, onPrevMonth, onNextMonth, onMonthChange, onThisMonth, onNewBooking, onNewCorporate, onLogOldBooking, newBookingDisabled, logOldDisabled }: CalendarToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-card px-3 py-2 rounded-xl border border-soft flex-shrink-0 shadow-soft">
      <h2 className="font-display font-bold text-lg text-main tracking-tight flex items-center gap-2">
        <Calendar className="w-5 h-5 text-sea-600" />
        {monthHeader}
      </h2>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-page p-1 rounded-lg border border-soft/70">
          <button onClick={onPrevMonth} title="Previous month" className="p-1.5 text-muted hover:text-main hover:bg-card rounded-md transition-all cursor-pointer">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="month"
            value={datePickerValue}
            onChange={e => { if (e.target.value) onMonthChange(e.target.value) }}
            className="bg-card border border-soft text-main text-xs px-1.5 py-1 rounded-md outline-none font-mono focus:ring-1 focus:ring-sea-500 focus:border-sea-500 cursor-pointer w-[115px] text-center"
          />
          <button onClick={onNextMonth} title="Next month" className="p-1.5 text-muted hover:text-main hover:bg-card rounded-md transition-all cursor-pointer">
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-soft mx-1" />
          <button onClick={onThisMonth} className="text-xs font-semibold text-sea-700 px-2 py-1 hover:bg-card hover:shadow-sm rounded-md transition-all cursor-pointer">
            This month
          </button>
        </div>

        <div className="flex items-center rounded-lg overflow-hidden border border-soft shadow-sm">
          <button onClick={onNewBooking} disabled={newBookingDisabled} className="flex items-center gap-1.5 bg-sea-600 hover:bg-sea-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold px-4 py-2 transition-colors cursor-pointer">
            <Plus className="w-3.5 h-3.5" />
            New booking
          </button>
          <div className="w-px h-5 bg-soft" />
          <button onClick={onNewCorporate} disabled={newBookingDisabled} title={newBookingDisabled ? 'Pick a date range on the calendar first' : 'Corporate / partner booking'} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-sea-700 bg-card hover:bg-sea-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
            <Users className="w-3.5 h-3.5" />
            Corporate
          </button>
        </div>

        <button onClick={onLogOldBooking} disabled={logOldDisabled} title={logOldDisabled ? 'Pick a date range on the calendar first' : 'Log old booking'} aria-label="Log old booking" className="flex items-center justify-center w-9 h-9 rounded-lg bg-card border border-soft text-muted hover:text-main hover:bg-page disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
          <FilePlus className="w-4 h-4 text-sea-600" />
        </button>
      </div>
    </div>
  )
}

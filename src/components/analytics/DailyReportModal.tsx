import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { useDashboardData } from '../DashboardContext'
import { getTabs } from '../../utils/tabs'
import { buildDailyReport } from '../../utils/dailyReport'
import { DailyReportDocument } from '../billing/DailyReportDocument'

/**
 * **Print a daily report** — an ACTION, not a page (the owner's ruling, 2026-09-30: *"the daily report should be
 * something like a 'print a daily report' type of feature. not a page"*).
 *
 * It used to be a tab of its own in the top nav. The hotel's actual need is narrower than a screen: once a day
 * somebody wants **that day's sheet on paper**. So the sheet is opened from the Analytics toolbar, the day is
 * picked, and it prints — and Analytics stays the one place the money is looked at.
 *
 * It owns only the day and the print; the figures are `utils/dailyReport.ts` and the paper is
 * `billing/DailyReportDocument.tsx`, both unchanged by the move.
 */
export function DailyReportModal({ onClose, initialDate }: {
  onClose: () => void
  /** The day to open on — the money screen hands over the day it is showing. Today when absent. */
  initialDate?: string
}) {
  // Every booking, cancelled ones too: money received on a booking that was later
  // cancelled still arrived on its day, and a money sheet must not lose it.
  const { allBookings: bookings, rooms, expenses, expenseCategories } = useDashboardData()
  const [date, setDate] = useState(() => initialDate || localToday())

  // A report is a cold read of a whole day, so the tabs are fetched here rather than riding the booking cache:
  // a tab settled at the counter is money this sheet must show, and it belongs to no booking.
  const { data: tabs = [] } = useQuery({ queryKey: ['tabs'], queryFn: getTabs })

  const report = useMemo(
    () => buildDailyReport({ date, bookings, tabs, expenses, categories: expenseCategories, rooms }),
    [date, bookings, tabs, expenses, expenseCategories, rooms],
  )

  // **Rendered through a portal to `document.body`**, the way every other print modal in the app is
  // (`PrintInvoiceModal`, `PrintPaymentReceiptModal`, `SlipModal`). That is not a styling choice — it is what
  // puts the paper at the TOP of the page. `index.css`'s print block hides `body > *` and re-shows only the
  // element that `:has(.print-page)`; rendered inline, that element is `#root`, so the whole dashboard is
  // re-shown as a block, keeps its layout, and the sheet prints about a third of the way down a blank page
  // (the owner's print, 2026-09-30). As a portal it becomes its own child of `body`, `#root` is hidden
  // outright, and the sheet starts on line one.
  return createPortal(
    <div className="fixed inset-0 z-50 bg-ink-900/60 overflow-y-auto print:static print:bg-transparent print:overflow-visible">
      <div className="max-w-xl mx-auto my-6 print:my-0">
        <div className="flex items-end justify-between gap-3 mb-3 px-1 print:hidden">
          <label className="flex items-center gap-2 text-xs font-bold text-white">
            Day
            <input
              type="date"
              value={date}
              onChange={event => setDate(event.target.value)}
              className="border border-ink-300 rounded-md px-2 py-1 font-mono text-xs bg-card text-main"
            />
          </label>
          {/* Money a booking holds with no dated receipt belongs on no day. Said once here rather than
              hidden, because a money report must never drop a peso in silence. */}
          {report.undatedCount > 0 && (
            <span className="text-[11px] text-white/70">
              {report.undatedCount} booking{report.undatedCount === 1 ? '' : 's'} holding ₱
              {report.undatedMoney.toLocaleString()} with no payment date
            </span>
          )}
        </div>

        <DailyReportDocument
          report={report}
          prettyDate={prettyDate(date)}
          embedded
          onClose={onClose}
          onPrint={printA5}
        />
      </div>
    </div>,
    document.body,
  )
}

/** Today as the hotel's calendar day, built from local parts (never `toISOString`, which is UTC). */
function localToday(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/**
 * `2026-09-30` → `30 September 2026`, the way the hotel writes a date.
 *
 * Parsed from its own parts rather than `new Date('2026-09-30')`, which is UTC midnight and reads as the day
 * *before* anywhere west of Greenwich — the same trap the booking dates carry.
 */
function prettyDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return `${day} ${MONTHS[month - 1]} ${year}`
}

/**
 * Print on A5 with a zero page margin, exactly the way the two bills do it: the zero box is what stops the
 * browser printing its own date, title and URL across the top of the hotel's paper. Injected for the moment of
 * printing only, and removed when the dialog closes.
 */
function printA5() {
  const style = document.createElement('style')
  style.textContent = '@page { size: A5; margin: 0; }'
  document.head.appendChild(style)
  const done = () => {
    style.remove()
    window.removeEventListener('afterprint', done)
  }
  window.addEventListener('afterprint', done)
  window.print()
  window.setTimeout(done, 60000)
}

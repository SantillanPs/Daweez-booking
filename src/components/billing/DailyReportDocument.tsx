import React from 'react'
import { StatementShell } from './StatementShell'
import { PaperEnd, PaperHead, PaperRow, PaperTitle, PaperTotal } from './LedgerPaper'
import { forwardedLabel, type DailyReport } from '../../utils/dailyReport'

/**
 * **The Daily Report sheet** — the owner's design, approved 2026-09-29, and the paper the front desk prints
 * at the end of every day.
 *
 * It is built to his four rulings, and every one of them is a reason a line is here or is not:
 *
 * 1. **Money only, nothing else** (*"this report is for money only. nothing else."*) — no check-ins, no rooms
 *    occupied, no counts of any kind.
 * 2. **Received, never promised** (*"a report of how much money was received and spent, not promised"*) — the
 *    lines come from dated receipts (`utils/dailyReport.ts`), so each peso landed on this day for real.
 * 3. **Listed, not summarised** (*"can we just list where the money came from? and not summarize it?"*) — one
 *    row per receipt and per expense, named `Room 4 · SEB · Cash`. There is no "Room payments ₱6,400" bucket and
 *    no Cash/GCash sub-total; the method rides on each line instead.
 * 4. **The conclusion at the bottom** (*"the total should be very clear. like, how a conclusion is always at
 *    the bottom"*) — `TOTAL CASH ON HAND` is the last thing on the sheet (the staff's own name for it;
 *    it was `NET TODAY` until 2026-10-13, when the money began to carry over from day to day), the last figure on it,
 *    closed by a double rule the way a ledger closes a column.
 *
 * **No signature lines** (his last word on it: *"remove this and start building"*), and **no captions** — a
 * label names its own line and stops (see `docs/why/bills-and-paper.md`: state facts, never explain them).
 *
 * **Drawn like the staff's monthly income statement** (Sebastian, 2026-11-14, on the mock: *"I really like this
 * printed design. can you apply this as the printed design including for the daily?"*): the title centred, each
 * block's lines indented with the amounts on the right edge, a rule over each total. The IN/OUT bars went with it.
 *
 * It shares `StatementShell`, so the report has the same A5 page, the same margins and the same one 8px
 * spacing rhythm as the two bills rather than being a third spacing system.
 */
export function DailyReportDocument({ report, prettyDate, embedded = false, onClose, onPrint }: {
  report: DailyReport
  /** The day as the hotel writes it — `30 September 2026`. */
  prettyDate: string
  embedded?: boolean
  onClose: () => void
  onPrint: () => void
}) {
  const short = (day: string) => new Date(day + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return (
    <StatementShell label="Daily report" invoiceNumber={prettyDate} onClose={onClose} onPrint={onPrint} embedded={embedded}>
      <div>
        <PaperTitle heading="Daily Report" date={prettyDate} />

        <PaperHead>Money in:</PaperHead>
        {report.moneyIn.map((line, index) => (
          <PaperRow key={`${line.label}-${index}`} label={line.label} amount={line.amount}
            struck={!!line.cancelled} note={line.cancelled ? 'Cancelled ' + short(line.cancelled) : undefined} />
        ))}
        <PaperTotal label="Total sales" amount={report.totalIn} />

        {/* Printed only on a day something was spent, like every line here. */}
        {report.moneyOut.length > 0 && <>
          <PaperHead>Less: Expenses</PaperHead>
          {report.moneyOut.map((line, index) => <PaperRow key={`${line.label}-${index}`} label={line.label} amount={line.amount} note={line.outside ? 'Not from hotel cash' : undefined} />)}
          <PaperTotal label="Total expenses" amount={report.totalOut} out />
        </>}

        {/* The staff's own summary, line for line (their paper, 2026-10-13) — the same lines the
            screen shows, so the paper and the screen cannot disagree. */}
        <PaperHead>Summary</PaperHead>
        <PaperRow label="Cash for today" amount={report.totalIn} />
        <PaperRow label={'Add: ' + forwardedLabel(report.date)} amount={report.broughtForward} />
        {report.cashAdded.map((line, index) => <PaperRow key={`${line.label}-${index}`} label={'Add: ' + line.label} amount={line.amount} />)}
        {report.totalNotCash > 0 && <PaperRow label="Less: GCash, bank & cheque" amount={report.totalNotCash} out />}
        <PaperTotal label="Cash on hand" amount={report.cashOnHand} />
        {report.totalCashOut > 0 && <PaperRow label="Less: Expenses" amount={report.totalCashOut} out />}
        {/* Money handed to the owner: printed only on a day it happened. */}
        {report.handedOver.map((line, index) => <PaperRow key={`${line.label}-${index}`} label={'Less: ' + line.label} amount={line.amount} out />)}

        <PaperEnd label="Total cash on hand" amount={report.balance} />
      </div>
    </StatementShell>
  )
}

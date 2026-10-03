import React from 'react'
import { StatementShell, BrandHeader } from './StatementShell'
import { money } from './receiptText'
import type { DailyReport } from '../../utils/dailyReport'

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
 *    the bottom"*) — `NET TODAY` is the last thing on the sheet, the biggest figure on it, closed above and
 *    below by a double rule the way a ledger closes a column. The two bars at the top say the shape of the day;
 *    the conclusion says the answer.
 *
 * **No signature lines** (his last word on it: *"remove this and start building"*), and **no captions** — a
 * label names its own line and stops (see `docs/why/bills-and-paper.md`: state facts, never explain them).
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
  // The bars are drawn to scale against the larger of the two sides, so the eye compares IN with OUT before
  // it reads a figure. Length is the one signal that needs no colour, so it survives a black-and-white
  // printer — which matters, because the office printer is the one this sheet comes off.
  const scale = Math.max(report.totalIn, report.totalOut, 1)
  const inWidth = `${Math.round((report.totalIn / scale) * 100)}%`
  const outWidth = `${Math.round((report.totalOut / scale) * 100)}%`
  const hasOut = report.moneyOut.length > 0

  return (
    <StatementShell label="Daily report" invoiceNumber={prettyDate} onClose={onClose} onPrint={onPrint} embedded={embedded}>
      <BrandHeader heading="Daily Report" dateIssued={prettyDate} dateLabel="Date" />

      {/* MONEY IN / OUT — the shape of the day at a glance. */}
      <div className="border-2 border-ink-700 rounded-sm px-3 py-2">
        <div className="grid grid-cols-[38px_1fr_auto] items-center gap-2 mb-1.5">
          <span className="text-[11px] font-extrabold tracking-wider">IN</span>
          <span className="h-3 bg-paper-200 rounded-sm overflow-hidden">
            <span className="block h-full bg-ink-800" style={{ width: inWidth }} />
          </span>
          <span className="font-mono text-[13px] font-extrabold">+ {money(report.totalIn)}</span>
        </div>
        {/* A bar measuring ₱0 against something says nothing, so the OUT row is only drawn when there was
            money out — the same "a line prints only if it carries money" rule the sheet already follows. */}
        {hasOut && (
          <div className="grid grid-cols-[38px_1fr_auto] items-center gap-2">
            <span className="text-[11px] font-extrabold tracking-wider">OUT</span>
            <span className="h-3 bg-paper-200 rounded-sm overflow-hidden">
              <span className="block h-full bg-ink-400" style={{ width: outWidth }} />
            </span>
            <span className="font-mono text-[13px] font-extrabold text-ink-700">− {money(report.totalOut)}</span>
          </div>
        )}
      </div>

      {hasOut ? (
        <div className="grid grid-cols-2 gap-x-5">
          <MoneyBlock title="In" lines={report.moneyIn} total={report.totalIn} />
          <MoneyBlock title="Out" lines={report.moneyOut} total={report.totalOut} />
        </div>
      ) : (
        <MoneyBlock title="In" lines={report.moneyIn} total={report.totalIn} />
      )}

      {/* THE CONCLUSION, where a conclusion belongs. */}
      <div className="border-y-4 border-double border-ink-800 py-2 flex justify-between items-baseline">
        <span className="text-[12px] font-extrabold tracking-[0.18em] uppercase">Net Today</span>
        <span className="font-mono text-[24px] font-extrabold leading-none">{money(report.net)}</span>
      </div>
    </StatementShell>
  )
}

/** One side of the sheet: every line named, then its total. */
function MoneyBlock({ title, lines, total }: { title: string; lines: { label: string; amount: number }[]; total: number }) {
  return (
    <div>
      <p className="text-[10px] font-extrabold tracking-[0.14em] uppercase text-ink-600 mb-1">{title}</p>
      {lines.map((line, index) => (
        <div key={`${line.label}-${index}`} className="flex justify-between gap-3 text-[12px]">
          <span className="truncate">{line.label}</span>
          <span className="font-mono">{money(line.amount)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 text-[13px] font-extrabold border-t border-ink-400 mt-1 pt-1">
        <span>Total</span>
        <span className="font-mono">{money(total)}</span>
      </div>
    </div>
  )
}

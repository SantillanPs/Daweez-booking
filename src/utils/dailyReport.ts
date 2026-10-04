// THE DAILY REPORT (the owner's design, 2026-09-29) — money in and money out for one day, and nothing
// else. His rulings, which are the whole specification:
//
//   *"this is supposed to be a report of how much money was received and spent, not promised."*
//   *"this report is for money only. nothing else."*
//   *"can we just list where the money came from? and not summarize it?"*
//
// So: **every peso is its own line, named by where it came from** (`Room 4 · SEB · Cash`) — never a
// bucket like "Room payments ₱6,400", and never a summary of summaries. No check-ins, no rooms occupied,
// no method sub-totals. The sheet's last line is NET TODAY.
//
// **WHAT MAKES A PESO COUNT: a dated receipt.** Money in comes from `payment_records` — a booking's or a
// walk-in tab's — because each record carries the `paid_at` the money actually arrived and the method it
// arrived by (see `PaymentRecord`, `utils/receiptNumber.ts`). A booking's `downpayment_paid` is *not* read
// here: it is a running total with no date, so it can never be placed on a day. Where a booking holds money
// that has no dated receipt (legacy paper-log backfills), the report says so through `undatedMoney` rather
// than quietly dropping it — a money report must not lose money.
//
// THE DAY BOUNDARY IS LOCAL MIDNIGHT, and that is the one thing still open with the owner: SEB's ₱1,900
// arrived at 2:45 AM local, so midnight puts it on the 30th where a 6 AM cut-off would put it on the 29th
// (keeping a night shift's takings on one sheet). When he names the hour, **`hotelDay` is the only function
// that changes** — every line of the report goes through it.

import type { Booking, PaymentRecord, Room } from '../types/booking'
import { slipNumber } from './orderSlips'
import type { Expense, ExpenseCategory } from '../types/expense'
import type { Tab } from '../types/tab'
import { paymentMethodLabel } from './paymentMethod'
import { formatRoomNumbers } from './roomNumbers'

/** One line of the sheet: what it was, and what it was worth. */
export interface DailyReportLine {
  /** Where the money came from or went — `Room 4 · SEB · Cash`, `Salary`. */
  label: string
  amount: number
}

export interface DailyReport {
  /** The day being reported, `YYYY-MM-DD`, in the hotel's own time. */
  date: string
  moneyIn: DailyReportLine[]
  moneyOut: DailyReportLine[]
  totalIn: number
  totalOut: number
  net: number
  /** Money bookings hold that carries no payment date, so it belongs to no day. */
  undatedMoney: number
  undatedCount: number
}

/**
 * The hotel's calendar day for an instant, as `YYYY-MM-DD`.
 *
 * Built from LOCAL parts, never `.toISOString()` — that is UTC, and in UTC+8 it moves every payment made
 * before 8 AM onto the previous day. This is the same trap `utils/helpers.ts` documents for booking dates,
 * and on this report it would put the night shift's takings on yesterday's sheet.
 *
 * **This is where the cut-off hour goes** when the owner names one: an instant before the cut-off belongs
 * to the day that is ending, so the body becomes a subtraction of `cutOffHours` before the parts are read.
 */
export function hotelDay(iso: string | undefined | null): string {
  if (!iso) return ''
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return ''
  const month = String(at.getMonth() + 1).padStart(2, '0')
  const day = String(at.getDate()).padStart(2, '0')
  return `${at.getFullYear()}-${month}-${day}`
}

/** A stored `payment_records` column: an array when it holds payments, and JSON `null` on most rows. */
function recordsOf(value: unknown): PaymentRecord[] {
  return Array.isArray(value) ? (value as PaymentRecord[]) : []
}

/** The room's number, or `null` for a venue or a booking that names no room. */
function roomNumberOf(booking: Booking, rooms: Room[]): number | null {
  if (!booking.room_id) return null
  const room = rooms.find(r => r.id === booking.room_id)
  return room ? room.room_number : null
}

/**
 * The rooms a payment covered — `Room 4`, `Rooms 2, 3`, or `Rooms 4–10` when they run consecutively.
 *
 * A multi-room payment is the case this exists for: the sheet has to say **which rooms** the money
 * covered, because one payment is one line and the rooms are the only thing that identifies it. The
 * wording is shared with the booking's own receipts list (`utils/roomNumbers.ts`) so the paper and the
 * screen never describe the same payment differently.
 */
const roomList = formatRoomNumbers

/** The guest on the line, shortened so a long agency name cannot push the figure off the sheet. */
function guestLabel(booking: Booking): string {
  const name = (booking.guest_name || '').trim()
  if (!name) return 'Guest'
  return name.length > 22 ? `${name.slice(0, 21)}…` : name
}

export interface DailyReportInput {
  /** The day to report, `YYYY-MM-DD`. */
  date: string
  bookings: Booking[]
  tabs?: Tab[]
  expenses?: Expense[]
  categories?: ExpenseCategory[]
  rooms?: Room[]
}

/**
 * Build one day's sheet. Pure: every figure comes from the records handed in, so the screen, the printed
 * paper and any later reader of the same day cannot disagree.
 */
export function buildDailyReport(input: DailyReportInput): DailyReport {
  const { date, bookings, tabs = [], expenses = [], categories = [], rooms = [] } = input

  // ── MONEY IN: one line per PAYMENT that landed on this day ───────────────────────────────────────────
  //
  // **Grouped by receipt number**, because one payment is stored on every room it covered and each of
  // those rows carries the WHOLE amount (the owner's ruling, 2026-09-30: a receipt must be findable from
  // any room it paid for, and must reprint the money that was actually handed over — never a room's
  // slice of it). Listing the rows as they come would print ₱9,200 seven times. The number is what says
  // those seven rows are one payment, so the day is summed by number and the line names every room.
  const payments = new Map<string, { rooms: number[]; guest: string; method: string; amount: number }>()

  const addPayment = (key: string, room: number | null, guest: string, method: string, amount: number) => {
    const found = payments.get(key)
    if (found) {
      if (room !== null && !found.rooms.includes(room)) found.rooms.push(room)
      return
    }
    payments.set(key, { rooms: room === null ? [] : [room], guest, method, amount })
  }

  bookings.forEach(booking => {
    recordsOf(booking.payment_records)
      .filter(record => hotelDay(record.paid_at) === date)
      .forEach(record => {
        const room = roomNumberOf(booking, rooms)
        // A record with no number of its own (legacy) stands alone, keyed by its own id.
        const key = record.receipt_number || record.id
        addPayment(key, room, guestLabel(booking), paymentMethodLabel(record.method), record.amount)
      })
  })

  tabs.forEach(tab => {
    recordsOf(tab.payment_records)
      .filter(record => hotelDay(record.paid_at) === date)
      .forEach(record => {
        const key = record.receipt_number || record.id
        const label = [tab.label || tab.table_label, slipNumber(tab)].filter(Boolean).join(' · ') || 'Order slip'
        const found = payments.get(key)
        if (found) found.guest = label
        else payments.set(key, { rooms: [], guest: label, method: paymentMethodLabel(record.method), amount: record.amount })
      })
  })

  const moneyIn: DailyReportLine[] = Array.from(payments.values()).map(payment => ({
    label: [payment.guest, roomList(payment.rooms), payment.method].filter(Boolean).join(' · '),
    amount: payment.amount,
  }))

  // Money held with no dated receipt, so no day can claim it. Reported, never dropped in silence.
  let undatedMoney = 0
  let undatedCount = 0
  bookings.forEach(booking => {
    const held = booking.downpayment_paid || 0
    if (held <= 0) return
    // The receipt on a room carries the WHOLE payment, so it is only "dated money" up to this room's own
    // share — comparing against the full amount would read every multi-room booking as overpaid.
    const share = Math.min(held, recordsOf(booking.payment_records).reduce((sum, r) => sum + (r.amount || 0), 0))
    const missing = Math.round((held - share) * 100) / 100
    if (missing > 0) {
      undatedMoney += missing
      undatedCount += 1
    }
  })

  // ── MONEY OUT: every expense dated this day, one line each ───────────────────────────────────────────
  const categoryName = (id: string) => categories.find(c => c.id === id)?.name || 'Other'
  const moneyOut: DailyReportLine[] = expenses
    .filter(expense => expense.expense_date === date)
    .map(expense => {
      const notes = (expense.notes || '').trim()
      const name = categoryName(expense.category_id)
      return { label: notes ? `${name} · ${notes}` : name, amount: expense.amount }
    })

  const totalIn = moneyIn.reduce((sum, line) => sum + line.amount, 0)
  const totalOut = moneyOut.reduce((sum, line) => sum + line.amount, 0)

  return {
    date,
    moneyIn,
    moneyOut,
    totalIn,
    totalOut,
    net: totalIn - totalOut,
    undatedMoney,
    undatedCount,
  }
}

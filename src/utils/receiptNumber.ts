import { Booking, PaymentRecord } from '../types/booking'

// Every payment gets its own numbered receipt. The number is STORED on the
// payment when it is recorded, because a receipt number derived from the
// payment's position in a list renumbers every later receipt as soon as one is
// removed — and staff quote these numbers when a guest calls back.
//
// Format: PR-<check-in month YYYYMM>-<NNN>, e.g. PR-202608-001. The month is
// the booking's check-in month, matching how booking invoices (GRF-YYYYMM-NNNN)
// already work.

const PREFIX = 'PR'

function monthKey(booking: Booking): string {
  const checkIn = booking.check_in || ''
  const month = checkIn.substring(0, 7)
  if (/^\d{4}-\d{2}$/.test(month)) return month.replace('-', '')
  return new Date().toISOString().substring(0, 7).replace('-', '')
}

function prefixFor(booking: Booking): string {
  return PREFIX + '-' + monthKey(booking) + '-'
}

// The next free receipt number for this payment's month.
//
// **One number per PAYMENT, and it must not already be on any other booking.** This used to read only
// the booking's OWN records, so two payments taken minutes apart on two fresh bookings both came out
// `PR-202609-001` — the desk could quote a receipt number and land on the wrong payment, and the guest
// was handed two different receipts carrying the same number (found on the owner's own bookings,
// 2026-09-30). It now scans every booking it is handed, so the month's numbers stay unique.
export function nextReceiptNumber(booking: Booking, otherBookings: Booking[] = []): string {
  const prefix = prefixFor(booking)
  const used = [booking, ...otherBookings]
    .flatMap(b => b.payment_records || [])
    .map(r => r.receipt_number || '')
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n) && n > 0)
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1
  return prefix + String(next).padStart(3, '0')
}

// The number to SHOW for a payment. New payments carry their own; payments
// recorded before receipts were numbered fall back to their position, so old
// bookings still print a stable, readable number.
export function receiptNumberFor(booking: Booking, record: PaymentRecord): string {
  if (record.receipt_number) return record.receipt_number
  const records = booking.payment_records || []
  const idx = records.findIndex(r => r.id === record.id)
  const position = idx >= 0 ? idx + 1 : 1
  return prefixFor(booking) + String(position).padStart(3, '0')
}

// The next free receipt number for a walk-in TAB (k69, part C). A diner with no
// booking has no check-in month to take, so today's month is used — built from
// LOCAL date parts, because UTC would report the previous month for the first
// eight hours of a new month in UTC+8.
export function nextTabReceiptNumber(usedNumbers: string[]): string {
  const now = new Date()
  const month = String(now.getFullYear()) + String(now.getMonth() + 1).padStart(2, '0')
  const prefix = PREFIX + '-' + month + '-'
  const used = usedNumbers
    .filter(n => n.startsWith(prefix))
    .map(n => Number(n.slice(prefix.length)))
    .filter(n => Number.isFinite(n) && n > 0)
  const next = (used.length > 0 ? Math.max(...used) : 0) + 1
  return prefix + String(next).padStart(3, '0')
}

// Splits all money received into the deposit captured when the booking was made
// and the payments recorded one by one, so a receipt can show the balance the
// guest was looking at *before* this payment.
//
// New bookings take no money at creation (Option B), so the deposit is 0 and
// every peso is a receipt. Legacy, imported and seeded bookings may carry a
// downpayment with no matching receipt; that remainder is the deposit.
export function paymentBreakdown(booking: Booking, record?: PaymentRecord) {
  const records = booking.payment_records || []
  const deposit = Math.max(0, (Number(booking.downpayment_paid) || 0) - paymentsRecorded(records))

  if (!record) {
    return { deposit, paidBefore: deposit, recordsTotal: paymentsRecorded(records) }
  }

  const idx = records.findIndex(r => r.id === record.id)
  const before = idx >= 0 ? records.slice(0, idx) : []
  return {
    deposit,
    paidBefore: deposit + paymentsRecorded(before),
    recordsTotal: paymentsRecorded(records),
  }
}

function paymentsRecorded(records: PaymentRecord[]): number {
  return records.reduce((sum, r) => sum + (Number(r.amount) || 0), 0)
}

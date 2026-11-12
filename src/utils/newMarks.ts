// New and changed features mark themselves where they live, in place of "What's new" (Sebastian,
// 2026-11-05: "add indicators from now on for features with updates or new features instead of using
// the what's new"; the "New feature marks" mock, option B in gold, "only on the feature"). The feature
// wears a NEW tag and one tap on it clears the tag on this device. The staff share devices and have no logins, so what a device has been shown is kept in its
// localStorage.
import { useSyncExternalStore } from 'react'

export interface NewFeature {
  id: string
  /** The day it went live, `YYYY-MM-DD`. Its marks go by themselves after `DAYS`, tapped or not. */
  since: string
}

/**
 * **Every update the staff can see adds one here, in the same push to `main`**, and its
 * feature wears `<NewTag id=… />` and calls `markSeen(id)` when tapped.
 */
export const NEW_FEATURES: NewFeature[] = [
  // An agency's bill takes discounts like a guest's, from its "Add" (`NewBookingBill`).
  { id: 'agency-discount', since: '2026-11-12' },
  // Restaurant → Paper slip: a paper order slip copied in after the fact, paid now or onto a guest's bill (`PaperSlipTab`).
  { id: 'paper-slip', since: '2026-11-11' },
  // The bill's Discounts say each thing once: the names when folded, no "Discount" on every line (`NewBookingBill`).
  { id: 'bill-discounts-lean', since: '2026-11-11' },
  // Restaurant → History: a diner's paid slip has a Paid step whose receipt number opens its receipt (`RestaurantHistory`).
  { id: 'history-receipt', since: '2026-11-09' },
  // A room on the bill is taken off by the trash can beside its name, always shown (`NewBookingBill`).
  { id: 'room-trash', since: '2026-11-06' },
  // A group's printed bill fits one A5 sheet: alike rooms on one row, one Dates column, the extras beside
  // the totals, the discount and payments grouped by them (`foldAlikeRooms`, `PaperExtras`, `InvoiceDocument`).
  { id: 'bill-paper-tight', since: '2026-11-06' },
  // A discount or payment is taken off on the bill by its bin, and stays struck through with Undo until
  // the bill closes; one alone is one plain line, the totals on one grid (`RemoveBin`, `GoneLine` in `FixPayment`).
  { id: 'bill-remove', since: '2026-11-06' },
  // A payment's receipt on the bill shows only its number, the ref. no., Print and Email (`FixPayment`).
  { id: 'receipt-slim', since: '2026-11-06' },
  // Today's money: a merged line says "N items", and a Money out one is titled by what it was for (`ExpenseGroup`,
  // `PaymentGroup` in `DayMoney`). It took over 'table-groups' (a table's slips as one line, the same day).
  { id: 'group-items', since: '2026-11-06' },
  // An agency's or institution's bill with money taken on it says what is left, not the whole Total (`NewBookingBill`).
  { id: 'agency-paid-due', since: '2026-11-05' },
  // Restaurant → History: each order slip's orders, serves and where its bill went (`RestaurantHistory`).
  // Renewed the same day for its stronger, lined-up icons, so a tablet that already tapped it sees the tag again.
  { id: 'restaurant-history-2', since: '2026-11-05' },
  // The day-or-hours chip beside a Gazebo or Garden on the bill (`NewBookingBill`).
  { id: 'venue-length', since: '2026-11-05' },
  // An agency's room and breakfast prices are changed on its bill and kept on the agency (`NewBookingBill`).
  { id: 'agency-prices', since: '2026-11-05' },
  // The agency's own breakfast price in Settings → Agencies (`DirectoryTab`).
  { id: 'agency-breakfast', since: '2026-11-05' },
  // The bill's one "Add" for a discount or a payment, beside the totals (`AddMoney` in `BillDesk`).
  { id: 'bill-add-one', since: '2026-11-06' },
  // Pension House Exclusive is the whole house: its row is on top and its roof covers every room and venue (`ExclusiveRoof`).
  { id: 'exclusive-roof', since: '2026-11-07' },
  // GCash, bank and cheque money comes off before Cash on hand in Today's money's summary (`DayMoney`).
  { id: 'cash-not-gcash', since: '2026-11-07' },
  // A bill that has received more than it comes to shows its Amount due below zero, in green (`over` in `NewBookingBill`).
  { id: 'bill-overpaid', since: '2026-11-07' },
]

const KEY = 'daweez_new_seen'
const DAYS = 30

function read(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return new Set(Array.isArray(v) ? v : [])
  } catch {
    return new Set()
  }
}

let seen = read()
const watchers = new Set<() => void>()

function fresh(f: NewFeature): boolean {
  if (seen.has(f.id)) return false
  const end = new Date(f.since + 'T00:00:00')
  end.setDate(end.getDate() + DAYS)
  return new Date() < end
}

/** The feature was tapped: its tag goes at once. */
export function markSeen(id: string): void {
  if (seen.has(id) || !NEW_FEATURES.some(f => f.id === id)) return
  seen = new Set(seen).add(id)
  try { localStorage.setItem(KEY, JSON.stringify([...seen])) } catch { /* the marks just come back on reload */ }
  watchers.forEach(tell => tell())
}

function useSeen(): Set<string> {
  return useSyncExternalStore(
    tell => {
      watchers.add(tell)
      return () => { watchers.delete(tell) }
    },
    () => seen,
  )
}

/** Whether this feature is still new here. */
export function useIsNew(id: string): boolean {
  useSeen()
  return NEW_FEATURES.some(f => f.id === id && fresh(f))
}

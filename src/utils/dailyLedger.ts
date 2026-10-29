import { Booking, Room, Venue } from '../types/booking'
import { Expense } from '../types/expense'
import { TabLine } from '../types/tab'
import { calculatePricing } from './syncEngine'
import { dateToString } from './helpers'

/** A source of income on the Earnings report's Charts view: a room, a named venue, or the restaurant. */
export interface Place {
  id: string
  /** What its tile says: the room number, or a short name. */
  label: string
  name: string
  hint?: string
  room: boolean
}

/** Every day's money for every source, nights filled for every room, and what was spent — read once, then summed for any dates. */
export interface Ledger {
  places: Place[]
  money: Record<string, Record<string, number>>
  used: Record<string, Record<string, number>>
  spent: Record<string, number>
  /** The first day the system holds anything for; nothing is compared with days before it. */
  first: string
  roomCount: number
}

export const parseDay = (day: string) => {
  const [y, m, d] = day.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}
export const addDays = (day: string, n: number) => {
  const d = parseDay(day)
  d.setDate(d.getDate() + n)
  return dateToString(d)
}

// The named venues the report counts, matched the way useAnalyticsCalculations matches them. A venue not
// named here (Pension House Exclusive) is not in the report's totals, so it is not a tile either.
const VENUES: [string, string][] = [['vacation', 'Vacation'], ['garden', 'Garden'], ['gazebo', 'Gazebo']]

/**
 * The same money the Earnings report counts, laid out day by day (the owner, 2026-10-14: the Charts view shows
 * how the hotel, each room and each venue perform over time). A room earns its rate and breakfast on each night
 * of the stay, a venue its whole price per day, the restaurant each order on the day it was placed.
 */
export function buildLedger(params: {
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  expenses: Expense[]
  tabLines: TabLine[]
  includePending: boolean
}): Ledger {
  const { bookings, rooms, venues, expenses, tabLines, includePending } = params
  const money: Ledger['money'] = {}
  const used: Ledger['used'] = {}
  const spent: Ledger['spent'] = {}
  let first = dateToString(new Date())
  const add = (bag: Record<string, Record<string, number>>, id: string, day: string, v: number) => {
    const row = (bag[id] ??= {})
    row[day] = (row[day] || 0) + v
    if (day < first) first = day
  }

  const places: Place[] = [...rooms]
    .sort((a, b) => a.room_number - b.room_number)
    .map(r => ({ id: r.id, label: 'Room ' + r.room_number, name: 'Room ' + r.room_number, hint: r.name, room: true }))
  const venueKey = (id: string) => VENUES.find(([k]) => id.toLowerCase().includes(k))?.[0]
  VENUES.forEach(([key, label]) => {
    const v = venues.find(x => venueKey(x.id) === key)
    places.push({ id: key, label, name: v?.name || label, room: false })
  })
  places.push({ id: 'food', label: 'Restaurant', name: 'Restaurant & bar', room: false })

  const statuses = includePending ? ['confirmed', 'pending'] : ['confirmed']
  for (const b of bookings) {
    const id = b.room_id || (b.venue_id ? venueKey(b.venue_id) : undefined)
    if (!id) continue
    // A cancelled booking earns nothing, the money it received included — the same rule as
    // the report's totals (`useAnalyticsCalculations`) and Today's money (2026-10-29).
    if (!statuses.includes(b.status) || !b.check_in || !b.check_out) continue
    const nights: string[] = []
    for (let d = b.check_in.slice(0, 10); d < b.check_out.slice(0, 10); d = addDays(d, 1)) nights.push(d)
    if (!nights.length) continue
    const price = calculatePricing({
      roomId: b.room_id,
      venueId: b.venue_id,
      checkIn: b.check_in,
      checkOut: b.check_out,
      guestEmail: b.guest_email,
      equipmentRentals: b.equipment_rentals,
      eventAddons: b.event_addons,
      bookingsList: bookings,
      breakfastIncluded: b.breakfast_included === true,
      breakfastDays: b.breakfast_days,
      contractRateOverride: b.contract_rate_override,
      shortStayHours: b.stay_hours,
      rooms,
      venues,
    })
    // What the report's totals count: a room's rate and breakfast, a venue's whole day.
    const perNight = (b.room_id ? price.subtotal + price.breakfastTotal : price.grandTotal) / nights.length
    for (const day of nights) {
      add(money, id, day, perNight)
      if (b.room_id) add(used, id, day, 1)
    }
  }
  for (const line of tabLines) {
    const at = line.created_at ? new Date(line.created_at) : null
    if (!at || Number.isNaN(at.getTime())) continue
    add(money, 'food', dateToString(at), Number(line.amount || 0))
  }
  for (const e of expenses) {
    if (!e.expense_date) continue
    const day = e.expense_date.slice(0, 10)
    spent[day] = (spent[day] || 0) + Number(e.amount || 0)
    if (day < first) first = day
  }
  return { places, money, used, spent, first, roomCount: rooms.length }
}

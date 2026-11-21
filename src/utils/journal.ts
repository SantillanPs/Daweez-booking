// THE JOURNAL — the staff's own monthly sheet (Sebastian, 2026-11-22, from their Google Sheet "Journal"):
// every bill BOOKED in the month, a line for each room, venue, the food and the catering on it, then
// Total · Discount · Total net · Payment · Balance and how they paid, and a summary by place. It tracks
// the money still owed on the month's reservations, so a payment made later updates the month the bill
// was booked in, never the month it was paid. A bill with nothing paid on it yet is left out (Sebastian:
// "the ones with no deposit shouldn't show here").
//
// Nothing is stored for it: each bill is priced the way `settleBill` prices it — every room's stay and
// food − the discounts − the money received.

import type { Booking, PaymentRecord, Room, Venue } from '../types/booking'
import { onLead } from './bookingBalance'
import { VENUE_ORDER } from './incomeStatement'
import { discountOffs, discountsOf } from './discounts'
import { billStays, priceBooking } from './pricing'
import { dateToString, normalizeVenueId } from './helpers'

export interface JournalLine {
  /** `Room 4`, `Vacation House`, `Food`, `Catering · Lunch`. */
  what: string
  /** The summary's line: `Rooms`, a venue's name, `Restaurant`, `Catering`. */
  place: string
  checkIn?: string
  checkOut?: string
  qty: number
  /** `night`, `day`, `6 hours`, `heads`; none for the food. */
  unit?: string
  rate: number
  total: number
}

export interface JournalBill {
  key: string
  /** The bill's number, its first room's. */
  number: string
  /** `YYYY-MM-DD`, the day it was booked. */
  booked: string
  who: string
  agency: boolean
  cancelled: boolean
  lines: JournalLine[]
  total: number
  discount: number
  net: number
  paid: number
  owed: number
  payments: PaymentRecord[]
  /** The booking that opens the bill. */
  lead: Booking
}

export interface JournalPlace { place: string; total: number; discount: number; net: number; paid: number; owed: number }

export interface Journal { bills: JournalBill[]; places: JournalPlace[] }

const unitWord = (unit: string, n: number) => {
  const u = unit.toLowerCase()
  return /hour/.test(u) ? u : u + (n === 1 ? '' : 's')
}
const isCatering = (c: { kind?: string; name: string }) => c.kind === 'catering' || /cater/i.test(c.name)

export function buildJournal({ month, bookings, rooms, venues, food }: {
  /** `YYYY-MM`. */
  month: string
  bookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  /** Each booking's order slips, by booking id. */
  food: Record<string, number>
}): Journal {
  const groups = new Map<string, Booking[]>()
  for (const b of bookings) {
    if (b.status === 'blocked') continue
    const k = b.group_id || b.id
    groups.set(k, [...(groups.get(k) || []), b])
  }
  const venueName = (id?: string) => venues.find(v => v.id === normalizeVenueId(id))?.name || id || 'Venue'
  const priced = (b: Booking) => b.room_id ? rooms.some(r => r.id === b.room_id) : venues.some(v => v.id === normalizeVenueId(b.venue_id))

  const bills: JournalBill[] = []
  for (const [key, list] of groups) {
    const all = [...list].sort((a, b) => (a.invoice_number || '').localeCompare(b.invoice_number || ''))
    const booked = all.map(b => b.created_at ? dateToString(new Date(b.created_at)) : b.check_in).sort()[0]
    if (!booked || booked.slice(0, 7) !== month) continue
    // a room cancelled off a bill is no longer on it; a bill cancelled whole keeps its rooms, struck through
    const cancelled = all.every(b => b.status === 'cancelled')
    const rows = cancelled ? all : all.filter(b => b.status !== 'cancelled')
    if (!rows.every(priced)) continue // the prices are still loading
    const payments = onLead(all)[0].payment_records || []
    const paid = payments.reduce((t, p) => t + Number(p.amount || 0), 0)
    if (paid <= 0) continue
    const led = onLead(rows)

    const lines: JournalLine[] = []
    let gross = 0
    for (const b of led) {
      const p = priceBooking({ ...b, applied_discount: [] }, { rooms, venues })
      const charges = b.event_addons?.charges || []
      const cater = charges.filter(isCatering)
      const caterTotal = cater.reduce((t, c) => t + Number(c.amount || 0), 0)
      const room = b.room_id ? rooms.find(r => r.id === b.room_id) : undefined
      const qty = p.stayQuantity || 1
      lines.push({
        what: room ? 'Room ' + room.room_number : venueName(b.venue_id),
        place: room ? 'Rooms' : venueName(b.venue_id),
        checkIn: b.check_in, checkOut: b.check_out,
        qty: b.stay_hours ? 1 : qty, unit: unitWord(p.stayUnit, qty), rate: Math.round(p.subtotal / qty),
        total: p.grandTotal - caterTotal,
      })
      for (const c of cater) lines.push({
        what: c.name && !/^catering$/i.test(c.name) ? 'Catering · ' + c.name : 'Catering', place: 'Catering',
        qty: c.qty || 1, unit: c.qty ? 'heads' : undefined, rate: c.price || Number(c.amount || 0), total: Number(c.amount || 0),
      })
      if (food[b.id]) lines.push({ what: 'Food', place: 'Restaurant', qty: 1, rate: food[b.id], total: food[b.id] })
      gross += p.grandTotal + (food[b.id] || 0)
    }
    const stays = billStays(led[0], led, { rooms, venues, food })
    const discount = discountOffs(discountsOf(led[0].applied_discount), stays ?? gross).reduce((t, n) => t + n, 0)
    const net = gross - discount
    const lead = all[0]
    bills.push({
      key, number: lead.invoice_number || '', booked, who: lead.company_name || lead.guest_name || 'Guest',
      agency: !!(lead.partner_deal_id || lead.company_name), cancelled, lines, total: gross, discount, net,
      paid, owed: cancelled ? 0 : Math.max(0, net - paid), payments, lead,
    })
  }
  bills.sort((a, b) => a.booked.localeCompare(b.booked) || a.number.localeCompare(b.number))
  return { bills, places: byPlace(bills, venues) }
}

/**
 * The summary, by place. A bill's discount comes off its places by their share of it, and its money
 * fills them the way Cash Flow counts it: the rooms, venues and food first, catering last (Sebastian,
 * 2026-11-14), so a bill part paid still owes for its catering before anything else. Money paid over the
 * bill counts on its first place, so the summary's payments add up to the money received (Sebastian,
 * 2026-11-22: "it should show extra"); what is owed is worked out bill by bill, so it never goes below 0.
 */
function byPlace(bills: JournalBill[], venues: Venue[]): JournalPlace[] {
  const sums = new Map<string, JournalPlace>()
  const at = (place: string) => sums.get(place) || sums.set(place, { place, total: 0, discount: 0, net: 0, paid: 0, owed: 0 }).get(place)!
  for (const b of bills) {
    if (b.cancelled) continue
    const share = new Map<string, number>()
    for (const l of b.lines) share.set(l.place, (share.get(l.place) || 0) + l.total)
    let left = b.paid
    const order = [...share].sort(([x], [y]) => Number(x === 'Catering') - Number(y === 'Catering'))
    for (const [place, total] of order) {
      const discount = b.total ? b.discount * total / b.total : 0
      const net = total - discount
      const paid = Math.min(left, net)
      left -= paid
      const s = at(place)
      s.total += total; s.discount += discount; s.net += net; s.paid += paid; s.owed += net - paid
    }
    if (left > 0 && order.length) at(order[0][0]).paid += left
  }
  // the paper's order: Rooms, the venues, Restaurant, Catering — each shown even when empty, like the staff's sheet
  const order = [...venues].sort((a, b) => {
    const ia = VENUE_ORDER.indexOf(a.id), ib = VENUE_ORDER.indexOf(b.id)
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.name.localeCompare(b.name)
  })
  const names = ['Rooms', ...order.filter(v => VENUE_ORDER.includes(v.id) || sums.has(v.name)).map(v => v.name), 'Restaurant', 'Catering']
  return names.map(at)
}

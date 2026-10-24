import { Booking, Room, Venue } from '../types/booking'
import * as syncEngine from './syncEngine'
import { normalizeVenueId, dateToString } from './helpers'
import { getRateConfig } from './rateConfig'
import { chargeableEarlyHours } from './checkInOut'
import { roomDisplayName } from '../components/calendar/bookingStyles'
import { OrderSlip, slipNumber, slipsTotal } from './orderSlips'
import { venueTypeOf, venueTypeTitle } from './venueTypes'
import { airconWords } from './venueHours'

/**
 * The rows of the printed Guest Billing Statement, one per charge.
 *
 * Every row carries its **band** (`Room Accommodation:` · `Breakfast:` · `Extras:` ·
 * `Discount:` · `Restaurant & bar:`) because the owner's 2026-09 design prints the paper's
 * own table — `Room / Particulars · Rate · Date (Check In | Check Out) · No. of Night ·
 * Total` — with the charges grouped under those bands, on **both** bills. A band with no
 * rows is simply never drawn, which is why an un-checked-in booking shows no restaurant
 * band at all (food follows check-in, card k69).
 *
 * It sits in its own module so `statement.ts` stays the assembler of totals and payments.
 */

/** `2026-09-25` → `09/25/26`, the way the paper's own Date columns read. */
export const shortDate = (iso?: string) => {
  const v = (iso || '').trim()
  if (!v.includes('-')) return v
  const [y, m, d] = v.split('-')
  return m + '/' + d + '/' + (y || '').slice(2)
}

export type StatementBand = 'room' | 'breakfast' | 'extras' | 'discount' | 'food'

export interface StatementLineItem {
  key: string
  band: StatementBand
  description: string
  qty: string
  unit: string
  price: number
  discount: number
  amount: number
  /** Room rows only: the dates the paper's own `Date` columns print. */
  checkIn?: string
  checkOut?: string
  /** Room rows only: the number in the `No. of Night` column. */
  nights?: number
  /** Order slip rows only: `Paid` or `Not paid`, printed beside the slip's number. */
  status?: string
  /**
   * What taking this charge off the booking writes (the owner's note, 2026-10-20: "be able
   * to remove charges in reservations"). Only on charges the desk added; the stay itself is
   * changed by its dates, and an order slip belongs to the restaurant.
   */
  remove?: Partial<Booking>
}

/**
 * **One discount row for the whole bill** (Sebastian, 2026-10-06: *"there's more than one
 * bookings, the discount usually has its own row for each room that has a discount, so just
 * use 1 row for the discount and just show the total of the discount for all"*).
 *
 * A booking of several rooms is one row per room, and each room that was given a discount
 * printed its own `Discount` line. They are joined into one that shows what all of them come
 * to. It keeps the percentage in its words only when every room was given the same one.
 */
export function mergeDiscountRows(items: StatementLineItem[]): StatementLineItem[] {
  const discounts = items.filter(i => i.band === 'discount')
  if (discounts.length < 2) return items
  const total = discounts.reduce((sum, i) => sum + i.amount, 0)
  const same = discounts.every(i => i.description === discounts[0].description)
  const merged: StatementLineItem = {
    ...discounts[0],
    description: same ? discounts[0].description : 'Discount',
    price: total,
    amount: total,
  }
  // Where the first discount row stood — the table groups by band, so this is only its order.
  let placed = false
  return items.flatMap(i => {
    if (i.band !== 'discount') return [i]
    if (placed) return []
    placed = true
    return [merged]
  })
}

/** The nights a booking is charged for (a short stay is one day). */
export const nightsFor = (b: Booking): number =>
  b.check_in && b.check_out
    ? Math.max(1, Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
    : 1

const unitName = (b: Booking, rooms: Room[], venues: Venue[]): string => {
  if (b.room_id) {
    const room = rooms.find(r => r.id === b.room_id)
    return room ? roomDisplayName(room) : 'Room'
  }
  const venue = venues.find(v => v.id === normalizeVenueId(b.venue_id || ''))
  return venue ? venue.name : 'Event Venue'
}

// Same charge inputs the pricing engine uses, so the printed table always matches
// the real invoice.
export function bookingPricing(b: Booking, o: {
  rooms: Room[]
  venues: Venue[]
  bookingsList: Booking[]
}) {
  return syncEngine.calculatePricing({
    roomId: b.room_id,
    venueId: b.venue_id,
    checkIn: b.check_in,
    checkOut: b.check_out,
    guestEmail: b.guest_email,
    // What the booking holds: this room has breakfast (card k140).
    breakfastIncluded: b.breakfast_included === true,
    equipmentRentals: b.equipment_rentals,
    eventAddons: b.event_addons,
    bookingsList: o.bookingsList,
    contractRateOverride: b.contract_rate_override,
    appliedDiscount: b.applied_discount,
    // Early check-in is collected at check-out, so it stays off the bill until then —
    // the paper and the screen must never disagree (see `chargeableEarlyHours`).
    earlyCheckInHours: chargeableEarlyHours(b),
    lateCheckOutHours: b.late_check_out_hours,
    venueDayBlocks: b.venue_day_blocks,
    breakfastRecords: b.breakfast_records,
    rooms: o.rooms,
    venues: o.venues,
    // The hours the room was sold for: without them the printed bill charges the whole
    // night for a 3-hour stay (the screen said ₱550, the paper printed ₱850).
    shortStayHours: b.stay_hours,
    rates: getRateConfig(),
  })
}

/**
 * Every charge on one booking, banded. The rows add up to exactly
 * `pricing.grandTotal + <its food tab>`, which is what `statement.ts` puts in Sub-Total:
 * room rows print the **rate on the board**, a real staff discount prints as its own
 * `Discount:` row, and a short stay prints the price of its **hours as the price** (the
 * owner's S3/S6 ruling — the gap between a night and its hours price is not a discount).
 */
export function bookingLines(b: Booking, o: {
  rooms: Room[]
  venues: Venue[]
  bookingsList: Booking[]
  slipsByBooking?: Record<string, OrderSlip[]>
}): { items: StatementLineItem[]; tabTotal: number } {
  const items: StatementLineItem[] = []
  const pricing = bookingPricing(b, o)
  const { rooms, venues } = o
  const isRoom = !!b.room_id
  const nights = nightsFor(b)
  const stayQty = pricing.stayQuantity > 0 ? pricing.stayQuantity : nights
  const checkIn = b.check_in || ''
  const checkOut = b.check_out || ''
  // No "promo" wording on the printed paper (card k128): there is one price, so the room
  // line simply names the room. Only a partner's contracted rate is worth calling out.
  const rateLabel = b.contract_rate_override != null && b.partner_deal_id ? ' · corporate' : ''
  // The kind of venue that was booked is named on its row: `Vacation House & Ground`,
  // `Vacation House · Exclusive`.
  const bookedVenue = isRoom ? undefined : venues.find(v => v.id === normalizeVenueId(b.venue_id || ''))
  const kind = bookedVenue ? venueTypeOf(bookedVenue, b.event_addons?.venue_type) : undefined
  const kindTitle = bookedVenue && kind ? venueTypeTitle(bookedVenue, kind) : ''
  const stayHours = Number(b.stay_hours || 0)
  const isShortStay = stayHours > 0

  // The stay, with the rate actually charged on the board. GROSS on purpose: a real staff
  // discount rides in its own row below, so the table adds up in front of the guest.
  items.push({
    key: b.id + '-stay',
    band: 'room',
    description: (kindTitle || unitName(b, rooms, venues)) + (isShortStay ? ' · ' + stayHours + ' hours' + airconWords(b.venue_id, stayHours) : '') + rateLabel,
    // A short stay is ONE charge, but the column must read the hours bought (`12 hrs`):
    // the charge count printed `1 hrs` on every short stay, whatever its length.
    qty: isShortStay ? String(stayHours) : String(stayQty),
    unit: isShortStay ? 'HOURS' : pricing.stayUnit,
    price: stayQty > 0 ? Math.round(pricing.subtotal / stayQty) : Math.round(pricing.subtotal),
    discount: 0,
    amount: Math.round(pricing.subtotal),
    checkIn,
    checkOut,
    nights: stayQty,
  })

  // A real staff discount, once, as its own row.
  if (pricing.appliedDiscountAmount > 0) {
    items.push({
      key: b.id + '-discount',
      band: 'discount',
      // Just `Discount` (Sebastian, 2026-10-06: *"remove the 'Staff' in the discount"*).
      description: b.applied_discount?.type === 'percent'
        ? 'Discount (' + b.applied_discount.value + '%)'
        : 'Discount',
      qty: '1',
      unit: 'PC',
      price: -Math.round(pricing.appliedDiscountAmount),
      discount: 0,
      amount: -Math.round(pricing.appliedDiscountAmount),
      // A value of 0, not null: `update_booking` keeps the stored discount when sent null.
      remove: { applied_discount: { type: 'flat', value: 0 } },
    })
  }

  // Breakfast is the room's own price once a night (2026-10-17) and prints as one line
  // under the Breakfast band — `Room 6 · Breakfast`, 2 × NIGHT — never per guest.
  if (isRoom && pricing.breakfastTotal > 0) {
    items.push({
      key: b.id + '-breakfast',
      band: 'breakfast',
      description: unitName(b, rooms, venues) + ' · Breakfast',
      qty: String(pricing.breakfastNights || 1),
      unit: pricing.breakfastNights ? 'NIGHT' : 'PC',
      price: Math.round(pricing.breakfastTotal / (pricing.breakfastNights || 1)),
      discount: 0,
      amount: Math.round(pricing.breakfastTotal),
      remove: { breakfast_included: false },
    })
  }

  // Early check-in and late checkout, a row each so either can be taken off on its own
  // (Sebastian, 2026-10-20: "include the charges from late checkin and checkout").
  const earlyLate: Array<[string, string, number, number, Partial<Booking>]> = [
    ['early', 'Early check-in', chargeableEarlyHours(b), pricing.earlyCharge, { early_check_in_hours: 0 }],
    ['late', 'Late checkout', Number(b.late_check_out_hours || 0), pricing.lateCharge, { late_check_out_hours: 0 }],
  ]
  earlyLate.forEach(([k, label, hrs, charge, remove]) => {
    if (!(charge > 0)) return
    items.push({
      key: b.id + '-' + k,
      band: 'extras',
      description: label + ' · ' + hrs + (hrs === 1 ? ' hr' : ' hrs'),
      qty: String(hrs),
      unit: 'HR',
      price: hrs > 0 ? Math.round(charge / hrs) : Math.round(charge),
      discount: 0,
      amount: Math.round(charge),
      remove,
    })
  })

  // Breakfast recorded against a VENUE booking keeps its own rows (there is no room
  // price to fold it into).
  const bfRecords = isRoom ? [] : (b.breakfast_records || [])
  if (bfRecords.length > 0) {
    bfRecords.forEach(r => {
      const dateLabel = r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      items.push({
        key: b.id + '-breakfast-' + r.id,
        band: 'breakfast',
        description: 'Breakfast · ' + r.item + (dateLabel ? ' · ' + dateLabel : ''),
        qty: String(r.quantity),
        unit: 'PERSON',
        price: Math.round(r.price || 0),
        discount: 0,
        amount: Math.round((r.price || 0) * (r.quantity || 0)),
        remove: { breakfast_records: (b.breakfast_records || []).filter(x => x.id !== r.id) },
      })
    })
  }
  // **There is no per-head breakfast line any more** (the owner's ruling, 2026-09-29). This
  // branch printed `Breakfast (₱150/guest/night)` and worked the head-count back out of the
  // total — the last trace of the retired ₱150-per-person rule, and the only reason the
  // engine still needed a per-head figure at all. Breakfast now reaches the paper exactly two
  // ways: a room's `breakfast_price` folded in as ONE `Breakfast:` row, or a legacy
  // `breakfast_record` above carrying the price it was served at.

  // Extra linen / amenities for rooms (per night) and event rental equipment.
  const er = b.equipment_rentals
  if (er) {
    // [label, count, unit, per-night?, rate, field]
    const rentals: Array<[string, number, string, boolean, number, keyof typeof er]> = []
    if (isRoom) {
      if (er.extraFoamCount) rentals.push(['Extra foam', er.extraFoamCount, 'PC', true, 200, 'extraFoamCount'])
      if (er.extraPillowCount) rentals.push(['Extra pillow', er.extraPillowCount, 'PC', true, 50, 'extraPillowCount'])
      if (er.extraBlanketCount) rentals.push(['Extra blanket', er.extraBlanketCount, 'PC', true, 50, 'extraBlanketCount'])
      if (er.extraTowelCount) rentals.push(['Extra towel', er.extraTowelCount, 'PC', true, 50, 'extraTowelCount'])
    } else {
      if (er.bigTableCount) rentals.push(['Big table', er.bigTableCount, 'PC', false, 150, 'bigTableCount'])
      if (er.smallTableCount) rentals.push(['Small table', er.smallTableCount, 'PC', false, 100, 'smallTableCount'])
      if (er.chairCount) rentals.push(['Chairs', er.chairCount, 'PC', false, 15, 'chairCount'])
      if (er.mineralWaterCount) rentals.push(['Mineral water', er.mineralWaterCount, 'PC', false, 35, 'mineralWaterCount'])
      if (er.tableCount) rentals.push(['Extra table', er.tableCount, 'PC', false, 150, 'tableCount'])
      if (er.tentCount) rentals.push(['Extra tent', er.tentCount, 'PC', false, 500, 'tentCount'])
    }
    rentals.forEach(([label, count, unit, perNight, rate, field]) => {
      items.push({
        key: b.id + '-' + label,
        band: 'extras',
        description: label,
        qty: String(perNight ? count * nights : count),
        unit,
        price: rate,
        discount: 0,
        amount: (perNight ? count * nights : count) * rate,
        remove: { equipment_rentals: { ...er, [field]: 0 } },
      })
    })
  }

  if (b.venue_excess_hours && b.venue_excess_hours > 0) {
    items.push({
      key: b.id + '-excess',
      band: 'extras',
      description: 'Venue excess hours',
      qty: String(b.venue_excess_hours),
      unit: 'HR',
      price: 500,
      discount: 0,
      amount: b.venue_excess_hours * 500,
      remove: { venue_excess_hours: 0 },
    })
  }

  const ea = b.event_addons
  if (ea) {
    const addons: Array<[string, number, keyof typeof ea]> = []
    if (ea.fullBandAndLights) addons.push(['Full band & lights', 2000, 'fullBandAndLights'])
    if (ea.stage) addons.push(['Stage', 2000, 'stage'])
    if (ea.ledWall) addons.push(['LED wall', 5000, 'ledWall'])
    addons.forEach(([label, rate, field]) => {
      items.push({ key: b.id + '-addon-' + label, band: 'extras', description: label, qty: '1', unit: 'PC', price: rate, discount: 0, amount: rate, remove: { event_addons: { ...ea, [field]: false } } })
    })
    // Charges the desk wrote on the bill, under Extras with the day they were put on.
    ;(ea.charges || []).forEach(c => {
      items.push({
        key: b.id + '-charge-' + c.id, band: 'extras', description: c.name, qty: '1', unit: 'PC',
        price: c.amount, discount: 0, amount: c.amount, checkIn: c.date,
        remove: { event_addons: { ...ea, charges: (ea.charges || []).filter(x => x.id !== c.id) } },
      })
    })
  }

  // The guest's food and bar — its own band, and only when there is food: nothing is
  // ordered before the guest checks in, so no band is drawn at all.
  //
  // **One row per order slip: its number, the day, its total and whether it is paid**
  // (the staff's feedback, 2026-10-04). The bill used to list every dish, so food the
  // guest had already paid for kept reading as an open order.
  const slips = o.slipsByBooking?.[b.id] || []
  const tabTotal = slipsTotal(slips)
  slips.forEach(slip => {
    items.push({
      key: b.id + '-slip-' + slip.tab.id,
      band: 'food',
      description: slipNumber(slip.tab),
      qty: '',
      unit: 'PC',
      price: 0,
      discount: 0,
      amount: Math.round(slip.total),
      checkIn: slip.tab.opened_at ? dateToString(new Date(slip.tab.opened_at)) : '',
      status: slip.paid ? 'Paid' : 'Not paid',
    })
  })

  return { items, tabTotal }
}

import { Booking, Room, Venue, PartnerDeal } from '../types/booking'
import * as syncEngine from './syncEngine'
import { normalizeVenueId } from './helpers'
import { getRateConfig } from './rateConfig'
import { amountToPayNow } from './bookingMoney'
import { chargeableEarlyHours } from './checkInOut'
import { roomDisplayName } from '../components/calendar/bookingStyles'
import { TabLine } from '../types/tab'

// Builds the structured data for the printable "Guest Billing Statement"
// (the form staff fill in by hand for walk-ins / Facebook calls). It turns a
// booking (and any related bookings sharing an invoice number) into one row
// per charge so the printed table mirrors the physical paper form.

export interface StatementLineItem {
  key: string
  description: string
  qty: string
  unit: string
  price: number
  discount: number
  amount: number
}

export interface Statement {
  invoiceNumber: string
  dateIssued: string
  lineItems: StatementLineItem[]
  subTotal: number
  downpaymentPaid: number
  partialPayment: number
  other: number
  // A refundable deposit held on the booking, printed only when one is actually
  // held so the statement never shows a line that has nothing to say.
  securityDeposit: number
  // What the guest hands over at this point — the agreed 50% deposit while
  // nothing has been paid yet, otherwise whatever is still owed. Never the whole
  // stay when the guest only agreed to a deposit.
  amountDue: number
  // What is still owed AFTER that payment, so the guest can see the deposit is
  // not the whole bill and knows what to bring on arrival.
  balanceAfter: number
  // What the guest agreed to pay when they booked: 'deposit' | 'full' | ''.
  paymentPlan: '' | 'deposit' | 'full'
  paymentMethod: string
}

export interface StatementInput {
  primaryBooking: Booking
  relatedBookings: Booking[]
  rooms: Room[]
  venues: Venue[]
  deal?: PartnerDeal | null
  bookingsList: Booking[]
  /**
   * The food and bar tab for each booking, keyed by booking id (k69). Its lines
   * print under the room and its total joins the bill, so the paper the guest
   * holds carries the same figure the screen shows.
   */
  tabLinesByBooking?: Record<string, TabLine[]>
}

const unitName = (b: Booking, rooms: Room[], venues: Venue[]): string => {
  if (b.room_id) {
    const room = rooms.find(r => r.id === b.room_id)
    return room ? roomDisplayName(room) : 'Room'
  }
  const venue = venues.find(v => v.id === normalizeVenueId(b.venue_id || ''))
  return venue ? venue.name : 'Event Venue'
}

const nightsFor = (b: Booking): number =>
  b.check_in && b.check_out
    ? Math.max(1, Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / 86400000))
    : 1

// Same charge inputs the pricing engine uses, so the printed table always
// matches the real invoice.
function bookingPricing(b: Booking, o: StatementInput) {
  const usePromo = (b as Booking & { promo_applied?: boolean }).promo_applied === true
  return syncEngine.calculatePricing({
    roomId: b.room_id,
    venueId: b.venue_id,
    checkIn: b.check_in,
    checkOut: b.check_out,
    guestEmail: b.guest_email,
    breakfastOrders: b.breakfast_orders == null ? [] : b.breakfast_orders,
    // What the booking holds: this room has breakfast (card k140).
    breakfastIncluded: b.breakfast_included === true,
    equipmentRentals: b.equipment_rentals,
    eventAddons: b.event_addons,
    companions: b.companions,
    bookingsList: o.bookingsList,
    contractRateOverride: b.contract_rate_override,
    appliedDiscount: b.applied_discount,
    // Early check-in is collected at check-out, so it stays off the bill until then —
    // the paper and the screen must never disagree (see `chargeableEarlyHours`).
    earlyCheckInHours: chargeableEarlyHours(b),
    lateCheckOutHours: b.late_check_out_hours,
    venueDayBlocks: b.venue_day_blocks,
    breakfastDays: b.breakfast_days,
    breakfastRecords: b.breakfast_records,
    rooms: o.rooms,
    venues: o.venues,
    usePromo,
    // The hours the room was sold for: without them the printed bill charges the
    // whole night for a 3-hour stay (the screen says ₱550, the paper printed ₱850).
    shortStayHours: b.stay_hours,
    rates: getRateConfig(),
  })
}

export function buildStatement(o: StatementInput): Statement {
  const { primaryBooking, relatedBookings, rooms, venues } = o
  const lineItems: StatementLineItem[] = []
  let subTotal = 0
  let downpaymentPaid = 0
  let securityDeposit = 0
  let amountDue = 0
  let balanceAfter = 0
  let paymentMethod = ''
  const paymentPlan: '' | 'deposit' | 'full' =
    primaryBooking.payment_plan === 'deposit' || primaryBooking.payment_plan === 'full'
      ? primaryBooking.payment_plan
      : ''

  relatedBookings.forEach(b => {
    const pricing = bookingPricing(b, o)
    const isRoom = !!b.room_id
    const nights = nightsFor(b)
    const stayQty = pricing.stayQuantity > 0 ? pricing.stayQuantity : nights

    const regularNightly = stayQty > 0 ? Math.round(pricing.undiscountedSubtotal / stayQty) : Math.round(pricing.subtotal / Math.max(1, stayQty))
    // No "promo" wording on the printed paper (card k128): there is one price, so
    // the room line simply names the room. Only a partner's contracted rate is
    // worth calling out, because it is not the price on the board.
    const rateLabel = b.contract_rate_override != null ? ' · corporate' : ''

    // A SHORT STAY (the owner's ruling, 2026-09): its hours price IS the price, so the
    // line prints what is actually charged — never the room's night price with the
    // difference shown as a "discount" nobody gave. The hours are named on the room
    // line (`Double · 12 hours`) and the unit column then reads HOURS, so the paper
    // cannot say it twice. The Discount column keeps only a real staff discount.
    const stayHours = Number(b.stay_hours || 0)
    const isShortStay = stayHours > 0

    // The stay itself — one row per unit. For a room, breakfast rides ON this row
    // (owner's rule, card k142): it is already inside the room rate, so the line
    // is named "Room 2 · Breakfast" and the amount includes it. Breakfast never
    // gets a row of its own on a room bill.
    const breakfastOnRoomLine = isRoom ? Math.round(pricing.breakfastTotal) : 0
    lineItems.push({
      key: b.id + '-stay',
      description: unitName(b, rooms, venues)
        + (isShortStay ? ' · ' + stayHours + ' hours' : '')
        + (breakfastOnRoomLine > 0 ? ' · Breakfast' : '') + rateLabel,
      qty: String(stayQty),
      unit: isShortStay ? 'HOURS' : pricing.stayUnit,
      price: isShortStay ? Math.round(pricing.subtotal / Math.max(1, stayQty)) : regularNightly,
      discount: isShortStay
        ? Math.round(pricing.appliedDiscountAmount)
        : Math.round(pricing.discountAmount + pricing.appliedDiscountAmount),
      amount: Math.round(pricing.stayTotal + breakfastOnRoomLine),
    })

    // Early check-in / late checkout charge.
    if (pricing.earlyLateTotal > 0) {
      const hrs = (b.early_check_in_hours || 0) + (b.late_check_out_hours || 0)
      lineItems.push({
        key: b.id + '-earlylate',
        description: 'Early check-in / late checkout',
        qty: String(hrs),
        unit: 'HR',
        price: hrs > 0 ? Math.round(pricing.earlyLateTotal / hrs) : Math.round(pricing.earlyLateTotal),
        discount: 0,
        amount: Math.round(pricing.earlyLateTotal),
      })
    }

    // Breakfast on a VENUE booking keeps its own row; on a room it is already on
    // the room line above (card k142), so this block is skipped for rooms.
    const bfRecords = isRoom ? [] : (b.breakfast_records || [])
    if (bfRecords.length > 0) {
      bfRecords.forEach(r => {
        const dateLabel = r.date ? new Date(r.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
        lineItems.push({
          key: b.id + '-breakfast-' + r.id,
          description: 'Breakfast · ' + r.item + (dateLabel ? ' · ' + dateLabel : ''),
          qty: String(r.quantity),
          unit: 'PERSON',
          price: Math.round(r.price || 0),
          discount: 0,
          amount: Math.round((r.price || 0) * (r.quantity || 0)),
        })
      })
    } else if (!isRoom && pricing.breakfastTotal > 0) {
      const rates = getRateConfig()
      const guestNights = rates.breakfastPrice > 0 ? pricing.breakfastTotal / rates.breakfastPrice : 0
      lineItems.push({
        key: b.id + '-breakfast',
        description: 'Breakfast (₱' + rates.breakfastPrice + '/guest/night)',
        qty: String(Math.round(guestNights)),
        unit: 'PERSON',
        price: rates.breakfastPrice,
        discount: 0,
        amount: pricing.breakfastTotal,
      })
    }

    // Extra linen / amenities for rooms (per night) and event rental equipment.
    const er = b.equipment_rentals
    if (er) {
      // [label, count, unit, per-night?, rate]
      const rentals: Array<[string, number, string, boolean, number]> = []
      if (isRoom) {
        if (er.extraFoamCount) rentals.push(['Extra foam', er.extraFoamCount, 'PC', true, 200])
        if (er.extraPillowCount) rentals.push(['Extra pillow', er.extraPillowCount, 'PC', true, 50])
        if (er.extraBlanketCount) rentals.push(['Extra blanket', er.extraBlanketCount, 'PC', true, 50])
        if (er.extraTowelCount) rentals.push(['Extra towel', er.extraTowelCount, 'PC', true, 50])
      } else {
        if (er.bigTableCount) rentals.push(['Big table', er.bigTableCount, 'PC', false, 150])
        if (er.smallTableCount) rentals.push(['Small table', er.smallTableCount, 'PC', false, 100])
        if (er.chairCount) rentals.push(['Chairs', er.chairCount, 'PC', false, 15])
        if (er.mineralWaterCount) rentals.push(['Mineral water', er.mineralWaterCount, 'PC', false, 35])
        if (er.tableCount) rentals.push(['Extra table', er.tableCount, 'PC', false, 150])
        if (er.tentCount) rentals.push(['Extra tent', er.tentCount, 'PC', false, 500])
      }
      rentals.forEach(([label, count, unit, perNight, rate]) => {
        const qty = perNight ? count * nights : count
        const amount = qty * rate
        lineItems.push({
          key: b.id + '-' + label,
          description: label,
          qty: String(count),
          unit,
          price: rate,
          discount: 0,
          amount,
        })
      })
    }

    if (b.venue_excess_hours && b.venue_excess_hours > 0) {
      lineItems.push({
        key: b.id + '-excess',
        description: 'Venue excess hours',
        qty: String(b.venue_excess_hours),
        unit: 'HR',
        price: 500,
        discount: 0,
        amount: b.venue_excess_hours * 500,
      })
    }

    const ea = b.event_addons
    if (ea) {
      const addons: Array<[string, number]> = []
      if (ea.fullBandAndLights) addons.push(['Full band & lights', 2000])
      if (ea.stage) addons.push(['Stage', 2000])
      if (ea.ledWall) addons.push(['LED wall', 5000])
      addons.forEach(([label, rate]) => {
        lineItems.push({ key: b.id + '-addon-' + label, description: label, qty: '1', unit: 'PC', price: rate, discount: 0, amount: rate })
      })
    }

    // The guest's food and bar tab (k69). Its lines print right under the room and
    // its total joins the bill — without this the paper showed the room alone
    // while the screen said the guest owed the room plus the food.
    const tab = o.tabLinesByBooking?.[b.id] || []
    const tabLinesTotal = tab.reduce((sum, l) => sum + Number(l.amount || 0), 0)
    tab.forEach(l => {
      lineItems.push({
        key: b.id + '-tab-' + l.id,
        description: 'Restaurant & bar · ' + l.description,
        qty: String(l.qty || 1),
        unit: 'PC',
        price: Math.round(Number(l.unit_price || 0)),
        discount: 0,
        amount: Math.round(Number(l.amount || 0)),
      })
    })

    subTotal += pricing.grandTotal + tabLinesTotal
    downpaymentPaid += Number(b.downpayment_paid || 0)
    securityDeposit += Number(b.security_deposit || 0)
    // What to pay NOW, from the guest's own choice: the agreed 50% deposit while
    // nothing has been paid, otherwise what is left. Using `balance_due` alone
    // printed the whole stay as due, which contradicted a deposit booking. The tab
    // is passed in so the deposit is still worked out from the STAY alone.
    const payNow = amountToPayNow(b, tabLinesTotal)
    amountDue += payNow
    balanceAfter += Math.max(0, Number(b.balance_due || 0) - payNow)
    if (b.payment_method) paymentMethod = b.payment_method
  })

  const invoiceNumber = primaryBooking.invoice_number || (
    'GRF-' + primaryBooking.check_in.substring(0, 7).replace('-', '') + '-PREVIEW'
  )

  return {
    invoiceNumber,
    dateIssued: primaryBooking.created_at ? new Date(primaryBooking.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '',
    lineItems,
    subTotal,
    downpaymentPaid,
    partialPayment: 0,
    other: 0,
    securityDeposit,
    amountDue,
    balanceAfter,
    paymentPlan,
    paymentMethod,
  }
}

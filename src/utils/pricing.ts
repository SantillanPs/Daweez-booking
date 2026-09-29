import { Booking, EquipmentRental, EventAddons, BookingSource, Room, Venue, AppliedDiscount, RateConfig, BreakfastRecord } from '../types/booking'
import { normalizeVenueId } from './helpers'
import { DEFAULT_ROOMS, DEFAULT_VENUES } from './defaultData'
import { DEFAULT_RATE_CONFIG } from './rateConfig'

function diffDays(a: string, b: string): number {
  return Math.ceil((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

function earlyLateCharge(hours: number | undefined, rate: number, cap: number, nightlyRate: number, hourlyOnly = false): number {
  if (!hours || hours <= 0) return 0
  if (hourlyOnly) return hours * rate
  return hours <= cap ? hours * rate : nightlyRate
}

export function calculatePricing(params: {
  roomId?: string
  venueId?: string
  checkIn: string
  checkOut: string
  guestEmail: string
  breakfastRecords?: BreakfastRecord[]
  equipmentRentals?: EquipmentRental
  eventAddons?: EventAddons
  bookingsList?: Booking[]
  rateMultiplier?: number
  source?: BookingSource
  contractRateOverride?: number
  venueExcessHours?: number
  breakfastEnabled?: boolean
  /** What the saved booking holds: this room has breakfast (card k140). */
  breakfastIncluded?: boolean
  rooms?: Room[]
  venues?: Venue[]
  usePromo?: boolean
  /**
   * Short stay: the hours the room was taken for — 3, 6, 12 or 22. The price comes
   * from the room's own short-stay figure (the 22-hour one IS the room's price), and
   * the stay is ONE charge, not nights × rate.
   */
  shortStayHours?: number
  appliedDiscount?: AppliedDiscount
  earlyCheckInHours?: number
  lateCheckOutHours?: number
  venueDayBlocks?: number
  rates?: RateConfig
}) {
  const { roomId, venueId, checkIn, checkOut, breakfastIncluded, equipmentRentals, eventAddons, rateMultiplier, contractRateOverride, venueExcessHours = 0, breakfastEnabled, breakfastRecords, rooms: liveRooms, venues: liveVenues, usePromo, appliedDiscount, earlyCheckInHours, lateCheckOutHours, venueDayBlocks, rates: ratesOverride, shortStayHours } = params
  const rates = ratesOverride ?? DEFAULT_RATE_CONFIG

  let basePrice = 0
  let undiscountedBasePrice = 0
  let nights = 0
  let discountPercent = 0
  let stayQuantity = 0
  let stayUnit = 'NIGHT'

  const roomList = liveRooms && liveRooms.length > 0 ? liveRooms : DEFAULT_ROOMS
  const venueList = liveVenues && liveVenues.length > 0 ? liveVenues : DEFAULT_VENUES
  const venue = venueId ? venueList.find(v => v.id === normalizeVenueId(venueId)) : undefined
  const isVenue = !!venueId
  const isDayBlockVenue = venue ? (venue.name === 'Gazebo' || venue.name === 'Garden Area') : false

  if (contractRateOverride !== undefined && contractRateOverride !== null) {
    undiscountedBasePrice = contractRateOverride
    if (usePromo === undefined && rateMultiplier !== undefined && rateMultiplier !== 1) {
      basePrice = Math.round(contractRateOverride * rateMultiplier)
      discountPercent = Math.round((1 - rateMultiplier) * 100)
    } else {
      basePrice = contractRateOverride
    }
    nights = Math.max(1, diffDays(checkIn, checkOut))
    stayQuantity = nights
    stayUnit = roomId ? 'NIGHT' : 'DAY'
  } else if (roomId) {
    const room = roomList.find(r => r.id === roomId)
    const regular = room ? room.base_price : 0
    const promo = room ? (room.promo_price ?? null) : null
    // ONE PRICE (owner's decision, card k128): the promo figure IS the price
    // whenever the room has one — there is no sale mode to switch on any more,
    // and no crossed-out second price. `base_price` survives only as the
    // fallback for a unit with no promo figure.
    //
    // `usePromo === false` still means "charge the regular figure", which is how
    // a booking made before this rule keeps the price it was actually made at
    // (the statement, analytics and balance all pass the booking's own
    // `promo_applied`, never `undefined`).
    const singlePrice = promo != null && promo > 0 ? promo : regular
    undiscountedBasePrice = regular
    if (usePromo !== undefined) {
      basePrice = usePromo ? singlePrice : regular
    } else if (rateMultiplier !== undefined && rateMultiplier !== 1) {
      basePrice = Math.round(regular * rateMultiplier)
      discountPercent = Math.round((1 - rateMultiplier) * 100)
    } else {
      basePrice = singlePrice
    }
    // SHORT STAY: ONE charge for the hours the room was taken for, straight off the
    // room's own board price — 3, 6 and 12 hours carry their own figure, and 22
    // hours IS the room's price. No nights, and no early/late hours: a 10am arrival
    // is not "4 hours early" when the stay is three hours long.
    const shortPrice = shortStayHours === 3 ? room?.hour3_price
      : shortStayHours === 6 ? room?.hour6_price
      : shortStayHours === 12 ? room?.hour12_price
      : singlePrice
    if (shortStayHours) {
      basePrice = shortPrice != null && shortPrice > 0 ? shortPrice : singlePrice
      nights = 1
      stayQuantity = 1
      stayUnit = shortStayHours + ' HOURS'
    } else {
      nights = Math.max(1, diffDays(checkIn, checkOut))
      stayQuantity = nights
      stayUnit = 'NIGHT'
    }
  } else if (venueId) {    if (isDayBlockVenue) {
      const perBlock = rates.dayBlockRate > 0 ? rates.dayBlockRate : (venue ? venue.base_price : 0)
      undiscountedBasePrice = perBlock
      let blocks = venueDayBlocks ?? Math.max(1, diffDays(checkIn, checkOut))
      if (blocks < 1) blocks = 1
      basePrice = perBlock
      stayQuantity = blocks
      stayUnit = 'BLOCK'
    } else {
      const regular = venue ? venue.base_price : 0
      const promo = venue ? (venue.promo_price ?? null) : null
      const singlePrice = promo != null && promo > 0 ? promo : regular
      undiscountedBasePrice = regular
      if (usePromo !== undefined) {
        basePrice = usePromo ? singlePrice : regular
      } else if (rateMultiplier !== undefined && rateMultiplier !== 1) {
        basePrice = Math.round(regular * rateMultiplier)
        discountPercent = Math.round((1 - rateMultiplier) * 100)
      } else {
        basePrice = singlePrice
      }
      nights = Math.max(1, diffDays(checkIn, checkOut))
      stayQuantity = nights
    }
  }

  const subtotal = basePrice * stayQuantity
  const undiscountedSubtotal = undiscountedBasePrice * stayQuantity
  const discountAmount = Math.max(0, undiscountedSubtotal - subtotal)
  if (undiscountedBasePrice > 0 && basePrice !== undiscountedBasePrice) {
    discountPercent = Math.round(((undiscountedBasePrice - basePrice) / undiscountedBasePrice) * 100)
  } else if (usePromo !== undefined) {
    discountPercent = basePrice !== undiscountedBasePrice ? Math.round(((undiscountedBasePrice - basePrice) / Math.max(1, undiscountedBasePrice)) * 100) : 0
  }

  let appliedDiscountAmount = 0
  if (appliedDiscount && appliedDiscount.value > 0) {
    appliedDiscountAmount = appliedDiscount.type === 'percent'
      ? Math.round(subtotal * appliedDiscount.value / 100)
      : Math.min(appliedDiscount.value, subtotal)
  }
  const stayTotal = Math.max(0, subtotal - appliedDiscountAmount)

  const earlyRate = isVenue ? rates.venueHourlyRate : rates.lateEarlyRatePesos
  const perStayNight = stayQuantity > 0 ? basePrice : 0
  const earlyCharge = earlyLateCharge(earlyCheckInHours, earlyRate, rates.lateEarlyCapHours, perStayNight, isVenue)
  const lateCharge = earlyLateCharge(lateCheckOutHours, earlyRate, rates.lateEarlyCapHours, perStayNight, isVenue)
  const earlyLateTotal = earlyCharge + lateCharge

  let breakfastTotal = 0
  const brkRecords = breakfastRecords || []
  // Breakfast for a room is **ONE charge for the whole stay, at the room's own
  // `breakfast_price`** (owner's rule, card k140) — never per person and never per day.
  // The desk types that figure per room in Settings, and **a room without one sells no
  // breakfast at all** (the owner's ruling, 2026-09-29).
  //
  // Two older rules are dead and must not come back: the bed-count idea (₱150 × the room's
  // beds, so a 3-bunk room was ₱900) and the person × night estimate. Both were replaced by
  // the desk's own figure. A booking that already carries `breakfast_records` keeps exactly
  // what it was charged — those rows hold the price each breakfast was served at.
  const roomForBreakfast = roomId ? roomList.find(r => r.id === roomId) : undefined
  // The room's own breakfast price, typed by the desk in Settings.
  const roomBreakfastPrice = roomForBreakfast ? Number(roomForBreakfast.breakfast_price || 0) : 0
  if (brkRecords.length > 0) {
    // A booking made while breakfast was still recorded day by day keeps the
    // figure it was actually charged (the owner's rule: old bookings are left
    // alone).
    breakfastTotal = brkRecords.reduce((sum, r) => sum + ((r.price || 0) * (r.quantity || 0)), 0)
  } else if (roomId && roomBreakfastPrice > 0) {
    // Breakfast is the ROOM's choice (card k140): on only for the rooms the desk
    // ticked, and charged at the room's OWN breakfast price — one charge for the
    // stay. `breakfastEnabled` is the caller's explicit answer (the booking form,
    // the guest portal); `breakfastIncluded` is what the saved booking holds.
    const wantsBreakfast = breakfastEnabled !== undefined
      ? breakfastEnabled
      : breakfastIncluded === true
    if (wantsBreakfast) breakfastTotal = roomBreakfastPrice
  }
  // **A room with no breakfast price sells NO breakfast** (the owner's ruling, 2026-09-29:
  // *"if a room has no breakfast price, then breakfast should be unavailable. remove every
  // trace of 150 per head for breakfast calculations since the staff decides what the
  // breakfast price is"*).
  //
  // Two fallbacks used to live here and **both invented a charge** out of the retired
  // ₱150-per-head default: one billed `rates.breakfastPrice × guests × nights` to any room
  // the desk had not priced yet, and one billed `rates.breakfastPrice × quantity` for a
  // legacy breakfast order — a `BreakfastOrder` carries no price of its own to bill. The
  // first is what charged Room 4 ₱300 for two nights it was never offered: the booking form
  // quoted ₱1,900, the engine stored ₱2,200, and the guest was handed a receipt reading
  // **₱300 remaining** on a stay they had paid in full.
  //
  // **The only breakfast prices are the ones the staff typed**: the room's own
  // `breakfast_price` above, and the price stored on each legacy `breakfast_record` when it
  // was served. Nothing is derived from a default any more.

  let rentalsTotal = 0
  if (equipmentRentals) {
    if (roomId) {
      const nightlyRentals =
        ((equipmentRentals.extraFoamCount || 0) * rates.foamRate) +
        ((equipmentRentals.extraPillowCount || 0) * rates.pillowRate) +
        ((equipmentRentals.extraBlanketCount || 0) * rates.blanketRate) +
        ((equipmentRentals.extraTowelCount || 0) * rates.towelRate)
      rentalsTotal += nightlyRentals * nights
    } else {
      rentalsTotal += ((equipmentRentals.bigTableCount || 0) * rates.bigTableRate)
      rentalsTotal += ((equipmentRentals.smallTableCount || 0) * rates.smallTableRate)
      rentalsTotal += ((equipmentRentals.chairCount || 0) * rates.chairRate)
      rentalsTotal += ((equipmentRentals.mineralWaterCount || 0) * rates.mineralWaterRate)
      rentalsTotal += ((equipmentRentals.tableCount || 0) * rates.bigTableRate)
      rentalsTotal += ((equipmentRentals.tentCount || 0) * rates.tentRate)
      rentalsTotal += (venueExcessHours * rates.venueHourlyRate)
    }
  } else if (venueExcessHours > 0) {
    rentalsTotal += (venueExcessHours * rates.venueHourlyRate)
  }

  let addonsTotal = 0
  if (eventAddons) {
    if (eventAddons.fullBandAndLights) addonsTotal += 2000
    if (eventAddons.stage) addonsTotal += 2000
    if (eventAddons.ledWall) addonsTotal += 5000
  }

  const securityDeposit = 0
  const calculatedGrand = stayTotal + earlyLateTotal + breakfastTotal + rentalsTotal + addonsTotal
  const downpayment = Math.round(calculatedGrand * 0.50)
  const balanceDue = (calculatedGrand - downpayment) + securityDeposit

  return {
    subtotal: Math.round(subtotal),
    undiscountedSubtotal: Math.round(undiscountedSubtotal),
    discountAmount: Math.round(discountAmount),
    discountPercent,
    hasLoyalty: false,
    breakfastTotal,
    rentalsTotal,
    addonsTotal,
    securityDeposit,
    stayTotal: Math.round(stayTotal),
    appliedDiscountAmount: Math.round(appliedDiscountAmount),
    earlyLateTotal: Math.round(earlyLateTotal),
    stayQuantity,
    stayUnit,
    grandTotal: calculatedGrand,
    downpayment,
    balanceDue
  }
}

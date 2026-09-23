import { Booking, BreakfastOrder, EquipmentRental, EventAddons, BookingSource, Companion, Room, Venue, AppliedDiscount, RateConfig, BreakfastRecord } from '../types/booking'
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
  breakfastOrders?: BreakfastOrder[]
  breakfastRecords?: BreakfastRecord[]
  equipmentRentals?: EquipmentRental
  eventAddons?: EventAddons
  bookingsList?: Booking[]
  rateMultiplier?: number
  companions?: Companion[]
  source?: BookingSource
  contractRateOverride?: number
  venueExcessHours?: number
  breakfastEnabled?: boolean
  /** What the saved booking holds: this room has breakfast (card k140). */
  breakfastIncluded?: boolean
  breakfastGuestCount?: number
  breakfastDays?: string[]
  rooms?: Room[]
  venues?: Venue[]
  usePromo?: boolean
  appliedDiscount?: AppliedDiscount
  earlyCheckInHours?: number
  lateCheckOutHours?: number
  venueDayBlocks?: number
  rates?: RateConfig
}) {
  const { roomId, venueId, checkIn, checkOut, breakfastOrders, breakfastIncluded, equipmentRentals, eventAddons, rateMultiplier, companions, contractRateOverride, venueExcessHours = 0, breakfastEnabled, breakfastGuestCount, breakfastDays, breakfastRecords, rooms: liveRooms, venues: liveVenues, usePromo, appliedDiscount, earlyCheckInHours, lateCheckOutHours, venueDayBlocks, rates: ratesOverride } = params
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
  const isVacationHouse = venue ? venue.name === 'Vacation House' : false
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
    nights = Math.max(1, diffDays(checkIn, checkOut))
    stayQuantity = nights
    stayUnit = 'NIGHT'
  } else if (venueId) {
    if (isDayBlockVenue) {
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
  // Breakfast for a room is ONE charge for the whole stay (owner's rule, card
  // k140): ₱150 × the number of beds in the room — not per person, and not per
  // day. A room with 3 bunk beds is 6 beds, so ₱900; a room for 2 is ₱300 even
  // with one guest in it.
  //
  // A room whose bed count has not been filled in yet keeps the older figures
  // below (a recorded day-by-day breakfast, or the person × night estimate), so
  // nothing changes for it until the desk writes the beds down in Settings.
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
  } else if (roomId) {
    const optedOut = breakfastOrders != null && breakfastOrders.length === 0
    if (!optedOut) {
      const isBreakfastOn = breakfastEnabled !== undefined ? breakfastEnabled : true
      if (isBreakfastOn) {
        const guestCount = breakfastGuestCount !== undefined ? breakfastGuestCount : (1 + (companions ? companions.length : 0))
        const dayCount = breakfastDays && breakfastDays.length > 0 ? breakfastDays.length : nights
        breakfastTotal = rates.breakfastPrice * guestCount * dayCount
      }
    }
  } else if (breakfastOrders && breakfastOrders.length > 0) {
    breakfastOrders.forEach(order => {
      breakfastTotal += rates.breakfastPrice * order.quantity
    })
  }

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

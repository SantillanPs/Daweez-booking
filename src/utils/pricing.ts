import { Booking, BreakfastOrder, EquipmentRental, EventAddons, BookingSource, Companion, Room, Venue } from '../types/booking'
import { normalizeVenueId } from './helpers'
import { DEFAULT_ROOMS, DEFAULT_VENUES } from './defaultData'

// Dynamic Invoice Calculations — explicit promo mode: when `usePromo` is true
// the exact sheet `promo_price` is charged (otherwise regular `base_price`).
// `rateMultiplier` is retained as a deprecated shim for partner/additional
// discount stacking and is honoured only when `usePromo` is undefined.
export function calculatePricing(params: {
  roomId?: string
  venueId?: string
  checkIn: string
  checkOut: string
  guestEmail: string
  breakfastOrders?: BreakfastOrder[]
  equipmentRentals?: EquipmentRental
  eventAddons?: EventAddons
  bookingsList?: Booking[]
  rateMultiplier?: number
  companions?: Companion[]
  source?: BookingSource
  contractRateOverride?: number
  venueExcessHours?: number
  breakfastEnabled?: boolean
  breakfastGuestCount?: number
  rooms?: Room[]
  venues?: Venue[]
  usePromo?: boolean
}) {
  const { roomId, venueId, checkIn, checkOut, breakfastOrders, equipmentRentals, eventAddons, rateMultiplier, companions, contractRateOverride, venueExcessHours = 0, breakfastEnabled, breakfastGuestCount, rooms: liveRooms, venues: liveVenues, usePromo } = params

  let basePrice = 0
  let undiscountedBasePrice = 0
  let nights = 0
  let discountPercent = 0

  if (contractRateOverride !== undefined && contractRateOverride !== null) {
    undiscountedBasePrice = contractRateOverride
    // Contract rate is a hard override; honour legacy multiplier only when
    // usePromo is not supplied (keeps partner-stack addons working).
    if (usePromo === undefined && rateMultiplier !== undefined && rateMultiplier !== 1) {
      basePrice = Math.round(contractRateOverride * rateMultiplier)
      discountPercent = Math.round((1 - rateMultiplier) * 100)
    } else {
      basePrice = contractRateOverride
    }
    nights = roomId
      ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
      : Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
  } else if (roomId) {
    const roomList = liveRooms && liveRooms.length > 0 ? liveRooms : DEFAULT_ROOMS
    const room = roomList.find(r => r.id === roomId)
    const regular = room ? room.base_price : 0
    const promo = room ? (room.promo_price ?? null) : null
    undiscountedBasePrice = regular
    if (usePromo !== undefined) {
      basePrice = usePromo && promo != null && promo > 0 ? promo : regular
    } else if (rateMultiplier !== undefined && rateMultiplier !== 1) {
      basePrice = Math.round(regular * rateMultiplier)
      discountPercent = Math.round((1 - rateMultiplier) * 100)
    } else {
      // Legacy path without usePromo or multiplier: charge regular. Callers
      // that previously relied on the implicit 0.8 website/manual discount
      // must now pass usePromo derived from the global promo toggle / staff
      // "Use Promo" button. Left here so callers omitting the flag never get
      // a phantom discount.
      basePrice = regular
    }
    nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  } else if (venueId) {
    const venueList = liveVenues && liveVenues.length > 0 ? liveVenues : DEFAULT_VENUES
    const venue = venueList.find(v => v.id === normalizeVenueId(venueId))
    const regular = venue ? venue.base_price : 0
    const promo = venue ? (venue.promo_price ?? null) : null
    undiscountedBasePrice = regular
    if (usePromo !== undefined) {
      basePrice = usePromo && promo != null && promo > 0 ? promo : regular
    } else if (rateMultiplier !== undefined && rateMultiplier !== 1) {
      basePrice = Math.round(regular * rateMultiplier)
      discountPercent = Math.round((1 - rateMultiplier) * 100)
    } else {
      basePrice = regular
    }
    nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
  }

  const subtotal = basePrice * nights
  const undiscountedSubtotal = undiscountedBasePrice * nights
  const discountAmount = Math.max(0, undiscountedSubtotal - subtotal)
  if (undiscountedBasePrice > 0 && basePrice !== undiscountedBasePrice) {
    discountPercent = Math.round(((undiscountedBasePrice - basePrice) / undiscountedBasePrice) * 100)
  } else if (usePromo !== undefined) {
    discountPercent = basePrice !== undiscountedBasePrice ? Math.round(((undiscountedBasePrice - basePrice) / Math.max(1, undiscountedBasePrice)) * 100) : 0
  }
  const grandTotal = subtotal * ((contractRateOverride !== undefined && contractRateOverride !== null) ? 1 : 1.0)

  let breakfastTotal = 0
  if (roomId) {
    // Empty breakfast_orders means the user explicitly opted out — skip.
    const optedOut = breakfastOrders !== undefined && breakfastOrders.length === 0
    if (!optedOut) {
      const isBreakfastOn = breakfastEnabled !== undefined ? breakfastEnabled : true
      if (isBreakfastOn) {
        const guestCount = breakfastGuestCount !== undefined ? breakfastGuestCount : (1 + (companions?.length || 0))
        breakfastTotal = 150 * guestCount * nights
      }
    }
  } else if (breakfastOrders && breakfastOrders.length > 0) {
    breakfastOrders.forEach(order => {
      breakfastTotal += 150 * order.quantity
    })
  }

  let rentalsTotal = 0
  if (equipmentRentals) {
    if (roomId) {
      const nightlyRentals =
        ((equipmentRentals.extraFoamCount || 0) * 200) +
        ((equipmentRentals.extraPillowCount || 0) * 50) +
        ((equipmentRentals.extraBlanketCount || 0) * 50) +
        ((equipmentRentals.extraTowelCount || 0) * 50)
      rentalsTotal += nightlyRentals * nights
    } else {
      rentalsTotal += ((equipmentRentals.bigTableCount || 0) * 150)
      rentalsTotal += ((equipmentRentals.smallTableCount || 0) * 100)
      rentalsTotal += ((equipmentRentals.chairCount || 0) * 15)
      rentalsTotal += ((equipmentRentals.mineralWaterCount || 0) * 35)
      rentalsTotal += ((equipmentRentals.tableCount || 0) * 150)
      rentalsTotal += ((equipmentRentals.tentCount || 0) * 500)
      rentalsTotal += (venueExcessHours * 500)
    }
  } else if (venueExcessHours > 0) {
    rentalsTotal += (venueExcessHours * 500)
  }

  let addonsTotal = 0
  if (eventAddons) {
    if (eventAddons.fullBandAndLights) addonsTotal += 2000
    if (eventAddons.stage) addonsTotal += 2000
    if (eventAddons.ledWall) addonsTotal += 5000
  }

  const securityDeposit = 0
  const calculatedGrand = grandTotal + breakfastTotal + rentalsTotal + addonsTotal
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
    grandTotal: calculatedGrand,
    downpayment,
    balanceDue
  }
}

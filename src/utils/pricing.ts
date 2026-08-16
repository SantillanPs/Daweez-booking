import { Booking, BreakfastOrder, EquipmentRental, EventAddons, BookingSource, Companion, Room, Venue } from '../types/booking'
import { normalizeVenueId } from './helpers'
import { DEFAULT_ROOMS, DEFAULT_VENUES } from './defaultData'

// Dynamic Invoice Calculations
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
}) {
  const { roomId, venueId, checkIn, checkOut, breakfastOrders, equipmentRentals, eventAddons, rateMultiplier, companions, source, contractRateOverride, venueExcessHours = 0, breakfastEnabled, breakfastGuestCount, rooms: liveRooms, venues: liveVenues } = params

  const defaultMultiplier = (source === 'manual' || source === 'facebook' || source === 'website') ? 0.8 : 1.0
  const finalMultiplier = rateMultiplier !== undefined ? rateMultiplier : defaultMultiplier

  let basePrice = 0
  let undiscountedBasePrice = 0
  let nights = 0

  if (contractRateOverride !== undefined && contractRateOverride !== null) {
    undiscountedBasePrice = contractRateOverride
    basePrice = Math.round(contractRateOverride * finalMultiplier)
    nights = roomId
      ? Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
      : Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
  } else if (roomId) {
    const roomList = liveRooms && liveRooms.length > 0 ? liveRooms : DEFAULT_ROOMS
    const room = roomList.find(r => r.id === roomId)
    undiscountedBasePrice = room ? room.base_price : 0
    basePrice = Math.round(undiscountedBasePrice * finalMultiplier)
    nights = Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24))
  } else if (venueId) {
    const venueList = liveVenues && liveVenues.length > 0 ? liveVenues : DEFAULT_VENUES
    const venue = venueList.find(v => v.id === normalizeVenueId(venueId))
    undiscountedBasePrice = venue ? venue.base_price : 0
    basePrice = Math.round(undiscountedBasePrice * finalMultiplier)
    nights = Math.max(1, Math.ceil((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / (1000 * 60 * 60 * 24)))
  }

  const subtotal = basePrice * nights
  const undiscountedSubtotal = undiscountedBasePrice * nights
  const discountAmount = undiscountedSubtotal - subtotal
  const discountPercent = Math.round((1 - finalMultiplier) * 100)
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

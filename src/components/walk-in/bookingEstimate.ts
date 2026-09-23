import { Room, Venue, PartnerDeal, Companion } from '../../types/booking'

export interface BookingEstimateParams {
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  rooms: Room[]
  venues: Venue[]
  partnerDeals: PartnerDeal[]
  formPartnerDealId: string
  formStatus: 'confirmed' | 'blocked'
  hasVenues: boolean
  formBreakfastRoomIds: string[]
  formCompanions: Companion[]
  formExtraFoam: number
  formExtraPillow: number
  formExtraBlanket: number
  formExtraTowel: number
  formEventTable: number
  formEventTent: number
  formChairs: number
  /**
   * Short stay: the hours the room is being sold for (3/6/12/22). The price is the
   * room's own figure for those hours and is charged ONCE — never per night.
   */
  shortStayHours?: number | null
}

export interface BookingEstimate {
  estBreakfast: number
  estRentals: number
  estAddons: number
  estSubtotal: number
  estRegularTotal: number
  estDiscountAmount: number
  estTotal: number
  estDown: number
  estDue: number
}

// Client-side estimate for the wizard totals. Breakfast is counted per person
// (main guest + each companion ticked for B'fast), rooms only.
export function computeBookingEstimate(p: BookingEstimateParams): BookingEstimate {
  let regularTotal = 0
  let discountedTotal = 0
  let breakfast = 0
  let rentals = 0

  Object.entries(p.unitSelections).forEach(([id, sel]) => {
    const deal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
    const contractedRate = deal?.contracted_rates[id]
    const n = sel.checkIn && sel.checkOut
      ? Math.max(1, Math.ceil((new Date(sel.checkOut).getTime() - new Date(sel.checkIn).getTime()) / 86400000))
      : 1

    const room = sel.type === 'room' ? p.rooms.find(r => r.id === id) : undefined
    const venue = sel.type === 'venue' ? p.venues.find(v => v.id === id) : undefined
    const regular = contractedRate !== undefined && contractedRate !== null
      ? contractedRate
      : sel.type === 'room'
        ? (room?.base_price ?? 0)
        : (venue?.base_price ?? 0)
    const promo = sel.type === 'room'
      ? (room?.promo_price ?? null)
      : (venue?.promo_price ?? null)
    // ONE PRICE (card k128): the promo figure is the price whenever there is one.
    const effectiveRate = promo != null && promo > 0 ? promo : regular

    // SHORT STAY: ONE charge off the room's own board price for those hours — the
    // 22-hour figure IS the room's price. No nights, and no breakfast or rentals:
    // a three-hour guest does not buy either.
    const shortStay = p.shortStayHours ?? null
    const shortPrice = sel.type === 'room' && shortStay
      ? (shortStay === 3 ? room?.hour3_price : shortStay === 6 ? room?.hour6_price : shortStay === 12 ? room?.hour12_price : effectiveRate)
      : null
    const quantity = shortStay ? 1 : n

    if (shortStay) {
      const price = shortPrice != null && shortPrice > 0 ? Number(shortPrice) : effectiveRate
      regularTotal += price
      discountedTotal += price
    } else {
      regularTotal += regular * quantity
      discountedTotal += effectiveRate * quantity
    }

    const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
    if (sel.type === 'room' && !shortStay) {
      // Breakfast is the ROOM's choice, at the room's OWN breakfast price — one
      // charge for the stay (card k140). A partner deal that includes breakfast
      // does not charge it again.
      const roomBreakfast = Number(room?.breakfast_price || 0)
      const wantsBreakfast = isBreakfastIncluded || p.formBreakfastRoomIds.includes(id)
      if (wantsBreakfast && roomBreakfast > 0) breakfast += roomBreakfast
      rentals += (p.formExtraFoam * 200 + p.formExtraPillow * 50 + p.formExtraBlanket * 50 + p.formExtraTowel * 50) * n
    }
  })

  if (p.hasVenues) {
    rentals += p.formEventTable * 150 + p.formEventTent * 500 + p.formChairs * 15
  }

  const subtotal = discountedTotal
  const total = subtotal + breakfast + rentals
  const down = Math.round(total * 0.5)
  const due = p.formStatus === 'blocked' ? 0 : (total - down)

  return {
    estBreakfast: breakfast,
    estRentals: rentals,
    estAddons: 0,
    estSubtotal: subtotal,
    estRegularTotal: regularTotal,
    estDiscountAmount: Math.max(0, regularTotal - discountedTotal),
    estTotal: total,
    estDown: down,
    estDue: due,
  }
}

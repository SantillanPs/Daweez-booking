import { Room, Venue, PartnerDeal, Companion } from '../../types/booking'

export interface BookingEstimateParams {
  unitSelections: Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>
  rooms: Room[]
  venues: Venue[]
  partnerDeals: PartnerDeal[]
  formPartnerDealId: string
  formUsePromo: boolean
  formStatus: 'confirmed' | 'blocked'
  hasVenues: boolean
  formGuestBreakfast: boolean
  formCompanions: Companion[]
  formExtraFoam: number
  formExtraPillow: number
  formExtraBlanket: number
  formExtraTowel: number
  formEventTable: number
  formEventTent: number
  formChairs: number
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
    const effectiveRate = p.formUsePromo && promo != null && promo > 0 ? promo : regular
    regularTotal += regular * n
    discountedTotal += effectiveRate * n

    const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
    if (sel.type === 'room') {
      const bfCount = (p.formGuestBreakfast ? 1 : 0) + p.formCompanions.filter(c => c.breakfast).length
      if (!isBreakfastIncluded && bfCount > 0) {
        breakfast += 150 * bfCount * n
      }
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

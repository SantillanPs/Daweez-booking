import { Room, Venue, PartnerDeal, Companion, AppliedDiscount } from '../../types/booking'
import { calculatePricing } from '../../utils/pricing'
import { getRateConfig } from '../../utils/rateConfig'

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
  formVenueExcessHours: number
  /** The staff discount, exactly as the booking will store it. */
  discountType: 'none' | AppliedDiscount['type']
  discountValue: number
  venueDayBlocks: number
  bookingType: 'individual' | 'partner'
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

// The form's totals, worked out by the SAME pricing rule the booking is saved with
// (`calculatePricing`), one call per unit, handed exactly what `submitBookingForm`
// hands `createManualBooking`. This used to be a second sum of its own, and it had
// drifted: it left out the staff discount and ignored an agency's agreed rate on any
// room with a board price — and this figure is what the form takes as money, so a
// 20%-off stay paid in full was received at the undiscounted amount.
export function computeBookingEstimate(p: BookingEstimateParams): BookingEstimate {
  const deal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
  const isPartner = p.bookingType === 'partner'
  const rates = getRateConfig()
  const appliedDiscount: AppliedDiscount | undefined =
    p.discountType === 'none' ? undefined : { type: p.discountType, value: p.discountValue }

  let breakfast = 0, rentals = 0, addons = 0, total = 0, regularTotal = 0, subtotal = 0
  // Extras are entered once for the whole group, so they go on the FIRST room and the
  // FIRST venue only — the rule `submitBookingForm` uses.
  let isFirstRoom = true, isFirstVenue = true

  Object.entries(p.unitSelections).forEach(([id, sel]) => {
    if (!sel.checkIn || !sel.checkOut) return
    const isRoom = sel.type === 'room'
    const first = isRoom ? isFirstRoom : isFirstVenue
    if (isRoom) isFirstRoom = false; else isFirstVenue = false
    const equipmentRentals = isPartner || !first ? undefined : isRoom
      ? { bigTableCount: 0, smallTableCount: 0, chairCount: 0, mineralWaterCount: 0,
          extraFoamCount: p.formExtraFoam, extraPillowCount: p.formExtraPillow,
          extraBlanketCount: p.formExtraBlanket, extraTowelCount: p.formExtraTowel }
      : { bigTableCount: 0, smallTableCount: 0, chairCount: p.formChairs, mineralWaterCount: 0,
          tableCount: p.formEventTable, tentCount: p.formEventTent }

    const pricing = calculatePricing({
      roomId: isRoom ? id : undefined,
      venueId: isRoom ? undefined : id,
      checkIn: sel.checkIn,
      checkOut: sel.checkOut,
      guestEmail: '',
      equipmentRentals,
      contractRateOverride: deal?.contracted_rates[id] || undefined,
      venueExcessHours: isRoom ? undefined : p.formVenueExcessHours,
      breakfastIncluded: isRoom && ((deal ? deal.breakfast_default === 'with' : false) || p.formBreakfastRoomIds.includes(id)),
      appliedDiscount,
      venueDayBlocks: p.venueDayBlocks,
      shortStayHours: isRoom ? (p.shortStayHours ?? undefined) : undefined,
      rooms: p.rooms,
      venues: p.venues,
      rates,
    })
    breakfast += pricing.breakfastTotal
    rentals += pricing.rentalsTotal
    addons += pricing.addonsTotal
    total += pricing.grandTotal
    subtotal += pricing.stayTotal
    regularTotal += pricing.undiscountedSubtotal
  })

  const down = Math.round(total * 0.5)
  const due = p.formStatus === 'blocked' ? 0 : (total - down)

  return {
    estBreakfast: breakfast,
    estRentals: rentals,
    estAddons: addons,
    estSubtotal: subtotal,
    estRegularTotal: regularTotal,
    estDiscountAmount: Math.max(0, regularTotal - subtotal),
    estTotal: total,
    estDown: down,
    estDue: due,
  }
}

import { AppliedDiscount, Room, Venue } from '../../types/booking'
import { calculatePricing } from '../../utils/pricing'
import { getRateConfig } from '../../utils/rateConfig'
import { allocatePayment } from './bookingPayment'

/**
 * ONE FLAT DISCOUNT IS ONE DISCOUNT (Sebastian, 2026-10-06).
 *
 * A booking of several rooms or venues is saved as one row per unit, and each row is priced
 * on its own (`calculatePricing`). A percentage works out right that way — 20% of each part
 * is 20% of the whole — but a flat amount did not: the desk typed ₱6,200 off a ₱50,000
 * booking of two venues, and every venue was given the full ₱6,200, so the total came to
 * ₱37,600 instead of ₱43,800. The form's total and the bills both said so.
 *
 * So the amount is **shared out between the units in proportion to what each costs**, and
 * each row carries only its own share. The shares add back up to exactly what was typed
 * (`allocatePayment` — the same split that divides one payment across rooms — never a peso
 * over or short), and no unit is ever given more off than it costs.
 *
 * A percentage, no discount, a removed discount (`flat 0`) and a booking of one unit are
 * all handed through unchanged.
 */
export interface DiscountUnit {
  id: string
  type: 'room' | 'venue'
  checkIn: string
  checkOut: string
  /** The agency's agreed rate for this unit, when an agency is paying. */
  contractRate?: number
}

export function splitDiscount(
  discount: AppliedDiscount | undefined,
  units: DiscountUnit[],
  o: { rooms: Room[]; venues: Venue[]; venueDayBlocks: number; shortStayHours?: number | null },
): Record<string, AppliedDiscount | undefined> {
  const out: Record<string, AppliedDiscount | undefined> = {}
  const sharedOut = !!discount && discount.type === 'flat' && discount.value > 0 && units.length > 1
  if (!discount || !sharedOut) {
    units.forEach(u => { out[u.id] = discount })
    return out
  }
  // What each unit's stay costs before any discount — the same figure the discount is taken from.
  const costs = units.map(u => calculatePricing({
    roomId: u.type === 'room' ? u.id : undefined,
    venueId: u.type === 'venue' ? u.id : undefined,
    checkIn: u.checkIn,
    checkOut: u.checkOut,
    guestEmail: '',
    contractRateOverride: u.contractRate,
    venueDayBlocks: o.venueDayBlocks,
    shortStayHours: u.type === 'room' ? (o.shortStayHours ?? undefined) : undefined,
    rooms: o.rooms,
    venues: o.venues,
    rates: getRateConfig(),
  }).stayTotal)
  const shares = allocatePayment(costs, Math.round(discount.value))
  units.forEach((u, i) => { out[u.id] = { type: 'flat', value: shares[i] } })
  return out
}

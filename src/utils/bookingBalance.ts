import { Booking, Room, Venue } from '../types/booking'
import * as syncEngine from './syncEngine'
import { getRateConfig } from './rateConfig'
import { paymentStatusFromMoney } from './bookingMoney'
import { chargeableEarlyHours } from './checkInOut'

// The balance rule for a stay with a food tab (board card k69):
//
//     what is owed = the stay + the guest's food tab − the money received
//
// It lives in one pure place so the quick view, the check-in/check-out recompute
// and the tab itself can never disagree about the figure.
//
// The DEPOSIT is deliberately not part of this: `amountToPayNow(booking, tabTotal)`
// takes the tab out again before working out the 50%, because the deposit was
// agreed on the stay alone and a lunch eaten later must never inflate what the
// desk asks for on arrival.
export function recomputeBalance(
  base: Booking,
  opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number; includeEarlyHours?: boolean },
): Booking {
  const pricing = syncEngine.calculatePricing({
    roomId: base.room_id,
    venueId: base.venue_id,
    checkIn: base.check_in,
    checkOut: base.check_out,
    guestEmail: base.guest_email,
    breakfastOrders: base.breakfast_orders,
    equipmentRentals: base.equipment_rentals,
    eventAddons: base.event_addons,
    companions: base.companions,
    contractRateOverride: base.contract_rate_override,
    venueExcessHours: base.venue_excess_hours,
    appliedDiscount: base.applied_discount,
    // Early hours are billable only once the stay is checked out (`chargeableEarlyHours`),
    // unless the caller is asking what the bill WILL be — see `pendingEarlyCharge`.
    earlyCheckInHours: opts.includeEarlyHours ? Number(base.early_check_in_hours || 0) : chargeableEarlyHours(base),
    lateCheckOutHours: base.late_check_out_hours,
    venueDayBlocks: base.venue_day_blocks,
    breakfastDays: base.breakfast_days,
    breakfastRecords: base.breakfast_records,
    breakfastIncluded: base.breakfast_included === true,
    usePromo: (base as Booking & { promo_applied?: boolean }).promo_applied === true,
    // SHORT STAY: the hours must reach the pricing rule or a 3-hour stay is re-priced
    // as a whole night (the room's normal price instead of its 3-hour figure). Every
    // reader that re-prices a booking has to pass this — see `utils/AGENTS.md`.
    shortStayHours: base.stay_hours,
    rooms: opts.rooms,
    venues: opts.venues,
    rates: getRateConfig(),
  })
  const paid = Number(base.downpayment_paid || 0)
  const remaining = Math.max(0, pricing.grandTotal + (opts.tabTotal || 0) - paid)
  return { ...base, balance_due: remaining, payment_status: paymentStatusFromMoney(paid, remaining) }
}

/**
 * The early check-in money that has been **recorded but not billed yet** — the figure
 * the quick view shows as *goes on the bill at check-out*.
 *
 * It is the difference between the bill as it will stand at check-out (early hours
 * counted) and the bill as it stands now (they are held back). Worked out by asking the
 * one pricing rule twice rather than re-deriving the ₱/hour-or-a-night logic here, so
 * the number on screen can never drift from the number that lands at check-out.
 */
export function pendingEarlyCharge(
  base: Booking,
  opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number },
): number {
  const hours = Number(base.early_check_in_hours || 0)
  if (!hours || base.actual_check_out) return 0
  const withHours = recomputeBalance(base, { ...opts, includeEarlyHours: true })
  const without = recomputeBalance(base, opts)
  return Math.max(0, Number(withHours.balance_due || 0) - Number(without.balance_due || 0))
}

import { Booking, Room, Venue } from '../types/booking'
import * as syncEngine from './syncEngine'
import { getRateConfig } from './rateConfig'
import { paymentStatusFromMoney } from './bookingMoney'

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
  opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number },
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
    earlyCheckInHours: base.early_check_in_hours,
    lateCheckOutHours: base.late_check_out_hours,
    venueDayBlocks: base.venue_day_blocks,
    breakfastDays: base.breakfast_days,
    breakfastRecords: base.breakfast_records,
    usePromo: (base as Booking & { promo_applied?: boolean }).promo_applied === true,
    rooms: opts.rooms,
    venues: opts.venues,
    rates: getRateConfig(),
  })
  const paid = Number(base.downpayment_paid || 0)
  const remaining = Math.max(0, pricing.grandTotal + (opts.tabTotal || 0) - paid)
  return { ...base, balance_due: remaining, payment_status: paymentStatusFromMoney(paid, remaining) }
}

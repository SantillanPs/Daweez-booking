import { Booking, Room, Venue } from '../types/booking'
import * as syncEngine from './syncEngine'
import { getRateConfig } from './rateConfig'
import { paymentStatusFromMoney } from './bookingMoney'
import { chargeableEarlyHours } from './checkInOut'
import { normalizeVenueId } from './helpers'

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
  // **Never re-price a booking before its room's prices have arrived.** With an empty
  // room list the pricing rule falls back to the built-in sample rooms, which carry no
  // short-stay prices — so a booking panel that opened while the page was still loading
  // (a short stay whose time is up opens by itself) re-priced a paid ₱650 six-hour stay
  // as a ₱950 night and SAVED it as owing ₱300 (found 2026-10-04). Unknown unit: leave
  // the booking exactly as it is stored.
  // A date block is not a stay and owes nothing — pricing it would write a bill onto it.
  if (base.status === 'blocked') return base

  const unitKnown = base.room_id
    ? opts.rooms.some(r => r.id === base.room_id)
    : base.venue_id
      ? opts.venues.some(v => v.id === normalizeVenueId(base.venue_id))
      : true
  if (!unitKnown) return base

  const pricing = syncEngine.calculatePricing({
    roomId: base.room_id,
    venueId: base.venue_id,
    checkIn: base.check_in,
    checkOut: base.check_out,
    guestEmail: base.guest_email,
    equipmentRentals: base.equipment_rentals,
    eventAddons: base.event_addons,
    contractRateOverride: base.contract_rate_override,
    venueExcessHours: base.venue_excess_hours,
    appliedDiscount: base.applied_discount,
    // Early hours are billable only once the stay is checked out (`chargeableEarlyHours`),
    // unless the caller is asking what the bill WILL be — see `pendingEarlyCharge`.
    earlyCheckInHours: opts.includeEarlyHours ? Number(base.early_check_in_hours || 0) : chargeableEarlyHours(base),
    lateCheckOutHours: base.late_check_out_hours,
    venueDayBlocks: base.venue_day_blocks,
    breakfastRecords: base.breakfast_records,
    breakfastIncluded: base.breakfast_included === true,
    // SHORT STAY: the hours must reach the pricing rule or a 3-hour stay is re-priced
    // as a whole night (the room's normal price instead of its 3-hour figure). Every
    // reader that re-prices a booking has to pass this — see `docs/why/money.md`.
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
 * The booking as it stands once its check-out is moved to `newCheckOut` — the ONE
 * place an extension is priced (the owner's ruling, 2026-10-03).
 *
 * Extend stay used to price itself: half of the re-priced stay, with the money already
 * received, the discount, the breakfast and the extras all left out — a fully paid
 * two-night stay at ₱950 extended by a night was saved owing ₱1,425 instead of ₱950.
 * It is the same sum as everywhere else now: the new bill + the food tab − the money
 * received.
 *
 * A short stay pushed past its day **becomes a normal stay, priced by nights** (his
 * ruling on the same page), so the hours come off the booking here.
 */
export function extendStay(
  base: Booking,
  newCheckOut: string,
  opts: { rooms: Room[]; venues: Venue[]; tabTotal?: number },
): Booking {
  return recomputeBalance({ ...base, check_out: newCheckOut, stay_hours: undefined }, opts)
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

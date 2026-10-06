import { Booking, PaymentRecord } from '../../types/booking'
import * as syncEngine from '../../utils/syncEngine'
import { recordBookingPayment } from './bookingPayment'
import { BookingSubmitParams, BookingSubmitResult } from './bookingSubmitTypes'
import { editedMoney } from './bookingEditMoney'
import { generateUUID } from '../../utils/helpers'
import { splitDiscount } from './discountSplit'

// The param and result shapes live in `bookingSubmitTypes`, and the payment logic in
// `bookingPayment` — both split out to keep this file inside the 300-line limit.
export type { BookingSubmitParams, BookingSubmitResult } from './bookingSubmitTypes'

// Collision-check every selected unit, then create/update one booking per room
// and per venue, cancelling any edit-mode bookings the user removed.
export async function submitBookingForm(p: BookingSubmitParams): Promise<BookingSubmitResult> {
  // 1. Run collision checks for all selected units on their respective dates
  for (const [id, sel] of Object.entries(p.unitSelections)) {
    const isRoom = sel.type === 'room'
    if (isRoom) {
      if (!syncEngine.isRoomAvailable(id, sel.checkIn, sel.checkOut, p.activeBookings)) {
        const roomNum = p.rooms.find(r => r.id === id)?.room_number || id
        return { ok: false, error: `Room ${roomNum} is already booked for the selected dates.` }
      }
    } else {
      if (!syncEngine.isVenueRangeAvailable(id, sel.checkIn, sel.checkOut, p.activeBookings)) {
        const venueName = p.venues.find(v => v.id === id)?.name || id
        return { ok: false, error: `Venue ${venueName} is already reserved for the selected dates.` }
      }
    }
  }

  const cleanGuestName = p.formGuestName.trim() || (p.bookingType === 'partner' && p.formPartnerDealId ? `${p.partnerDeals.find(d => d.id === p.formPartnerDealId)?.name || 'Corporate'} Guest` : '')
  if (p.bookingStatus !== 'blocked' && !cleanGuestName && p.bookingType === 'individual') {
    return { ok: false, error: 'Guest name is required.' }
  }

  // Correcting a booking: the database keeps the old value of these two when it is sent
  // nothing, so a removed discount or an emptied companion list has to be sent as an
  // empty one — otherwise taking a discount off in the form silently did nothing.
  const isEdit = !!p.editingBookings
  const appliedDiscount = p.discountType === 'none'
    ? (isEdit ? { type: 'flat' as const, value: 0 } : undefined)
    : { type: p.discountType, value: p.discountValue }
  // Each unit is saved as its own row, so a flat amount off is SHARED OUT between them
  // (see `discountSplit`): handed whole to every row it was taken off once per unit.
  const bookedDeal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
  const discounts = splitDiscount(
    appliedDiscount,
    Object.entries(p.unitSelections)
      .filter(([id]) => p.formRoomIds.has(id) || p.formVenueIds.has(id))
      .map(([id, sel]) => ({ id, type: sel.type, checkIn: sel.checkIn, checkOut: sel.checkOut, contractRate: bookedDeal?.contracted_rates[id] || undefined })),
    { rooms: p.rooms, venues: p.venues, venueDayBlocks: p.venueDayBlocks, shortStayHours: p.stay_hours },
  )
  const companions = p.bookingType === 'partner'
    ? undefined
    : (p.formCompanions.length > 0 ? p.formCompanions : (isEdit ? [] : undefined))

  // The agreed figure is for the whole booking. Written onto every room of a several-room
  // booking it made each room ask for the group's deposit (₱2,000 on a ₱1,800 room), so
  // it is only stored when one unit is booked; otherwise each room works out its own half.
  const agreedDeposit = Object.keys(p.unitSelections).length > 1 ? undefined : (p.formAgreedDeposit || undefined)

  // SEVERAL ROOMS, ONE BOOKING: every room made here carries the same group mark, so the
  // bill, the edit form and the booking panel treat them as one booking afterwards.
  // Correcting an existing group keeps its mark; a room added to a one-room booking
  // starts one.
  const severalUnits = Object.keys(p.unitSelections).length > 1
  const groupId = p.editingBookings?.find(eb => eb.group_id)?.group_id
    || (severalUnits ? 'grp-' + generateUUID() : undefined)
  // Each room has its OWN invoice number (the database requires them unique). The form
  // shows one number box, so on a several-room correction every room keeps its own —
  // sending the first room's number to all of them was refused as a duplicate.
  const invoiceFor = (existing?: Booking) =>
    existing
      ? ((p.editingBookings?.length || 0) > 1 ? existing.invoice_number : (p.formInvoiceNumber || existing.invoice_number))
      : undefined

  const createdBookings: Booking[] = []
  const processedBookingIds = new Set<string>()

  try {
    // 2. Loop to create or update room bookings
    let isFirstRoom = true
    for (const roomId of Array.from(p.formRoomIds)) {
      const sel = p.unitSelections[roomId]
      const rentals = (p.bookingType === 'partner' || !isFirstRoom) ? undefined : {
        bigTableCount: 0,
        smallTableCount: 0,
        chairCount: 0,
        mineralWaterCount: 0,
        extraFoamCount: p.formExtraFoam,
        extraPillowCount: p.formExtraPillow,
        extraBlanketCount: p.formExtraBlanket,
        extraTowelCount: p.formExtraTowel
      }
      isFirstRoom = false

      const deal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
      const isBreakfastIncluded = deal ? deal.breakfast_default === 'with' : false
      const contractedPrice = deal?.contracted_rates[roomId]

      const existingBooking = p.editingBookings?.find(eb => eb.room_id === roomId)
      if (existingBooking) processedBookingIds.add(existingBooking.id)

      const b = await p.createManualBooking({
        id: existingBooking?.id,
        invoiceNumber: invoiceFor(existingBooking),
        groupId,
        roomId,
        guestName: cleanGuestName,
        guestEmail: p.formGuestEmail || (deal?.email || 'admin@daweez-booking.vercel.app'),
        guestPhone: p.formGuestPhone || (deal?.contact_no || 'None'),
        guestGender: p.formGuestGender || undefined,
        guestNationality: p.formGuestNationality || undefined,
        guestAddress: p.formGuestAddress || undefined,
        birthdate: p.formBirthdate || undefined,
        preparedBy: p.formPreparedBy || undefined,
        appliedDiscount: discounts[roomId],
        venueDayBlocks: p.venueDayBlocks,
        notes: p.formBlockNotes.trim() || undefined,
        checkIn: sel.checkIn,
        checkOut: sel.checkOut,
        source: p.bookingType === 'partner' ? 'manual' : p.formSource,
        status: p.bookingStatus,
        equipmentRentals: rentals,
        agreedDeposit,
        companions,
        partnerDealId: p.formPartnerDealId || undefined,
        companyName: p.formCompanyName || undefined,
        vehiclePlate: p.formVehiclePlate || undefined,
        // Breakfast belongs to the ROOM (card k140): the row is marked when the desk
        // tapped that room's chip, and the charge is ₱150 × the room's beds.
        breakfastOrders: undefined,
        breakfastIncluded: isBreakfastIncluded || p.formBreakfastRoomIds.includes(roomId),
        contractRateOverride: contractedPrice || (existingBooking && !existingBooking.partner_deal_id ? existingBooking.contract_rate_override : undefined),
        paymentMethod: p.formPaymentMethod || undefined,
        paymentReference: p.formPaymentReference || undefined,
        paymentPlan: p.bookingStatus === 'blocked' ? undefined : p.formPaymentPlan,
        ...editedMoney(p, existingBooking),
        stayHours: p.stay_hours || undefined
      })
      createdBookings.push(b)
    }

    // 3. Loop to create or update venue bookings
    // Extras are entered once for the whole group, so they belong on the FIRST
    // venue only — the same rule the rooms loop above uses.
    let isFirstVenue = true
    for (const venueId of Array.from(p.formVenueIds)) {
      const sel = p.unitSelections[venueId]
      const rentals = (p.bookingType === 'partner' || !isFirstVenue) ? undefined : {
        bigTableCount: 0,
        smallTableCount: 0,
        chairCount: p.formChairs,
        mineralWaterCount: 0,
        tableCount: p.formEventTable,
        tentCount: p.formEventTent
      }
      isFirstVenue = false
      const existingBooking = p.editingBookings?.find(eb => eb.venue_id === venueId)
      if (existingBooking) processedBookingIds.add(existingBooking.id)

      const deal = p.partnerDeals.find(d => d.id === p.formPartnerDealId)
      const contractedPrice = deal?.contracted_rates[venueId]

      const b = await p.createManualBooking({
        id: existingBooking?.id,
        invoiceNumber: invoiceFor(existingBooking),
        groupId,
        venueId,
        guestName: cleanGuestName,
        guestEmail: p.formGuestEmail || (deal?.email || 'admin@daweez-booking.vercel.app'),
        guestPhone: p.formGuestPhone || (deal?.contact_no || 'None'),
        guestGender: p.formGuestGender || undefined,
        guestNationality: p.formGuestNationality || undefined,
        guestAddress: p.formGuestAddress || undefined,
        birthdate: p.formBirthdate || undefined,
        preparedBy: p.formPreparedBy || undefined,
        appliedDiscount: discounts[venueId],
        venueDayBlocks: p.venueDayBlocks,
        notes: p.formBlockNotes.trim() || undefined,
        checkIn: sel.checkIn,
        checkOut: sel.checkOut,
        source: p.bookingType === 'partner' ? 'manual' : p.formSource,
        status: p.bookingStatus,
        equipmentRentals: rentals,
        agreedDeposit,
        companions,
        partnerDealId: p.formPartnerDealId || undefined,
        companyName: p.formCompanyName || undefined,
        vehiclePlate: p.formVehiclePlate || undefined,
        contractRateOverride: contractedPrice || (existingBooking && !existingBooking.partner_deal_id ? existingBooking.contract_rate_override : undefined),
        paymentMethod: p.formPaymentMethod || undefined,
        paymentReference: p.formPaymentReference || undefined,
        paymentPlan: p.bookingStatus === 'blocked' ? undefined : p.formPaymentPlan,
        venueExcessHours: p.formVenueExcessHours,
        ...editedMoney(p, existingBooking)
      })
      createdBookings.push(b)
    }

    // 4. Cancel any bookings from editingBookings that were NOT processed (i.e. removed by user)
    if (p.editingBookings) {
      for (const eb of p.editingBookings) {
        if (!processedBookingIds.has(eb.id)) {
          try {
            // A room taken off the booking: kept as Cancelled when money was recorded
            // on it (the receipt must survive), simply removed when it held none.
            const heldMoney = Number(eb.downpayment_paid || 0) > 0 || (eb.payment_records || []).length > 0
            if (heldMoney) await p.cancelBooking(eb.id)
            else await p.deleteBooking(eb.id)
          } catch (err) {
            console.error('Failed to cancel removed booking:', eb.id, err)
          }
        }
      }
    }

    // 5. **Take the money** (the owner's ruling, 2026-09-29). The form records the payment
    //    as well as creating the booking, because that is what the desk really does: the
    //    guest is asked deposit or full pay and how they will pay, the desk enters both, and
    //    the form waits for the GCash reference before it will finish.
    //
    //    Skipped in three cases, each deliberate:
    //      · **a blocked date** — nothing is being sold, so nothing is paid;
    //      · **a Reservation** (`receivedAmount` is 0) — a hold agrees to nothing, and it
    //        still finishes on the plan alone and prints the billing statement;
    //      · **edit mode** — correcting an existing booking must never take money again.
    //        Money on a saved booking is added from its quick view, which is what prints
    //        that payment's receipt.
    //
    //    A failed write throws, and the catch below cancels every booking just created — so
    //    the form can never finish on a booking whose payment did not land.
    const takesMoney = p.receivedAmount > 0 && p.bookingStatus !== 'blocked' && !p.editingBookings
    let finalBookings = createdBookings
    let receipt: PaymentRecord | undefined

    if (takesMoney) {
      const recorded = await recordBookingPayment({
        bookings: createdBookings,
        // So the receipt number is not already on another payment this month.
        allBookings: p.allBookings,
        received: p.receivedAmount,
        method: p.formPaymentMethod,
        reference: p.formPaymentReference,
        plan: p.formPaymentPlan,
        updateBooking: p.updateBooking,
      })
      finalBookings = recorded.bookings
      receipt = recorded.receipt
    }

    return {
      ok: true,
      bookings: finalBookings,
      payAmount: String(finalBookings.reduce((a, b) => a + (b.balance_due || 0), 0)),
      receipt,
    }
  } catch (err: unknown) {
    // Rollback successfully created bookings on failure
    for (const b of createdBookings) {
      try {
        // Never a cancellation: these rows should not exist at all.
        if (!p.editingBookings?.some(eb => eb.id === b.id)) await p.deleteBooking(b.id)
      } catch (rollbackErr) {
        console.error('Failed to rollback booking:', b.id, rollbackErr)
      }
    }
    return { ok: false, error: err instanceof Error ? err.message : 'Booking failed — possible date overlap.' }
  }
}
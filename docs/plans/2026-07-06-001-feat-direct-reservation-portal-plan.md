---
title: "feat: Add direct reservation portal and admin confirmation trigger"
type: feat
date: 2026-07-06
origin: docs/brainstorms/2026-07-06-direct-reservation-portal-requirements.md
---

# Plan: Add Direct Reservation Portal

Create a public-facing booking page `/reserve` allowing guests to check real-time availability, select a room/venue, input details with a GCash reference, and submit a pending reservation.

## Key Technical Decisions
- **KTD1. Public Route Architecture:** Register `/reserve` as a direct child of the `rootRoute` in `router.tsx` to bypass authentication.
- **KTD2. Availability Check Optimization:** Query Supabase bookings client-side and filter available units using `syncEngine.isRoomAvailable` and `syncEngine.isVenueRangeAvailable`.
- **KTD3. GCash Reference Storage:** Store the transaction reference number in the booking record inside the `event_addons` JSONB under the key `payment_reference`.
- **KTD4. Admin Confirmation Button:** Add a `"Confirm Reservation"` button to `ExtendStayModal.tsx` for pending bookings to trigger `confirmBooking` and update the status in Supabase.

## Requirements Traceability
- **Public Route & Layout:** R1, R2, R3 (see origin)
- **Booking Wizard Workflow:** R4, R5, R6, R7 (see origin)
- **Supabase Persistence & Pricing Integration:** R8, R9, R10 (see origin)
- **Admin Validation & Confirmation Panel:** R11, R12, R13 (see origin)

## Implementation Units

### U1. Register Public Route /reserve
- **Files:**
  - `src/router.tsx`
  - `src/components/PublicReservePortal.tsx` [NEW]
- **Tasks:**
  - Import `PublicReservePortal` in `src/router.tsx`.
  - Declare `reserveRoute` as a child of the `rootRoute` (unauthenticated).
  - Add `reserveRoute` to the route children array.
  - Create a placeholder `PublicReservePortal` returning a basic title and container.

### U2. Create Guest Booking Wizard Component
- **Files:**
  - `src/components/PublicReservePortal.tsx`
- **Tasks:**
  - Implement date selection state and vacancy filtering (queries all bookings and filters using `isRoomAvailable` / `isVenueRangeAvailable`).
  - Render available rooms and venues as visually premium cards showing capacity, image, base rate, and 20% discounted rate.
  - Add step navigation: (1) Select Dates & Unit, (2) Guest Contact & Downpayment Proof, (3) Success confirmation.
  - Guest Contact form fields: guestName, guestEmail, guestPhone, companions, paymentReference.

### U3. Implement Pricing and Discount Logic
- **Files:**
  - `src/utils/syncEngine.ts`
  - `src/components/PublicReservePortal.tsx`
- **Tasks:**
  - Update `calculatePricing` default multiplier check in `syncEngine.ts` to include `'website'` source channel.
  - Render a clear invoice statement in the wizard detailing: original rates, 20% Direct Booking Discount, 50% downpayment due, and ₱500 per-unit security deposit.

### U4. Add Double-Booking Guard & Save Booking
- **Files:**
  - `src/components/PublicReservePortal.tsx`
- **Tasks:**
  - Implement dynamic collision checking inside the submit handler to prevent concurrent booking conflicts.
  - Assemble the new booking object: `status = 'pending'`, `source = 'website'`, `event_addons = { "payment_reference": paymentReference }`.
  - Save the booking using `syncEngine.insertBooking` and direct the user to the success screen.

### U5. Update Back-Office PMS Verification Panel
- **Files:**
  - `src/components/calendar/TimelineGrid.tsx`
  - `src/components/calendar/ExtendStayModal.tsx`
- **Tasks:**
  - Update `TimelineGrid.tsx` to render pending bookings (status = `'pending'`) in yellow.
  - Modify timeline cell tooltip to show `Ref: ...` from `event_addons.payment_reference`.
  - Update `ExtendStayModal.tsx` to display the payment reference code and render a `"Confirm Reservation"` button when status is pending.
  - Confirm reservation button calls `confirmBooking(booking.id)` from context to change status to `confirmed`.

## Verification Plan

### Automated Checks
- Run `npx tsc --noEmit` and `npm run build` to confirm compilation cleanliness.

### Manual Verification
- Test direct link reservation at `/reserve`: verify date queries, available unit listings, discounts, and database insertion.
- Verify that a pending booking is correctly highlighted in yellow on the admin calendar.
- Verify that clicking it and clicking "Confirm Reservation" updates the status to confirmed.

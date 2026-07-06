# Walkthrough: Direct Reservation Portal

We have successfully implemented the **Direct Reservation Portal** (`/reserve`) and back-office verification features.

## Changes Made

### 1. Routing & Public Entry Point
- Registered `/reserve` as a child of the `rootRoute` in `src/router.tsx` to bypass authentication.

### 2. Guest Booking Wizard Component
- Created `src/components/PublicReservePortal.tsx` implementing:
  - **Live Availability Filtering:** Guest chooses dates and the portal queries Supabase bookings to filter out unavailable rooms/venues.
  - **Dynamic Card Catalog:** Displays vacant units with price comparisons showing standard rates and 20% direct-booking discount rates.
  - **Downpayment Instructions & GCash Proof:** Guides guests on payment and collects contact information + GCash Reference Code.
  - **Double-Booking Prevention Guard:** Executes final vacancy check before calling `syncEngine.insertBooking`.

### 3. Back-Office Verification
- Rendered pending bookings in yellow with a pulse animation on the calendar timeline.
- Printed the GCash payment reference in TimelineGrid cell tooltips.
- Added a payment reference display and `"Confirm Reservation"` action inside the `ExtendStayModal` for pending bookings to update status to confirmed in Supabase.

## Verification & Testing
- Ran type checks successfully via `npx tsc --noEmit`.
- Compiled Vite production assets successfully using `npm run build`.

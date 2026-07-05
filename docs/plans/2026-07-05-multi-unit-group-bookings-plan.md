---
title: Plan: Multi-Unit Group Bookings
type: feat
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-multi-unit-group-bookings-requirements.md
---

# Plan: Multi-Unit Group Bookings

## Summary
Refactor the Walk-In Booking Form wizard and dashboard to allow front desk staff to book multiple rooms and event venues in a single transaction. Group bookings share guest credentials and check-in/out dates, and generate individual booking records (one per room and venue) with a per-unit security deposit.

---

## Problem Frame
Currently, the PMS enforces a strict division between room and venue bookings. Staff must enter guest data, email, phone, and companions multiple times to reserve a room and an event venue for the same guest, causing friction and data duplication.

---

## Key Technical Decisions
* **Unified Wizard State**:
  * Replace the single-select `formPathway: 'room' | 'venue'` behavior with a unified layout allowing both `formRoomIds` and `formVenueIds` sets to be populated concurrently.
  * Initialize `formVenueIds` as a `Set<string>` (instead of a single string `formVenueId`) to handle multiple event venues.
* **Per-Unit Security Deposit**:
  * Charge a flat ₱500 security deposit for each booked room and venue.
  * Subtotal billing calculations: `estDue = (subtotal - downpayment) + (formStatus === 'blocked' ? 0 : 500 * (roomCount + venueCount))`.
* **Amenities & Rentals Deduplication**:
  * Attach breakfast orders to all room bookings in the group.
  * Attach equipment rentals and event add-ons **only to the first venue booking** to prevent double-charging the guest's invoice for shared event assets.

---

## Requirements Traceability
* R1. Enable side-by-side/stacked selection of both rooms and venues → `src/components/walk-in/GuestDetailsForm.tsx`
* R2. Show Step 3 panels contextually based on selected unit types → `src/components/walk-in/AmenitiesForm.tsx`
* R3. Estimate subtotal, downpayment, and per-unit deposits dynamically → `src/components/WalkInBookingForm.tsx`, `src/components/walk-in/BillingSummary.tsx`
* R4. Group transaction looping with check-in < check-out validation → `src/components/WalkInBookingForm.tsx`

---

## Implementation Units

### U1. Refactor State & Pricing Logic in WalkInBookingForm
* **Goal**:
  * Add `formVenueIds: Set<string>` state to `WalkInBookingForm.tsx`.
  * Update pricing `useMemo` block to calculate base prices, nights, and totals for rooms and venues combined.
  * Adjust subtotal and due-at-checkin estimates to apply ₱500 per unit (room + venue count).
* **Files**:
  * `src/components/WalkInBookingForm.tsx`
* **Approach**:
  * Replace `formVenueId` state with `formVenueIds` initialized from `initialVenueId`.
  * Calculate total room rate = `roomBasePrices * nights`.
  * Calculate total venue rate = `venueBasePrices * nights`.
  * Sum them for the subtotal. Add `500 * (formRoomIds.size + formVenueIds.size)` to the balance due if status is confirmed.

### U2. Update GuestDetailsForm for Concurrent Multi-Select
* **Goal**:
  * Update `GuestDetailsForm.tsx` props: replace `formVenueId` and its setter with `formVenueIds` Set.
  * Remove the path toggle buttons ("Room Stay" vs "Event Venue").
  * Render BOTH Room selection chips and Venue selection chips on the same view.
  * Ensure selected rooms and venues are toggled in their respective Sets.
* **Files**:
  * `src/components/walk-in/GuestDetailsForm.tsx`
* **Approach**:
  * Display a "Select Room(s)" chip container and a "Select Event Venue(s)" chip container.
  * Disable chips for colliding rooms/venues based on the selected dates.
  * Validate that at least one room or venue is selected to proceed.

### U3. Refactor AmenitiesForm and BillingSummary
* **Goal**:
  * Modify `AmenitiesForm.tsx` to display breakfast orders if rooms are selected, and equipment rentals/event add-ons if venues are selected.
  * Modify `BillingSummary.tsx` to list all selected rooms and venues and itemize their respective billing calculations.
* **Files**:
  * `src/components/walk-in/AmenitiesForm.tsx`
  * `src/components/walk-in/BillingSummary.tsx`
* **Approach**:
  * Update interfaces to accept `formRoomIds: Set<string>` and `formVenueIds: Set<string>`.
  * Map through both sets inside `BillingSummary.tsx` to list unit name and cost breakdowns.

### U4. Implement Unified Booking Transaction Loop
* **Goal**:
  * Update `handleSubmit` in `WalkInBookingForm.tsx` to check range collisions for all selected rooms and venues.
  * Execute sequential manual booking queries.
  * Attach breakfast orders to all rooms, and attach event assets (rentals/addons) only to the first venue.
* **Files**:
  * `src/components/WalkInBookingForm.tsx`
* **Approach**:
  * Run `syncEngine.isRoomAvailable` for every selected room ID.
  * Run `syncEngine.isVenueRangeAvailable` for every selected venue ID.
  * Run a loop to call `createManualBooking` for each selected room.
  * Run a loop to call `createManualBooking` for each selected venue. Pass `equipmentRentals` and `eventAddons` only to the first venue in the loop; pass `undefined` for subsequent venues.

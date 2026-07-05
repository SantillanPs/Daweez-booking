---
title: Plan: Unified Timeline Grid & Date Navigation
type: feat
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-timeline-unification-and-navigation-requirements.md
---

# Plan: Unified Timeline Grid & Date Navigation

## Summary
Consolidate Rooms and Event Venues into a unified scheduling Timeline Grid and implement robust date navigation controls (month jumps, native date picker, spanned month headers). Complete the deprecation of the Month Grid View.

---

## Problem Frame
Removing the Month Calendar View simplifies the interface but requires restoring date navigation efficiency within the Timeline View. In addition, Event Venues (such as the Gazebo, Vacation House, and Garden Area) must be unified into the timeline scheduler so that staff can view and book them.

---

## Key Technical Decisions

* **Venue Range Availability API**: Introduce `isVenueRangeAvailable` in `src/utils/syncEngine.ts` mirroring `isRoomAvailable`'s overlap calculation. This replaces the single-day checks of the old layout and supports timeline stay selections.
* **Unified Row List**: Inject Venues directly into the table rendering structure in `src/components/calendar/TimelineGrid.tsx`. Venues will be listed as separate rows below the Room unit rows.
* **Date Pre-calculations**: Move all timeline cell date logic, split operations, and header displays into the `daysList` `useMemo` block in `src/components/CalendarTab.tsx` to keep the timeline grid renders fast.

---

## Requirements Traceability

* R1. Month View toggle buttons removed from UI → `src/components/CalendarTab.tsx`
* R2. Month View source files deleted → `src/components/calendar/MonthGridView.tsx`, `src/components/calendar/DayPreviewPanel.tsx`
* R3-R5. Double-chevrons, single-chevrons, and native date picker added to toolbar → `src/components/CalendarTab.tsx`
* R6. Spanned month/year header added to toolbar → `src/components/CalendarTab.tsx`
* R7. Venues rendered below rooms on timeline → `src/components/calendar/TimelineGrid.tsx`
* R8. Clicking venue cell triggers venue pathway wizard → `src/components/CalendarTab.tsx`, `src/components/WalkInBookingForm.tsx`
* R9. Double-booking overlap checks on venues → `src/utils/syncEngine.ts`, `src/components/CalendarTab.tsx`

---

## Implementation Units

### U1. Deprecate and Clean Month View Files
* **Task**:
  * Delete `src/components/calendar/MonthGridView.tsx`.
  * Delete `src/components/calendar/DayPreviewPanel.tsx`.
  * Remove `schedulerMode`, `currentMonthDate`, `selectedRoomIds`, `prevRooms`, `showRoomFilter`, and `selectedPreviewDate` states and handlers from `src/components/CalendarTab.tsx`.
  * Clean up associated imports and buttons from the toolbar area.
* **Files**:
  * `src/components/CalendarTab.tsx`
  * `src/components/calendar/MonthGridView.tsx` (Delete)
  * `src/components/calendar/DayPreviewPanel.tsx` (Delete)
* **Test Scenario**: Verify the application builds cleanly after file deletions and does not contain broken imports.

### U2. Implement Enhanced Date Toolbar & Header
* **Task**:
  * Implement month navigation buttons (`<<` / `>>`) shifting `schedulerStartDate` by 30 days.
  * Keep week navigation buttons (`<` / `>`) shifting `schedulerStartDate` by 7 days.
  * Add a datepicker input (`<input type="date">` styled in gold matching the theme) that directly sets `schedulerStartDate`.
  * Format and display the active spanned month/year (e.g., "July - August 2026") above the grid.
* **Files**:
  * `src/components/CalendarTab.tsx`
* **Test Scenario**:
  * Check that clicking `<<` and `>>` shifts date offsets by 30 days.
  * Check that changing the native date input jumps the grid immediately.
  * Check that spanning dates across two months correctly formats the header string.

### U3. Integrate Event Venues as Timeline Rows
* **Task**:
  * Add a separate mapping block or rows under the Rooms rows inside `src/components/calendar/TimelineGrid.tsx`.
  * Use a clean text label or header "Event Venues" to segment rooms from venues.
  * Map venue bookings under `venue_id` matching `VENUE_COLORS` (fuchsia) so that they stand out.
  * Pass `venues={venues}` down to `ExtendStayModalProps` and update details to display the correct venue name instead of a generic "Event Venue" string.
* **Files**:
  * `src/components/calendar/TimelineGrid.tsx`
  * `src/components/CalendarTab.tsx`
  * `src/components/calendar/ExtendStayModal.tsx`
* **Test Scenario**:
  * Verify the Timeline table renders room rows 1–10 and venue rows "Gazebo", "Vacation House", "Garden Area".
  * Verify that venue bookings render in fuchsia colors.

### U4. Support Venue Date Selection & Overlap Checks
* **Task**:
  * Implement `isVenueRangeAvailable` in `src/utils/syncEngine.ts`.
  * Modify `handleCellClick` to accept `(id: string, type: 'room' | 'venue', date: Date)`.
  * Add `initialVenueId?: string` to `WalkInBookingFormProps` and wire it to initialize the booking wizard pathway.
  * Modify `handleExtendStaySubmit` in `src/components/CalendarTab.tsx` and `ExtendStayModal.tsx` to support venue overlap checks and pricing calculations.
* **Files**:
  * `src/utils/syncEngine.ts`
  * `src/components/CalendarTab.tsx`
  * `src/components/WalkInBookingForm.tsx`
  * `src/components/calendar/ExtendStayModal.tsx`
* **Test Scenario**:
  * Selecting a check-in and check-out on a venue row opens the manual form in the venue pathway with dates pre-filled.
  * Attempting to block/book overlapping stays on the same venue row triggers a collision alert.

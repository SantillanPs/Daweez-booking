---
title: "Plan: Multi-Unit Staggered Dates Bookings"
type: feat
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-multi-unit-group-bookings-requirements.md
---

# Plan: Multi-Unit Staggered Dates Bookings

## Goal Description
Support multi-unit group bookings where each selected room or venue has its own individual check-in and check-out dates. Staff will be able to select independent date ranges per unit directly on the timeline grid (using a click check-in, click check-out sequential flow), visualize and manage selections in the bottom floating bar, and pre-fill them into the Walk-In Booking Form wizard.

## Proposed Changes

### 1. Calendar State & Grid Interactions

#### [MODIFY] [CalendarTab.tsx](src/components/CalendarTab.tsx)
* Change the type of `groupSelection` state to a map of unit selections:
  `const [groupSelection, setGroupSelection] = useState<Record<string, { checkIn: Date; checkOut: Date; type: 'room' | 'venue' }> | null>(null)`
* Refactor the `handleCellClick` callback:
  * If the clicked unit `id` is already selected:
    * Remove it from the `groupSelection` map. If no units remain, set `groupSelection` to `null`.
  * If a unit `id` is NOT selected:
    * If `timelineSelection` is active for the **same unit**:
      * Complete the range selection (Click 2).
      * Run collision check (`syncEngine.isRoomAvailable` or `syncEngine.isVenueRangeAvailable`) over the clicked range.
      * If collision exists: show overlap warning, but do not automatically clear the entire selection.
      * If vacant: add the unit with its check-in/check-out dates to `groupSelection` map, then clear `timelineSelection`.
    * If `timelineSelection` is active for a **different unit**:
      * Clear the previous unit's draft and start a new selection (Click 1) on the clicked unit.
    * If `timelineSelection` is NOT active:
      * Start a new selection (Click 1) on the clicked unit.
* Update the bottom floating bar layout:
  * Render a list of selected units showing their specific check-in and check-out date badges.
  * Provide a delete (`x`) button next to each unit to remove it from selection.
  * On Confirm Booking click: serialize `groupSelection` to `Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>` and pass to `resetAndOpenManualForm`.
* Update the signature of `resetAndOpenManualForm` to accept `initialSelections`.

#### [MODIFY] [TimelineGrid.tsx](src/components/calendar/TimelineGrid.tsx)
* Update `TimelineGridProps` to accept the new map structure for `groupSelection`.
* Memoize selection date ranges using `React.useMemo` for highly optimized check-in/out cell highlights:
  ```typescript
  const selectionRanges = React.useMemo(() => {
    if (!groupSelection) return {}
    const ranges: Record<string, { start: number; end: number }> = {}
    Object.entries(groupSelection).forEach(([id, sel]) => {
      ranges[id] = {
        start: sel.checkIn.getTime(),
        end: sel.checkOut.getTime()
      }
    })
    return ranges
  }, [groupSelection])
  ```
* Calculate `isHighlighted` for vacant room/venue cells by checking if cell time falls within its unit-specific selection range.

---

### 2. Walk-In Booking Wizard

#### [MODIFY] [WalkInBookingForm.tsx](src/components/WalkInBookingForm.tsx)
* Update `WalkInBookingFormProps` to receive `initialSelections` instead of individual Sets and dates.
* Change state management to store individual unit dates:
  `const [unitSelections, setUnitSelections] = useState<Record<string, { checkIn: string; checkOut: string; type: 'room' | 'venue' }>>(initialSelections)`
* Refactor pricing calculation in `useMemo` to sum prices based on each unit's individual check-in and check-out dates.
* Update wizard step 1 submit check:
  * Check collisions for each unit over its specific check-in/check-out date range.
* Update `createManualBooking` loops:
  * Create each booking with its individual check-in and check-out dates.

#### [MODIFY] [GuestDetailsForm.tsx](src/components/walk-in/GuestDetailsForm.tsx)
* Update props to receive `unitSelections` and an update callback `setUnitSelections`.
* Instead of global date inputs, render date range inputs for **each selected room/venue individually** inside the form.
* When toggling new rooms/venues in Step 1, initialize their date ranges using a default stay window (e.g. today to tomorrow).

#### [MODIFY] [BillingSummary.tsx](src/components/walk-in/BillingSummary.tsx)
* Update props to receive `unitSelections` instead of Sets.
* Render the check-in and check-out dates for each room and venue next to its list entry.
* Compute the nights and subtotal per room individually using its specific dates.

## Verification Plan

### Automated Tests
* Run `npm run build` to verify TypeScript compile success.

### Manual Verification
* Navigate to the Calendar tab.
* Select **July 16 to July 19** on Room 101. Verify the highlight appears on Room 101.
* Select **July 17 to July 19** on Room 103. Verify the highlight appears on Room 103.
* Click 'x' on Room 103 in the floating bar and verify it disappears from selection and highlights.
* Click "Confirm Booking" to open the wizard.
* Verify Step 1 shows Room 101 with its individual dates, and that the statement estimate displays the individual prices and nights.

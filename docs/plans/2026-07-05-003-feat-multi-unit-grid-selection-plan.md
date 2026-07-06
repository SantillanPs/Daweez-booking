---
title: "Plan: Multi-Unit Grid Selection"
type: feat
date: 2026-07-05
origin: docs/brainstorms/2026-07-05-multi-unit-group-bookings-requirements.md
---

# Plan: Multi-Unit Grid Selection

## Goal Description
Implement the grid-based multi-room date selection flow on the timeline grid. When a front desk staff member selects check-in and check-out dates on a primary room, the grid enters a locked "Group Selection Mode" highlighting the columns across all rooms. Clicking any other room or venue row toggles that unit in/out of the selection (running real-time collision checks), with a floating bottom confirmation bar to proceed directly to the Walk-In Booking Form wizard.

## Proposed Changes

### Calendar Timeline & Selection Components

#### [MODIFY] [CalendarTab.tsx](src/components/CalendarTab.tsx)
- Add state for `groupSelection: { checkIn: Date; checkOut: Date; selectedIds: Set<string> } | null` to track active grid selections.
- Update the `handleCellClick` callback:
  - If `groupSelection` is active:
    - Toggle the clicked `id` in `groupSelection.selectedIds`.
    - If toggling *in*, perform a real-time availability check using `syncEngine` and block selection with a warning alert if a conflict exists.
    - Prevent deselecting the last remaining unit to keep the selection valid.
  - If `groupSelection` is inactive:
    - Click 1 sets `timelineSelection` (check-in).
    - Click 2 (establishing range) checks availability for the primary unit. If vacant, initializes `groupSelection` with the dates and initial unit ID, and clears `timelineSelection`.
- Render a floating confirmation bar fixed at the bottom center of the screen when `groupSelection` is active:
  - Displays selected unit count and formatted check-in/out dates.
  - Offers a "Cancel" action to clear the selection.
  - Offers a "Confirm Booking" action to set `formRoomIds` / `formVenueId` states and open the walk-in form wizard pre-filled with the dates and units.
- Pass `groupSelection` down as a prop to `<TimelineGrid />`.

---

#### [MODIFY] [TimelineGrid.tsx](src/components/calendar/TimelineGrid.tsx)
- Update `TimelineGridProps` and `TimelineCellProps` to receive `groupSelection` context.
- Highlight cells that fall within the locked date range (`date >= checkIn && date < checkOut`) for any room/venue present in `groupSelection.selectedIds`.
- Render highlighted empty cells with a distinct background (golden/champagne tint: `bg-amber-50/70 border-y border-amber-200/50`) to visually represent the selected stay blocks.
- Update `TimelineCell`'s `React.memo` comparator to ensure cells re-render correctly when their selection highlight status changes.

## Verification Plan

### Automated Tests
- Run `npm run build` to verify type safety and Vite compilation success.

### Manual Verification
- Go to the Calendar tab.
- Click a check-in date and check-out date on a room (e.g., Room 101, July 10 to July 12).
- Verify the grid enters Group Selection Mode, highlighting the range and showing the floating confirmation bar at the bottom.
- Click other room rows (e.g. Room 102, Room 103) and verify they toggle in/out.
- Try clicking an occupied room row during those dates and verify it blocks selection and displays a conflict warning.
- Click "Confirm Booking" and verify the Walk-In Booking Form opens with all toggled rooms pre-selected.
- Click "Cancel" on the floating bar and verify the active selection highlights are cleared.

---
date: 2026-07-05
topic: multi-unit-group-bookings
---

# Requirements: Multi-Unit Group Bookings

## Summary
Provide a grid-based multi-unit date selection flow on the timeline grid, enabling staff to select individual date ranges for multiple rooms/venues sequentially, and confirm them to launch a single Walk-In Booking Form wizard for a shared guest.

---

## Problem Frame
Allow front desk staff to book multiple rooms and event venues simultaneously in a single walk-in booking flow, even if the guest needs different check-in and check-out dates for different units. This eliminates the need to manually repeat guest details, contact entries, and companion registrations for group reservations, improving booking speed and reducing data entry errors.

---

## Key Decisions

* **Per-Unit Date Ranges on Grid**: Instead of a locked global date range, each room or venue selected on the timeline grid has its own check-in and check-out dates.
* **Sequential Grid Selection (2 Clicks per Unit)**: Clicking check-in then check-out on a room establishes the date range for that room. Clicking check-in then check-out on a subsequent room adds it with its own range.
* **Accumulating Selection Bar**: A floating bar at the bottom center displays the list of currently selected rooms with their individual date ranges and a button to confirm the group booking.
* **Soft Warning on Overlap**: If a selected range conflicts with an existing booking, a warning is displayed to the staff. Staff can decide whether to skip the room or adjust the dates.

---

## Actors
* **Front Desk Staff**: Accesses the timeline dashboard and registers walk-in guests or records off-platform bookings.

---

## Key Flows

### F1. Sequential Multi-Unit Selection
* **Trigger**: Staff clicks a vacant cell on any room or venue row.
* **Steps**:
  1. **Click 1**: Set check-in date for the target room.
  2. **Click 2**: Set check-out date for the target room.
  3. The room's selected range is highlighted on the grid, and the room is added to the active selection list in the bottom floating bar.
  4. Repeat steps 1–3 for any additional rooms/venues.
  5. **Confirm**: Staff clicks "Confirm Booking" in the floating bar.

### F2. Conflict Resolution
* **Trigger**: Staff selects a range that overlaps with an existing booking on a room.
* **Steps**:
  1. System displays a warning: "Room [X] is already booked during [Dates]."
  2. Staff can choose to adjust their date selection or remove the room from the active selection.

### F3. Booking Wizard Pre-Fill
* **Trigger**: Staff clicks "Confirm Booking" on the floating selection bar.
* **Steps**:
  1. The Walk-In Booking Form wizard opens.
  2. Step 1 of the wizard displays the list of selected units, each showing its individual check-in and check-out dates.
  3. Guest contact details are entered once.
  4. On final submission, the system writes a single combined booking invoice and saves individual booking records for each unit.

---

## Requirements

### Grid Interaction
* R1. Clicking a vacant cell starts a room-specific date range selection if no selection is active on that room.
* R2. The second click on the same room row establishes the check-out date, locking the date range for that specific room and highlighting it.
* R3. Selecting a check-out date that is before the check-in date is blocked.
* R4. Hovering over cells during active room selection shows a draft highlighted preview of the range.

### Selection Management
* R5. The bottom floating bar must display all currently selected units, showing the unit name and its chosen check-in/check-out dates.
* R6. Clicking the remove (trash or 'x') icon next to a unit in the floating bar removes that unit from the active selection.
* R7. Selecting a range that overlaps with an existing booking triggers a visible conflict warning but does not automatically clear the entire selection.

### Wizard Integration
* R8. Step 1 of the booking form must render the list of selected units with their individual check-in/check-out dates.
* R9. The booking wizard must accept a set of selected units and their respective dates, pre-populating them into the booking form.
* R10. A single guest contact profile must cover all selected units in the created booking session.

---

## Scope Boundaries
* **Shared Reference**: Selected units are linked under a single booking group/invoice for the guest, sharing a guest contact profile and transaction.
* **Independent Dates**: Each unit maintains its own check-in/check-out timestamps in the database, allowing fully staggered stays under a single group booking.

---

## Acceptance Examples

### AE1: Group Staggered Booking
* **Input**:
  * Guest: John Doe (`john@example.com`, `0917-123-4567`)
  * Selected units:
    * Room 101: 2026-07-16 to 2026-07-19 (3 nights)
    * Room 103: 2026-07-17 to 2026-07-19 (2 nights)
    * Room 105: 2026-07-16 to 2026-07-17 (1 night)
* **Outcome**:
  * Three bookings created under a single transaction:
    1. **Booking 1**: Room 101, John Doe, 2026-07-16 to 2026-07-19.
    2. **Booking 2**: Room 103, John Doe, 2026-07-17 to 2026-07-19.
    3. **Booking 3**: Room 105, John Doe, 2026-07-16 to 2026-07-17.
  * Grid rendering: Each room row displays its specific occupied block corresponding to its dates.

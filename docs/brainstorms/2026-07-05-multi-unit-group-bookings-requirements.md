# Requirements: Multi-Unit Group Bookings

## Purpose
Allow front desk staff to book multiple rooms and event venues simultaneously in a single walk-in booking flow. This eliminates the need to manually repeat contact entries, guest details, and companion registrations for group reservations, improving booking speed and reducing data entry errors.

---

## Actors
* **Front Desk Staff**: Accesses the timeline dashboard and registers walk-in guests or records off-platform bookings.

---

## Key Flows

### 1. Multi-Unit Wizard Activation
* When staff selects check-in and check-out dates on the Timeline Grid for any room or venue, the dashboard opens the Walk-In Booking Form wizard.
* The wizard initializes with the selected dates and pre-selects the clicked room or venue.
* The pathway is now unified: rather than selecting *either* Rooms *or* Venues, the wizard shows both selection areas side-by-side or stacked in Step 1.

### 2. Multi-Unit Selection
* The staff can toggle checkbox chips to select any combination of:
  * **Rooms**: Room 1 through Room 10.
  * **Event Venues**: Gazebo, Vacation House, Garden Area.
* Only rooms and venues that are fully vacant/available during the selected dates can be toggled on. Colliding units render as disabled and line-through.

### 3. Step-by-Step Contextual Customization
* **Step 2 (Amenities & Add-ons)**:
  * If at least one room is selected: Show the Breakfast Orders config panel.
  * If at least one venue is selected: Show the Equipment Rentals and Event Add-ons config panel.
* **Step 3 (Billing Summary)**:
  * Lists all selected rooms and venues with their respective rates.
  * Displays the total sum of stays, breakfast, rentals, and event add-ons.
  * Shows the group's downpayment (50% of total) and balance due (50% + add-ons/rentals + per-unit security deposits).

### 4. Group Checkout & Transaction Execution
* On submission, the system validates availability for all selected units.
* The system creates independent `Booking` records for each selected unit:
  * Room bookings store the guest details, companions, and breakfast orders.
  * The first venue booking stores the guest details, equipment rentals, and event add-ons (subsequent venue bookings, if any, do not duplicate rentals/addons to prevent double-charging).
  * Each created booking receives a flat ₱500 security deposit as part of its balance.

---

## Behavioral Constraints
* **Check-out sequence**: `check_in` must be chronologically earlier than `check_out` (`check_in < check_out`).
* **Availability validation**: A double-booking collision check must run for all selected units before saving. If any unit fails, the entire transaction is rolled back or blocked, displaying an error.
* **Minimum unit constraint**: At least one room or venue must be selected to proceed with the booking.

---

## Non-Goals / Scope Boundaries
* **Shared Reservation Reference**: Group bookings will be linked by sharing identical guest details (name, email, phone) and dates, rather than creating a new database-level group/parent table entity. No schema migrations are required.
* **Split Dates in Group**: All units selected in a single wizard submission share the same check-in and check-out dates. Staff wishing to book different dates for different rooms must create separate reservations.

---

## Acceptance Examples

### AE1: Multi-Room & Venue Combo Booking
* **Input**:
  * Guest: John Doe (`john@example.com`, `0917-123-4567`)
  * Stay: 2026-07-10 to 2026-07-12 (2 nights)
  * Selected units: Room 1, Room 2, and Gazebo.
  * Add-ons: 10 Breakfast logs, 5 Big Tables, Full Band & Lights.
* **Outcome**:
  * Three bookings created:
    1. **Booking 1**: Room 1, John Doe, check-in 2026-07-10, check-out 2026-07-12, breakfast orders attached, ₱500 security deposit.
    2. **Booking 2**: Room 2, John Doe, check-in 2026-07-10, check-out 2026-07-12, breakfast orders attached, ₱500 security deposit.
    3. **Booking 3**: Gazebo, John Doe, check-in 2026-07-10, check-out 2026-07-12, equipment rentals (5 tables) and event addons (Full Band & Lights) attached, ₱500 security deposit.
  * Grid rendering: Room 1 row, Room 2 row, and Gazebo row show the respective occupied blocks for John Doe.

---
date: 2026-07-05
topic: timeline-unification-and-navigation
---

# Unified Timeline Grid & Date Navigation Requirements

## Summary
The hotel booking scheduler will be simplified by deprecating the Month Calendar View and consolidating all scheduling workflows into a unified Timeline Grid. The timeline view will feature rooms and event venues in one vertical table, upgraded navigation controls (month-level chevron offsets and a direct date picker), and a spanned month/year header.

---

## Problem Frame
The current dashboard scheduler implements two distinct interfaces—a monthly grid and a horizontal timeline—which requires users to toggle views to manage different booking workflows. The monthly calendar is used primarily for date jumping and year tracking rather than detailed room assignment. Additionally, event venues (such as the Gazebo, Vacation House, and Garden Area) are displayed on the Month View but missing from the Timeline Grid, forcing a disjointed workflow when managing venue reservations.

---

## Key Decisions

* **Unified Timeline Grid**: Both room units and event venues are listed as rows in a single scheduling view. This eliminates the need for separate calendar tabs and provides unified visibility of all resort bookings.
* **Month View Deprecation**: The month-level grid layout is completely removed from the dashboard. Date navigation efficiency is instead recovered by adding dedicated date-jumping controls directly to the timeline toolbar.

---

## Requirements

### UI Simplification & Deprecation
* R1. The Month View toggle buttons and references shall be removed from the scheduler dashboard in `src/components/CalendarTab.tsx`.
* R2. The Month View component files `src/components/calendar/MonthGridView.tsx` and `src/components/calendar/DayPreviewPanel.tsx` shall be deleted from the codebase.

### Timeline Toolbar & Navigation
* R3. The navigation controls in the timeline toolbar shall support month-level chevrons (`<<` and `>>`) shifting the start date backward or forward by 30 days.
* R4. The navigation controls in the timeline toolbar shall support week-level chevrons (`<` and `>`) shifting the start date backward or forward by 7 days.
* R5. A gold-styled date picker input element shall be embedded in the toolbar to jump directly to any user-selected start date.
* R6. The toolbar header shall display the spanned month(s) and year represented in the active 30-day timeline range (e.g., "July - August 2026").

### Venue Unification
* R7. Event Venues (Gazebo, Vacation House, Garden Area) shall be rendered as rows at the bottom of the Timeline Grid, styled distinctly from room units.
* R8. Clicking a timeline cell on a venue row shall start a date selection flow that pre-fills the check-in date, check-out date, and selected venue ID, opening the booking wizard in the venue pathway.
* R9. Double-booking check-in/out overlaps on venue rows shall trigger the same validation and error modal workflows as room bookings.

---

## Scope Boundaries

### Deferred for later
* **Hourly venue scheduling**: Venue bookings will continue to be allocated on day-level slots to maintain consistency with the existing database schema.
* **Filter toggles**: Toggling between Rooms-only or Venues-only timeline rows is deferred; all units will display in one flat list.

### Outside this product's identity
* **External channel syncing for venues**: External calendar feed imports (e.g., Airbnb, Booking.com) apply only to room units; venues remain manually booked.

---

## Dependencies / Assumptions
* The existing Supabase and localStorage tables for rooms, venues, and bookings remain unchanged.
* Spanning ranges across months handles leap years and variable month lengths based on JavaScript native UTC date helpers.
